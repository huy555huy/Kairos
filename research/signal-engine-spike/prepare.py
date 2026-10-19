"""Fetch the pinned upstream, apply capacity settings, build; Python is probe tooling."""
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parent
lock = json.loads((ROOT / "engine-lock.json").read_text())
checkout = ROOT / ".cache" / "ona"
checkout.parent.mkdir(exist_ok=True)
if not checkout.exists():
    subprocess.run(["git", "clone", lock["repository"], str(checkout)], check=True)
    subprocess.run(["git", "checkout", "--detach", lock["commit"]], cwd=checkout, check=True)
actual = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=checkout, text=True).strip()
if actual != lock["commit"]:
    raise SystemExit(f"Unexpected checkout: {actual}; preserve it and use a clean cache directory.")
config = checkout / "src/Config.h"
source = config.read_text()
for name, (old, new) in lock["config"].items():
    pattern = rf"(#define {name} )({old}|{new})\b"
    source, count = re.subn(pattern, lambda m: m[1] + str(new), source)
    assert count == 1, (name, count)
config.write_text(source)
with (checkout.parent / "build.log").open("w") as log:
    subprocess.run(["./build.sh"], cwd=checkout, stdout=log, stderr=subprocess.STDOUT, check=True)
print(checkout / "NAR")
