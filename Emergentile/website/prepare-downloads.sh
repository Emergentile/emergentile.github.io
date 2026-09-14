#!/bin/sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
DOWNLOAD_DIR="$PROJECT_DIR/website/downloads"
mkdir -p "$DOWNLOAD_DIR"

SOURCE_ARCHIVE="$DOWNLOAD_DIR/emergentilegui-1-source.tar.gz"
tar -czf "$SOURCE_ARCHIVE" \
    --transform 's,^,Emergentile/,' \
    --exclude='./build' --exclude='./dist' --exclude='./website/downloads' --exclude='./.git' \
    -C "$PROJECT_DIR" .
(
    cd "$DOWNLOAD_DIR"
    sha256sum "$(basename "$SOURCE_ARCHIVE")" > "$(basename "$SOURCE_ARCHIVE").sha256"
)

if [ -d "$PROJECT_DIR/dist" ]; then
    find "$PROJECT_DIR/dist" -maxdepth 1 -type f \( -name '*.iso' -o -name '*.img' -o -name '*.sha256' \) -exec cp -f {} "$DOWNLOAD_DIR/" \;
fi

printf 'Website downloads prepared in %s\n' "$DOWNLOAD_DIR"
