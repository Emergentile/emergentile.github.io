#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
    printf '%s\n' 'Run with sudo: sudo image-build/install-build-deps.sh' >&2
    exit 1
fi

apt-get update
apt-get install -y live-build debootstrap xorriso isolinux syslinux-common qemu-user-static binfmt-support rsync

# Debian publishes GRUB EFI builders per host architecture. Install every
# bootloader package available on this host without making the other
# architecture's absence fatal.
for package in grub-pc-bin grub-efi-amd64-bin grub-efi-arm64-bin; do
    candidate=$(apt-cache policy "$package" | awk '/Candidate:/{print $2; exit}')
    if [ -n "$candidate" ] && [ "$candidate" != '(none)' ]; then
        apt-get install -y "$package"
    fi
done
