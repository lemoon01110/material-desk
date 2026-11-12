#!/bin/sh
# tools/build.sh store            dist/store/ and dist/material-desk-VERSION.zip, ready for the Chrome Web Store
#                                 (no update_url: the store hosts updates).
# tools/build.sh local [--install] dist/local/, a self-hosted copy for the optional desktop integration: same files,
#                                 plus the update_url and version of an existing self-hosted install. Settings come from
#                                 tools/local.env (not in git), for example:
#                                     MD_UPDATE_URL=file:///path/to/updates.xml   update_url written into the manifest
#                                     MD_UPDATES_XML=/path/to/updates.xml         read for the installed version
#                                     MD_PACK_CMD="/path/to/pack-script name"     run by --install to pack and publish
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
mode=${1:?usage: tools/build.sh store|local [--install]}
dist="$root/dist/$mode"
rm -rf "$dist"; mkdir -p "$dist"
cp -r "$root/extension/." "$dist/"
case $mode in
store)
    python3 -I - "$dist/manifest.json" <<'PY'
import json, sys
p = sys.argv[1]; m = json.load(open(p)); m.pop("update_url", None)
json.dump(m, open(p, "w"), indent=1)
PY
    ver=$(python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$dist/manifest.json")
    zip="$root/dist/material-desk-$ver.zip"; rm -f "$zip"
    (cd "$dist" && zip -qr -X "$zip" .)
    echo "store build: $zip ($(wc -c < "$zip") bytes)"
    ;;
local)
    MD_UPDATE_URL=""; MD_UPDATES_XML=""; MD_PACK_CMD=""
    # shellcheck disable=SC1091
    [ -f "$root/tools/local.env" ] && . "$root/tools/local.env"
    cur=""
    if [ -n "$MD_UPDATES_XML" ]; then
        cur=$(grep -o "updatecheck[^>]*version='[^']*'" "$MD_UPDATES_XML" 2>/dev/null | grep -o "version='[^']*'" | cut -d"'" -f2 || true)
    fi
    python3 -I - "$dist/manifest.json" "$cur" "$MD_UPDATE_URL" <<'PY'
import json, sys
p, v, url = sys.argv[1], sys.argv[2], sys.argv[3]; m = json.load(open(p))
if v: m["version"] = v
if url: m["update_url"] = url
json.dump(m, open(p, "w"), indent=1)
PY
    echo "local build: $dist (version ${cur:-from manifest.json})"
    if [ "${2:-}" = --install ]; then
        [ -n "$MD_PACK_CMD" ] || { echo "set MD_PACK_CMD in tools/local.env" >&2; exit 1; }
        sh -c "$MD_PACK_CMD"
    fi
    ;;
*) echo "unknown mode $mode" >&2; exit 1 ;;
esac
