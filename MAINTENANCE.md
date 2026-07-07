# Windows 93 Offline — AI Maintenance Guide

> **For AI agents and developers:** This document explains the architecture of this patched offline build of [windows93.net](https://www.windows93.net/), what was modified and why, and exactly what to do when the upstream site updates and things break.

---

## 🗺️ Quick Architecture Overview

```
win93/
├── index.html              ← Main entry point (patched: core.js path made relative)
├── bios/
│   ├── bios.js             ← Reads timestamps.json, sets up version flags
│   └── boot.js             ← PATCHED: navigator.onLine checks removed for offline boot
├── 42/                     ← System42 core OS (extracted from 42.tar.gz)
├── 42.tar.gz               ← Archive of System42 (browser extracts this into CacheStorage on boot)
├── 42.sw.js                ← PATCHED: Service worker — cross-origin requests return mock responses
├── 42.sw.bundle.js         ← PATCHED: Minified version of 42.sw.js
├── 42.system.js            ← System42 bundle
├── files.cbor              ← Binary index of ALL virtual filesystem paths (~90,000 entries)
├── apps.cbor               ← App registry
├── c/                      ← Virtual filesystem root
│   ├── programs/           ← All installed apps (scrapers, emulators, games)
│   ├── libs/               ← Shared libraries (animate.css, retroarch cores, etc.)
│   └── users/windows93/    ← User profile (desktop shortcuts, themes, sounds, ROMs)
├── server.py               ← Python caching proxy server (for local Windows use)
├── main.js                 ← Electron entry point (for Windows .exe build)
├── package.json            ← Electron + electron-builder config
├── credits.html            ← Credits page (patched: offline patch credits added)
└── .github/workflows/      ← CI/CD workflows
    ├── pages.yml           ← Deploy to GitHub Pages
    ├── windows.yml         ← Build Windows .exe via Electron
    └── android.yml         ← Build Android APK via Cordova
```

---

## 🔧 What Was Patched and Why

### 1. `42.sw.js` + `42.sw.bundle.js` — Service Worker CORS Bypass

**Problem:** Windows 93 apps (IE6 browser, shop, etc.) make cross-origin `fetch()` calls. Browsers block these with CORS errors.

**Fix:** In the `fetch` event listener, added a block that intercepts any request where `origin !== location.origin` and returns an immediate local mock response with permissive CORS headers instead of making a real network call.

```js
// Line ~143 in 42.sw.js
if (origin !== location.origin) {
  e.respondWith((async () => {
    const headers = new Headers({
      "Access-Control-Allow-Origin": "*",
      // ...
    });
    if (req.url.includes("shop.windows93.net")) {
      return new Response(JSON.stringify([]), { headers }); // mock shop as empty
    }
    return new Response("", { status: 200, headers }); // all other cross-origin = empty 200
  })());
  return;
}
```

**When upstream updates:** If `42.sw.js` is updated by the Windows 93 team, re-apply this patch after the `if (origin !== location.origin) {` line. **Do NOT use any external proxy service** (corsproxy.io, allorigins, etc.) — they require internet access. The mock response approach is the only truly offline solution.

---

### 2. `bios/boot.js` — Offline Boot

**Problem:** The original boot sequence checks `navigator.onLine` and only fetches+extracts `42.tar.gz` if online, causing the OS to fail to boot offline.

**Fix:** Replaced the online guard so the boot always proceeds with fetching/extracting `42.tar.gz` from the local server.

**When upstream updates:** Re-check `bios/boot.js` for any new `navigator.onLine` or `fetch("https://...")` calls. All fetches must point to relative local paths.

---

### 3. `server.py` — On-Demand Caching Proxy

**Purpose:** A multithreaded Python HTTP server on port `8093` that:
- Serves all local static files with correct MIME types
- Sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` headers (required for `SharedArrayBuffer` / WASM emulators)
- **On cache miss:** fetches the missing file from `https://www.windows93.net/`, saves it to disk permanently, then serves it
- Routes `/proxy?url=...` requests for same-origin CORS bypass (used by apps when running locally)

**Key bug fixed:** URL paths must be `urllib.parse.unquote()`'d before calling `os.path.isfile()` — otherwise files with spaces (e.g., `Windows 93/DING.WAV`) fail the existence check even though they exist on disk.

---

### 4. `index.html` — Relative Path Fix

Changed `src="/42/core.js"` → `src="./42/core.js"` so the app works when served from a GitHub Pages subfolder (`username.github.io/win93/`) instead of a root domain.

---

### 5. `credits.html` — Offline Patch Credits

Added a section at the bottom crediting the offline patch and listing what was modified.

---

## 🚨 When Windows 93 Updates — Step-by-Step Fix Guide

When `https://www.windows93.net/` pushes an update, some things may break. Here's how to diagnose and fix:

### Step 1: Check what changed upstream

```bash
# Download fresh copies of the key files
curl -o 42.sw.js.new https://www.windows93.net/42.sw.js
curl -o boot.js.new https://www.windows93.net/bios/boot.js
curl -o files.cbor.new https://www.windows93.net/files.cbor
```

Compare them against the patched local versions with `diff`.

### Step 2: Re-apply service worker patch

Open the new `42.sw.js`, find:
```js
if (origin !== location.origin) {
```
Replace the block's body with the mock-response handler (see patch above). Do the same in `42.sw.bundle.js` — find the minified equivalent and replace it.

### Step 3: Re-apply boot patch

Open `bios/boot.js`, find any code gated on `navigator.onLine` and remove those guards.

### Step 4: Re-download new/changed assets

If `files.cbor` changed (new files were added), run:

```bash
python download_essential_assets.py
```

This script (if present) downloads only the essential non-ROM files (~14,750 files). If it doesn't exist, recreate it from the pattern in the git history — it reads `files.cbor`, skips `c/users/windows93/music/`, `roms/`, `pictures/`, `documents/`, `videos/`, and downloads everything else in parallel with 32 workers.

### Step 5: Re-run the app and check browser console

Open `http://localhost:8093/` and check for `404 (File not found)` errors. Each one is a file you need to either:
- Download manually from `https://www.windows93.net/<path>`
- Or let the caching proxy (`server.py`) fetch it automatically on first request

### Step 6: Re-build and redeploy

```bash
git add -A && git commit -m "chore: re-patch for windows93 vX.X.X update"
git push origin main
```

GitHub Actions will auto-rebuild and redeploy GitHub Pages + Windows EXE + Android APK.

---

## 📦 Build Outputs

| Target | Output | How |
|---|---|---|
| **GitHub Pages** | Static site at `https://giangnam0201.github.io/win93/` | Push to `main` branch |
| **Windows EXE** | `WINDOWS93-Setup.exe` portable | GitHub Actions → electron-builder |
| **Android APK** | `win93.apk` | GitHub Actions → Cordova + Android SDK |

---

## 🐛 Common Issues & Fixes

| Symptom | Cause | Fix |
|---|---|---|
| "File Index incorrect state" dialog on boot | IndexedDB was corrupted (from a crash or server restart mid-load) | Click OK to reset, then hard-refresh (`Ctrl+F5`) |
| Files load slowly / lots of CACHE MISS logs | Files not yet downloaded locally | Let server.py cache them on-demand, or run the downloader |
| `ERR_EMPTY_RESPONSE` on `/files.cbor` | Server crashed before sending headers | Check server.py is running; `guess_type()` must return string not tuple |
| `BOOT.ogg` / `DING.WAV` 404 | Sound files have spaces in paths, URL not decoded | `server.py` path must call `urllib.parse.unquote()` before `os.path.isfile()` |
| Cross-origin fetch blocked by browser | Service worker patch not applied / SW not updated | Hard-refresh page to force SW reinstall, check 42.sw.js patch is in place |
| `42_DEV/dev.js` 404 | Dev-mode file doesn't exist in production — harmless | Ignore, this is expected |

---

## 🔑 Key File Locations

| File | Purpose |
|---|---|
| `files.cbor` | Binary-encoded CBOR dictionary of ALL virtual filesystem entries |
| `apps.cbor` | Registry of all installable apps |
| `42.tar.gz` | System42 archive, extracted into browser CacheStorage on boot |
| `timestamps.json` | Version timestamps checked by bios.js on startup |
| `c/users/windows93/desktop/*.desktop` | Desktop shortcut definitions |
| `c/users/windows93/interface/` | UI sounds, icons, fonts, themes |
| `c/programs/` | All application code |
| `c/libs/` | Shared libraries (RetroArch WASM cores, etc.) |
