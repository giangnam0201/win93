"""
Push large git repo to GitHub in tiny batches.
Properly clears the git index before re-batching.
"""
import subprocess
import sys
import time
import os

BATCH_SIZE = 100
REMOTE = "origin"
BRANCH = "master"

def run(cmd, check=True):
    result = subprocess.run(
        cmd, shell=True, capture_output=True,
        text=True, encoding="utf-8", errors="replace"
    )
    out = (result.stdout + result.stderr).strip()
    if out:
        print(out)
    if check and result.returncode != 0:
        print(f"[ERROR] exit={result.returncode}: {cmd}")
        sys.exit(result.returncode)
    return result

def push_with_retry(force=False, retries=5, delay=20):
    cmd = f"git push --no-thin {REMOTE} {BRANCH}"
    if force:
        cmd += " --force"
    for attempt in range(1, retries + 1):
        r = subprocess.run(
            cmd,
            shell=True, capture_output=True,
            text=True, encoding="utf-8", errors="replace"
        )
        out = (r.stdout + r.stderr).strip()
        print(out)
        if r.returncode == 0 or "Everything up-to-date" in out:
            return
        print(f"  [retry {attempt}/{retries}] waiting {delay}s...")
        time.sleep(delay)
    print("[FATAL] Push failed after all retries.")
    sys.exit(1)

# 1. Get full file list from working tree
print("=== Collecting all files ===")
tracked = run("git ls-files").stdout.splitlines()
untracked = run("git ls-files --others --exclude-standard").stdout.splitlines()
all_files = sorted(list(set([f.strip() for f in tracked + untracked if f.strip()])))
print(f"Total files: {len(all_files)}")

# 2. Destroy HEAD and CLEAR the index completely
print("\n=== Resetting HEAD and clearing index ===")
run("git update-ref -d HEAD", check=False)
run("git read-tree --empty")   # clears the index
print("Index cleared.")

# 3. Configure git for efficient small pushes
run("git config http.postBuffer 52428800")    # 50MB
run("git config pack.windowMemory 10m")
run("git config pack.packSizeLimit 20m")
run("git config pack.threads 1")

total_batches = (len(all_files) + BATCH_SIZE - 1) // BATCH_SIZE
print(f"\n=== {len(all_files)} files -> {total_batches} batches of {BATCH_SIZE} ===\n")

LIST_FILE = "_batch_files.txt"

for batch_num, i in enumerate(range(0, len(all_files), BATCH_SIZE), start=1):
    batch = all_files[i : i + BATCH_SIZE]
    print(f"[{batch_num}/{total_batches}] Adding {len(batch)} files...")

    with open(LIST_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(batch))

    run(f'git add --pathspec-from-file="{LIST_FILE}"')

    # Verify something is staged
    diff = run("git diff --cached --stat")
    if not diff.stdout.strip():
        print(f"  [SKIP] nothing new")
        continue

    run(f'git commit -m "batch {batch_num}/{total_batches}: {len(batch)} files"')

    print(f"  Pushing...")
    push_with_retry(force=(batch_num == 1))
    print(f"  [OK] batch {batch_num}/{total_batches}")
    time.sleep(1)

if os.path.exists(LIST_FILE):
    os.remove(LIST_FILE)

print("\n[DONE] All pushed!")
run("git log --oneline")
