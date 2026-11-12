/*
 * Material Desk: the Wallpaper section of Settings (mounts into .st-wp-host, made by scripts/settings.js).
 * Pick a built-in wallpaper (wallpapers/*.svg) or upload a picture (any image the browser can open, downscaled to at
 * most 2560 px and kept as JPEG in IndexedDB), and dim it. Each choice gets a Material You dark scheme made from the
 * picture with Google's material-color-utilities (vendor/, loaded only when needed): the picture's colors are
 * quantized (Celebi), the best source color is scored, and the tonal spot scheme gives every --dl-<role>.
 * Lemon.look (scripts/lemon.js) saves the result and paints it. A managed look (the optional desktop integration)
 * wins: the section then only says so.
 */
(function () {
    "use strict";
    const host = document.querySelector(".st-wp-host");
    if (!host || !window.Lemon || !Lemon.look) return;
    const look = Lemon.look;

    const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ESC[c]);
    const P = {
        check: "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
        upload: "M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z",
        remove: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
        desktop: "M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z",
    };
    const icon = (n, cls) => `<svg${cls ? ` class="${cls}"` : ""} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${P[n]}"/></svg>`;

    host.innerHTML = `
        <div class="st-wp-managed" hidden>
            <span class="st-wp-managed-ico">${icon("desktop")}</span>
            <p class="st-desc">Your wallpaper, colors and font come from your desktop, so they are managed there.</p>
        </div>
        <div class="st-wp-own">
            <div class="st-wp-grid" role="radiogroup" aria-label="Wallpaper">
                ${look.builtins.map(([id, name]) => `<button type="button" role="radio" class="st-wp-tile" data-id="${id}"
                    aria-checked="false" tabindex="-1" style="background-image:url('wallpapers/${id}.svg')">
                    <span class="st-wp-tick">${icon("check")}</span><span class="st-wp-name">${esc(name)}</span></button>`).join("")}
                <button type="button" role="radio" class="st-wp-tile st-wp-custom" data-id="custom" aria-checked="false"
                    tabindex="-1" hidden><span class="st-wp-tick">${icon("check")}</span><span class="st-wp-name">Yours</span></button>
                <button type="button" class="st-wp-tile st-wp-upload" data-do="upload">${icon("upload", "st-wp-up-ico")}<span class="st-wp-name">Upload your own</span></button>
            </div>
            <div class="st-wp-actions">
                <button type="button" class="st-text-btn st-wp-remove" hidden>${icon("remove")}Remove your picture</button>
                <p class="st-desc st-wp-note" aria-live="polite"></p>
            </div>
            <div class="st-wp-dim">
                <div class="st-row-line">
                    <span class="st-label" id="st-l-dim">Dim</span>
                    <output class="st-val st-wp-dimval" for="st-dim">0%</output>
                </div>
                <input id="st-dim" class="st-slider" type="range" min="0" max="80" step="1" aria-labelledby="st-l-dim">
                <div class="st-scale" aria-hidden="true"><span>Bright</span><span>Dark</span></div>
            </div>
            <input class="st-wp-file" type="file" accept="image/*" hidden>
        </div>`;

    const $ = (s) => host.querySelector(s);
    const note = $(".st-wp-note"), slider = $("#st-dim"), sliderOut = $(".st-wp-dimval"), file = $(".st-wp-file");
    const say = (text, bad) => { note.textContent = text || ""; note.classList.toggle("st-bad", !!bad); };

    // ---- colors from a picture -------------------------------------------------------------------------------------
    let mcu = null;
    function loadMCU() {
        if (window.MaterialColorUtilities) return Promise.resolve(window.MaterialColorUtilities);
        if (mcu) return mcu;
        mcu = new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "vendor/material-color-utilities.js";
            s.onload = () => resolve(window.MaterialColorUtilities);
            s.onerror = () => { mcu = null; reject(new Error("could not load the color library")); };
            document.head.appendChild(s);
        });
        return mcu;
    }
    const snake = (name) => name.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
    // Every role as matugen names it (primary, on_primary_container, surface_container_high, ...), plus source_color.
    async function schemeFrom(img) {
        const M = await loadMCU();
        const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        const k = Math.min(1, 128 / Math.max(w, h, 1));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        const pixels = [];
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] === 255) pixels.push(M.argbFromRgb(d[i], d[i + 1], d[i + 2]));
        const source = M.Score.score(M.QuantizerCelebi.quantize(pixels, 128))[0];
        const scheme = new M.SchemeTonalSpot(M.Hct.fromInt(source), true, 0);
        const colors = { source_color: M.hexFromArgb(source) };
        for (const name of Object.getOwnPropertyNames(M.MaterialDynamicColors)) {
            const dc = M.MaterialDynamicColors[name];
            if (!dc || typeof dc.getArgb !== "function" || /PaletteKeyColor$/.test(name)) continue;
            try { colors[snake(name)] = M.hexFromArgb(dc.getArgb(scheme)); } catch (e) { /* role not in this scheme */ }
        }
        return colors;
    }
    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("the picture could not be opened"));
            img.src = src;
        });
    }
    // An uploaded file: at most 2560 px on its longest side, JPEG at 0.9, plus a tiny placeholder for instant paint.
    async function prepare(f) {
        const url = URL.createObjectURL(f);
        try {
            const img = await loadImage(url);
            const w = img.naturalWidth, h = img.naturalHeight;
            if (!w || !h) throw new Error("the picture has no size");
            const draw = (max, type, q) => {
                const k = Math.min(1, max / Math.max(w, h));
                const c = document.createElement("canvas");
                c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
                const ctx = c.getContext("2d");
                ctx.fillStyle = "#000"; ctx.fillRect(0, 0, c.width, c.height);   // transparent parts become dark
                ctx.drawImage(img, 0, 0, c.width, c.height);
                return c;
            };
            const big = draw(2560);
            const blob = await new Promise((resolve, reject) => big.toBlob((b) => b ? resolve(b) : reject(new Error("could not save the picture")), "image/jpeg", 0.9));
            const thumb = draw(48).toDataURL("image/jpeg", 0.7);
            const colors = await schemeFrom(big);
            return { blob, thumb, colors };
        } finally { URL.revokeObjectURL(url); }
    }

    // ---- reflect the state -----------------------------------------------------------------------------------------
    function sync() {
        const managed = look.managed();
        $(".st-wp-managed").hidden = !managed;
        $(".st-wp-own").hidden = managed;
        if (managed) return;
        const w = look.wallpaper();
        const custom = $(".st-wp-custom");
        custom.hidden = w.id !== "custom";
        if (w.id === "custom" && w.thumb) custom.style.backgroundImage = `url("${w.thumb}")`;
        host.querySelectorAll(".st-wp-tile[role=radio]").forEach((b) => {
            const on = b.dataset.id === w.id;
            b.setAttribute("aria-checked", String(on));
            b.tabIndex = on ? 0 : -1;
        });
        $(".st-wp-remove").hidden = w.id !== "custom";
        if (document.activeElement !== slider) setSlider(w.dim);
    }
    function setSlider(v) {
        v = Math.max(0, Math.min(80, Math.round(+v || 0)));
        slider.value = v;
        sliderOut.textContent = v + "%";
        slider.style.setProperty("--p", (v / 80 * 100) + "%");
    }

    // ---- actions ---------------------------------------------------------------------------------------------------
    let busy = false;
    async function pickBuiltin(id) {
        if (busy) return;
        const w = look.wallpaper();
        if (w.id === id && w.colors && w.colors.primary) return;
        busy = true;
        say("Making colors from the wallpaper…");
        try {
            const colors = await schemeFrom(await loadImage(`wallpapers/${id}.svg`));
            await look.set({ id, dim: w.dim, colors });
            say("");
        } catch (e) { say("Could not use that wallpaper: " + (e.message || e), true); }
        busy = false;
    }
    async function upload(f) {
        if (busy || !f) return;
        if (f.type && !f.type.startsWith("image/")) { say(`${f.name} is not a picture.`, true); return; }
        busy = true;
        say("Making colors from your picture…");
        try {
            const p = await prepare(f);
            await look.set({ id: "custom", dim: look.wallpaper().dim, colors: p.colors, thumb: p.thumb }, p.blob);
            say("");
        } catch (e) { say(`Could not use ${f.name}: ${e.message || e}`, true); }
        busy = false;
    }
    async function removeCustom() {
        const d = look.defaultWallpaper;
        busy = false;
        await pickBuiltin(d.id);
        say("Your picture was removed.");
    }

    host.addEventListener("click", (e) => {
        const tile = e.target.closest(".st-wp-tile");
        if (tile && tile.dataset.do === "upload") { file.click(); return; }
        if (tile && tile.dataset.id && tile.dataset.id !== "custom") { pickBuiltin(tile.dataset.id); return; }
        if (e.target.closest(".st-wp-remove")) removeCustom();
    });
    // Arrow keys move between wallpapers (roving tab stop), like the other choice groups in Settings.
    host.addEventListener("keydown", (e) => {
        const tile = e.target.closest(".st-wp-tile[role=radio]");
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!tile || step === undefined) return;
        e.preventDefault();
        const all = [...host.querySelectorAll(".st-wp-tile[role=radio]")].filter((b) => !b.hidden);
        const next = all[(all.indexOf(tile) + step + all.length) % all.length];
        next.focus();
        if (next.dataset.id !== "custom") pickBuiltin(next.dataset.id);
    });
    file.addEventListener("change", () => { const f = file.files && file.files[0]; file.value = ""; upload(f); });

    // Dim: the page follows the slider at once; the value is saved when it settles.
    let dimTimer = 0;
    const saveDim = () => { const w = look.wallpaper(); if (w.dim !== +slider.value) look.set({ ...w, dim: +slider.value }); };
    slider.addEventListener("input", () => {
        setSlider(slider.value);
        look.preview(+slider.value);
        clearTimeout(dimTimer);
        dimTimer = setTimeout(saveDim, 300);
    });
    slider.addEventListener("change", () => { clearTimeout(dimTimer); saveDim(); });

    // First run: the default wallpaper's scheme is made once and saved, so later tabs paint in it from the cache.
    look.ready.then(() => {
        sync();
        const w = look.wallpaper();
        if (!look.managed() && w.id !== "custom" && !(w.colors && w.colors.primary)) { busy = false; pickBuiltin(w.id); }
    });
    look.onChange(sync);
})();
