#!/bin/sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DATA_DIR="$HOME/.local/share/emergentile"
BIN_DIR="$HOME/.local/bin"
SESSION_DIR="$HOME/.local/share/xsessions"

for command in gjs xfwm4 xfsettingsd; do
    if ! command -v "$command" >/dev/null 2>&1; then
        printf 'Missing required command: %s\n' "$command" >&2
        exit 1
    fi
done

mkdir -p "$DATA_DIR/shell" "$DATA_DIR/openbox" "$BIN_DIR" "$SESSION_DIR"
cp "$PROJECT_DIR/native/shell/main.js" "$PROJECT_DIR/native/shell/style.css" "$DATA_DIR/shell/"
cp "$PROJECT_DIR/native/openbox/rc.xml" "$DATA_DIR/openbox/"
cp "$PROJECT_DIR/native/emergentile-shell" "$PROJECT_DIR/native/emergentile-session" "$BIN_DIR/"
cp "$PROJECT_DIR/native/emergentile.desktop" "$SESSION_DIR/"
chmod +x "$BIN_DIR/emergentile-shell" "$BIN_DIR/emergentile-session" "$DATA_DIR/shell/main.js"
sed -i "s|Exec=/usr/local/bin/emergentile-session|Exec=$BIN_DIR/emergentile-session|;s|TryExec=/usr/local/bin/emergentile-session|TryExec=$BIN_DIR/emergentile-session|" "$SESSION_DIR/emergentile.desktop"

printf '%s\n' \
  'Emergentile has been installed for this user.' \
  "Choose Emergentile from your login screen, or run: $BIN_DIR/emergentile-session"
