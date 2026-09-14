# EmergentileGUI image builder

This builder creates Debian Trixie images with the standard Debian Linux kernel,
GDM, XFWM, the Emergentile shell, About and Installer applications, a browser,
file manager, terminal, networking, Bluetooth, PipeWire audio, fonts, and common
command-line utilities.

## Outputs

| Architecture | ISO | Disk image |
|---|---|---|
| AMD/Intel 64-bit | `emergentilegui-1-amd64.iso` | `emergentilegui-1-amd64.img` |
| ARM 64-bit | `emergentilegui-1-arm64.iso` | `emergentilegui-1-arm64.img` |

The ISO is a hybrid live/install image. The IMG uses live-build's HDD image
format for USB disks and virtual machines. ARM boards often require board-specific
firmware and boot loaders; the generic ARM64 images target standards-compliant
UEFI systems and are not a Raspberry Pi OS firmware image.

## Build locally

Use a machine with at least 20 GB free for one build or 60 GB for all four:

```bash
sudo image-build/install-build-deps.sh
sudo image-build/build.sh --arch arm64 --format iso
sudo image-build/build.sh --arch arm64 --format img
sudo image-build/build.sh --arch amd64 --format iso
sudo image-build/build.sh --arch amd64 --format img
```

Artifacts and SHA-256 checksums are written to `dist/`. For cross-architecture
builds, QEMU binfmt support must be enabled. Native builds are faster and more
reliable.

The GitHub Actions workflow builds all four combinations on demand or when a
version tag is pushed.

## Custom editions

Open **Emergentile Dev** to choose a name, version, desktop title, accent,
wallpaper, logo, Debian base, architecture, and output format. Saved profiles
are stored under `editions/` and passed to the builder with:

```bash
sudo image-build/build.sh --arch amd64 --format iso \
  --edition editions/my-edition/edition.json
```

Edition assets are copied into the image, `/etc/os-release` is branded during
the build, and the Emergentile shell reads the embedded profile on startup.
