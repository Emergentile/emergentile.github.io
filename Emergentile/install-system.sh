#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
    printf '%s\n' 'Run this installer with sudo: sudo ./install-system.sh' >&2
    exit 1
fi

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DATA_DIR=/usr/local/share/emergentile

for command in gjs; do
    if ! command -v "$command" >/dev/null 2>&1; then
        printf 'Missing required command: %s\n' "$command" >&2
        exit 1
    fi
done

install -d "$DATA_DIR/shell" "$DATA_DIR/openbox" "$DATA_DIR/installer" "$DATA_DIR/about" "$DATA_DIR/help" "$DATA_DIR/dev" "$DATA_DIR/settings" "$DATA_DIR/assets" "$DATA_DIR/theme/Emergentile/gtk-3.0" /usr/local/bin /usr/local/libexec/emergentile /usr/share/xsessions /usr/share/applications /usr/share/icons/hicolor/scalable/apps /usr/share/themes/Emergentile/gtk-3.0
install -m 0644 "$PROJECT_DIR/native/shell/main.js" "$PROJECT_DIR/native/shell/style.css" "$DATA_DIR/shell/"
install -m 0644 "$PROJECT_DIR/native/openbox/rc.xml" "$DATA_DIR/openbox/rc.xml"
install -m 0755 "$PROJECT_DIR/native/emergentile-shell" "$PROJECT_DIR/native/emergentile-session" /usr/local/bin/
install -m 0644 "$PROJECT_DIR/native/emergentile.desktop" /usr/share/xsessions/emergentile.desktop
install -m 0644 "$PROJECT_DIR/native/installer/main.js" "$DATA_DIR/installer/main.js"
install -m 0644 "$PROJECT_DIR/native/about/main.js" "$DATA_DIR/about/main.js"
install -m 0644 "$PROJECT_DIR/native/help/main.js" "$DATA_DIR/help/main.js"
install -m 0644 "$PROJECT_DIR/native/dev/main.js" "$DATA_DIR/dev/main.js"
install -m 0644 "$PROJECT_DIR/native/settings/main.js" "$DATA_DIR/settings/main.js"
install -m 0644 "$PROJECT_DIR/native/assets/emergentile.svg" "$DATA_DIR/assets/emergentile.svg"
install -m 0644 "$PROJECT_DIR/native/theme/Emergentile/index.theme" "$DATA_DIR/theme/Emergentile/index.theme"
install -m 0644 "$PROJECT_DIR/native/theme/Emergentile/gtk-3.0/gtk.css" "$DATA_DIR/theme/Emergentile/gtk-3.0/gtk.css"
install -m 0755 "$PROJECT_DIR/native/emergentile-installer" /usr/local/bin/emergentile-installer
install -m 0755 "$PROJECT_DIR/native/emergentile-about" /usr/local/bin/emergentile-about
install -m 0755 "$PROJECT_DIR/native/emergentile-help" /usr/local/bin/emergentile-help
install -m 0755 "$PROJECT_DIR/native/emergentile-dev" /usr/local/bin/emergentile-dev
install -m 0755 "$PROJECT_DIR/native/emergentile-settings" /usr/local/bin/emergentile-settings
install -m 0755 "$PROJECT_DIR/native/install-components" /usr/local/libexec/emergentile/install-components
install -m 0644 "$PROJECT_DIR/native/emergentile-installer.desktop" /usr/share/applications/org.emergentile.Installer.desktop
install -m 0644 "$PROJECT_DIR/native/emergentile-about.desktop" /usr/share/applications/org.emergentile.About.desktop
install -m 0644 "$PROJECT_DIR/native/emergentile-help.desktop" /usr/share/applications/org.emergentile.Help.desktop
install -m 0644 "$PROJECT_DIR/native/emergentile-dev.desktop" /usr/share/applications/org.emergentile.Dev.desktop
install -m 0644 "$PROJECT_DIR/native/emergentile-settings.desktop" /usr/share/applications/org.emergentile.Settings.desktop
install -m 0644 "$PROJECT_DIR/native/assets/emergentile.svg" /usr/share/icons/hicolor/scalable/apps/emergentile.svg
install -m 0644 "$PROJECT_DIR/native/theme/Emergentile/index.theme" /usr/share/themes/Emergentile/index.theme
install -m 0644 "$PROJECT_DIR/native/theme/Emergentile/gtk-3.0/gtk.css" /usr/share/themes/Emergentile/gtk-3.0/gtk.css
gtk-update-icon-cache -f /usr/share/icons/hicolor >/dev/null 2>&1 || true

printf '%s\n' 'Emergentile is installed system-wide and will appear in GDM after logging out.'
