#!/bin/sh
set -eu

rm -r "$HOME/.local/share/emergentile"
rm "$HOME/.local/bin/emergentile-shell" "$HOME/.local/bin/emergentile-session"
rm "$HOME/.local/share/xsessions/emergentile.desktop"
printf '%s\n' 'Emergentile has been removed from this user account.'
