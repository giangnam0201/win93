"""Check the public desktop's static ES-module dependency graph."""
from concurrent.futures import ThreadPoolExecutor
import gzip
import json
import re
import urllib.parse
import urllib.request

BASE = 'https://win93.namdev.online'
HEADERS = {'User-Agent': 'Mozilla/5.0'}
IMPORTS = re.compile(r'(?m)^\s*(?:import|export)\s+(?:[^;]*?\bfrom\s*)?["\x27]([^"\x27]+)["\x27]')

def read(path):
    with urllib.request.urlopen(urllib.request.Request(BASE + path, headers=HEADERS), timeout=30) as response:
        return response.read()

def main():
    manifest = json.loads(read('/asset-map.json'))
    seen, pending, failures = set(), {'/desktop.js', '/42.sw.js'}, {}
    def inspect(path):
        try:
            if path in manifest:
                body = gzip.decompress(read(urllib.parse.quote(manifest[path]['url'], safe='/')))
            else:
                body = read(urllib.parse.quote(path, safe='/?='))
            text = body.decode('utf-8-sig')
            text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
            text = re.sub(r'(?m)^\s*//.*$', '', text)
            return {urllib.parse.urljoin(path, dep) for dep in IMPORTS.findall(text) if dep.startswith(('.', '/'))}, None
        except Exception as error:
            return set(), str(error)
    with ThreadPoolExecutor(12) as pool:
        while pending:
            batch = sorted(pending - seen)
            pending = set()
            seen.update(batch)
            for path, (dependencies, error) in zip(batch, pool.map(inspect, batch)):
                if error:
                    failures[path] = error
                pending.update(dependencies - seen)
    print(json.dumps({'modules': len(seen), 'failures': failures}, indent=2))
    if failures:
        raise SystemExit(1)

if __name__ == '__main__':
    main()
