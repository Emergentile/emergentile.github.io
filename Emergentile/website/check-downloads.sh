#!/bin/sh
set -eu

DOWNLOAD_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/downloads" && pwd)
REQUIRE_ISOS=false
[ "${1:-}" = --require-isos ] && REQUIRE_ISOS=true
failed=false

check_artifact() {
    name=$1
    required=$2
    path="$DOWNLOAD_DIR/$name"
    if [ ! -s "$path" ]; then
        printf 'MISSING  %s\n' "$name"
        [ "$required" = true ] && failed=true
        return 0
    fi
    if [ ! -s "$path.sha256" ]; then
        printf 'NO HASH  %s\n' "$name"
        [ "$required" = true ] && failed=true
        return 0
    fi
    if (cd "$DOWNLOAD_DIR" && sha256sum -c "$name.sha256" >/dev/null 2>&1); then
        printf 'READY    %s\n' "$name"
    else
        printf 'BAD HASH %s\n' "$name"
        failed=true
    fi
}

check_artifact emergentilegui-1-source.tar.gz true
check_artifact emergentilegui-1-amd64.iso "$REQUIRE_ISOS"
check_artifact emergentilegui-1-arm64.iso "$REQUIRE_ISOS"
check_artifact emergentilegui-1-amd64.img false
check_artifact emergentilegui-1-arm64.img false

[ "$failed" = false ] || exit 1
