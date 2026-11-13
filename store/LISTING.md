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
A calm new tab with a clock, weather, to-dos and your bookmarks, all colored to match your wallpaper.
```

(101 characters, the same as `extension/manifest.json`. It makes no "data stays on your device" claim: the weather and
search suggestions send the place and the typed text to outside services, see the Privacy paragraph below.)

## Detailed description (dashboard field "Description")

```
Material Desk swaps Chrome's new tab for one quiet page: a clock, search, the weather, your to-dos and your bookmarks. Its colors come from your wallpaper, so the whole thing matches.

What you get

• A big round clock with the date
• Search that uses the engine you already set in Chrome. You can pick a different one in settings, search by voice with the mic, and with Google picked, ask AI Mode.
• Weather for where you are: now, the next 24 hours and 10 days, with rain, wind, UV and air quality
• A to-do list with due dates, repeats, subtasks and tags. Type "call mom friday 5pm" and it sets the date for you.
• Your Chrome bookmarks, to open, search and tidy up without leaving the tab
• Shortcuts to Gmail, Drive, Calendar and other Google apps

Make it yours

Keep the built-in Dusk wallpaper or upload your own picture, and the page takes its colors from it. Fold either side column away, make the panels more or less see-through, and hide whatever you don't use.

Keyboard

Press ? on the page to see every shortcut. The ones you'll use most: s to search, n for a new to-do, b to search bookmarks, w for the weather. Chrome puts the cursor in the address bar when a new tab opens, so click the page first.

Privacy

No account, no ads, no tracking. Your to-dos and settings stay in your browser. The weather asks before it uses your location. It then goes to Open-Meteo for the forecast, and to BigDataCloud or ipinfo.io for the place name (ipinfo.io also guesses your city from your internet address if your location can't be read). Search suggestions are off until you turn them on. The mic uses Chrome's own speech recognition, which sends your voice to Google to turn it into text. Full policy: https://lemoon01110.github.io/material-desk/privacy.html

Free and open source (GPL-3.0): https://github.com/lemoon01110/material-desk

Clock style inspired by end-4's dots-hyprland. Weather data by Open-Meteo.com. Material Desk is not made by or affiliated with Google.
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
