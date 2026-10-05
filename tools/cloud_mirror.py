"""Mirror a shard into release ZIPs, freeing each batch after a verified upload."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import shutil
import time
import urllib.parse
import urllib.request
import zipfile
from mirror import indexed_paths, ORIGIN, ROOT

def gh(*args, capture=False):
    for attempt in range(3):
        try:
            return subprocess.run(['gh', *args], check=True, text=True, stdout=subprocess.PIPE if capture else None).stdout
        except subprocess.CalledProcessError:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--shard', type=int, required=True)
    parser.add_argument('--shards', type=int, default=16)
    parser.add_argument('--repo', required=True)
    args = parser.parse_args()
    subprocess.run(['node', str(ROOT / 'tools/inspect-index.mjs')], check=True)
    index = json.loads((ROOT / 'file-index.json').read_text())
    paths = sorted(set(indexed_paths(index)) | {'/42.sw.js', '/42.sw.bundle.js', '/42.tar.gz'})[args.shard::args.shards]
    revision = hashlib.sha256((ROOT / 'files.cbor').read_bytes()).hexdigest()[:12]
    tag = f'assets-{revision}-{args.shard:02d}'
    try:
        release = json.loads(gh('release', 'view', tag, '--repo', args.repo, '--json', 'assets', capture=True))
    except subprocess.CalledProcessError:
        gh('release', 'create', tag, '--repo', args.repo, '--target', os.environ.get('GITHUB_SHA', 'main'), '--title', f'WINDOWS93 assets {revision}, shard {args.shard + 1}/{args.shards}', '--notes', 'Asset mirror from the committed files.cbor snapshot. Download and restore using tools/restore.py. Batch manifests include SHA-256 hashes; the shard report lists unavailable upstream files.')
        release = {'assets': []}
    existing = {a['name'] for a in release['assets']}
    summary = {'shard': args.shard, 'revision': revision, 'total': len(paths), 'archived': 0, 'resumed': 0, 'errors': {}}
    with tempfile.TemporaryDirectory(prefix='win93-batch-') as folder:
        temporary = Path(folder)
        for batch_number, offset in enumerate(range(0, len(paths), 128)):
            batch = paths[offset:offset + 128]
            base = f'part-{batch_number:04d}'
            completion = base + '-complete.json'
            if completion in existing:
                summary['resumed'] += len(batch)
                print(f'Resume: {base} already uploaded', flush=True)
                continue
            successes, errors = [], {}
            def fetch(path):
                destination = temporary / hashlib.sha256(path.encode()).hexdigest()
                for attempt in range(3):
                    try:
                        digest = hashlib.sha256()
                        size = 0
                        with urllib.request.urlopen(ORIGIN + urllib.parse.quote(path, safe='/'), timeout=60) as response, destination.open('wb') as out:
                            while block := response.read(1024 * 1024):
                                if shutil.disk_usage(temporary).free < 3 * 1024**3:
                                    raise RuntimeError('Runner disk reserve reached; reduce batch size')
                                size += len(block)
                                if size >= 1900 * 1024**2:
                                    raise ValueError('Individual asset exceeds GitHub release file limit')
                                digest.update(block)
                                out.write(block)
                        return {'path': path, 'sha256': digest.hexdigest(), 'size': size, 'temporary': destination}
                    except Exception:
                        if attempt == 2:
                            destination.unlink(missing_ok=True)
                            raise
                        time.sleep(attempt + 1)
            with ThreadPoolExecutor(4) as pool:
                futures = {pool.submit(fetch, p): p for p in batch}
                for future in as_completed(futures):
                    try:
                        successes.append(future.result())
                    except Exception as error:
                        errors[futures[future]] = str(error)
            successes.sort(key=lambda item: item['path'])
            # Split within a batch to keep every release asset below 2 GiB.
            groups, group, size = [], [], 0
            for item in successes:
                if group and size + item['size'] > 1024**3:
                    groups.append(group)
                    group, size = [], 0
                group.append(item)
                size += item['size']
            if group:
                groups.append(group)
            archives = []
            for number, group in enumerate(groups):
                archive = temporary / f'{base}-{number:02d}.zip'
                records = [{k: v for k, v in item.items() if k != 'temporary'} for item in group]
                with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_STORED, allowZip64=True) as out:
                    out.writestr('_mirror-manifest.json', json.dumps(records))
                    for item in group:
                        out.write(item['temporary'], item['path'].lstrip('/'))
                gh('release', 'upload', tag, str(archive), '--repo', args.repo, '--clobber')
                uploaded = json.loads(gh('release', 'view', tag, '--repo', args.repo, '--json', 'assets', capture=True))
                if not any(a['name'] == archive.name and a['size'] == archive.stat().st_size for a in uploaded['assets']):
                    raise RuntimeError('Uploaded archive size verification failed')
                with archive.open('rb') as stream:
                    archive_hash = hashlib.file_digest(stream, 'sha256').hexdigest()
                archives.append({'name': archive.name, 'sha256': archive_hash, 'size': archive.stat().st_size})
                archive.unlink()
            for item in successes:
                item['temporary'].unlink()
            summary['archived'] += len(successes)
            summary['errors'].update(errors)
            receipt = temporary / (base + ('-incomplete.json' if errors else '-complete.json'))
            receipt.write_text(json.dumps({'paths': batch, 'archives': archives, 'errors': errors}, indent=2))
            gh('release', 'upload', tag, str(receipt), '--repo', args.repo, '--clobber')
            receipt.unlink()
            print(f"Shard {args.shard}: {offset + len(batch)}/{len(paths)}; errors {len(summary['errors'])}", flush=True)
        report = temporary / 'shard-report.json'
        report.write_text(json.dumps(summary, indent=2))
        gh('release', 'upload', tag, str(report), '--repo', args.repo, '--clobber')
    if summary['errors']:
        raise SystemExit(f"{len(summary['errors'])} upstream files unavailable; see shard-report.json")

if __name__ == '__main__':
    main()
