#!/bin/bash
set -uo pipefail

drive=/media/avichu/EMERGENTILE_BUIL
log="$drive/amd64-build.log"

printf '%s\n' \
  'Emergentile AMD64 OS Builder' \
  '============================' \
  'Enter your administrator password when requested.' \
  "Logging this build to: $log" \
  ''

sudo /home/avichu/Emergentile/image-build/build-all.sh \
  "$drive/work" "$drive/dist" 2>&1 | tee "$log"

status=${PIPESTATUS[0]}
printf '\nBuild exited with status %s.\n' "$status"
printf '%s' 'Press Enter to close this terminal... '
read -r answer
exit "$status"
