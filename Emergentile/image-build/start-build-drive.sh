#!/bin/sh
set -eu

DEVICE=/dev/sda1
MOUNT=/mnt/emergentile-build

if [ "$(id -u)" -ne 0 ]; then
    printf '%s\n' 'This launcher must run through pkexec.' >&2
    exit 1
fi

[ -b "$DEVICE" ] || { printf 'Build device is missing: %s\n' "$DEVICE" >&2; exit 1; }
label=$(blkid -s LABEL -o value "$DEVICE" 2>/dev/null || true)
[ "$label" = EMERGENTILE_BUIL ] || { printf 'Unexpected build device label: %s\n' "$label" >&2; exit 1; }

if findmnt -rn -S "$DEVICE" >/dev/null 2>&1; then
    umount "$DEVICE"
fi
mkdir -p "$MOUNT"
mount -o rw,dev,suid "$DEVICE" "$MOUNT"

options=$(findmnt -rn -o OPTIONS "$MOUNT")
case ",$options," in
    *,nodev,*) printf '%s\n' 'Build drive is still mounted with nodev.' >&2; exit 1 ;;
esac

exec /home/avichu/Emergentile/image-build/build-all.sh "$MOUNT/work" "$MOUNT/dist"
