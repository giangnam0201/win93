# WINDOWS93 offline mirror

Start on Windows by double-clicking `start.cmd`, or run `python tools/server.py`.
Open **http://localhost:8093/**. Python 3.12 or later is recommended.
Opening `index.html` directly or using a generic static server will not provide the asset fallback.

The server serves local files first. Missing assets are fetched from
https://www.windows93.net and saved to disk for subsequent offline use.
Internet apps such as web radio still require their original live services.
The restored service worker preserves the virtual filesystem used by app iframes.

## Public website

The **Deploy WINDOWS93 apps to Pages** workflow restores the desktop, apps,
libraries, and interface assets from Releases into the published site.
It verifies file hashes and compresses large libraries to stay within the
GitHub Pages size limit. The service worker decompresses these files while
preserving their original URLs, MIME types, and range responses.
The complete media/ROM collection remains available in release archives;
it is larger than the public Pages site can hold.

Run `node tools/test-page-assets.mjs` to verify the compressed asset loader.

## Store the full collection on GitHub without filling the PC

Run the **Mirror all WINDOWS93 assets** workflow in the repository's Actions tab.
It downloads the committed `files.cbor` snapshot on GitHub runners, in 16 shards
with at most four concurrent jobs. Each job downloads a batch, packs release ZIPs,
uploads them, verifies their uploaded size, then deletes its temporary batch.
Large assets are stored in Releases rather than Git history. Every archive has
a SHA-256 manifest; each shard publishes a report of unavailable upstream files.
Rerunning resumes batches with completion receipts. A failed job is not a
complete mirror; inspect its `shard-report.json` and rerun after resolving errors.
Run `python tools/audit_releases.py` to check that every indexed asset belongs
to a completed uploaded batch. This produces `release-audit.json` and exits
with an error while any files or release archives are still missing.

## Restore assets for offline use

Install and sign into `gh`, then run:

```powershell
python tools/restore.py --core-only
```

This restores apps, libraries, desktop assets, and themes. For every media and ROM
asset too, use `python tools/restore.py` on a drive with sufficient free space.
It processes one release ZIP at a time, checks individual file SHA-256 hashes,
and removes each downloaded ZIP afterwards. Existing files are preserved.
Filenames unsupported by Windows are stored under `.asset-cache`; the local
server maps their original URLs to those files without renaming virtual entries.

Alternatively, `python tools/mirror.py --core-only` fetches core assets directly
from WINDOWS93. `mirror.cmd` fetches every indexed file. Both are resumable and
stop before consuming the last 1 GB of drive space. Node is needed only to decode
the CBOR file index using the project's bundled decoder.

To verify the disk copy without upstream fallback:

```powershell
python tools/server.py --offline --port 8094
```

Open http://localhost:8094/ in a fresh browser profile. Assets not yet mirrored
will return 404. Release storage alone does not make an incomplete disk copy
fully offline; restore the desired collection before disconnecting.
