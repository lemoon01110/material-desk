# Material Desk: architecture

A Chrome new tab page (Manifest V3 extension) in the Material 3 expressive style: a cookie clock on top, a long
search bar, a weather band under it, a feature-rich to-do column on the left, and bookmarks, Google apps and settings
in the column on the right. Dark, calm, colored from the wallpaper. This file is for contributors: how the page is
put together, the shared tokens and APIs, the saved data, and the dev tools.

## Repository layout

| Path | What it is |
|---|---|
| `extension/` | The extension itself, the source of truth. Loaded unpacked as is; no build step. |
| `extension/vendor/` | Third-party code, bundled once (`tools/build-vendor.sh`): material-color-utilities. |
| `extension/fonts/` | Space Grotesk and Google Sans Flex (Latin subsets, woff2) with their OFL licenses. |
| `extension/wallpapers/` | Built-in wallpapers, procedural SVG drawn by `tools/wallpapers.py`. |
| `dev/` | Mock `chrome.*` APIs (`mock-chrome.js`) and a sample managed look (`look.json`) for development. |
| `tools/` | `dev.sh`, `shot.sh`, `headless.sh`, `cdp.mjs`, `build.sh`, `build-vendor.sh`, `wallpapers.py`. |

## Layout (index.html)

```
| #todo-col (panel, 320px)   |   #center                         | #right-col (panel, 320px) |
|                            |   #clock-host  (cookie clock)     |  #bookmarks-host          |
|                            |   #dlDate      (date pill)        |  #apps-host               |
|                            |   #search-host (long search bar)  |  #settings-host           |
|                            |   #weather-host (weather band)    |                           |
```
- Side columns are `.panel` (full height glass panels, styled in styles/base.css). Each column owns its inside.
- No popups that can clip: everything lives inside its column. Overlays (menus, date pickers, edit forms) open inside
  the column and must stay fully on screen at 1366x768 and 1920x1080.
- Side columns fold to an icon, or widen to half or the whole page (scripts/collapse.js); the center never moves.

## Files

| Part | Files |
|---|---|
| Core: settings, storage, look, layout tokens | scripts/lemon.js, styles/base.css, index.html, manifest.json, schema.json |
| Clock and date | scripts/cookie-clock.js, styles/clock.css |
| Search | scripts/center.js, styles/center.css |
| Weather | scripts/open-meteo.js (data and icons), scripts/weather-card.js, styles/weather.css |
| To-do column | scripts/todo.js, styles/todo.css |
| Bookmarks and Google apps | scripts/bookmarks.js, styles/bookmarks.css |
| Settings | scripts/settings.js, scripts/wallpaper.js (Wallpaper section), styles/settings.css |
| Column folding and sizes | scripts/collapse.js |
| Keyboard shortcuts | scripts/keys.js, styles/keys.css |
| Background worker (applies updates promptly) | scripts/background.js |

## Colors and type

- Colors come only from CSS variables `--dl-<role>` (Material 3 roles in snake case, as matugen names them): primary,
  on_primary, primary_container, on_primary_container, secondary, on_secondary, secondary_container,
  on_secondary_container, tertiary, on_tertiary, tertiary_container, on_tertiary_container, error, on_error,
  error_container, on_error_container, surface, surface_container_lowest, surface_container_low, surface_container,
  surface_container_high, surface_container_highest, on_surface, on_surface_variant, outline, outline_variant,
  inverse_surface, inverse_on_surface, inverse_primary, scrim, shadow (plus the fixed roles and source_color).
  They change with the wallpaper; never hard-code a color without a `var(--dl-..., fallback)`.
- Shorthands in base.css: `--panel`, `--card`, `--raised`, `--text`, `--text-2`, `--line`, `--shadow`, radii
  `--r-xl/lg/md/sm/pill`, `--gap`. Shared classes: `.panel-head`, `.panel-title`, `.panel-body`, `.icon-btn`, `.chip`,
  `.field`, `.btn-filled`, `.btn-tonal`, `.empty`.
- Not monotone: use the three accent families with meaning. primary = actions and "now"; tertiary = time and dates
  (today, due); secondary = organizing (lists, folders, tags). Containers (`*_container` + `on_*_container`) for filled
  chips and badges. Text on a fill always uses its `on_*` partner. error = overdue and priority 1.
- Fonts (bundled in fonts/): `--f-display` (Space Grotesk) for numbers and headings; `--f-body` (Google Sans Flex)
  for the rest. Sentence case, no all-caps labels, no "A · B · C" strings.
- Icons: inline SVG (Material Symbols style paths), `fill: currentColor`. No icon fonts, no external requests.
- Motion: short and only in answer to the user (open, add, complete). Respect prefers-reduced-motion.

## Where the look comes from

scripts/lemon.js runs first (in `<head>`) so a new tab paints in its final colors at once.

1. **Managed look (optional desktop integration).** An admin policy can give the extension a look through
   `chrome.storage.managed` (keys in schema.json: `colors` as a role to hex map, `background`, `font`, `scale`).
   This is how a Linux desktop can keep the page in its wallpaper colors (for example from matugen). When present it
   wins, and Settings > Wallpaper only says the look is managed by the desktop. Cached in localStorage `desktopLook`.
