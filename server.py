import http.server
import socketserver
import urllib.request
import urllib.error
import urllib.parse
import os
import sys
import webbrowser

PORT = 8093

# Map extensions to exact content types to avoid platform dependencies
MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.json5': 'application/json; charset=utf-8',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/sfnt',
    '.tar.gz': 'application/gzip',
    '.gz': 'application/gzip',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg'
}

class Windows93RequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Allow cross-origin requests and support cross-origin isolation (required for modern browser service workers and frame isolation)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD, PUT, DELETE')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'credentialless')
        super().end_headers()

    def do_OPTIONS(self):
        # Handle preflight CORS requests
        self.send_response(200)
        self.end_headers()

    def handle_proxy(self):
        # Extract target URL from query
        target_url = None
        if 'url=' in self.path:
            parts = self.path.split('url=', 1)
            if len(parts) > 1:
                target_url = urllib.parse.unquote(parts[1])
        
        if not target_url:
            self.send_error(400, "Missing url parameter in proxy request")
            return

        print(f"[CORS PROXY] Fetching target: {target_url}")
        
        # Read request body if present
        content_length = int(self.headers.get('Content-Length', 0))
        req_body = self.rfile.read(content_length) if content_length > 0 else None
        
        # Prepare outgoing headers
        outgoing_headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        # Copy original headers, skipping host/connection headers
        for k, v in self.headers.items():
            k_lower = k.lower()
            if k_lower not in ('host', 'connection', 'accept-encoding', 'content-length', 'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site'):
                outgoing_headers[k] = v

        try:
            req = urllib.request.Request(
                target_url, 
                data=req_body, 
                headers=outgoing_headers, 
                method=self.command
            )
            
            with urllib.request.urlopen(req) as response:
                status_code = response.getcode()
                res_body = response.read()
                
                self.send_response(status_code)
                # Copy response headers
                for k, v in response.getheaders():
                    k_lower = k.lower()
                    if k_lower not in ('access-control-allow-origin', 'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'transfer-encoding', 'content-encoding'):
                        self.send_header(k, v)
                
                self.end_headers()
                self.wfile.write(res_body)
                
        except urllib.error.HTTPError as e:
            # Handle HTTP errors from the target server by forwarding the response
            print(f"[CORS PROXY] HTTPError from target: {e.code}")
            try:
                err_body = e.read()
                self.send_response(e.code)
                for k, v in e.headers.items():
                    k_lower = k.lower()
                    if k_lower not in ('access-control-allow-origin', 'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'transfer-encoding', 'content-encoding'):
                        self.send_header(k, v)
                self.end_headers()
                self.wfile.write(err_body)
            except Exception as inner_e:
                self.send_error(e.code, str(e))
        except Exception as e:
            print(f"[CORS PROXY] Failed to fetch target: {e}")
            self.send_error(502, f"Bad Gateway (CORS proxy failed): {e}")

    def do_GET(self):
        # Route to proxy if path starts with /proxy
        if self.path.startswith('/proxy'):
            self.handle_proxy()
            return
        
        # Strip query string for static file lookup
        clean_path = self.path.split('?', 1)[0]
        clean_path = urllib.parse.unquote(clean_path)
        
        # If accessing the root, serve index.html
        if clean_path == '/' or clean_path == '':
            clean_path = '/index.html'
            
        local_path = clean_path.lstrip('/')
        # Resolve to current working directory
        full_path = os.path.join(os.getcwd(), local_path)
        
        # Check if file exists
        if os.path.isfile(full_path):
            self.send_response(200)
            
            # Determine content type
            _, ext = os.path.splitext(full_path.lower())
            content_type = MIME_TYPES.get(ext)
            if not content_type:
                content_type = self.guess_type(full_path)
                
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(os.path.getsize(full_path)))
            self.end_headers()
            
            # Write file contents
            with open(full_path, 'rb') as f:
                self.wfile.write(f.read())
        else:
            # File not found locally. Let's try to fetch it from windows93.net on-demand and cache it!
            if not clean_path.startswith('/proxy') and not clean_path.startswith('/.well-known'):
                print(f"[CACHE MISS] Fetching on-demand: {clean_path}")
                encoded_path = urllib.parse.quote(clean_path, safe='/')
                url = "https://www.windows93.net" + encoded_path
                try:
                    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req) as response:
                        if response.getcode() == 200:
                            # Create local directory structure
                            local_dir = os.path.dirname(full_path)
                            if local_dir and not os.path.exists(local_dir):
                                os.makedirs(local_dir, exist_ok=True)
                            
                            # Save to disk
                            data = response.read()
                            with open(full_path, 'wb') as f:
                                f.write(data)
                            print(f"[CACHE HIT] Saved and serving: {clean_path}")
                            
                            self.send_response(200)
                            _, ext = os.path.splitext(full_path.lower())
                            content_type = MIME_TYPES.get(ext)
                            if not content_type:
                                content_type = self.guess_type(full_path)
                            self.send_header('Content-Type', content_type)
                            self.send_header('Content-Length', str(len(data)))
                            self.end_headers()
                            self.wfile.write(data)
                            return
                except Exception as e:
                    print(f"[CACHE MISS FAIL] Could not fetch/cache {clean_path}: {e}")
            
            # File not found
            print(f"[404 NOT FOUND] {clean_path}")
            super().do_GET()

    def do_POST(self):
        if self.path.startswith('/proxy'):
            self.handle_proxy()
            return
        super().do_POST()

    def do_PUT(self):
        if self.path.startswith('/proxy'):
            self.handle_proxy()
            return
        self.send_error(405, "Method not allowed")

    def do_DELETE(self):
        if self.path.startswith('/proxy'):
            self.handle_proxy()
            return
        self.send_error(405, "Method not allowed")

# Set working directory to this script's directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

if __name__ == '__main__':
    handler = Windows93RequestHandler
    # Disable logging details for cleaner terminal, print custom messages instead
    # handler.log_message = lambda *args: None 
    
    print(f"==================================================")
    print(f"   Starting Offline Windows 93 Local Web Server   ")
    print(f"==================================================")
    print(f" Port: {PORT}")
    print(f" Local URL: http://localhost:{PORT}/")
    print(f" CORS Proxy Enabled at /proxy?url=...")
    print(f" Cross-Origin Isolated (COOP/COEP) Enabled")
    print(f" Press Ctrl+C to stop.")
    print(f"==================================================")
    
    # Automatically open local site in browser
    webbrowser.open(f"http://localhost:{PORT}/")
    
    try:
        with ThreadedHTTPServer(("", PORT), handler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping web server. Goodbye!")
        sys.exit(0)
