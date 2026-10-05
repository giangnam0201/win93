"""Serve local assets first, downloading missing WINDOWS93 assets on demand."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import urllib.error
import urllib.parse
from mirror import ROOT, download, local_path

LOCKS = {}
GUARD = threading.Lock()

class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.cbor': 'application/cbor', '.json5': 'application/json'}
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'credentialless')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def translate_path(self, path):
        path = urllib.parse.unquote(urllib.parse.urlsplit(path).path)
        if path.endswith('/'):
            path += 'index.html'
        return str(local_path(path))

    def send_head(self):
        path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        if path.endswith('/'):
            path += 'index.html'
        if path.startswith(('/tools/', '/.git/', '/.codex/', '/.asset-cache/')):
            self.send_error(403)
            return None
        try:
            target = local_path(path)
            if target.relative_to(ROOT).parts[0] in {'.git', '.codex', 'tools'}:
                self.send_error(403)
                return None
            if not target.is_file() and not self.server.offline:
                with GUARD:
                    lock = LOCKS.setdefault(path, threading.Lock())
                with lock:
                    download(path)
        except urllib.error.HTTPError as error:
            self.send_error(error.code)
            return None
        except ValueError:
            self.send_error(403)
            return None
        except Exception as error:
            self.send_error(503, 'Asset unavailable locally and online')
            self.log_error('%s', error)
            return None
        self.extensions_map[''] = 'application/octet-stream'
        # Hashed Windows filenames retain the MIME type of their original URL.
        import mimetypes
        content_type = self.extensions_map.get(Path(path).suffix) or mimetypes.guess_type(path)[0] or 'application/octet-stream'
        self.guess_type = lambda _: content_type
        return super().send_head()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8093)
    parser.add_argument('--offline', action='store_true', help='Disable upstream fetching for offline verification')
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    server.offline = args.offline
    print(f'WINDOWS93: http://localhost:{args.port}/', flush=True)
    server.serve_forever()

if __name__ == '__main__':
    main()