2. **Picked wallpaper (everyone else).** Settings > Wallpaper (scripts/wallpaper.js): six built-in wallpapers, or an
   uploaded picture (downscaled to at most 2560 px, JPEG 0.9, kept in IndexedDB `material-desk` / `files` /
   `wallpaper`), and a Dim slider. On a choice, material-color-utilities (lazy-loaded from vendor/) quantizes the
   picture (Celebi), scores a source color and builds a dark tonal spot scheme; every role becomes a `--dl-*`
   variable. Saved in `chrome.storage.local` key `wallpaper` (`{ id, dim, colors, thumb? }`) and cached in
   localStorage `userLook`, with a tiny placeholder (`thumb`) for uploads so the first paint is never empty.
3. **First run:** the built-in "dusk" wallpaper with its scheme precomputed in lemon.js.

The wallpaper is `--bg-image` on `body`, under a shade of the surface color `--bg-dim` strong. A `lemon:look` event on
`document` fires after every look change.

## Shared JavaScript (scripts/lemon.js, loaded first)

```js
await Lemon.ready;                 // settings loaded
Lemon.settings.get()               // { units, useGPS, location, engine, suggestions, showSeconds, weather, todo,
                                   //   bookmarks, apps, bookmarksView, panelOpacity, todoCollapsed, ... }
await Lemon.settings.set({ units: "C" })   // saves and notifies
Lemon.settings.onChange((settings, patch) => {...})
await Lemon.store.get("todo", fallback)    // chrome.storage.local, use your own top-level key
await Lemon.store.set("todo", value)
Lemon.color("primary")             // current hex of a role
Lemon.look.managed()               // true when the desktop integration provides the look
Lemon.look.wallpaper()             // { id, dim, colors, thumb? }
await Lemon.look.set(state, blob)  // save and show a wallpaper (blob: a new uploaded picture)
Lemon.look.onChange(callback)
```
- The global is called `Lemon` and several storage keys start with `lemon` for historical reasons (the project's
  first name). Do not rename them: existing installs keep their data under those names.
- Data: chrome.storage.local only (never localStorage for user data; localStorage only holds caches). Keys:
  `settings`, `todo`, `bookmarksUi`, `wallpaper`, `myntImported`. The weather cache is localStorage `dlWeather2`.
- Scripts are classic scripts at the end of body (no modules, no build step, no network except the hosts in
  manifest.json). Wrap your code in an IIFE; mount into your host element; expose nothing global unless listed here.
- Page scale: the page is designed at 100% in CSS px at 1920x1080 and checked at 1366x768. A managed look may set
  `html { zoom }` (a desktop running Chrome at 125% uses 0.8). Never size with vh/vw: the zoom shrinks them too (use
  %, flex, or the `lemon` size container on `.lemon`, e.g. `cqh`, `@container lemon (max-height: ...)`).

## Settings

units (F/C, default from the browser's region), useGPS + location (text, empty means "by internet address"),
engine (google/duckduckgo/bing/brave/wikipedia/youtube), suggestions, showSeconds, weather, todo, bookmarks, apps,
bookmarksView, panelOpacity (60 to 100), column fold and size keys. Plus the Wallpaper section, "Export data" /
"Import data" (chrome.storage.local keys as one JSON file) and "Reset" (settings back to defaults only), and About.

## Weather

Open-Meteo (forecast, geocoding, air quality; free, no key, CC BY 4.0, credited in the weather detail view and in
Settings > About). The place: GPS when "Use my location" is on, else the typed place, else the internet address
(ipinfo.io). Place names for GPS coordinates come from BigDataCloud's free client-side reverse geocoder.

## Developing and checking your work

```sh
tools/dev.sh 8799 &                     # serves http://127.0.0.1:8799/dev.html with fake chrome.* APIs
                                        #   ?store       no managed look (like a store install)
                                        #   ?seed        sample to-dos (?seed=empty, ?seed=200)
                                        #   ?noBookmarks empty bookmark tree
tools/shot.sh "http://127.0.0.1:8799/dev.html?store&seed" /tmp/x.png 1920 1080
# Clicks and JavaScript: a headless Chrome with remote debugging, then cdp.mjs against it.
tools/headless.sh 9399 "http://127.0.0.1:8799/dev.html?store" 1366 768
CDP_PORT=9399 TARGET=dev.html node tools/cdp.mjs eval "document.querySelector('...').click()"
CDP_PORT=9399 TARGET=dev.html node tools/cdp.mjs shot /tmp/y.png
```
In dev the managed look comes from dev/look.json (or `MD_DEV_COLORS` and `MD_DEV_BACKGROUND`). Look at every
screenshot before calling something done; check empty state, a full state (many items, long titles), store mode and
managed mode, at 1920x1080 and 1366x768. Use headless Chrome only (tools/headless.sh and tools/shot.sh send downloads
to a temp folder), and stop your servers and Chromes when done.

## Building

- `tools/build.sh store`: `dist/store/` and `dist/material-desk-VERSION.zip` for the Chrome Web Store.
- `tools/build.sh local [--install]`: a self-hosted copy for the optional desktop integration, configured by
  `tools/local.env` (not in git; see the comments in build.sh).
- `tools/build-vendor.sh`: rebuilds `extension/vendor/material-color-utilities.js` from npm (needs network once).
- `python3 -I tools/wallpapers.py`: redraws the built-in wallpapers.
