#!/bin/sh
# tools/build-vendor.sh   rebuild extension/vendor/material-color-utilities.js: Google's material-color-utilities
# (Apache-2.0) from npm, bundled by esbuild into one minified classic script (IIFE, global MaterialColorUtilities)
# holding only what scripts/wallpaper.js uses. Needs network once; the extension never fetches anything at runtime.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
ver=${MCU_VERSION:-0.4.0}
work=$(mktemp -d "${TMPDIR:-/tmp}/md-vendor-XXXX")
trap 'rm -rf "$work"' EXIT
cd "$work"
npm init -y >/dev/null
npm install --no-audit --no-fund "@material/material-color-utilities@$ver" esbuild >/dev/null
cat > entry.js <<'EOF'
export { argbFromHex, hexFromArgb, argbFromRgb, QuantizerCelebi, Score, SchemeTonalSpot, SchemeContent, Hct,
    MaterialDynamicColors } from "@material/material-color-utilities";
EOF
./node_modules/.bin/esbuild entry.js --bundle --format=iife --global-name=MaterialColorUtilities --minify \
    --legal-comments=eof --target=chrome110 --outfile=bundle.js
out="$root/extension/vendor"
mkdir -p "$out"
{ echo "/* @material/material-color-utilities $ver (Apache-2.0, Copyright Google LLC), bundled as one classic script by tools/build-vendor.sh. Global: MaterialColorUtilities. License: vendor/LICENSE-material-color-utilities.txt */"
  cat bundle.js; } > "$out/material-color-utilities.js"
cp node_modules/@material/material-color-utilities/LICENSE "$out/LICENSE-material-color-utilities.txt"
echo "wrote $out/material-color-utilities.js"
