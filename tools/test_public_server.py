"""Serve the current code with the published gzip assets for browser checks."""
import sys
from http.server import ThreadingHTTPServer
from pathlib import Path
import urllib.request
from server import Handler

class TestHandler(Handler):
    def send_head(self):
        if self.path.split('?')[0] == '/asset-map.json' or self.path.split('?')[0].endswith('.gz'):
            try:
                request = urllib.request.Request('https://win93.namdev.online' + self.path, headers={'User-Agent':'Mozilla/5.0'})
                with urllib.request.urlopen(request, timeout=30) as response:
                    body = response.read()
                    self.send_response(response.status)
                    self.send_header('Content-Type', response.headers.get('Content-Type'))
                    self.send_header('Content-Length', len(body))
                    self.end_headers()
                    import io
                    return io.BytesIO(body)
            except Exception as error:
                self.send_error(502, str(error))
                return None
        return super().send_head()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8097
httpd = ThreadingHTTPServer(('127.0.0.1', port), TestHandler)
httpd.offline = False
print(f'Public gzip-asset validation: http://localhost:{port}/diagnostics.html', flush=True)
httpd.serve_forever()
