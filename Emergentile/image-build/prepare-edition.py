#!/usr/bin/env python3
import argparse
import json
import re
import shutil
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("profile", type=Path)
parser.add_argument("--field")
parser.add_argument("--destination", type=Path)
args = parser.parse_args()

data = json.loads(args.profile.read_text(encoding="utf-8"))
defaults = {
    "os_name": "EmergentileGUI", "version": "1",
    "desktop_title": "EmergentileGUI-1", "accent": "#dc7655",
    "base_distribution": "trixie", "logo": "", "background": ""
}
data = {**defaults, **data}
if data["base_distribution"] not in ("bookworm", "trixie"):
    raise SystemExit("base_distribution must be bookworm or trixie")
if not re.fullmatch(r"#[0-9a-fA-F]{6}", str(data["accent"])):
    raise SystemExit("accent must be a six-digit hex color")

slug = re.sub(r"[^a-z0-9]+", "-", str(data["os_name"]).lower()).strip("-") or "emergentile"
data["slug"] = slug

if args.field:
    value = data.get(args.field, "")
    print(value)
elif args.destination:
    destination = args.destination
    assets = destination / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    for key in ("logo", "background"):
        value = str(data.get(key, ""))
        if not value:
            continue
        source = Path(value)
        if not source.is_absolute():
            source = args.profile.parent / source
        if not source.is_file():
            raise SystemExit(f"Edition {key} does not exist: {source}")
        target = assets / f"{key}{source.suffix.lower()}"
        shutil.copy2(source, target)
        data[key] = f"/etc/emergentile/assets/{target.name}"
    (destination / "edition.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
else:
    print(json.dumps(data, indent=2))
