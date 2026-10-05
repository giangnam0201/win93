"""Check that every indexed file has a completed, uploaded release batch."""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
from mirror import ROOT, indexed_paths

def main():
    subprocess.run(['node', str(ROOT / 'tools/inspect-index.mjs')], check=True, stdout=subprocess.DEVNULL)
    expected = set(indexed_paths(json.loads((ROOT / 'file-index.json').read_text()))) | {'/42.sw.js', '/42.sw.bundle.js', '/42.tar.gz'}
    revision = hashlib.sha256((ROOT / 'files.cbor').read_bytes()).hexdigest()[:12]
    uploaded = set()
    errors = {}
    for shard in range(16):
        tag = f'assets-{revision}-{shard:02d}'
        result = subprocess.run(['gh', 'release', 'view', tag, '--repo', 'giangnam0201/win93', '--json', 'assets'], capture_output=True, text=True)
        if result.returncode:
            errors[tag] = 'Release missing'
            continue
        assets = {a['name']: a for a in json.loads(result.stdout)['assets']}
        with tempfile.TemporaryDirectory() as folder:
            receipts = [name for name in assets if name.endswith('-complete.json')]
            for name in receipts:
                subprocess.run(['gh', 'release', 'download', tag, '--repo', 'giangnam0201/win93', '--pattern', name, '--dir', folder], check=True, stdout=subprocess.DEVNULL)
                receipt = json.loads((Path(folder) / name).read_text())
                if receipt['errors'] or any(archive['name'] not in assets or assets[archive['name']]['size'] != archive['size'] for archive in receipt['archives']):
                    errors[tag + '/' + name] = 'Incomplete or missing archive'
                    continue
                uploaded.update(receipt['paths'])
        print(f'{tag}: {len(receipts)} complete batches', flush=True)
    missing = sorted(expected - uploaded)
    report = {'expected': len(expected), 'uploaded': len(uploaded & expected), 'missing': missing, 'errors': errors}
    (ROOT / 'release-audit.json').write_text(json.dumps(report, indent=2))
    print(f"{report['uploaded']}/{report['expected']} files in completed uploaded batches; {len(errors)} errors")
    if missing or errors:
        raise SystemExit(1)

if __name__ == '__main__':
    main()
