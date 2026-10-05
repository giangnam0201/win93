"""Build the public site from the archived desktop/app assets on a GitHub runner."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile
from mirror import ROOT, indexed_paths
from restore import is_core

REPO = os.environ.get('GITHUB_REPOSITORY', 'giangnam0201/win93')
LIMIT = 950 * 1024**2

def gh(*args):
    return subprocess.run(['gh', *args, '--repo', REPO], check=True, capture_output=True, text=True).stdout

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
    subprocess.run(['node', str(ROOT / 'tools/inspect-index.mjs')], check=True, stdout=subprocess.DEVNULL)
    index = json.loads((ROOT / 'file-index.json').read_text())
    required = {p for p in indexed_paths(index) if is_core(p)}
    revision = hashlib.sha256((ROOT / 'files.cbor').read_bytes()).hexdigest()[:12]
    total_bytes = sum(p.stat().st_size for p in output.rglob('*') if p.is_file())
    restored = set()
    def restore_shard(shard):
        tag = f'assets-{revision}-{shard:02d}'
        assets = json.loads(gh('release', 'view', tag, '--json', 'assets'))['assets']
        with tempfile.TemporaryDirectory(prefix='win93-pages-') as directory:
            temporary = Path(directory)
            gh('release', 'download', tag, '--pattern', '*-complete.json', '--dir', directory)
            selected = set()
            for receipt in temporary.glob('*-complete.json'):
                value = json.loads(receipt.read_text())
                if any(is_core(p) for p in value['paths']):
                    selected.update(a['name'] for a in value['archives'])
            copied, size = set(), 0
            for name in sorted(selected):
                gh('release', 'download', tag, '--pattern', name, '--dir', directory)
                archive = temporary / name
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
            if total_bytes > LIMIT:
                raise SystemExit(f'App bundle exceeds the Pages size budget: {total_bytes} bytes')
    missing = sorted(p for p in required if not (output / p.lstrip('/')).is_file())
    if missing:
        raise SystemExit('Required app assets missing from releases: ' + ', '.join(missing))
    report = {'revision': revision, 'files': len(required), 'bytes': total_bytes}
    (output / 'deployment.json').write_text(json.dumps(report, indent=2))
    print(f"Ready to publish {len(required)} app assets; {total_bytes / 1024**2:.1f} MiB", flush=True)

if __name__ == '__main__':
    main()
