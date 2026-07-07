# Windows 93 Offline Version

This project is a fully offline, self-hosted version of Windows 93 (v3) built off `https://www.windows93.net/`.

---

## 🚀 How to Run

1. **Start the local server:**
   Double-click the **[start.bat](file:///C:/Users/Nam/Downloads/win93/start.bat)** file.
   *This launches the Python server and automatically opens the browser.*

2. **Access URL:**
   Open your browser to: **[http://localhost:8093/](http://localhost:8093/)**

---

## 🛠️ Implemented Features

### 📴 1. Complete Offline & On-Demand Caching Proxy
* **Dynamic Mirroring:** If the local server (`server.py`) cannot find a requested file on disk (like retro ROMs, system scripts, animations, or styles), it automatically downloads it from `https://www.windows93.net/`, caches it locally to disk, and serves it.
* **Instant Boot:** By avoiding upfront download of all 86,000+ emulator ROMs and assets, the server boots instantly. Files are cached permanently as you use the OS, saving space.

### 📥 2. Upfront CBOR Crawler (For APK & GitHub Pages Deployments)
* For static hosting platforms (like GitHub Pages) or WebView packaging (like Android APK) where no backend Python server is running, all files must exist locally on disk.
* The crawler script **[traverse_cbor_download.py](file:///C:/Users/Nam/Downloads/win93/traverse_cbor_download.py)** decodes the binary file index (`files.cbor`) and downloads all 90,656 virtual filesystem entries in parallel using a thread pool.
* **Special Characters Support:** Implemented URL encoding (`urllib.parse.quote`) to correctly fetch files containing spaces, brackets, or parentheses (e.g. game ROMs).

### 🌐 3. Transparent CORS Proxy Bypass
* **Service Worker Interceptor:** Patched **[42.sw.js](file:///C:/Users/Nam/Downloads/win93/42.sw.js)** and **[42.sw.bundle.js](file:///C:/Users/Nam/Downloads/win93/42.sw.bundle.js)**. When any app or iframe inside Windows 93 requests an external URL (e.g. `fetch("https://some-api.com")`), the request is intercepted and transparently routed through our local server at `/proxy?url=...`.
* **CORS Proxy Server:** Added `/proxy` endpoint handler in **[server.py](file:///C:/Users/Nam/Downloads/win93/server.py)**. The server retrieves the request, copies headers, performs the HTTP/HTTPS request, and forwards the response.
* **Same-Origin Response:** Since the browser fetches from `/proxy` (which is on the same origin `localhost:8093`), **CORS is completely bypassed**!

---

## 📂 Project Structure

* **[server.py](file:///C:/Users/Nam/Downloads/win93/server.py)**: Python server handling routing, custom MIME-types, security headers, on-demand caching, and the CORS proxy.
* **[traverse_cbor_download.py](file:///C:/Users/Nam/Downloads/win93/traverse_cbor_download.py)**: CBOR file crawler that downloads the entire Windows 93 filesystem in parallel.
* **[start.bat](file:///C:/Users/Nam/Downloads/win93/start.bat)**: Double-click launcher for Windows.
* **[42/](file:///C:/Users/Nam/Downloads/win93/42)**: System42 core filesystem (extracted from `42.tar.gz`).
* **[bios/](file:///C:/Users/Nam/Downloads/win93/bios)**: Windows 93 BIOS and boot files.
* **[42.sw.js](file:///C:/Users/Nam/Downloads/win93/42.sw.js)**: Modified service worker code.
* **[42.sw.bundle.js](file:///C:/Users/Nam/Downloads/win93/42.sw.bundle.js)**: Modified minified service worker bundle.
* **[42.tar.gz](file:///C:/Users/Nam/Downloads/win93/42.tar.gz)**: System42 archive bundle.
* **[index.html](file:///C:/Users/Nam/Downloads/win93/index.html)**: Main OS entry point.
