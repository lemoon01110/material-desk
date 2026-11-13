/*
 * Material Desk: settings view (right column). See ARCHITECTURE.md.
 * Mounts into #settings-host and slides over the bookmarks in #right-col. Opened by the gear in the bookmarks header
 * (a "lemon:settings" event on #right-col) or, when the bookmarks column is hidden, by a small gear button that stays
 * in the bottom right corner (styles/settings.css). Every change goes through Lemon.settings.set, so it applies live.
 */
(function () {
    "use strict";
    const host = document.getElementById("settings-host");
    const col = document.getElementById("right-col");
    if (!host || !col || !window.Lemon) return;
    const api = typeof chrome !== "undefined" ? chrome : {};
    const local = api.storage && api.storage.local;

    const P = {
        back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
        close: "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
        check: "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
        gear: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z",
        clock: "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z",
        search: "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
        cloud: "M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A6 6 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z",
        columns: "M10 18h5V5h-5v13zm-6 0h5V5H4v13zM16 5v13h5V5h-5z",
        palette: "M12 3a9 9 0 0 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z",
        save: "M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z",
        place: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z",
        download: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
        upload: "M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z",
        reset: "M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z",
        grid: "M3 3v8h8V3H3zm6 6H5V5h4v4zm-6 4v8h8v-8H3zm6 6H5v-4h4v4zm4-16v8h8V3h-8zm6 6h-4V5h4v4zm-6 4v8h8v-8h-8zm6 6h-4v-4h4v4z",
        list: "M3 14h4v-4H3v4zm0 5h4v-4H3v4zM3 9h4V5H3v4zm5 5h13v-4H8v4zm0 5h13v-4H8v4zM8 5v4h13V5H8z",
        image: "M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z",
        info: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
    };
    const icon = (n, cls) => `<svg${cls ? ` class="${cls}"` : ""} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${P[n]}"/></svg>`;
    const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ESC[c]);

    const ENGINES = [["default", "Chrome default"], ["google", "Google"], ["duckduckgo", "DuckDuckGo"], ["bing", "Bing"], ["brave", "Brave"],
        ["wikipedia", "Wikipedia"], ["youtube", "YouTube"]];

    // ---- markup helpers ---------------------------------------------------------------------------------------------
    const sw = (key, label, desc) => `
        <div class="st-row st-row-switch" data-for="${key}">
            <div class="st-row-text">
                <span class="st-label" id="st-l-${key}">${label}</span>
                ${desc ? `<span class="st-desc" id="st-d-${key}">${desc}</span>` : ""}
            </div>
            <button type="button" role="switch" class="st-switch" data-key="${key}" aria-checked="false"
                aria-labelledby="st-l-${key}"${desc ? ` aria-describedby="st-d-${key}"` : ""}>
                <span class="st-handle">${icon("check")}</span>
            </button>
        </div>`;
    const seg = (key, label, options) => `
        <div class="st-row">
            <div class="st-row-text"><span class="st-label" id="st-l-${key}">${label}</span></div>
            <div class="st-seg" role="radiogroup" aria-labelledby="st-l-${key}">
                ${options.map(([value, text, ic]) => `<button type="button" role="radio" data-key="${key}" data-value="${value}"
                    aria-checked="false" tabindex="-1">${icon("check", "st-tick")}${ic ? icon(ic, "st-seg-ico") : ""}<span>${text}</span></button>`).join("")}
            </div>
        </div>`;
    const group = (title, ic, rows, tone) => `
        <section class="st-group" aria-labelledby="st-g-${ic}">
            <h3 class="st-group-title" id="st-g-${ic}"><span class="st-group-ico${tone ? " st-" + tone : ""}">${icon(ic)}</span>${title}</h3>
            <div class="st-card">${rows.join("")}</div>
        </section>`;

    host.innerHTML = `
        <button type="button" class="st-launcher" aria-label="Open settings" title="Settings">${icon("gear")}</button>
        <section class="st" aria-label="Settings" tabindex="-1" hidden>
            <header class="st-head">
                <button type="button" class="icon-btn st-back" aria-label="Back to bookmarks" title="Back to bookmarks">${icon("back")}</button>
                <h2 class="panel-title st-title">Settings</h2>
                <button type="button" class="st-done">Done</button>
            </header>
            <div class="st-body">
                ${group("Clock", "clock", [
                    sw("showSeconds", "Second dot", "The dot that travels around the clock"),
                ], "time")}
                ${group("Search", "search", [
                    `<div class="st-row st-row-stack">
                        <div class="st-row-text"><span class="st-label" id="st-l-engine">Search with</span></div>
                        <div class="st-chips" role="radiogroup" aria-labelledby="st-l-engine">
                            ${ENGINES.map(([v, t]) => `<button type="button" role="radio" class="st-chip" data-key="engine" data-value="${v}"
                                aria-checked="false" tabindex="-1">${icon("check", "st-tick")}<span>${t}</span></button>`).join("")}
                        </div>
                    </div>`,
                    sw("suggestions", "Suggestions", "Show ideas while you type"),
                ])}
                ${group("Weather", "cloud", [
                    sw("weather", "Weather card", "Under the search bar"),
                    seg("units", "Units", [["F", "°F"], ["C", "°C"]]),
                    sw("useGPS", "Use my location", "Find the weather where this computer is"),
                    `<div class="st-row st-row-stack">
                        <div class="st-row-text">
                            <label class="st-label" for="st-location">Place</label>
                            <span class="st-desc" id="st-d-location">Used when location is off or has no answer. Leave empty to go by your internet address.</span>
                        </div>
                        <div class="st-input">
                            ${icon("place", "st-input-ico")}
                            <input id="st-location" class="field" type="text" autocomplete="off" spellcheck="false"
                                placeholder="City or place" aria-describedby="st-d-location">
                            <span class="st-saved" aria-live="polite"></span>
                        </div>
                    </div>`,
                ])}
                ${group("Columns", "columns", [
                    sw("todo", "To-do column", "The list on the left"),
                    sw("bookmarks", "Bookmarks column", "When hidden, settings wait behind a small gear in the corner"),
                    sw("apps", "Google apps", "The app shortcuts under your bookmarks"),
                    seg("bookmarksView", "Bookmarks as", [["grid", "Grid", "grid"], ["list", "List", "list"]]),
                ])}
                ${group("Wallpaper", "image", [
                    `<div class="st-row st-row-stack st-wp-host"></div>`,
                ])}
                ${group("Look", "palette", [
                    `<div class="st-row st-row-stack">
                        <div class="st-row-line">
                            <span class="st-label" id="st-l-opacity">Panel opacity</span>
                            <output class="st-val" for="st-opacity">88%</output>
                        </div>
                        <input id="st-opacity" class="st-slider" type="range" min="60" max="100" step="1"
                            aria-labelledby="st-l-opacity">
                        <div class="st-scale" aria-hidden="true"><span>See-through</span><span>Solid</span></div>
                    </div>`,
                ])}
                ${group("Data", "save", [
                    `<div class="st-row st-row-stack">
                        <p class="st-desc st-data-desc">Your to-do list, settings and view choices, saved as one file. Bookmarks stay in Chrome.</p>
                        <div class="st-data">
                            <button type="button" class="st-btn" data-do="export">${icon("download")}Export data</button>
                            <button type="button" class="st-btn" data-do="import">${icon("upload")}Import data</button>
                            <button type="button" class="st-btn st-btn-danger" data-do="reset">${icon("reset")}Reset settings</button>
                        </div>
                        <div class="st-confirm" role="alertdialog" aria-labelledby="st-confirm-text" hidden>
                            <p id="st-confirm-text"></p>
                            <div class="st-confirm-actions">
                                <button type="button" class="st-text-btn" data-do="cancel">Cancel</button>
                                <button type="button" class="st-btn-strong" data-do="confirm"></button>
                            </div>
                        </div>
                        <p class="st-note" aria-live="polite"></p>
                        <input class="st-file" type="file" accept=".json,application/json" hidden>
                    </div>`,
                ])}
                ${group("About", "info", [
                    `<div class="st-row st-row-stack st-about">
                        <p class="st-label">Material Desk <span class="st-version"></span></p>
                        <p class="st-desc">Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> (CC BY 4.0).
                            Place names by BigDataCloud and ipinfo.io when needed.</p>
                        <p class="st-desc">Clock design after End4's dots-hyprland (GPL-3.0). Colors made with Google's
                            material-color-utilities (Apache-2.0). Fonts: Space Grotesk and Google Sans Flex (SIL Open Font License).</p>
                        <p class="st-desc">Your saved data stays in this browser. With Chrome default, searches go to the search
                            engine set in Chrome. Search suggestions, when on, send what you type to a suggestion service
                            (Google or DuckDuckGo, only when that is the chosen engine). Free software under the GPL-3.0.</p>
                    </div>`,
                ])}
            </div>
        </section>`;

    const $ = (s) => host.querySelector(s);
    const view = $(".st");
    const back = $(".st-back");
    const launcher = $(".st-launcher");
    const loc = $("#st-location");
    const slider = $("#st-opacity");
    const sliderOut = $(".st-val");
    const confirmBox = $(".st-confirm");
    const note = $(".st-note");
    const fileInput = $(".st-file");

    // ---- reflect the current settings -------------------------------------------------------------------------------
    function sync(s) {
        s = s || Lemon.settings.get();
        host.querySelectorAll(".st-switch").forEach((b) => b.setAttribute("aria-checked", String(!!s[b.dataset.key])));
        host.querySelectorAll("[role=radio][data-key]").forEach((b) => {
            const on = String(s[b.dataset.key]) === b.dataset.value;
            b.setAttribute("aria-checked", String(on));
            b.tabIndex = on ? 0 : -1;
        });
        // Make sure each radio group has one tab stop even if the saved value is unknown.
        host.querySelectorAll("[role=radiogroup]").forEach((g) => {
            if (!g.querySelector("[tabindex='0']")) { const f = g.querySelector("[role=radio]"); if (f) f.tabIndex = 0; }
        });
        if (document.activeElement !== loc) loc.value = s.location || "";
        if (document.activeElement !== slider) setSlider(s.panelOpacity);
        host.querySelectorAll("[data-needs-weather]").forEach((r) => r.classList.toggle("st-dim", !s.weather));
        $("#st-d-suggestions").textContent = suggestHint(s.engine);
    }
    // Suggestions come only from Google's or DuckDuckGo's own suggest service, for that engine. With "Chrome default"
    // the page can not tell which engine Chrome uses, so there are none.
    function suggestHint(engine) {
        if (engine === "google") return "Ideas from Google while you type";
        if (engine === "duckduckgo") return "Ideas from DuckDuckGo while you type";
        if (engine === "default") return "Off with Chrome default, since Material Desk can't tell which engine Chrome uses. Pick Google or DuckDuckGo to get them.";
        return "Only with Google or DuckDuckGo";
    }
    function setSlider(v) {
        v = Math.max(60, Math.min(100, Math.round(+v || 88)));
        slider.value = v;
        sliderOut.textContent = v + "%";
        slider.style.setProperty("--p", ((v - 60) / 40 * 100) + "%");
    }
    // Rows that only matter while the weather card is on look quieter when it is off.
    ["units", "useGPS"].forEach((k) => { const el = host.querySelector(`[data-key="${k}"]`); if (el) el.closest(".st-row").dataset.needsWeather = ""; });
    loc.closest(".st-row").dataset.needsWeather = "";

    // ---- open and close ---------------------------------------------------------------------------------------------
    // With the bookmarks column hidden there is nothing to go back to, so the button closes settings instead.
    function setBackButton() {
        const noBookmarks = document.documentElement.classList.contains("no-bookmarks");
        const label = noBookmarks ? "Close settings" : "Back to bookmarks";
        if (back.getAttribute("aria-label") === label) return;
        back.setAttribute("aria-label", label);
        back.title = label;
        back.innerHTML = icon(noBookmarks ? "close" : "back");
    }
    let isOpen = false, returnTo = null, closeTimer = 0;
    function open() {
        if (isOpen) return;
        isOpen = true;
        clearTimeout(closeTimer);
        returnTo = document.activeElement;
        sync();
        hideConfirm();
        note.textContent = "";
        setBackButton();
        view.hidden = false;
        view.classList.remove("st-out");
        col.classList.add("st-open");
        $(".st-body").scrollTop = 0;
        view.focus({ preventScroll: true }); // Tab goes on to the back button
    }
    function close() {
        if (!isOpen) return;
        isOpen = false;
        view.classList.add("st-out");
        col.classList.remove("st-open");
        const done = () => { view.hidden = true; view.classList.remove("st-out"); };
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) done(); else closeTimer = setTimeout(done, 170);
        const target = (returnTo && returnTo.isConnected && returnTo.offsetParent) ? returnTo
            : col.querySelector(".bm-gear") && col.querySelector(".bm-gear").offsetParent ? col.querySelector(".bm-gear") : launcher;
        if (target && target.focus) target.focus({ preventScroll: true });
    }
    col.addEventListener("lemon:settings", (e) => { if (e.detail && e.detail.open === false) close(); else open(); });
    launcher.addEventListener("click", open);
    back.addEventListener("click", close);
    $(".st-done").addEventListener("click", close);
    view.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !e.defaultPrevented) {
            e.preventDefault();
            if (!confirmBox.hidden) hideConfirm(true); else close();
        }
    });

    // ---- controls ---------------------------------------------------------------------------------------------------
    const set = (patch) => Lemon.settings.set(patch).catch((err) => { console.warn("Material Desk settings:", err); });

    view.addEventListener("click", (e) => {
        const swBtn = e.target.closest(".st-switch");
        if (swBtn) { const k = swBtn.dataset.key; set({ [k]: !Lemon.settings.get()[k] }); return; }
        const radio = e.target.closest("[role=radio][data-key]");
        if (radio) { set({ [radio.dataset.key]: radio.dataset.value }); return; }
        const row = e.target.closest(".st-row-switch");
        if (row && !e.target.closest("button, input, a")) row.querySelector(".st-switch").click();
    });
    // Arrow keys move between options in a radio group (roving tab stop).
    view.addEventListener("keydown", (e) => {
        const radio = e.target.closest("[role=radio][data-key]");
        if (!radio) return;
        const all = [...radio.closest("[role=radiogroup]").querySelectorAll("[role=radio]")];
        const i = all.indexOf(radio);
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (step === undefined) return;
        e.preventDefault();
        const next = all[(i + step + all.length) % all.length];
        next.focus();
        set({ [next.dataset.key]: next.dataset.value });
    });

    // Place: saved when you press Enter or leave the field.
    let savedTimer = 0;
    function saveLocation() {
        const v = loc.value.trim();
        if (v === (Lemon.settings.get().location || "")) return;
        set({ location: v }).then(() => {
            const s = $(".st-saved");
            s.innerHTML = `${icon("check")}Saved`;
            s.classList.add("on");
            clearTimeout(savedTimer);
            savedTimer = setTimeout(() => { s.classList.remove("on"); s.textContent = ""; }, 1800);
        });
    }
    loc.addEventListener("change", saveLocation);
    loc.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); saveLocation(); }
        else if (e.key === "Escape") { loc.value = Lemon.settings.get().location || ""; }
    });

    // Opacity: the panels follow the slider at once; the value is saved when it settles.
    let sliderTimer = 0;
    slider.addEventListener("input", () => {
        setSlider(slider.value);
        document.documentElement.style.setProperty("--panel-alpha", slider.value + "%");
        clearTimeout(sliderTimer);
        sliderTimer = setTimeout(() => set({ panelOpacity: +slider.value }), 250);
    });
    slider.addEventListener("change", () => { clearTimeout(sliderTimer); set({ panelOpacity: +slider.value }); });

    // ---- data -------------------------------------------------------------------------------------------------------
    async function readAll() {
        if (local) return await local.get(null);
        const out = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k.startsWith("lemon:") && k !== "lemon:settingsCache") {
                try { out[k.slice(6)] = JSON.parse(localStorage.getItem(k)); } catch (e) { /* skip */ }
            }
        }
        return out;
    }
    async function writeAll(data) {
        if (local) { await local.set(data); return; }
        for (const [k, v] of Object.entries(data)) localStorage.setItem("lemon:" + k, JSON.stringify(v));
    }
    function say(text, bad) {
        note.textContent = text;
        note.classList.toggle("st-bad", !!bad);
    }
    const stamp = () => {
        const d = new Date();
        const p = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    };

    // Export writes what Import reads back: settings, to-dos, the bookmark view and a built-in wallpaper. An uploaded
    // picture is not in the file (not even its small preview), so a shared export never carries a photo.
    const EXPORTED = ["settings", "todo", "bookmarksUi", "myntImported"];
    async function exportData() {
        try {
            const all = await readAll(), data = {};
            for (const k of EXPORTED) if (all[k] !== undefined) data[k] = all[k];
            const wp = all.wallpaper;
            if (isPlain(wp) && Lemon.look.builtins.some(([id]) => id === wp.id)) data.wallpaper = { id: wp.id, dim: wp.dim };
            // "lemon-newtab" is the file format id from the first release; kept so older exports still import.
            const payload = { app: "lemon-newtab", version: 1, exportedAt: new Date().toISOString(), data };
            const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = `material-desk-${stamp()}.json`;
            a.hidden = true;
            host.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 4000);
            const parts = describe(Object.keys(data));
            say(parts ? `Saved your ${parts} to ${a.download}` : `Saved to ${a.download}`);
        } catch (err) { say("Could not export: " + (err.message || err), true); }
    }

    // The parts of the saved data people know by name, in plain words ("settings, to-do list and bookmark view").
    const NAMES = { settings: "settings", todo: "to-do list", bookmarksUi: "bookmark view", wallpaper: "wallpaper" };
    function describe(keys) {
        const named = Object.keys(NAMES).filter((k) => keys.includes(k)).map((k) => NAMES[k]);
        return named.length > 1 ? named.slice(0, -1).join(", ") + " and " + named[named.length - 1] : named[0] || "";
    }

    // Import takes only what Material Desk itself saves, each part checked, so a stray JSON file cannot write junk keys.
    const isPlain = (v) => !!v && typeof v === "object" && !Array.isArray(v);
    const ENGINE_IDS = ENGINES.map(([v]) => v);
    function cleanSettings(raw) {
        const d = Lemon.settings.defaults, out = {};
        for (const [k, def] of Object.entries(d)) {
            const v = raw[k];
            if (v === undefined || typeof v !== typeof def) continue;
            if (typeof v === "number" && !Number.isFinite(v)) continue;
            out[k] = v;
        }
        if (out.units !== undefined && !["F", "C"].includes(out.units)) delete out.units;
        if (out.engine !== undefined && !ENGINE_IDS.includes(out.engine)) delete out.engine;
        if (out.bookmarksView !== undefined && !["grid", "list"].includes(out.bookmarksView)) delete out.bookmarksView;
        if (out.panelOpacity !== undefined) out.panelOpacity = Math.max(60, Math.min(100, Math.round(out.panelOpacity)));
        if (out.location !== undefined) out.location = out.location.trim().slice(0, 200);
        return { ...d, ...out };
    }
    // Returns the keys to write, or throws with a short reason.
    function cleanImport(parsed) {
        if (!isPlain(parsed) || parsed.app !== "lemon-newtab" || !isPlain(parsed.data)) throw new Error("it was not exported from Material Desk");
        const src = parsed.data, out = {};
        if (isPlain(src.settings)) out.settings = cleanSettings(src.settings);
        if (isPlain(src.todo) && Array.isArray(src.todo.items)) out.todo = src.todo; // todo.js normalizes the rest on load
        if (isPlain(src.bookmarksUi)) {
            const ui = {};
            if (typeof src.bookmarksUi.folderId === "string") ui.folderId = src.bookmarksUi.folderId;
            if (typeof src.bookmarksUi.appsOpen === "boolean") ui.appsOpen = src.bookmarksUi.appsOpen;
            out.bookmarksUi = ui;
        }
        if (typeof src.myntImported === "boolean") out.myntImported = src.myntImported;
        // A built-in wallpaper (an uploaded picture is not exported): its id and dim. The colors are not taken from the
        // file: with none, wallpaper.js makes them again from the built-in picture after the reload.
        const wp = src.wallpaper;
        if (isPlain(wp) && Lemon.look.builtins.some(([id]) => id === wp.id)) {
            out.wallpaper = { id: wp.id, dim: Math.max(0, Math.min(80, Math.round(+wp.dim) || 0)), colors: {} };
        }
        if (!out.settings && !out.todo && !out.bookmarksUi && !out.wallpaper) throw new Error("no saved data in it");
        return out;
    }

    let pending = null; // what the confirm button will do
    function ask(text, label, run, danger) {
        pending = run;
        $("#st-confirm-text").textContent = text;
        const ok = confirmBox.querySelector("[data-do=confirm]");
        ok.textContent = label;
        ok.classList.toggle("st-danger-fill", !!danger);
        confirmBox.hidden = false;
        say("");
        // A risky choice starts on Cancel, so a stray Enter does nothing harmful.
        (danger ? confirmBox.querySelector("[data-do=cancel]") : ok).focus({ preventScroll: true });
        // Bring the whole question and its buttons into view (the Data card sits at the bottom of the list).
        requestAnimationFrame(() => { const b = $(".st-body"); b.scrollTop = b.scrollHeight; });
    }
    function hideConfirm(refocus) {
        confirmBox.hidden = true;
        pending = null;
        if (refocus) { const b = $(".st-data [data-do=export]"); if (b) b.focus(); }
    }

    fileInput.addEventListener("change", async () => {
        const file = fileInput.files && fileInput.files[0];
        fileInput.value = "";
        if (!file) return;
        let data;
        try {
            let parsed;
            try { parsed = JSON.parse(await file.text()); } catch (e) { throw new Error("it is not a JSON file"); }
            data = cleanImport(parsed);
        } catch (err) {
            say(`${file.name} is not a Material Desk data file: ${err.message || err}`, true);
            return;
        }
        ask(`Replace your saved data with ${file.name}? This overwrites your ${describe(Object.keys(data))}.`, "Replace", async () => {
            try {
                const { wallpaper, ...rest } = data;
                await writeAll(rest);
                if (data.settings) await Lemon.settings.set(data.settings);
                // Through Lemon.look, which also drops an uploaded picture the imported wallpaper replaces.
                if (wallpaper) await Lemon.look.set(wallpaper);
                say("Imported. Reloading the page");
                setTimeout(() => location.reload(), 900);
            } catch (err) { say("Could not import: " + (err.message || err), true); }
        }, true);
    });

    view.addEventListener("click", (e) => {
        const b = e.target.closest("[data-do]");
        if (!b) return;
        const what = b.dataset.do;
        if (what === "export") { hideConfirm(); exportData(); }
        else if (what === "import") { hideConfirm(); fileInput.click(); }
        else if (what === "reset") {
            ask("Reset every setting to its default? Your to-do list and bookmarks stay as they are.", "Reset", async () => {
                try {
                    await Lemon.settings.set({ ...Lemon.settings.defaults });
                    say("Settings are back to their defaults");
                } catch (err) { say("Could not reset: " + (err.message || err), true); }
            }, true);
        }
        else if (what === "cancel") hideConfirm(true);
        // The confirm button hides with its box: the focus goes to Export rather than to the page.
        else if (what === "confirm") { const run = pending; hideConfirm(true); if (run) run(); }
    });

    // ---- start ------------------------------------------------------------------------------------------------------
    try { $(".st-version").textContent = (api.runtime && api.runtime.getManifest) ? api.runtime.getManifest().version : ""; } catch (e) { /* dev */ }
    Lemon.ready.then(() => sync());
    Lemon.settings.onChange((s, patch) => {
        if (!isOpen) return;
        sync(s);
        if (patch && "bookmarks" in patch) setBackButton();
    });
})();
