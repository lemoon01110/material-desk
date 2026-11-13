# Chrome Web Store listing: Material Desk

Copy each part into the matching field of the "Store listing" tab in the Chrome Web Store Developer Dashboard.

Note: the name and the short description are not typed in the dashboard. They come from `name` and `description` in
`extension/manifest.json` inside the uploaded ZIP and cannot be edited in the dashboard. Make sure the manifest says
exactly what is below before you build the ZIP.

## Name (manifest `name`)

```
Material Desk
```

## Short description (manifest `description`, max 132 characters)

```
A calm Material You new tab: cookie clock, weather, to-do list and bookmarks, colored from your wallpaper.
```

(106 characters, the same as `extension/manifest.json`. It makes no "data stays on your device" claim: the weather and
search suggestions send the place and the typed text to outside services, see the Privacy paragraph below.)

## Detailed description (dashboard field "Description")

```
Material Desk turns every new tab into a quiet desk: a clock, a search bar, today's weather, your to-do list and your bookmarks, all in one dark Material You page that takes its colors from a wallpaper you choose.

What is on the page

- Cookie clock: a round Material 3 clock with the date, in the style of the End4 Hyprland desktop.
- Search bar: a long search bar that searches with the search engine set in Chrome, like the address bar does. Text that looks like a web address opens directly. You can also pick Google, DuckDuckGo, Bing, Brave, Wikipedia or YouTube instead. With Google or DuckDuckGo picked, suggestions show while you type and the arrow keys pick one. Suggestions can be turned off in settings.
- Weather: current conditions, feels-like temperature, wind, humidity, UV and air quality, with a detail view for the next hours and the next 10 days. The place comes from your location (if you allow it) or a city you type in settings. Fahrenheit or Celsius.
- To-do column: lists, sections, due dates and times, priorities, tags, subtasks, notes and repeating to-dos (daily, weekdays, weekly, monthly). Search your to-dos and keep a focus item.
- Bookmarks column: browse, search, add, edit, move and delete your Chrome bookmarks in a grid or a list, with site icons from Chrome.
- Google apps: quick links to Gmail, Calendar, Drive, Docs, YouTube, Maps, Photos, Classroom, Meet and Translate.
- Colors: keep the built-in Dusk wallpaper or upload your own picture, and the whole page is colored from it with Material You colors.
- Layout: fold or widen the side columns, set panel opacity, and hide the parts you do not use.
- Settings: units, location, search engine, suggestions, seconds on the clock, and export or import of your data as a file.

Keyboard shortcuts (when you are not typing in a field)

- s: search the web
- e: search engine menu
- n: new to-do
- /: search to-dos
- 1: fold or open the to-do column
- [ and ]: to-do column smaller or bigger
- b: search bookmarks
- a: add a bookmark
- 2: fold or open the bookmarks column
- { and }: bookmarks column smaller or bigger
- g: Google apps
- w: weather details
- h: weather hours or days
- ,: settings
- ?: show all shortcuts
- Esc: close what is open

On a fresh new tab Chrome puts the cursor in the address bar. Click the page or press F6 first, then use the keys.

Privacy

Material Desk has no account, no analytics and no ads, and the developer receives none of your data. Your settings, to-dos and wallpaper are stored only in your browser on this device. To show the weather, the page sends coordinates or the city you typed to Open-Meteo, and may ask BigDataCloud for the city name of your coordinates or ipinfo.io for an approximate location when no location is set. Searches go to the search engine set in Chrome, or to the engine you pick in settings. When search suggestions are on and Google or DuckDuckGo is the picked engine, the text you type in the search bar is sent to that engine to get suggestions. Full privacy policy: https://lemoon01110.github.io/material-desk/privacy.html

Open source

Material Desk is free and open source under the GPL-3.0 license. Source code, issues and feedback: https://github.com/lemoon01110/material-desk

Credits

- Clock and cookie shapes inspired by End4's dots-hyprland (illogical-impulse) desktop.
- Weather and air quality data by Open-Meteo.com (CC BY 4.0).
- Reverse geocoding by BigDataCloud. Approximate location by ipinfo.io.
- Colors follow Google's Material Design 3 (Material You) color system.
```

## Category

Primary category: **Productivity** (the to-do list, bookmarks and search are the main uses).

Note: the dashboard shows its own category list. Pick the closest match if the wording differs (for example a
"Workflow & Planning" subcategory under Productivity, if offered).

## Language

**English (United States)**

## Additional fields (optional)

- Homepage URL: `https://lemoon01110.github.io/material-desk/`
- Support URL: `https://github.com/lemoon01110/material-desk/issues`
- Mature content: off

## Graphic assets

- Store icon: 128x128 PNG, comes from the ZIP (`icons/icon128.png`). Chrome recommends 96x96 artwork with 16 px of
  transparent padding on each side.
- Screenshots: 1 to 5 images, 1280x800 (preferred) or 640x400, square corners, no padding. Take them from `store/`.
- Small promo tile: 440x280 PNG or JPEG, from `store/`.
- Marquee promo tile (optional): 1400x560 PNG or JPEG. Only needed to be considered for featuring.

## Before you paste: check against the final build

- Every feature named in the description must work in the uploaded version (review rejects listings that promise
  things the item does not do). If the wallpaper feature or any Google app link changes, edit the text above.
- Do not repeat a keyword many times. Chrome's policy names "unnatural repetition of the same keyword more than 5
  times" as keyword spam.
- Do not put the privacy policy only in the description. It goes in the Privacy tab field (see PERMISSIONS.md).
