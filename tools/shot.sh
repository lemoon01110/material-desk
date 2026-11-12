#!/bin/sh
# tools/shot.sh URL OUT.png [WIDTH HEIGHT]   screenshot a page with headless Chrome (default 1920x1080).
# For clicks and JavaScript use tools/cdp.mjs against a Chrome started with --remote-debugging-port.
set -eu
url=${1:?url}; out=${2:?out.png}; w=${3:-1920}; h=${4:-1080}
tmp=$(mktemp -d)
# Downloads go to the temp profile, never the user's Downloads folder.
mkdir -p "$tmp/Default" && printf '{"download":{"default_directory":"%s/dl","prompt_for_download":false}}' "$tmp" > "$tmp/Default/Preferences"
timeout 60 env -u WAYLAND_DISPLAY -u DISPLAY google-chrome-stable --headless=new --user-data-dir="$tmp" \
    --hide-scrollbars --window-size="$w,$h" --virtual-time-budget=5000 --screenshot="$out" "$url" >/dev/null 2>&1 || true
rm -rf "$tmp"
[ -s "$out" ] && echo "saved $out" || { echo "screenshot failed" >&2; exit 1; }
