"""Record the public download links needed by the Pages app bundle."""
import hashlib
import json
import subprocess
from mirror import ROOT, indexed_paths
from restore import is_core

subprocess.run(['node', str(ROOT / 'tools/inspect-index.mjs')], check=True, stdout=subprocess.DEVNULL)
paths = sorted(set(indexed_paths(json.loads((ROOT / 'file-index.json').read_text(encoding='utf-8')))) | {'/42.sw.js', '/42.sw.bundle.js', '/42.tar.gz'})
revision = hashlib.sha256((ROOT / 'files.cbor').read_bytes()).hexdigest()[:12]
result = subprocess.run(['gh', 'api', 'repos/giangnam0201/win93/releases', '--paginate'], capture_output=True, text=True, check=True)
releases = {r['tag_name']: r for r in json.loads(result.stdout)}
shards = []
for shard in range(16):
    items = paths[shard::16]
    prefixes = {f'part-{offset // 128:04d}' for offset in range(0, len(items), 128) if any(is_core(p) for p in items[offset:offset + 128])}
    release = releases[f'assets-{revision}-{shard:02d}']
    shards.append([{'name': a['name'], 'url': a['browser_download_url'], 'size': a['size']} for a in release['assets'] if a['name'].endswith('.zip') and a['name'][:9] in prefixes])
(ROOT / 'tools/pages-assets.json').write_text(json.dumps({'revision': revision, 'shards': shards}, indent=2))
print(f'Catalog: {sum(len(s) for s in shards)} app archives; no receipt downloads needed')
