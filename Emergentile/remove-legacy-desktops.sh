#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
    printf '%s\n' 'Run with sudo: sudo ./remove-legacy-desktops.sh' >&2
    exit 1
fi

if [ ! -f /usr/share/xsessions/emergentile.desktop ]; then
    printf '%s\n' 'Emergentile is not installed system-wide; refusing to remove other desktops.' >&2
    exit 1
fi

export DEBIAN_FRONTEND=noninteractive
printf '%s\n' 'Installing the replacement LightDM login manager…'
printf '%s\n' 'lightdm shared/default-x-display-manager select lightdm' | debconf-set-selections
apt-get update
apt-get install -y lightdm lightdm-gtk-greeter

printf '%s\n' 'Selecting LightDM for the next boot…'
printf '%s\n' /usr/sbin/lightdm > /etc/X11/default-display-manager
systemctl disable gdm3.service 2>/dev/null || true
systemctl enable lightdm.service

printf '%s\n' 'Removing Cinnamon and GNOME desktop sessions…'
apt-get purge -y \
    task-cinnamon-desktop \
    cinnamon-desktop-environment cinnamon-core cinnamon cinnamon-session \
    gnome-shell gnome-session gnome-session-xsession gdm3

# Deliberately do not autoremove: shared GTK applications and libraries may be
# useful to Emergentile and can be reviewed separately later.
printf '%s\n' \
    'Cinnamon and GNOME desktop sessions were removed.' \
    'LightDM will provide the next graphical login.' \
    'Reboot when convenient to complete the display-manager change.'
