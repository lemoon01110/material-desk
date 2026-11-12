#!/bin/sh
# tools/headless.sh PORT URL [WIDTH HEIGHT]   start a throwaway headless Chrome with remote debugging on PORT.
# Downloads (e.g. testing "Export data") go to a temp folder, never the user's Downloads folder.
# Prints the profile folder; kill the Chrome by its --remote-debugging-port.
set -eu
port=${1:?port}; url=${2:?url}; w=${3:-1920}; h=${4:-1080}
tmp=$(mktemp -d "${TMPDIR:-/tmp}/md-headless-$port-XXXX")
mkdir -p "$tmp/Default" "$tmp/downloads"
printf '{"download":{"default_directory":"%s","prompt_for_download":false},"savefile":{"default_directory":"%s"}}' \
    "$tmp/downloads" "$tmp/downloads" > "$tmp/Default/Preferences"
env -u WAYLAND_DISPLAY -u DISPLAY setsid google-chrome-stable --headless=new --user-data-dir="$tmp" --hide-scrollbars \
    --window-size="$w,$h" --remote-debugging-port="$port" "$url" >/dev/null 2>&1 &
echo "$tmp"
