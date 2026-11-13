/*
 * Material Desk core. Loaded first, before the page is parsed, so the look paints at once. Gives every part of the
 * page:
 *   - the look: Material 3 colors as CSS variables --dl-<role> (primary, surface_container_high, ...), the wallpaper,
 *     the font and the page scale. Two sources:
 *       1. a managed look from the optional desktop integration (admin policy, chrome.storage.managed: colors,
 *          background, font, scale; see schema.json). When present it wins.
 *       2. otherwise the wallpaper picked in Settings (scripts/wallpaper.js): a built-in or an uploaded picture
 *          (kept in IndexedDB) with a dark scheme made from it, saved under the storage key "wallpaper".
 *     Both are cached in localStorage ("desktopLook", "userLook") so a new tab paints instantly;
 *   - Lemon.store: promise wrappers around chrome.storage.local (get(key, fallback), set(key, value));
 *   - Lemon.settings: the page settings (defaults below) with get(), set(patch) and onChange(callback);
 *   - Lemon.look: the wallpaper state and how to change it (used by scripts/wallpaper.js).
 * The window.Lemon name and the storage keys are kept from the project's first name, so saved data carries over.
 * See ARCHITECTURE.md.
 */
(function () {
    const root = document.documentElement;
    const api = typeof chrome !== "undefined" ? chrome : {};

    // Fahrenheit where the browser's region uses it (United States and a few others), else Celsius.
    function localUnits() {
        try {
            const region = new Intl.Locale(navigator.language || "en-US").maximize().region;
            return ["US", "LR", "MM", "BS", "BZ", "KY", "PW", "FM", "MH"].includes(region) ? "F" : "C";
        } catch (e) { return "C"; }
    }

    const DEFAULTS = {
        units: localUnits(),   // "F" | "C"
        useGPS: true,          // weather place from GPS, else `location`
        location: "",          // typed place; empty means "where the internet address says"
        engine: "default",     // default (Chrome's own engine, chrome.search) | google | duckduckgo | bing | brave |
                               //   wikipedia | youtube. Installs from before "default" existed keep "google" (below).
        suggestions: false,    // search suggestions while typing (new installs: off until turned on, see below)
        weatherAsked: false,   // the first-run weather question was answered (weather-card.js); nothing is sent before
        voice: true,           // mic button in the search bar (Chrome's speech recognition, center.js)
        aiMode: true,          // Google AI Mode button in the search bar, only while Google is the engine
        showSeconds: true,     // the clock's second dot
        weather: true,         // weather card in the center
        todo: true,            // to-do column on the left
        bookmarks: true,       // bookmarks column on the right
        apps: true,            // Google apps row in the right column
        bookmarksView: "grid", // "grid" | "list"
        panelOpacity: 88,      // side panels and cards, percent
        magnify: true,         // dock magnification over the weather strip (weather-card.js)
        magSize: 26,           //   how much the item under the mouse grows, percent
        magSpread: 115,        //   how far the bell curve reaches, percent of one item's width
        magLift: 9,            //   how far the item under the mouse rises, px
        todoCollapsed: false,      // to-do column folded to a slim rail (collapse.js)
        bookmarksCollapsed: false, // right column folded to a slim rail
        todoSize: "normal",        // "normal" (320px) | "wide" (half the page); folding is todoCollapsed (collapse.js)
        bookmarksSize: "normal",
    };

    // ---- storage -------------------------------------------------------------------------------------------------
    const local = api.storage && api.storage.local;

    // One-time import of to-dos from MYNT, an earlier new tab page that some self-hosted installs replaced under the
    // same extension ID: its localStorage "todoList" ({ id: { title, status: "pending"|"completed", pinned } }) is
    // still readable then. Pending items land in Today (pinned ones repeat daily), finished ones as done. MYNT's copy
    // is left untouched. A store install has nothing to import and only sets the flag.
    async function importMynt() {
        if (!local) return;
        const have = await local.get(["todo", "myntImported"]);
        if (have.myntImported) return;
        let old = null;
        try { old = JSON.parse(localStorage.getItem("todoList") || "null"); } catch (e) { old = null; }
        const entries = old && typeof old === "object" ? Object.values(old).filter((t) => t && t.title) : [];
        if (have.todo === undefined && entries.length) {
            const d = new Date(), today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            const now = Date.now();
            const items = entries.map((t, i) => {
                const done = t.status === "completed";
                return { id: crypto.randomUUID(), title: String(t.title), notes: "", listId: "inbox", sectionId: null,
                    due: today, time: null, priority: 0, tags: [], repeat: t.pinned ? "daily" : null, subtasks: [],
                    done, completedAt: done ? now : null, createdAt: now, order: i };
            });
            await local.set({ todo: { version: 1, lists: [{ id: "inbox", name: "Inbox", color: "secondary", sections: [] }],
                items, tagColors: {}, focusId: null, view: "today" } });
        }
        await local.set({ myntImported: true });
    }
    // Was the page run before this load? Every earlier version set "myntImported" on its first load, so it tells an
    // existing install from a new one. Asked before importMynt() can set the flag for this load.
    const ranBefore = local ? local.get("myntImported").then((r) => !!r.myntImported, () => false) : Promise.resolve(false);
    const imported = importMynt().catch((e) => console.warn("MYNT to-do import", e));

    const store = {
        async get(key, fallback) {
            if (key === "todo") await imported;
            if (!local) {
                try { const v = localStorage.getItem("lemon:" + key); return v === null ? fallback : JSON.parse(v); }
                catch (e) { return fallback; }
            }
            const r = await local.get(key);
            return r[key] === undefined ? fallback : r[key];
        },
        async set(key, value) {
            if (!local) { localStorage.setItem("lemon:" + key, JSON.stringify(value)); return; }
            await local.set({ [key]: value });
        },
    };

    // ---- settings ------------------------------------------------------------------------------------------------
    // What a saved value may be beyond its default's type: the choices of a pick-one setting and the range of a
    // number (the same limits as the controls in Settings). Damaged storage, an old cache or an imported file must
    // not reach the page as engine "nope" or a panel opacity of "abc%".
    const CHOICES = {
        units: ["F", "C"],
        engine: ["default", "google", "duckduckgo", "bing", "brave", "wikipedia", "youtube"],
        bookmarksView: ["grid", "list"],
        todoSize: ["normal", "wide", "full"],
        bookmarksSize: ["normal", "wide", "full"],
    };
    const LIMITS = { panelOpacity: [60, 100], magSize: [0, 60], magSpread: [50, 300], magLift: [0, 24] };
    // The keys of `raw` that are known settings with a usable value (numbers rounded into range). Keys that are
    // missing or bad are left out, so the caller decides what fills them.
    function cleanSettings(raw) {
        const out = {};
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
        for (const [k, def] of Object.entries(DEFAULTS)) {
            let v = raw[k];
            if (v === undefined || typeof v !== typeof def) continue;
            if (typeof v === "number") {
                if (!Number.isFinite(v)) continue;
                if (LIMITS[k]) v = Math.max(LIMITS[k][0], Math.min(LIMITS[k][1], Math.round(v)));
            }
            if (CHOICES[k] && !CHOICES[k].includes(v)) continue;
            if (k === "location") v = v.trim().slice(0, 200);
            out[k] = v;
        }
        return out;
    }
    let current = { ...DEFAULTS };
    try { Object.assign(current, cleanSettings(JSON.parse(localStorage.getItem("lemon:settingsCache") || "{}"))); } catch (e) { /* */ }
    const listeners = [];
    const cacheSettings = () => { try { localStorage.setItem("lemon:settingsCache", JSON.stringify(current)); } catch (e) { /* */ } };
    const tell = (patch) => listeners.forEach((cb) => { try { cb({ ...current }, patch); } catch (e) { console.error(e); } });
    const mine = new Set();   // settings this tab wrote, so their storage event is not taken for another tab's change
    const settings = {
        defaults: DEFAULTS,
        clean: cleanSettings,   // also used by Import in settings.js
        get: () => ({ ...current }),
        async set(patch) {
            const before = current;
            current = { ...current, ...patch };
            cacheSettings();
            const sent = JSON.stringify(current);
            mine.add(sent);
            try { await store.set("settings", current); }
            catch (e) {
                // Not saved: take the patch back, so this tab, its cache and the storage agree.
                mine.delete(sent);
                current = { ...current };
                for (const k of Object.keys(patch)) current[k] = before[k];
                cacheSettings();
                throw e;
            }
            applySettings();
            tell(patch);
        },
        onChange(cb) { listeners.push(cb); },
    };
    // Another tab changed a setting: follow it, so this tab's next change does not write its old copy back.
    if (api.storage && api.storage.onChanged) {
        api.storage.onChanged.addListener((changes, area) => {
            if (area !== "local" || !changes.settings) return;
            const raw = changes.settings.newValue, sent = JSON.stringify(raw);
            if (mine.delete(sent)) return;
            const next = { ...DEFAULTS, ...cleanSettings(raw) }, patch = {};
            for (const k of Object.keys(next)) if (JSON.stringify(next[k]) !== JSON.stringify(current[k])) patch[k] = next[k];
            if (!Object.keys(patch).length) return;
            current = next;
            cacheSettings();
            applySettings();
            tell(patch);
        });
    }
    const ready = Promise.all([store.get("settings", {}), ranBefore]).then(async ([saved, before]) => {
        if (!saved || typeof saved !== "object" || Array.isArray(saved)) saved = {};
        const fill = {};
        // "Chrome default" became the default engine later. An install from before that never saved an engine (it never
        // changed a setting) keeps searching with Google, as it always did. A new install gets "default".
        if (saved.engine === undefined) fill.engine = before ? "google" : DEFAULTS.engine;
        // Nothing leaves the device before the user says so (Chrome Web Store disclosure policy): a new install asks
        // before the weather looks up a place (weather-card.js), and search suggestions start off. An install that
        // already ran (its engine is saved) keeps the weather and suggestions it had.
        const old = saved.engine !== undefined;
        if (saved.weatherAsked === undefined) fill.weatherAsked = old;
        if (saved.suggestions === undefined) fill.suggestions = old;
        // One write, so a second tab opening meanwhile sees all of it or none of it.
        if (Object.keys(fill).length) {
            saved = { ...saved, ...fill };
            const sent = JSON.stringify(saved);
            mine.add(sent);   // this tab's own write, not another tab's change
            try { await store.set("settings", saved); } catch (e) { mine.delete(sent); console.warn("settings", e); }
        }
        // The checks run after the migration above, which goes by which keys were ever saved. A bad value falls back
        // to its default here; storage keeps it until the next change writes this clean copy.
        current = { ...DEFAULTS, ...cleanSettings(saved) };
        try { localStorage.setItem("lemon:settingsCache", JSON.stringify(current)); } catch (e) { /* */ }
        applySettings();
        return current;
    });

    function applySettings() {
        root.style.setProperty("--panel-alpha", current.panelOpacity + "%");
        for (const k of ["todo", "bookmarks", "weather", "apps", "showSeconds"]) root.classList.toggle("no-" + k, !current[k]);
        root.classList.toggle("fold-todo", !!current.todoCollapsed);
        root.classList.toggle("fold-bookmarks", !!current.bookmarksCollapsed);
    }
    applySettings();

    // ---- look ----------------------------------------------------------------------------------------------------
    // The built-in wallpapers (wallpapers/<id>.svg, drawn by tools/wallpapers.py) and the first-run default, whose
    // scheme is worked out ahead of time (tonal spot, dark, from the picture) so the very first tab paints in it.
    const BUILTINS = [["dusk", "Dusk"]];   // only Dusk is kept (2026-11-12); a saved Dune, Tide, ... falls back to it
    const DEFAULT_COLORS = {
        primary: "#d6bbfb", on_primary: "#3b255b", primary_container: "#523c73", on_primary_container: "#eddcff",
        secondary: "#cec2db", on_secondary: "#352d40", secondary_container: "#4c4357",
        on_secondary_container: "#ebddf7", tertiary: "#f1b7c2", on_tertiary: "#4b252e",
        tertiary_container: "#643b44", on_tertiary_container: "#ffd9df", error: "#ffb4ab", on_error: "#690005",
        error_container: "#93000a", on_error_container: "#ffdad6", surface: "#151218",
        surface_container_lowest: "#100d12", surface_container_low: "#1d1a20", surface_container: "#211e24",
        surface_container_high: "#2c292f", surface_container_highest: "#37333a", on_surface: "#e7e0e8",
        on_surface_variant: "#cbc4cf", outline: "#958e99", outline_variant: "#4a454e", inverse_surface: "#e7e0e8",
        inverse_on_surface: "#322f35", inverse_primary: "#6a538c", scrim: "#000000", shadow: "#000000",
        source_color: "#4c3470", background: "#151218", on_background: "#e7e0e8", surface_dim: "#151218",
        surface_bright: "#3b383e", surface_variant: "#4a454e", surface_tint: "#d6bbfb", primary_fixed: "#eddcff",
        primary_fixed_dim: "#d6bbfb", on_primary_fixed: "#250e45", on_primary_fixed_variant: "#523c73",
        secondary_fixed: "#ebddf7", secondary_fixed_dim: "#cec2db", on_secondary_fixed: "#1f182a",
        on_secondary_fixed_variant: "#4c4357", tertiary_fixed: "#ffd9df", tertiary_fixed_dim: "#f1b7c2",
        on_tertiary_fixed: "#321019", on_tertiary_fixed_variant: "#643b44"
    };
    const DEFAULT_WALLPAPER = { id: "dusk", dim: 15, colors: DEFAULT_COLORS };

    const isManagedLook = (cfg) => !!cfg && typeof cfg === "object" &&
        ((cfg.colors && Object.keys(cfg.colors).length > 0) || !!cfg.background);

    function styleFor(cfg) {
        const colors = (cfg && cfg.colors) || {};
        let vars = "";
        for (const [role, value] of Object.entries(colors)) {
            if (/^#[0-9a-f]{6}$/i.test(value) && /^[a-z_]+$/.test(role)) vars += `--dl-${role}: ${value};`;
        }
        if (cfg && cfg.font && /^[\w .-]+$/.test(cfg.font)) vars += `--f-body: "${cfg.font}", "Google Sans Flex", sans-serif;`;
        vars += `--bg-dim: ${Math.max(0, Math.min(90, +(cfg && cfg.dim) || 0))}%;`;
        // The page is designed for 100%. A managed look is for a desktop that runs Chrome at 125% (interface scale
        // times zoom), so it shrinks the page back by 0.8 unless it gives its own scale. Picked wallpapers pass 1.
        const scale = (cfg && (cfg.scale || cfg.myntScale)) || 0.8;
        // First paint already in the right layout: decide narrow mode now (collapse.js keeps it current) and hold all
        // animation until collapse.js has settled the page.
        window.__lemonScale = scale;
        root.classList.toggle("narrow", window.innerWidth / scale < 1240);
        if (!window.__lemonSettled) root.classList.add("lemon-loading");
        return `:root { ${vars} } html { zoom: ${scale}; }`;
    }
    function applyLook(cfg) {
        window.desktopLook = cfg || {};
        let tag = document.getElementById("lemon-look");
        if (!tag) { tag = document.createElement("style"); tag.id = "lemon-look"; root.appendChild(tag); }
        tag.textContent = styleFor(cfg);
        root.style.removeProperty("--bg-dim");   // drop a slider preview
        if (document.body) showBackground();
        document.dispatchEvent(new CustomEvent("lemon:look"));
    }
    function showBackground() {
        const bg = window.desktopLook && window.desktopLook.background;
        // Absolute addresses: a url() inside a custom property resolves against the stylesheet that uses it.
        const abs = (u) => { try { return new URL(u, location.href).href; } catch (e) { return u; } };
        const css = [].concat(bg || []).filter(Boolean).map((u) => `url("${abs(u)}")`).join(", ");
        if (css) document.body.style.setProperty("--bg-image", css);
        else document.body.style.removeProperty("--bg-image");
    }
    document.addEventListener("DOMContentLoaded", showBackground);

    // Uploaded wallpapers live in IndexedDB (too big for chrome.storage.local's comfort and for localStorage).
    const idb = {
        open() {
            return new Promise((resolve, reject) => {
                const r = indexedDB.open("material-desk", 1);
                r.onupgradeneeded = () => r.result.createObjectStore("files");
                r.onsuccess = () => resolve(r.result);
                r.onerror = () => reject(r.error);
            });
        },
        async run(mode, fn) {
            const db = await idb.open();
            try {
                return await new Promise((resolve, reject) => {
                    const tx = db.transaction("files", mode), req = fn(tx.objectStore("files"));
                    tx.oncomplete = () => resolve(req && req.result);
                    tx.onerror = tx.onabort = () => reject(tx.error);
                });
            } finally { db.close(); }
        },
        get: (key) => idb.run("readonly", (s) => s.get(key)),
        put: (key, value) => idb.run("readwrite", (s) => s.put(value, key)),
        del: (key) => idb.run("readwrite", (s) => s.delete(key)),
    };

    let managedNow = false;          // a managed look is in effect
    let wallpaper = null;            // the picked wallpaper state { id, dim, colors, thumb?, source? }
    let customUrl = null;            // object URL of the uploaded picture while it is shown
    let customPic = null;            // the `pic` stamp of the picture behind customUrl
    const lookListeners = [];
    const tellLook = () => lookListeners.forEach((cb) => { try { cb(); } catch (e) { console.error(e); } });

    function cleanWallpaper(w) {
        if (!w || typeof w !== "object" || typeof w.id !== "string") return { ...DEFAULT_WALLPAPER };
        const known = w.id === "custom" || BUILTINS.some(([id]) => id === w.id);
        if (!known) return { ...DEFAULT_WALLPAPER };
        // The default wallpaper saved without its scheme (an imported file carries none, so does damaged storage):
        // use the precomputed one that a new install paints with, so the page never shows the CSS fallback colors.
        if (w.id === DEFAULT_WALLPAPER.id && !(w.colors && w.colors.primary)) return { ...w, colors: DEFAULT_COLORS };
        return w;
    }
    async function showCustom(w) {
        let blob = null;
        try { blob = await idb.get("wallpaper"); } catch (e) { console.warn("wallpaper", e); }
        if (managedNow || wallpaper !== w) return;   // something else was picked meanwhile
        if (customUrl) { URL.revokeObjectURL(customUrl); customUrl = null; }
        if (blob) { customUrl = URL.createObjectURL(blob); customPic = w.pic; }
        applyLook({ colors: w.colors, dim: w.dim, scale: 1, background: [customUrl, w.thumb] });
    }
    function applyWallpaper(w) {
        wallpaper = cleanWallpaper(w);
        if (managedNow) return;
        if (wallpaper.id === "custom") {
            // The picture already shown is reused (a Dim change); otherwise the small placeholder paints at once and
            // the full picture follows from IndexedDB a moment later.
            const same = customUrl && customPic === wallpaper.pic;
            applyLook({ colors: wallpaper.colors, dim: wallpaper.dim, scale: 1, background: [same ? customUrl : null, wallpaper.thumb] });
            if (!same) showCustom(wallpaper);
        } else {
            if (customUrl) { URL.revokeObjectURL(customUrl); customUrl = null; }
            applyLook({ colors: wallpaper.colors, dim: wallpaper.dim, scale: 1, background: `wallpapers/${wallpaper.id}.svg` });
        }
    }

    // First paint from the caches: a managed look if one was seen, else the picked wallpaper, else the default.
    let cachedManaged = null;
    try { cachedManaged = JSON.parse(localStorage.getItem("desktopLook") || "null"); } catch (e) { cachedManaged = null; }
    let cachedWallpaper = null;
    try { cachedWallpaper = JSON.parse(localStorage.getItem("userLook") || "null"); } catch (e) { cachedWallpaper = null; }
    if (isManagedLook(cachedManaged)) { managedNow = true; wallpaper = cleanWallpaper(cachedWallpaper); applyLook(cachedManaged); }
    else applyWallpaper(cachedWallpaper);

    // Then the real sources. The managed policy first (it wins), then the saved wallpaper.
    const managed = api.storage && api.storage.managed;
    const managedChecked = new Promise((resolve) => {
        if (!managed) { resolve(); return; }
        try {
            managed.get(null, (cfg) => {
                if (api.runtime && api.runtime.lastError) cfg = {};
                if (isManagedLook(cfg)) {
                    const fresh = JSON.stringify(cfg);
                    const was = managedNow;
                    managedNow = true;
                    if (!was || fresh !== localStorage.getItem("desktopLook")) {
                        try { localStorage.setItem("desktopLook", fresh); } catch (e) { /* too big to cache: still shown */ }
                        applyLook(cfg);
                        if (!was) tellLook();
                    }
                } else {
                    try { localStorage.removeItem("desktopLook"); } catch (e) { /* */ }
                    if (managedNow) { managedNow = false; applyWallpaper(wallpaper); tellLook(); }
                }
                resolve();
            });
        } catch (e) { resolve(); }
    });
    const lookReady = store.get("wallpaper", null).then(async (saved) => {
        await managedChecked;
        const w = cleanWallpaper(saved);
        if (JSON.stringify(w) !== JSON.stringify(wallpaper)) {
            try { localStorage.setItem("userLook", JSON.stringify(w)); } catch (e) { /* */ }
            applyWallpaper(w);
            tellLook();
        }
    }).catch((e) => console.warn("wallpaper", e));
    // Another tab picked a wallpaper: follow it.
    if (api.storage && api.storage.onChanged) {
        api.storage.onChanged.addListener((changes, area) => {
            if (area !== "local" || !changes.wallpaper) return;
            const w = cleanWallpaper(changes.wallpaper.newValue);
            if (JSON.stringify(w) === JSON.stringify(wallpaper)) return;
            try { localStorage.setItem("userLook", JSON.stringify(w)); } catch (e) { /* */ }
            applyWallpaper(w);
            tellLook();
        });
    }

    const look = {
        builtins: BUILTINS,
        defaultWallpaper: DEFAULT_WALLPAPER,
        ready: lookReady,
        managed: () => managedNow,
        wallpaper: () => ({ ...wallpaper }),
        // Save and show a wallpaper state. `blob` (optional) is a new uploaded picture for "custom".
        async set(w, blob) {
            if (blob) await idb.put("wallpaper", blob);
            if (w.id !== "custom") { try { await idb.del("wallpaper"); } catch (e) { /* none */ } }
            const clean = cleanWallpaper({ ...w, at: Date.now(), ...(blob ? { pic: Date.now() } : {}) });
            try { localStorage.setItem("userLook", JSON.stringify(clean)); } catch (e) { /* */ }
            applyWallpaper(clean);
            await store.set("wallpaper", clean);
            tellLook();
        },
        // Dim while the slider moves, without saving.
        preview(dim) {
            if (managedNow) return;
            root.style.setProperty("--bg-dim", Math.max(0, Math.min(90, +dim || 0)) + "%");
        },
        onChange(cb) { lookListeners.push(cb); },
    };

    // Read a color role, e.g. Lemon.color("primary").
    const color = (role) => getComputedStyle(root).getPropertyValue("--dl-" + role).trim();

    window.Lemon = { store, settings, ready, color, look };
    // Each new tab nudges the background worker to look for a newer build (background.js part 2).
    try { if (api.runtime && api.runtime.sendMessage && api.runtime.id !== "devlemon") api.runtime.sendMessage({ type: "lemon-check-update" }).catch(() => {}); } catch (e) { /* */ }
})();
