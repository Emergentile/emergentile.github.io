#!/usr/bin/env python3
import json
from pathlib import Path

profile = Path("/etc/emergentile/edition.json")
if not profile.is_file():
    raise SystemExit(0)
data = json.loads(profile.read_text(encoding="utf-8"))
name = str(data.get("os_name", "EmergentileGUI")).replace('"', '')
version = str(data.get("version", "1")).replace('"', '')
slug = str(data.get("slug", "emergentile")).replace('"', '')
Path("/etc/os-release").write_text(
    f'PRETTY_NAME="{name} {version}"\n'
    f'NAME="{name}"\nVERSION_ID="{version}"\nVERSION="{version}"\n'
    f'ID={slug}\nID_LIKE=debian\n'
    'HOME_URL="https://www.debian.org/"\n'
    'SUPPORT_URL="https://www.debian.org/support"\n'
    'BUG_REPORT_URL="https://www.debian.org/Bugs/"\n',
    encoding="utf-8"
)
