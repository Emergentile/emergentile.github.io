#!/bin/sh
set -eu

usage() {
    printf '%s\n' \
        'Usage: image-build/build.sh --arch amd64|arm64 --format iso|img [--edition FILE] [--output DIR] [--work DIR]' \
        '' \
        'Builds a bootable Debian Trixie EmergentileGUI image.'
}

ARCH=
FORMAT=
OUTPUT_DIR=
WORK_ROOT=
EDITION_FILE=
while [ "$#" -gt 0 ]; do
    case "$1" in
        --arch) ARCH=${2:-}; shift 2 ;;
        --format) FORMAT=${2:-}; shift 2 ;;
        --output) OUTPUT_DIR=${2:-}; shift 2 ;;
        --work) WORK_ROOT=${2:-}; shift 2 ;;
        --edition) EDITION_FILE=${2:-}; shift 2 ;;
        -h|--help) usage; exit 0 ;;
        *) printf 'Unknown argument: %s\n' "$1" >&2; usage >&2; exit 2 ;;
    esac
done

case "$ARCH" in amd64|arm64) ;; *) printf '%s\n' 'Architecture must be amd64 or arm64.' >&2; exit 2 ;; esac
case "$FORMAT" in iso|img) ;; *) printf '%s\n' 'Format must be iso or img.' >&2; exit 2 ;; esac

for command in lb rsync python3; do
    if ! command -v "$command" >/dev/null 2>&1; then
        printf 'Missing build tool: %s\nRun: sudo image-build/install-build-deps.sh\n' "$command" >&2
        exit 1
    fi
done

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
EDITION_FILE=${EDITION_FILE:-"$PROJECT_DIR/image-build/default-edition.json"}
[ -f "$EDITION_FILE" ] || { printf 'Edition profile not found: %s\n' "$EDITION_FILE" >&2; exit 1; }
BASE_DISTRIBUTION=$(python3 "$PROJECT_DIR/image-build/prepare-edition.py" "$EDITION_FILE" --field base_distribution)
OS_NAME=$(python3 "$PROJECT_DIR/image-build/prepare-edition.py" "$EDITION_FILE" --field os_name)
VERSION=$(python3 "$PROJECT_DIR/image-build/prepare-edition.py" "$EDITION_FILE" --field version)
EDITION_SLUG=$(python3 "$PROJECT_DIR/image-build/prepare-edition.py" "$EDITION_FILE" --field slug)
OUTPUT_DIR=${OUTPUT_DIR:-"$PROJECT_DIR/dist"}
WORK_ROOT=${WORK_ROOT:-"$PROJECT_DIR/build"}
WORK_DIR="$WORK_ROOT/${EDITION_SLUG}-${ARCH}-${FORMAT}"
BINARY_IMAGE=iso-hybrid
BOOTLOADERS='syslinux grub-efi'
if [ "$ARCH" = arm64 ]; then
    # ARM64 live media boots through UEFI. live-build's legacy hdd backend
    # rejects grub-efi, so the .img target is a flashable EFI ISO-hybrid.
    BOOTLOADERS=grub-efi
elif [ "$FORMAT" = img ]; then
    BINARY_IMAGE=hdd
    BOOTLOADERS=syslinux
fi

mkdir -p "$OUTPUT_DIR" "$WORK_DIR"
cd "$WORK_DIR"
# Clear partial build state while retaining downloaded/bootstrap caches so a
# corrected or interrupted build can resume without starting from zero.
lb clean 2>/dev/null || true

lb config noauto \
    --mode debian \
    --distribution "$BASE_DISTRIBUTION" \
    --architectures "$ARCH" \
    --binary-images "$BINARY_IMAGE" \
    --bootloaders "$BOOTLOADERS" \
    --archive-areas 'main contrib non-free-firmware' \
    --debian-installer live \
    --debian-installer-gui true \
    --image-name "${EDITION_SLUG}-${VERSION}-${ARCH}" \
    --iso-application "$OS_NAME $VERSION" \
    --iso-publisher 'The Emergentile Project' \
    --iso-volume 'EMERGENTILE' \
    --bootappend-live 'boot=live components username=emergentile hostname=emergentile locales=en_US.UTF-8 keyboard-layouts=us'

mkdir -p config/package-lists config/includes.chroot/usr/local/src/emergentile config/includes.chroot/etc/emergentile config/hooks/live
sed '/^[[:space:]]*#/d;/^[[:space:]]*$/d' "$PROJECT_DIR/image-build/packages.common" > config/package-lists/emergentile.list.chroot
printf '%s\n' "linux-image-$ARCH" live-boot live-config live-config-systemd >> config/package-lists/emergentile.list.chroot

rsync -a --delete \
    --exclude build --exclude dist --exclude .git \
    "$PROJECT_DIR/" config/includes.chroot/usr/local/src/emergentile/

install -m 0755 "$PROJECT_DIR/image-build/010-emergentile.hook.chroot" config/hooks/live/010-emergentile.hook.chroot
python3 "$PROJECT_DIR/image-build/prepare-edition.py" "$EDITION_FILE" --destination config/includes.chroot/etc/emergentile

lb build

if [ "$FORMAT" = iso ] || { [ "$FORMAT" = img ] && [ "$ARCH" = arm64 ]; }; then
    BUILT_IMAGE=$(find . -maxdepth 1 -type f -name '*.iso' | head -1)
    DESTINATION="$OUTPUT_DIR/${EDITION_SLUG}-${VERSION}-${ARCH}.${FORMAT}"
else
    BUILT_IMAGE=$(find . -maxdepth 1 -type f \( -name '*.img' -o -name '*.hdd' \) | head -1)
    DESTINATION="$OUTPUT_DIR/${EDITION_SLUG}-${VERSION}-${ARCH}.img"
fi

if [ -z "$BUILT_IMAGE" ]; then
    printf '%s\n' 'live-build finished but no output image was found.' >&2
    exit 1
fi

cp "$BUILT_IMAGE" "$DESTINATION"
(
    cd "$OUTPUT_DIR"
    sha256sum "$(basename "$DESTINATION")" > "$(basename "$DESTINATION").sha256"
)
printf 'Created %s\n' "$DESTINATION"
