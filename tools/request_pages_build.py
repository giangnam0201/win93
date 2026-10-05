"""Request a Pages build, waiting for GitHub's shared token quota if needed."""
import json
import os
import subprocess
import time

for attempt in range(3):
    result = subprocess.run(
        ['gh', 'api', '--method', 'POST', f"repos/{os.environ['GITHUB_REPOSITORY']}/pages/builds"],
        capture_output=True, text=True,
    )
    if result.returncode == 0:
        print(result.stdout, flush=True)
        break
    if 'rate limit' not in (result.stdout + result.stderr).lower():
        raise SystemExit(result.stderr)
    quota = json.loads(subprocess.check_output(['gh', 'api', 'rate_limit'], text=True))
    delay = max(30, quota['resources']['core']['reset'] - time.time() + 15)
    print(f'GitHub quota exhausted; retrying Pages build in {int(delay)} seconds.', flush=True)
    time.sleep(delay)
else:
    raise SystemExit('GitHub Pages build still blocked by API quota after retries.')
