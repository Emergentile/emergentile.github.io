#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
    printf '%s\n' 'Run with sudo: sudo image-build/build-all.sh [WORK_DIR] [OUTPUT_DIR]' >&2
    exit 1
fi

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
WORK_ROOT=${1:-/mnt/emergentile-build/work}
OUTPUT_DIR=${2:-/mnt/emergentile-build/dist}
PROFILE="$PROJECT_DIR/image-build/default-edition.json"
SLUG=$(python3 "$PROJECT_DIR/image-build/prepare-edition.py" "$PROFILE" --field slug)
VERSION=$(python3 "$PROJECT_DIR/image-build/prepare-edition.py" "$PROFILE" --field version)

mkdir -p "$WORK_ROOT" "$OUTPUT_DIR"

build_one() {
    arch=$1
    format=$2
    artifact="$OUTPUT_DIR/${SLUG}-${VERSION}-${arch}.${format}"
    checksum="$artifact.sha256"

    if [ -f "$artifact" ] && [ -f "$checksum" ] && (
        cd "$OUTPUT_DIR"
        sha256sum -c "$(basename "$checksum")" >/dev/null 2>&1
    ); then
        printf 'Already verified: %s\n' "$artifact"
    else
        "$PROJECT_DIR/image-build/build.sh" \
            --arch "$arch" \
            --format "$format" \
            --edition "$PROFILE" \
            --work "$WORK_ROOT" \
            --output "$OUTPUT_DIR"
    fi

    build_dir="$WORK_ROOT/${SLUG}-${arch}-${format}"
    if [ -d "$build_dir" ]; then
        (cd "$build_dir" && lb clean --purge) || true
    fi
}

clone_hybrid() {
    arch=$1
    source_format=$2
    target_format=$3
    source="$OUTPUT_DIR/${SLUG}-${VERSION}-${arch}.${source_format}"
    target="$OUTPUT_DIR/${SLUG}-${VERSION}-${arch}.${target_format}"

    [ -f "$source" ] || { printf 'Missing hybrid source: %s\n' "$source" >&2; exit 1; }
    if [ -f "$target" ] && [ -f "$target.sha256" ] && (
        cd "$OUTPUT_DIR"
        sha256sum -c "$(basename "$target.sha256")" >/dev/null 2>&1
    ); then
        printf 'Already verified: %s\n' "$target"
        return
    fi

    rm -f "$target" "$target.sha256"
    ln "$source" "$target"
    (cd "$OUTPUT_DIR" && sha256sum "$(basename "$target")" > "$(basename "$target").sha256")
    printf 'Published hybrid: %s\n' "$target"
}

# Each EFI ISO-hybrid is valid both for optical media and direct disk writing,
# so build it once per architecture and publish both requested extensions.
build_one arm64 img
clone_hybrid arm64 img iso
build_one amd64 iso
clone_hybrid amd64 iso img

printf '%s\n' 'All Emergentile images are built and verified:'
find "$OUTPUT_DIR" -maxdepth 1 -type f \
    \( -name "${SLUG}-${VERSION}-*.iso" -o -name "${SLUG}-${VERSION}-*.img" \) \
    -printf '%f\n' | sort
