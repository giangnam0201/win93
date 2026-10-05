import urllib.request
from concurrent.futures import ThreadPoolExecutor
def probe(p):
    try:
        r = urllib.request.urlopen(urllib.request.Request('https://www.windows93.net/'+p, method='HEAD'), timeout=30)
        print(p, r.status, r.headers.get('Content-Length'), flush=True)
    except Exception as e:
        print(p, str(e), flush=True)
with ThreadPoolExecutor(5) as pool:
    list(pool.map(probe, ['42.tar.gz', '42.sw.js', '42.sw.bundle.js', 'c.tar.gz', 'robots.txt']))
