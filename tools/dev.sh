#!/bin/sh
# tools/dev.sh PORT   serve the extension for development at http://127.0.0.1:PORT/dev.html (Ctrl+C or kill to stop).
# dev.html = extension/index.html with dev/mock-chrome.js (fake chrome.* APIs) and a managed look loaded first, as
# the optional desktop integration would provide it. Its colors come from $MD_DEV_COLORS and its background from
# $MD_DEV_BACKGROUND when set (a matugen colors.json and a picture), else dev/look.json and no picture.
# URL flags: ?store (no managed look, like a store install: the Wallpaper settings apply), ?noBookmarks (empty
# bookmark tree), ?seed (sample to-dos; also ?seed=empty, ?seed=200).
set -eu
port=${1:?usage: tools/dev.sh PORT}
root=$(cd "$(dirname "$0")/.." && pwd)
out=$(mktemp -d "${TMPDIR:-/tmp}/md-dev-$port-XXXX")
for f in "$root"/extension/*; do ln -s "$f" "$out/"; done
ln -s "$root/dev" "$out/dev"
colors=${MD_DEV_COLORS:-}; [ -n "$colors" ] && [ -f "$colors" ] || colors="$root/dev/look.json"
bg=${MD_DEV_BACKGROUND:-}; [ -n "$bg" ] && [ -f "$bg" ] && cp "$bg" "$out/bg.jpg" || true
python3 -I - "$colors" "$out/dev-look.js" "$([ -f "$out/bg.jpg" ] && echo /bg.jpg || echo '')" <<'PY'
import json, sys
colors = json.load(open(sys.argv[1]))
look = {"colors": colors, "font": "Google Sans Flex", "scale": 1}
if sys.argv[3]: look["background"] = sys.argv[3]
open(sys.argv[2], "w").write(f"window.__devLook = {json.dumps(look)};\n"
    "if (new URLSearchParams(location.search).has('store')) localStorage.removeItem('desktopLook');\n"
    "else localStorage.setItem('desktopLook', JSON.stringify(window.__devLook));\n")
PY
sed 's|<script src="scripts/lemon.js"></script>|<script src="dev/mock-chrome.js"></script>\n    <script src="dev-look.js"></script>\n    <script src="scripts/lemon.js"></script>|' "$root/extension/index.html" > "$out/dev.html"
echo "http://127.0.0.1:$port/dev.html  (files: $out)"
cd "$out" && exec python3 -m http.server "$port" --bind 127.0.0.1
