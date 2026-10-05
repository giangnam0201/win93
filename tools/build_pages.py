"""Build the public site from the archived desktop/app assets on a GitHub runner."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import gzip
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import zipfile
import urllib.request
from mirror import ROOT, indexed_paths
from restore import is_core

REPO = os.environ.get('GITHUB_REPOSITORY', 'giangnam0201/win93')
LIMIT = 950 * 1024**2

def gh(*args):
    arguments = ['gh', *args, '--repo', REPO]
    if args[:2] == ('release', 'download'):
        arguments.append('--clobber')
    for attempt in range(5):
        result = subprocess.run(arguments, capture_output=True, text=True)
        if result.returncode == 0:
            return result.stdout
        print(result.stderr, flush=True)
        if attempt == 4:
            result.check_returncode()
        time.sleep(2 ** (attempt + 1))

def main():
    output = ROOT / '_site'
    output.mkdir(exist_ok=True)
    # Build from tracked files so only reviewed source is deployed.
    tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    for path in tracked:
        if not path or path.startswith(('.github/', '.codex/', 'tools/')) or path in {'.gitignore', 'package.json', 'README.md', 'mirror.cmd', 'start.cmd'}:
            continue
        source = ROOT / path
        if source.is_file():
            destination = output / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, destination)
    (output / '.nojekyll').touch()
    # Every deployment must activate a new worker so downloaded modules cannot
    # hide updated startup code. Activation preserves the virtual filesystem.
    source_revision = os.environ.get('GITHUB_SHA')
    if source_revision:
        for name in ('42.sw.js', '42.sw.bundle.js'):
            worker = output / name
            worker.write_text(f'// Mirror build {source_revision}\n' + worker.read_text(encoding='utf-8'), encoding='utf-8')
    subprocess.run(['node', str(ROOT / 'tools/inspect-index.mjs')], check=True, stdout=subprocess.DEVNULL)
    index = json.loads((ROOT / 'file-index.json').read_text())
    required = {p for p in indexed_paths(index) if is_core(p)}
    revision = hashlib.sha256((ROOT / 'files.cbor').read_bytes()).hexdigest()[:12]
    total_bytes = sum(p.stat().st_size for p in output.rglob('*') if p.is_file())
    restored = set()
    catalog = json.loads((ROOT / 'tools/pages-assets.json').read_text())
    if catalog['revision'] != revision:
        raise SystemExit('Regenerate tools/pages-assets.json for the new file index')
    def restore_shard(shard):
        tag = f'assets-{revision}-{shard:02d}'
        assets = catalog['shards'][shard]
        with tempfile.TemporaryDirectory(prefix='win93-pages-') as directory:
            temporary = Path(directory)
            copied, size = set(), 0
            for asset in assets:
                name = asset['name']
                archive = temporary / name
                for attempt in range(8):
                    try:
                        # GitHub/CDN may cache a failing or expired redirect.
                        url = asset['url'] + f'?mirror={time.time_ns()}'
                        request = urllib.request.Request(url, headers={'User-Agent': 'WINDOWS93-Pages-Build'})
                        with urllib.request.urlopen(request, timeout=120) as source, archive.open('wb') as destination:
                            shutil.copyfileobj(source, destination)
                        if archive.stat().st_size != asset['size']:
                            raise ValueError('Release archive size mismatch')
                        break
                    except Exception as error:
                        print(f'Retrying {tag}/{name}: {error}', flush=True)
                        if attempt == 7:
                            raise
                        time.sleep(min(60, 2 ** (attempt + 1)))
                with zipfile.ZipFile(archive) as bundle:
                    records = json.loads(bundle.read('_mirror-manifest.json'))
                    for record in records:
                        path = record['path']
                        if not is_core(path):
                            continue
                        target = (output / path.lstrip('/')).resolve()
                        if not target.is_relative_to(output.resolve()):
                            raise ValueError('Archive path outside site')
                        copied.add(path)
                        if target.is_file():
                            continue
                        target.parent.mkdir(parents=True, exist_ok=True)
                        digest = hashlib.sha256()
                        with bundle.open(path.lstrip('/')) as source, target.open('wb') as destination:
                            while block := source.read(1024 * 1024):
                                destination.write(block)
                                digest.update(block)
                        if digest.hexdigest() != record['sha256']:
                            raise ValueError('Archive checksum mismatch: ' + path)
                        size += record['size']
                archive.unlink()
                print(f'Restored {tag}/{name}', flush=True)
            return copied, size
    with ThreadPoolExecutor(4) as pool:
        for copied, size in pool.map(restore_shard, range(16)):
            restored.update(copied)
            total_bytes += size
    missing = sorted(p for p in required if not (output / p.lstrip('/')).is_file())
    if missing:
        raise SystemExit('Required app assets missing from releases: ' + ', '.join(missing))
    # Pages cannot set Content-Encoding per file. Store beneficial gzip copies
    # and let the service worker restore their original bytes and MIME types.
    compressed = {}
    for source in (output / 'c').rglob('*'):
        if not source.is_file() or source.stat().st_size < 65536:
            continue
        original_size = source.stat().st_size
        body = gzip.compress(source.read_bytes(), compresslevel=6, mtime=0)
        if len(body) >= original_size * 0.85:
            continue
        path = '/' + source.relative_to(output).as_posix()
        destination = source.with_name(source.name + '.gz')
        destination.write_bytes(body)
        source.unlink()
        compressed[path] = {'url': path + '.gz', 'size': original_size}
        total_bytes -= original_size - len(body)
    (output / 'asset-map.json').write_text(json.dumps(compressed, separators=(',', ':')))
    total_bytes += (output / 'asset-map.json').stat().st_size
    if total_bytes > LIMIT:
        raise SystemExit(f'Compressed app bundle exceeds the Pages size budget: {total_bytes} bytes')
    report = {'revision': revision, 'source': os.environ.get('GITHUB_SHA'), 'files': len(required), 'bytes': total_bytes, 'compressed': len(compressed)}
    (output / 'deployment.json').write_text(json.dumps(report, indent=2))
    print(f"Ready to publish {len(required)} app assets; {total_bytes / 1024**2:.1f} MiB", flush=True)

if __name__ == '__main__':
    main()
