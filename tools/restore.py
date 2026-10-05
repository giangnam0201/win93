"""Restore release asset archives, checking SHA-256, one ZIP at a time."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile
from mirror import ROOT, local_path

def is_core(path):
    return path.startswith(('/42/', '/bios/', '/c/libs/', '/c/programs/')) or '/interface/' in path or '/desktop/' in path or '/config/' in path or path.count('/') == 1

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', default='giangnam0201/win93')
    parser.add_argument('--core-only', action='store_true', help='Restore desktop, apps, and libraries, excluding media collections')
    args = parser.parse_args()
    revision = hashlib.sha256((ROOT / 'files.cbor').read_bytes()).hexdigest()[:12]
    for shard in range(16):
        tag = f'assets-{revision}-{shard:02d}'
        result = subprocess.run(['gh', 'release', 'view', tag, '--repo', args.repo, '--json', 'assets'], check=True, capture_output=True, text=True)
        assets = json.loads(result.stdout)['assets']
        with tempfile.TemporaryDirectory(prefix='win93-restore-') as folder:
            selected = None
            if args.core_only:
                selected = set()
                receipts = [a for a in assets if a['name'].endswith('-complete.json')]
                if receipts:
                    subprocess.run(['gh', 'release', 'download', tag, '--repo', args.repo, '--pattern', '*-complete.json', '--dir', folder], check=True)
                for receipt_asset in receipts:
                    receipt = json.loads((Path(folder) / receipt_asset['name']).read_text())
                    if any(is_core(path) for path in receipt['paths']):
                        selected.update(archive['name'] for archive in receipt['archives'])
            for asset in sorted(assets, key=lambda item: item['name']):
                if not asset['name'].endswith('.zip'):
                    continue
                if selected is not None and asset['name'] not in selected:
                    continue
                if shutil.disk_usage(ROOT).free < asset['size'] + 1024**3:
                    raise SystemExit('Need more disk space for the next archive.')
                subprocess.run(['gh', 'release', 'download', tag, '--repo', args.repo, '--pattern', asset['name'], '--dir', folder], check=True)
                archive = Path(folder) / asset['name']
                with zipfile.ZipFile(archive) as bundle:
                    records = json.loads(bundle.read('_mirror-manifest.json'))
                    for record in records:
                        path = record['path']
                        if args.core_only and not is_core(path):
                            continue
                        target = local_path(path)
                        # Preserve startup fixes and existing local files.
                        if target.is_file():
                            continue
                        if shutil.disk_usage(ROOT).free < record['size'] + 1024**3:
                            raise SystemExit('Need more disk space. Restore onto a larger drive.')
                        target.parent.mkdir(parents=True, exist_ok=True)
                        temporary = target.with_name(target.name + '.restore')
                        digest = hashlib.sha256()
                        with bundle.open(path.lstrip('/')) as source, temporary.open('wb') as out:
                            while block := source.read(1024 * 1024):
                                digest.update(block)
                                out.write(block)
                        if digest.hexdigest() != record['sha256']:
                            temporary.unlink()
                            raise SystemExit('Checksum mismatch: ' + path)
                        os.replace(temporary, target)
                archive.unlink()
                print(f'Restored {tag}/{asset["name"]}', flush=True)

if __name__ == '__main__':
    main()
