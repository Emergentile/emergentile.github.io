# EmergentileOS
# EmergentileGUI

A lightweight, installable Linux desktop environment for X11. Emergentile uses
GTK/GJS for its shell and Openbox for standards-compliant window management.

## Install the real desktop

Requirements: `gjs`, GTK 3, Openbox, and standard XDG utilities. On Debian or
Raspberry Pi OS these are available as `gjs gir1.2-gtk-3.0 openbox`.
Transfer the EmergentileGUI folder that you installed to path : /user/home

```bash
make check
make install
sudo image-build/install-build-deps.sh

## Install the EmergentileOS

make image-amd64-iso
make image-amd64-img
make image-arm64-iso
make image-arm64-img
```

Log out, select **Emergentile** from the session chooser, and log back in. You can
also test it from an existing X11 login with `make preview`.

## What is native and functional

- Discovers and launches installed Linux applications through `Gio.AppInfo`
- Runs ordinary Linux windows with Openbox
- Four workspaces and window snapping keyboard shortcuts
- Native GTK panel, searchable launcher, dock, clock, notifications and session menu
- Hardware brightness support when `brightnessctl` is installed
- Per-user XSession installation without replacing the current desktop

Keyboard shortcuts include `Super+Return` for a terminal, `Super+E` for files,
`Super+Q` to close a window, `Super+Left/Right` to tile, and
`Ctrl+Alt+Left/Right` to change workspaces.

## Architecture

`native/shell` is the desktop process, `native/openbox` contains window-manager
policy, and `native/emergentile-session` starts both as one login session. A future
Wayland compositor can replace Openbox without discarding the shell design.

To remove the session, run `make uninstall`.


GUI-ver-1.0
OS-ver-1.0
The Emergentile Project