"""Resumable mirror of every file published in the WINDOWS93 file index."""
import argparse
import concurrent.futures
import json
import hashlib
import os
from pathlib import Path
import shutil
import threading
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
ORIGIN = 'https://www.windows93.net'
STOP = threading.Event()

def local_path(path):
    parts = path.lstrip('/').split('/')
    if os.name == 'nt' and (len(str(ROOT)) + len(path) > 230 or any(
        any(c in part for c in '<>:"\\|?*') or part.endswith((' ', '.'))
        or part.split('.')[0].upper() in {'CON', 'PRN', 'AUX', 'NUL', *(f'COM{i}' for i in range(1, 10)), *(f'LPT{i}' for i in range(1, 10))}
        for part in parts
    )):
        return ROOT / '.asset-cache' / hashlib.sha256(path.encode()).hexdigest()
    target = (ROOT / path.lstrip('/')).resolve()
    if not target.is_relative_to(ROOT):
        raise ValueError('Path outside mirror')
    return target

def download(path, overwrite=False):
    target = local_path(path)
    if target.is_file() and not overwrite:
        return 'existing', target.stat().st_size
    if STOP.is_set():
        return 'stopped', 0
    if shutil.disk_usage(ROOT).free < 1024**3:
        STOP.set()
        raise RuntimeError('Stopped to preserve 1 GB of free disk space; resume on a larger drive')
    for attempt in range(3):
        try:
            url = ORIGIN + urllib.parse.quote('/' + path.lstrip('/'), safe='/')
            with urllib.request.urlopen(url, timeout=45) as response:
                target.parent.mkdir(parents=True, exist_ok=True)
                temporary = target.with_name(target.name + '.download')
                with temporary.open('wb') as out:
                    shutil.copyfileobj(response, out)
                os.replace(temporary, target)
            return 'downloaded', target.stat().st_size
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)

def indexed_paths(index, prefix=''):
    for name, value in index.items():
        path = prefix + '/' + name
        if isinstance(value, dict):
            yield from indexed_paths(value, path)
        elif value == 0:
            yield path

def priority(path):
    if not path.startswith('/c/') or '/interface/' in path or '/config/' in path or '/desktop/' in path:
        return 0
    if path.startswith(('/c/libs/', '/c/programs/')):
        return 1
    if '/music/' in path or '/roms/' in path:
        return 3
    return 2

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workers', type=int, default=16)
    parser.add_argument('--core-only', action='store_true')
    args = parser.parse_args()
    os.chdir(ROOT)
    download('/files.cbor')
    # Use the project's own CBOR decoder, with no pip/npm dependency.
    import subprocess
    subprocess.run(['node', str(ROOT / 'tools/inspect-index.mjs')], check=True, stdout=subprocess.DEVNULL)
    index = json.loads((ROOT / 'file-index.json').read_text(encoding='utf-8'))
    paths = sorted(set(indexed_paths(index)) | {'/42.sw.js', '/42.sw.bundle.js', '/42.tar.gz'}, key=lambda p: (priority(p), p))
    if args.core_only:
        paths = [p for p in paths if priority(p) < 2]
    stats = {'total': len(paths), 'downloaded': 0, 'existing': 0, 'stopped': 0, 'bytes': 0, 'errors': {}}
    print(f'Mirroring {len(paths)} files with {args.workers} workers', flush=True)
    def save():
        (ROOT / 'mirror-report.json').write_text(json.dumps(stats, indent=2), encoding='utf-8')
    with concurrent.futures.ThreadPoolExecutor(args.workers) as pool:
        pending = {}
        iterator = iter(paths)
        def fill():
            while not STOP.is_set() and len(pending) < args.workers * 2:
                path = next(iterator, None)
                if path is None:
                    break
                pending[pool.submit(download, path)] = path
        fill()
        completed = 0
        last_report = time.monotonic()
        while pending:
            done, _ = concurrent.futures.wait(pending, return_when=concurrent.futures.FIRST_COMPLETED)
            for future in done:
                path = pending.pop(future)
                try:
                    result, size = future.result()
                    stats[result] += 1
                    stats['bytes'] += size
                except Exception as error:
                    stats['errors'][path] = str(error)
                completed += 1
            fill()
            if time.monotonic() - last_report > 15:
                save()
                print(f"{completed}/{len(paths)}; downloaded {stats['downloaded']}; errors {len(stats['errors'])}; {stats['bytes']/1024**3:.2f} GB", flush=True)
                last_report = time.monotonic()
    save()
    print(json.dumps({k: v if k != 'errors' else len(v) for k, v in stats.items()}), flush=True)
    if STOP.is_set() or stats['errors']:
        raise SystemExit(1)

if __name__ == '__main__':
    main()
