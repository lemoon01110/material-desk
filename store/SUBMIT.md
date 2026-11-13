# Submitting Material Desk to the Chrome Web Store

A step-by-step checklist for the Chrome Web Store Developer Dashboard. No terminal needed. Where a file has to be
made (the ZIP, screenshots), ask Claude to make it and tell you where it is.

Files this checklist uses:

- `store/LISTING.md`: the text for the Store listing tab.
- `store/PERMISSIONS.md`: the answers for the Privacy practices tab.
- `docs/privacy.html`: the privacy policy, published at https://lemoon01110.github.io/material-desk/privacy.html
- `dist/material-desk-VERSION.zip`: the package to upload (made by the store build, without `update_url`).
- `store/`: the screenshots (1280x800) and the small promo tile (440x280). These were not made yet on 2026-11-12.

---

## Part A. Before you open the dashboard

1. **Fix the known review risks** (section "Known review risks" at the end). Ask Claude to do them in `extension/`.
   The one that mattered most, the search bar going through Chrome's search API, is done (risk 1).
2. **Check the manifest text.** In the final `extension/manifest.json` the `name` must be `Material Desk` and the
   `description` must be the short description from LISTING.md. These two can not be edited in the dashboard later
   without uploading a new version.
3. **Build the ZIP.** Ask Claude for the store build. You get `dist/material-desk-VERSION.zip`. Install the unpacked
   `dist/store/` folder once in Chrome (chrome://extensions, Developer mode, "Load unpacked") and click through every
   feature. Reviewers reject items with broken features or missing files.
4. **Make the images.** Ask Claude for:
   - 1 to 5 screenshots, **1280x800** (640x400 also allowed), square corners, no padding, PNG or JPEG.
   - A **440x280** small promo tile (PNG or JPEG). Optional, but items without it are shown after items that have it.
   - Optional: a 1400x560 marquee tile (only needed to be featured).
   - The 128x128 store icon comes from the ZIP. Google recommends 96x96 artwork with 16 px transparent padding.
5. **Publish the privacy policy.** The repo has to be public on GitHub first. Then on github.com:
   1. Open the repository, then **Settings**, then **Pages** (left menu).
   2. Under "Build and deployment", Source: **Deploy from a branch**.
   3. Branch: **main**, folder: **/docs**, then **Save**.
   4. Wait a minute or two, then open https://lemoon01110.github.io/material-desk/privacy.html in a browser. It must
      load. A missing or dead privacy policy link is a rejection reason.
6. **Turn on 2-Step Verification** on the Google account you will publish with (Google requires it before you can
   publish or update an item). Google account settings, Security, 2-Step Verification.

## Part B. Register as a Chrome Web Store developer (once)

1. Pick the Google account. Google suggests a separate account just for publishing. The developer email **cannot be
   changed** later, so pick one you will keep.
2. Open the Chrome Web Store Developer Dashboard: https://chrome.google.com/webstore/devconsole
3. Accept the developer agreement and policies.
4. Pay the **one-time registration fee**. Google's page does not print the amount. It has been US$5 since 2010
   according to Google's announcement and current guides. The dashboard shows the exact amount before you pay. One fee
   covers every item on the account.
5. On the **Account** page:
   1. **Publisher name** (required): shown as "Offered by" on the listing. For example your name or "lemoon01110".
   2. **Verify your contact email** (required): click the link in the email Google sends.
   3. **Trader or non-trader**: every developer has to declare this (an EU rule). You decide this yourself: it is
      "trader" if you publish as a business or professional, "non-trader" if it is a free personal hobby project.
      Traders must give a legal name, address and SMS-verified phone number, and these are shown publicly on the
      listing.
   4. Physical address: only needed if the item sells something. Material Desk does not, so skip it.
   5. Optional: turn on email notifications for "staged" and "published" so you know when review finishes.

Note: a new publisher can have at most two published items at first. That is fine for Material Desk.

## Part C. Add the item

1. In the dashboard click **Add new item**, then **Choose file**, pick `dist/material-desk-VERSION.zip`, then
   **Upload**.
2. If the upload shows an error, stop and send Claude the exact message.

## Part D. Store listing tab

Open `store/LISTING.md` and copy:

1. **Description**: the whole "Detailed description" block.
2. **Category**: Productivity (pick the closest match in the list).
3. **Language**: English (United States).
4. **Store icon**: shown from the ZIP. Upload `icon128.png` here too if the field asks for it.
5. **Screenshots**: upload the 1280x800 images from `store/` (at least 1, best 3 to 5).
6. **Small promo tile**: upload the 440x280 image from `store/`.
7. **Marquee promo tile**: leave empty unless you made one.
8. **Additional fields**: Homepage URL `https://lemoon01110.github.io/material-desk/`, Support URL
   `https://github.com/lemoon01110/material-desk/issues`. Leave "Official URL" empty (only for verified sites).
   Mature content: off.
9. Click **Save draft**.

## Part E. Privacy practices tab

Open `store/PERMISSIONS.md` and copy:

1. **Single purpose description**: section 1.
2. **Permission justification**: one box per permission. Paste the matching text from section 2. If the dashboard
   shows a permission that PERMISSIONS.md has no answer for, stop and ask Claude (it means the manifest changed).
3. **Remote code**: choose "No, I am not using remote code."
4. **Data usage**: tick the categories marked "Yes" in section 4a (Location, Web history, User activity).
5. **Certifications**: tick all three statements in section 4b.
6. **Privacy policy URL**: `https://lemoon01110.github.io/material-desk/privacy.html`
7. Click **Save draft**.

## Part F. Distribution tab

1. **Payments**: Free.
2. **Visibility**: **Public**.
3. **Distribution regions**: All regions.
4. Click **Save draft**.

## Part G. Test instructions tab

Leave it empty. Material Desk needs no login or test account. (If you want, write: "No account needed. Open a new
tab after installing.")

## Part H. Submit for review

1. Click **Submit for review** (top right). Every tab must be complete, the dashboard marks what is missing.
2. In the confirm dialog there is a checkbox to publish automatically after approval.
   - Leave it **checked** to go live as soon as review passes.
   - **Uncheck** it ("deferred publishing") if you want to press Publish yourself. You then have **30 days** after
     approval to publish, or the submission goes back to draft.
3. Click **Submit**.

## Part I. What review checks and how long it takes

- Google checks the item against the Developer Program Policies: single purpose, that each permission is really
  used and needed, the privacy policy and data disclosures match what the code does, no remote code, no hidden or
  obfuscated code (minified is fine), working features, and an honest listing (no keyword stuffing).
- Most reviews finish within a few days but can take up to a few weeks. New developers, new items and sensitive
  permissions can take longer. Material Desk has no all-sites access, which helps.
- If it is still pending after **three weeks**, contact developer support from the dashboard.
- If rejected, you get an email naming the policy (often with a code name such as "Purple Potassium" for an unused
  permission or "Yellow Zinc" for missing listing details). Send that email to Claude, fix, and submit again. A
  rejection does not affect anything already published.

## Part J. Publishing an update later

1. Ask Claude to raise the `version` in `extension/manifest.json` (every upload must have a **higher** version than
   the last one) and to make a new store build.
2. In the dashboard open Material Desk, go to the **Package** tab, click **Upload new package**, and pick the new ZIP.
3. If the update adds a permission or sends data somewhere new: update the Privacy practices tab, update
   `docs/privacy.html` (with a new effective date) first, and expect users to be asked to accept the new permission.
   Google's disclosure policy requires telling users about changed data practices.
4. Update the Store listing text or screenshots if the features changed.
5. Click **Submit for review**. Users keep the old version until the update is approved and published.

---

## Known review risks (fix before the first submission)

These come from reading the code on 2026-11-12 against the policies cited below. They are for whoever edits
`extension/`.

1. **Search on the new tab page must respect Chrome's search settings.** Done on 2026-11-12. The Program Policies
   list as a single purpose violation: "New Tab Page extensions that alter or provide a general web search experience
   without using official Chrome search APIs or respecting the user's active search settings." The search bar now has
   a "Chrome default" engine that runs the query with `chrome.search.query` (current tab, or a new tab on Ctrl, Cmd or
   middle click), so Chrome's own default search engine answers. It is the default engine for new installs.
   Installs from before keep the engine they had (Google if they never changed it). Google, DuckDuckGo, Bing, Brave,
   Wikipedia and YouTube stay as choices the user makes in the engine menu or Settings. Typed web addresses still
   open directly. "Chrome default" gets no suggestions, since the page can not tell which engine Chrome uses. The
   `search` permission is back in the manifest, with its answer in PERMISSIONS.md.
2. **Unused permission.** Done: `search` was removed on 2026-11-12 while `chrome.search` was never called, and came
   back the same day with risk 1, now used by `scripts/center.js`. Unused permissions are rejected ("Purple
   Potassium"), so keep it only while the "Chrome default" engine exists.
3. **Disclosure and consent before data leaves the device.** The Disclosure Requirements policy says an item that
   handles user data must prominently disclose what it collects and how it is used, and get the user's
   affirmative consent. The July 2026 policy update extends prominent disclosure to all data collection, enforced
   from August 1, 2026. Today the weather uses the device location by default (`useGPS: true`, and the manifest
   `geolocation` permission means Chrome shows no location prompt), falls back to ipinfo.io automatically, and search
   suggestions are on by default (on a new install they send nothing until the user picks Google or DuckDuckGo, since
   the default engine "Chrome default" has no suggestions). Recommended: a short first-run card ("Material Desk shows weather for your
   location using Open-Meteo. Use my location / Type a city / No weather" and "Show search suggestions from Google?
   Yes / No"), with nothing sent before the user answers. The listing and privacy policy already describe the data.
4. **Author-only code in the background worker.** Done: the one-time bookmark cleanup is gone from
   `scripts/background.js` and `schema.json`. What is left only applies waiting updates and asks for update checks.
5. **Names and text.** Done: the manifest, UI text, export file names and messages say Material Desk.
6. **Managed storage schema.** If the desktop color policy (`storage.managed_schema`) is not part of the public
   product, drop it from the store build.
7. **Permissions in the privacy policy.** Done: `docs/privacy.html` lists the Search permission again (point 1) and
   says how "Chrome default" searches are handled.
8. **License files in the package.** Done: `tools/build.sh` copies LICENSE (GPL-3.0) and NOTICE into every build.
9. **Minimum Chrome version.** The manifest asks for Chrome 116 or newer (`minimum_chrome_version`), the first
   version with `chrome.runtime.getContexts`, which the background worker uses.

---

## Sources (read on 2026-11-12)

- Image sizes and requirements: https://developer.chrome.com/docs/webstore/images
- Store listing tab fields: https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- Manifest description limit (132 characters) and fields read from the ZIP: https://developer.chrome.com/docs/webstore/prepare
- Registering a developer account: https://developer.chrome.com/docs/webstore/register
- Account setup (publisher name, email verification): https://developer.chrome.com/docs/webstore/set-up-account
- Trader / non-trader declaration: https://developer.chrome.com/docs/webstore/program-policies/trader-disclosure
- Registration fee amount (US$5): Chromium Blog, "Security improvements and registration" (2010), https://blog.chromium.org/2010/08/security-improvements-and-registration.html , and https://flaviocopes.com/chrome-web-store-publish/
- Privacy practices tab: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- Data categories and certification statements as launched: https://9to5google.com/2020/11/18/chrome-web-store-disclosure/
- Limited Use policy: https://developer.chrome.com/docs/webstore/program-policies/limited-use
- User data FAQ (local-only data still disclosed, privacy policy needed): https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
- Disclosure Requirements policy: https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements
- July 2026 policy update (enforced August 1, 2026): https://developer.chrome.com/blog/cws-policy-updates-2026
- Developer Program Policies (single purpose, new tab search rule, permissions, remote code, 2-Step Verification): https://developer.chrome.com/docs/webstore/program-policies/policies
- Publishing steps, item limit, deferred publishing: https://developer.chrome.com/docs/webstore/publish
- Review process and times: https://developer.chrome.com/docs/webstore/review-process
- Updating an item: https://developer.chrome.com/docs/webstore/update
- Rejection code names: https://developer.chrome.com/docs/webstore/troubleshooting
