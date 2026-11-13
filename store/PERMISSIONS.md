# Chrome Web Store "Privacy practices" tab: Material Desk

Copy each answer into the matching field of the Privacy practices tab in the Developer Dashboard.

Written from `extension/manifest.json` as it was on 2026-11-12 (version 4.0.0.23, permissions storage, bookmarks, favicon, geolocation and search). The dashboard shows one justification box for each permission in the uploaded
ZIP. If the final manifest adds or drops a permission, add or drop its answer here before you submit (see "Check
before submitting" at the end).

---

## 1. Single purpose description

```
Material Desk replaces Chrome's new tab page with a personal start page that brings together a clock, a web search bar, local weather, a to-do list and the user's bookmarks, colored from a wallpaper the user picks.
```

---

## 2. Permission justifications

### storage

```
Saves the user's settings (units, typed location, chosen search engine, layout, panel opacity), to-do lists, the bookmark view and the chosen wallpaper in chrome.storage.local on the user's device so they persist across new tabs. The weather cache is kept in the page's local storage and an uploaded wallpaper picture in IndexedDB, also only on the device. Nothing in storage is sent to the developer.
```

### bookmarks

```
The right column of the new tab shows the user's Chrome bookmarks and lets the user browse, search, add, edit, move and delete them. The bookmarks permission is needed to read and change the bookmark tree for this feature. Bookmarks are not sent anywhere.
```

### favicon

```
Shows each bookmark's site icon next to it, using Chrome's own favicon cache through the chrome-extension://<id>/_favicon/ URL. The extension does not request icons from any web service itself.
```

### geolocation

```
Used only for the weather card. The first time the page opens it asks "Use my location", "Type a city" or "No weather", and nothing is looked up before the user answers. When "Use my location" is on in settings, the page reads the device location once per refresh and sends the coordinates, rounded to 3 decimals, to Open-Meteo to get the local forecast and air quality, and once per new location to BigDataCloud to show the city name. Nothing is requested while the weather card is turned off. The user can turn location off in settings and type a city instead.
```

### search

```
The new tab's search bar runs web searches with the search engine set in the user's Chrome settings: it passes the typed text to chrome.search.query, in the current tab or, on a Ctrl, Cmd or middle click, a new tab. This "Chrome default" choice is the default search engine of the search bar, so searches from the new tab respect the user's search settings. The extension does not see the results and sends the query nowhere itself.
```

(History: `search` was dropped on 2026-11-12 while `chrome.search` was not called, and added back the same day when the
search bar started to use `chrome.search.query`, see `scripts/center.js` and SUBMIT.md risk 1.)

### Host permission: https://www.google.com/complete/search*

```
Fetches search suggestions from Google while the user types in the new tab's search bar, only when the user turned on "Suggestions" (off on a new install) and picked Google as the engine (not with the default "Chrome default" engine). Only the typed text is sent.
```

### Host permission: https://duckduckgo.com/ac/*

```
Fetches search suggestions from DuckDuckGo while the user types in the search bar, only when the user turned on "Suggestions" (off on a new install) and picked DuckDuckGo as the engine. Only the typed text is sent.
```

### Host permission: https://api.open-meteo.com/*

```
Gets the weather forecast (current conditions, hourly and 10-day) for the weather card. The request contains only latitude and longitude.
```

### Host permission: https://air-quality-api.open-meteo.com/*

```
Gets the air quality index shown in the weather card for the same coordinates. The request contains only latitude and longitude.
```

### Host permission: https://geocoding-api.open-meteo.com/*

```
Turns a city name the user typed in settings into coordinates for the weather forecast. Only the typed city name is sent.
```

### Host permission: https://api.bigdatacloud.net/*

```
Looks up the city name for the device coordinates so the weather card can show where the forecast is for. Only latitude and longitude are sent. BigDataCloud may answer from its own api-bdc.io address.
```

### Host permission: https://ipinfo.io/*

```
Fallback for the weather card when no device location and no typed city are available (or to name the place when the city lookup fails): ipinfo.io returns an approximate city and coordinates for the request's IP address. No other data is sent.
```

If the dashboard shows one box for all host permissions instead of one per host, paste this:

```
The extension contacts only these fixed hosts, each for one visible feature of the new tab page: Google and DuckDuckGo suggestion endpoints for search suggestions while typing (optional, can be turned off). Open-Meteo forecast, air quality and geocoding APIs for the weather card (coordinates or a typed city name only). BigDataCloud reverse geocoding to show the city name for the coordinates. ipinfo.io as a fallback to estimate the city from the IP address when no location is available. There are no wildcard or all-sites host permissions and no content scripts.
```

---

## 3. Remote code

Answer: **"No, I am not using remote code."**

If a justification box is shown anyway:

```
All JavaScript is included in the extension package. The extension loads no external scripts, uses no eval or new Function on fetched text, and the only network requests are JSON data requests (weather, geocoding, search suggestions).
```

---

## 4. Data usage

### 4a. What user data does the item collect?

The dashboard lists data categories with checkboxes. Google's documentation shows the list only as an image, so match
the wording you see. The categories (as reported when the form launched) are: personally identifiable information,
health information, financial and payment information, authentication information, personal communications,
location, web history, user activity and website content.

Google's User Data FAQ says data that is only processed or stored locally still has to be disclosed. So tick:

| Category | Tick? | Why |
|---|---|---|
| Personally identifiable information | No | No name, email, address or ID is read or stored. |
| Health information | No | |
| Financial and payment information | No | |
| Authentication information | No | No passwords or logins. |
| Personal communications | No | |
| **Location** | **Yes** | Device coordinates (geolocation) and an IP-based approximate location are used for the weather card and sent to Open-Meteo, BigDataCloud and ipinfo.io. The typed city name is also stored locally. |
| **Web history** | **Yes** | The extension reads and edits the user's bookmarks (page titles and addresses). They stay on the device, but ticking this is the safe choice because bookmarks are lists of web pages. |
| **User activity** | **Yes** | Text typed into the search bar is sent to Google or DuckDuckGo for suggestions when that setting is on and that engine is picked. Searches with "Chrome default" are handed to Chrome, which sends them to the user's own search engine. The mic button uses Chrome's built-in speech recognition (Chrome sends the audio to Google and returns text; the extension never handles audio). |
| Website content | No | The extension reads no page content. To-dos and the uploaded wallpaper are the user's own content kept on the device and none of the categories describes them. The privacy policy covers them. |

If you want to be even more careful, also tick "Website content" for the user-written to-dos. It does no harm to
over-disclose. It does harm to under-disclose.

### 4b. Certifications (tick all three)

The form asks you to certify that you:

- [x] Do not sell or transfer user data to third parties, outside of the approved use cases.
- [x] Do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- [x] Do not use or transfer user data to determine creditworthiness or for lending purposes.

All three are true for Material Desk: the developer receives no data at all, there are no ads or analytics, and the
only transfers are the requests to the weather, geocoding and suggestion services that the user-facing features need.
Google's Limited Use policy allows transfers "necessary for the single purpose".

### 4c. Privacy policy URL

```
https://lemoon01110.github.io/material-desk/privacy.html
```

This page is `docs/privacy.html` in the repo. It only works after the repo is public and GitHub Pages is turned on
for the `docs/` folder (see SUBMIT.md). Open the link in a browser before you submit: a dead privacy link is a common
rejection reason.

---

## 5. Things in the manifest that need no justification box

- `chrome_url_overrides.newtab`: the new tab override is the item itself, covered by the single purpose.
- `background.service_worker`: no permission. It listens to tab open and close events only to apply updates, which
  needs no `tabs` permission.
- `storage.managed_schema`: left out of the store build by `tools/build.sh store` (it is only for the author's own desktop).
- `update_url`: removed automatically by `tools/build.sh store`. The store build must not contain it.

## Check before submitting

1. Open `dist/store/manifest.json` (the build that becomes the ZIP) and compare its `permissions` and
   `host_permissions` with the headings above. One answer per permission, no answer for a permission that is gone.
2. If the wallpaper upload uses IndexedDB only, no extra permission is needed (IndexedDB needs none). If a
   `unlimitedStorage` permission is added for big images, add this answer:
   `Keeps the wallpaper image the user uploads in IndexedDB on the device. Large photos can exceed the default storage quota.`
3. The background worker only applies waiting updates (the earlier one-time bookmark cleanup was removed). If any
   code that deletes bookmarks comes back, describe it in the listing first.
