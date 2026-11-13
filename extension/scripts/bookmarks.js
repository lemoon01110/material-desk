/*
 * Material Desk: bookmarks and Google apps (right column). See ARCHITECTURE.md.
 * Mounts into #bookmarks-host and #apps-host inside #right-col. Everything that opens (menus, forms, confirms,
 * the undo snackbar) is placed inside #right-col, so nothing can clip at the column's edges.
 * Talks to scripts/settings.js only through a DOM event on #right-col ("lemon:settings").
 * UI state lives in chrome.storage.local under "bookmarksUi"; the grid/list view is the setting "bookmarksView".
 */
(function () {
    "use strict";
    const host = document.getElementById("bookmarks-host");
    const appsHost = document.getElementById("apps-host");
    const col = document.getElementById("right-col");
    if (!host || !col || !window.Lemon) return;
    const api = typeof chrome !== "undefined" ? chrome : {};
    const BM = api.bookmarks;
    // chrome-extension:// pages can ask Chrome for favicons; the dev server cannot, so it shows letters instead.
    const CAN_FAVICON = location.protocol === "chrome-extension:" && api.runtime && api.runtime.getURL;
    const DND_TYPE = "application/x-lemon-bookmark";

    // ---- icons (Material Symbols paths, 24px grid) ------------------------------------------------------------------
    const P = {
        search: "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
        add: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
        close: "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
        back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
        chevron: "M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z",
        expand: "M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z",
        more: "M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z",
        edit: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
        del: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
        folder: "M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z",
        newFolder: "M20 6h-8l-2-2H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z",
        move: "M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 12v-3h-4v-4h4V8l5 5-5 5z",
        grid: "M3 3v8h8V3H3zm6 6H5V5h4v4zm-6 4v8h8v-8H3zm6 6H5v-4h4v4zm4-16v8h8V3h-8zm6 6h-4V5h4v4zm-6 4v8h8v-8h-8zm6 6h-4v-4h4v4z",
        list: "M3 14h4v-4H3v4zm0 5h4v-4H3v4zM3 9h4V5H3v4zm5 5h13v-4H8v4zm0 5h13v-4H8v4zM8 5v4h13V5H8z",
        gear: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z",
        openNew: "M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z",
        link: "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z",
        bookmark: "M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15-5-2.18L7 18V5h10v13z",
        bookmarkAdd: "M17 11v6.97l-5-2.14-5 2.14V5h6V3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V11h-2zm4-4h-2v2h-2V7h-2V5h2V3h2v2h2v2z",
        apps: "M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z",
        // Google apps, monochrome
        mail: "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z",
        calendar: "M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z",
        drive: "M7.71 3.5 1.15 15l3.43 6 6.55-11.5L7.71 3.5zm1.73 0 6.55 11.5h6.86L16.29 3.5H9.44zM5.73 21h13.12l3.43-6H9.16l-3.43 6z",
        docs: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
        youtube: "M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM9.5 16.5v-9l7 4.5-7 4.5z",
        maps: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z",
        photos: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z",
        school: "M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3 1 9l11 6 9-4.91V17h2V9L12 3z",
        meet: "M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z",
        translate: "m12.87 15.07-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7 1.62-4.33L19.12 17h-3.24z",
    };
    const icon = (n, cls) => `<svg${cls ? ` class="${cls}"` : ""} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${P[n]}"/></svg>`;
    const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ESC[c]);
    const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

    // ---- urls ---------------------------------------------------------------------------------------------------------
    function hostOf(url) {
        try { const u = new URL(url); return (u.host || u.protocol.replace(":", "")).replace(/^www\./, ""); }
        catch (e) { return ""; }
    }
    // Script-carrying schemes (javascript:, data: and the like) never become a live link, never open and are never
    // saved from here. Everything else Chrome can open from a bookmark (http, chrome://, file://, mailto:, app links) is fine.
    function safeUrl(url) {
        try { return !/^(javascript|data|vbscript|blob|filesystem):$/i.test(new URL(url).protocol); } catch (e) { return false; }
    }
    // "github.com/foo" -> "https://github.com/foo"; returns "" when it cannot be a link.
    function normalizeUrl(raw) {
        let s = String(raw || "").trim();
        if (!s) return "";
        if (/\s/.test(s) && !/^[a-z][\w+.-]*:/i.test(s)) return "";
        if (!/^[a-z][\w+.-]*:/i.test(s) || /^(localhost|[\w-]+(\.[\w-]+)+):\d+/i.test(s)) {
            if (!/^(localhost|\[[\da-f:]+\]|[\w-]+(\.[\w-]+)+)(:\d+)?([/?#].*)?$/i.test(s)) return "";
            const local = /^(localhost|127\.|10\.|192\.168\.|\d+\.\d+\.\d+\.\d+)/.test(s);
            s = (local ? "http://" : "https://") + s;
        }
        try { const u = new URL(s); return safeUrl(u.href) ? u.href : ""; } catch (e) { return ""; }
    }
    // A title from the link's host: "github.com" -> "GitHub", "example.com" -> "Example", "docs.google.com" stays.
    const BRANDS = { github: "GitHub", gitlab: "GitLab", youtube: "YouTube", openrouter: "OpenRouter", linkedin: "LinkedIn",
        chatgpt: "ChatGPT", openai: "OpenAI", stackoverflow: "Stack Overflow", paypal: "PayPal", tiktok: "TikTok",
        whatsapp: "WhatsApp", deepl: "DeepL", huggingface: "Hugging Face", wikipedia: "Wikipedia", duckduckgo: "DuckDuckGo",
        icloud: "iCloud", soundcloud: "SoundCloud", codepen: "CodePen", leetcode: "LeetCode", npmjs: "npm" };
    function titleFromUrl(url) {
        const h = hostOf(url).replace(/:\d+$/, "");
        if (!h) return url;
        const parts = h.split(".");
        if (parts.length === 2 && !/^\d+$/.test(parts[1])) {
            const name = parts[0].toLowerCase();
            return BRANDS[name] || name.charAt(0).toUpperCase() + name.slice(1);
        }
        return h;
    }

    function openUrl(url, newTab, foreground) {
        if (!url) return;
        if (!safeUrl(url)) { snack("This kind of link cannot open from the new tab page"); return; }
        try {
            // Chrome may refuse a link (file:// without file access, say): say so instead of failing silently.
            if (newTab) {
                if (api.tabs && api.tabs.create) Promise.resolve(api.tabs.create({ url, active: !!foreground })).catch(report);
                else window.open(url, "_blank", "noopener");
            } else if (api.tabs && api.tabs.update && !/^https?:/i.test(url)) {
                // chrome://, file:// and friends cannot be opened by the page itself
                Promise.resolve(api.tabs.update({ url })).catch(report);
            } else {
                location.href = url;
            }
        } catch (err) { report(err); }
    }

    // ---- model --------------------------------------------------------------------------------------------------------
    let root = null;                 // tree from chrome.bookmarks.getTree()
    const byId = new Map();          // id -> node (with children)
    const parentOf = new Map();      // id -> parent node
    let flat = [];                   // search index: { n, hay, path: [folder nodes] }
    let total = 0;                   // links + folders below the roots
    let ui = { folderId: null, appsOpen: true };
    let query = "";
    let view = "grid";

    function indexTree(tree) {
        root = tree;
        byId.clear(); parentOf.clear(); flat = []; total = 0;
        // path = the folders above n, roots included (empty for the roots themselves, which are not searchable).
        const walk = (n, path) => {
            byId.set(n.id, n);
            if (n.url) { flat.push({ n, hay: ((n.title || "") + " " + n.url).toLowerCase(), path }); total++; return 1; }
            const inner = n === root ? [] : path.concat(n);
            let links = 0;
            for (const c of n.children || []) { parentOf.set(c.id, n); links += walk(c, inner); }
            if (path.length) { flat.push({ n, hay: (n.title || "").toLowerCase(), path, folder: true }); total++; }
            n._links = links;
            return links;
        };
        walk(tree, []);
    }
    const roots = () => (root && root.children) || [];
    const isRoot = (n) => n && parentOf.get(n.id) === root;
    // Folders from the node up to its root, e.g. [Bookmarks bar, School].
    function trail(id) {
        const out = [];
        for (let n = byId.get(id); n && n !== root; n = parentOf.get(n.id)) out.unshift(n);
        return out;
    }
    const insideOf = (id, maybeAncestorId) => trail(id).some((n) => n.id === maybeAncestorId);
    const rootLabel = (n) => (n.title || "Bookmarks").replace(/\s+bookmarks$/i, "").replace(/^./, (c) => c.toUpperCase());
    const folderName = (n) => (isRoot(n) ? rootLabel(n) : n.title || "Untitled folder");
    const current = () => byId.get(ui.folderId) || roots()[0];

    // ---- skeleton -----------------------------------------------------------------------------------------------------
    host.innerHTML = `
        <section class="bm" aria-label="Bookmarks">
            <header class="bm-head">
                <h2 class="panel-title bm-heading">Bookmarks</h2>
                <div class="bm-seg" role="radiogroup" aria-label="Bookmark view">
                    <button type="button" role="radio" data-view="grid" aria-label="Grid" title="Grid">${icon("grid")}</button>
                    <button type="button" role="radio" data-view="list" aria-label="List" title="List">${icon("list")}</button>
                </div>
                <button type="button" class="icon-btn bm-gear" aria-label="Settings" title="Settings">${icon("gear")}</button>
                <button type="button" class="bm-fab" aria-label="Add bookmark" title="Add bookmark">${icon("add")}</button>
            </header>
            <div class="bm-searchbar">
                ${icon("search", "bm-search-ico")}
                <input class="bm-search" type="search" placeholder="Search bookmarks" aria-label="Search bookmarks"
                    autocomplete="off" spellcheck="false">
                <button type="button" class="bm-search-clear" aria-label="Clear search" hidden>${icon("close")}</button>
            </div>
            <nav class="bm-nav" aria-label="Bookmark folders"></nav>
            <div class="bm-body" tabindex="-1"></div>
        </section>`;
    const $ = (s, el = host) => el.querySelector(s);
    const body = $(".bm-body");
    const nav = $(".bm-nav");
    const search = $(".bm-search");
    const searchClear = $(".bm-search-clear");

    // Overlays live directly in the column so they can use its full height.
    const layer = document.createElement("div");
    layer.className = "bm-layer";
    layer.innerHTML = `
        <div class="bm-scrim" hidden></div>
        <div class="bm-sheet" role="dialog" aria-modal="true" hidden></div>
        <div class="bm-menu" role="menu" hidden></div>
        <div class="bm-snack" role="status" aria-live="polite" hidden></div>`;
    host.appendChild(layer);
    const scrim = $(".bm-scrim", layer), sheet = $(".bm-sheet", layer), menu = $(".bm-menu", layer), snackEl = $(".bm-snack", layer);

    // ---- rendering ----------------------------------------------------------------------------------------------------
    function favicon(url, title) {
        const letter = esc((title || hostOf(url) || "?").trim().charAt(0).toUpperCase() || "?");
        if (!CAN_FAVICON) return `<span class="bm-letter" aria-hidden="true">${letter}</span>`;
        const src = api.runtime.getURL("/_favicon/?pageUrl=" + encodeURIComponent(url) + "&size=32");
        return `<img alt="" draggable="false" loading="lazy" decoding="async" src="${esc(src)}">`;
    }

    // Wrap query matches in <mark>, escaping everything else.
    function highlight(text, tokens) {
        text = String(text || "");
        if (!tokens || !tokens.length) return esc(text);
        // Matches are found in the lower-cased text (as the search index has it), but lower-casing can change the
        // length: "İ" becomes "i" plus a combining dot. So each position in `low` maps back to the character in `text`
        // it came from, or the highlight slides one letter late after every such character.
        const low = text.toLowerCase();
        const from = [];
        for (let i = 0; i < text.length;) {
            const ch = String.fromCodePoint(text.codePointAt(i));
            for (let k = ch.toLowerCase().length; k > 0; k--) from.push(i);
            i += ch.length;
        }
        if (from.length !== low.length) for (let i = 0; i < low.length; i++) from[i] = Math.min(i, text.length - 1);
        const marks = new Array(text.length).fill(false); // set on the first code unit of each marked character
        for (const t of tokens) {
            let i = low.indexOf(t);
            while (t && i >= 0) { for (let k = i; k < i + t.length; k++) marks[from[k]] = true; i = low.indexOf(t, i + t.length); }
        }
        // Walk whole characters so a mark never splits an emoji's surrogate pair.
        let out = "", open = false;
        for (let i = 0; i < text.length;) {
            const ch = String.fromCodePoint(text.codePointAt(i));
            if (marks[i] !== open) { out += marks[i] ? "<mark>" : "</mark>"; open = marks[i]; }
            out += esc(ch);
            i += ch.length;
        }
        return out + (open ? "</mark>" : "");
    }

    function itemHtml(n, tokens, inSearch) {
        const locked = n.unmodifiable ? " data-locked" : "";
        const drag = inSearch || n.unmodifiable ? "" : ` draggable="true"`;
        const more = `<button type="button" class="bm-more" tabindex="-1" aria-label="More actions" title="More">${icon("more")}</button>`;
        if (!n.url) {
            const name = folderName(n);
            const count = (n.children || []).length;
            const sub = count ? plural(count, "item", "items") : "Empty";
            const where = inSearch ? trail(n.id).slice(0, -1).map(folderName).join(" / ") : "";
            return `<div class="bm-item bm-folder" role="listitem" data-id="${n.id}"${drag}${locked}>
                <button type="button" class="bm-link" data-folder="${n.id}" aria-label="${esc(name)}, folder, ${sub}"
                    aria-keyshortcuts="Shift+F10 F2 Delete">
                    <span class="bm-ico">${icon("folder")}${count ? `<span class="bm-badge" aria-hidden="true">${count > 99 ? "99+" : count}</span>` : ""}</span>
                    <span class="bm-text"><span class="bm-title">${highlight(name, tokens)}</span>
                    <span class="bm-sub">${where ? `<span class="bm-path" title="${esc(where)}"><span class="bm-path-name">${esc(where)}</span></span>` : sub}</span></span>
                </button>${more}</div>`;
        }
        const title = n.title || hostOf(n.url) || n.url;
        const h = hostOf(n.url);
        let sub = `<span class="bm-host">${highlight(h, tokens)}</span>`;
        if (inSearch) {
            const t = trail(n.id).slice(0, -1);
            const f = t.length ? folderName(t[t.length - 1]) : "";
            sub = `<span class="bm-host">${highlight(h, tokens)}</span>${f ? `<span class="bm-path" title="${esc(t.map(folderName).join(" / "))}">${icon("folder")}<span class="bm-path-name">${esc(f)}</span></span>` : ""}`;
        }
        return `<div class="bm-item" role="listitem" data-id="${n.id}"${drag}${locked}>
            <a class="bm-link" ${safeUrl(n.url) ? `href="${esc(n.url)}"` : `tabindex="0" aria-disabled="true"`} draggable="false" title="${esc(title)}&#10;${esc(n.url)}"
                aria-keyshortcuts="Shift+F10 F2 Delete">
                <span class="bm-ico">${favicon(n.url, title)}</span>
                <span class="bm-text"><span class="bm-title">${highlight(title, tokens)}</span><span class="bm-sub">${sub}</span></span>
            </a>${more}</div>`;
    }

    // An M3 expressive "cookie" (scalloped circle) for the empty state, like the End4 clock face.
    function cookiePath(lobes, r, depth) {
        const pts = [];
        for (let i = 0; i <= 120; i++) {
            const a = (i / 120) * Math.PI * 2;
            const rr = r + depth * Math.cos(lobes * a);
            pts.push(`${(60 + rr * Math.cos(a - Math.PI / 2)).toFixed(2)} ${(60 + rr * Math.sin(a - Math.PI / 2)).toFixed(2)}`);
        }
        return "M" + pts.join("L") + "Z";
    }

    function heroHtml() {
        const bar = roots()[0];
        return `<div class="bm-hero">
            <div class="bm-hero-art" aria-hidden="true">
                <svg viewBox="0 0 120 120"><path class="bm-cookie" d="${cookiePath(9, 50, 4.5)}"/></svg>
                <span class="bm-dot bm-dot-a"></span><span class="bm-dot bm-dot-b"></span>
                ${icon("bookmarkAdd", "bm-hero-ico")}
            </div>
            <h3 class="bm-hero-title">Start your bookmarks</h3>
            <p class="bm-hero-text">Paste a link to keep it here, or drag one in from the address bar.</p>
            <form class="bm-quick" novalidate>
                <input class="field bm-quick-url" type="text" inputmode="url" placeholder="Paste a link"
                    aria-label="Link to bookmark" autocomplete="off" spellcheck="false">
                <button type="submit" class="btn-filled bm-quick-add">Add</button>
            </form>
            <p class="bm-quick-hint" aria-live="polite">Saves to ${esc(bar ? rootLabel(bar) : "Bookmarks bar")}</p>
            <button type="button" class="bm-text-btn" data-act="new-folder">${icon("newFolder")}New folder</button>
        </div>`;
    }

    function renderNav() {
        const cur = current();
        if (query) {
            const n = flatMatches().length;
            nav.hidden = false;
            nav.innerHTML = `<span class="bm-nav-note">${n > 300 ? "First 300 of " + n + " matches" : n ? plural(n, "match", "matches") + " in all folders" : ""}</span>`;
            return;
        }
        // No bookmarks at all: the welcome card below has everything, so the folder row steps aside.
        if (!cur || !total) { nav.innerHTML = ""; nav.hidden = true; return; }
        nav.hidden = false;
        const t = trail(cur.id);
        let html = "";
        if (t.length <= 1) {
            html = `<div class="bm-roots">` + roots().filter((r, i) => i < 2 || (r.children || []).length || r.id === cur.id).map((r) =>
                `<button type="button" class="bm-root${r.id === cur.id ? " on" : ""}" data-nav="${r.id}" data-drop="${r.id}"
                    aria-current="${r.id === cur.id ? "page" : "false"}">${esc(rootLabel(r))}<span class="bm-count">${r.children.length || ""}</span></button>`
            ).join("") + `</div>`;
        } else {
            const parent = t[t.length - 2];
            html = `<button type="button" class="icon-btn bm-up" data-nav="${parent.id}" data-drop="${parent.id}"
                    aria-label="Back to ${esc(folderName(parent))}" title="Back to ${esc(folderName(parent))}">${icon("back")}</button>
                <ol class="bm-crumbs">` + crumbList(t).map((f, i, all) => i === all.length - 1
                ? `<li class="bm-crumb-now"><span class="bm-crumb now" aria-current="page" title="${esc(folderName(f))}">${esc(folderName(f))}</span></li>`
                : `<li><button type="button" class="bm-crumb" data-nav="${f.id}" data-drop="${f.id}" title="${esc(trail(f.id).map(folderName).join(" / "))}">${esc(folderName(f))}</button>${icon("chevron", "bm-sep")}</li>`
            ).join("") + `</ol>`;
        }
        html += `<button type="button" class="bm-newfolder" data-act="new-folder" aria-label="New folder in ${esc(folderName(cur))}"
            title="New folder">${icon("newFolder")}</button>`;
        nav.innerHTML = html;
    }
    // Paths show the parent and the current folder (the back arrow climbs further); the parent's tooltip has the full path.
    const crumbList = (t) => t.slice(-2);

    let lastMatches = null;
    // Ties sort by name the way people read numbers ("Level 2" before "Level 10"). One collator: big trees sort fast.
    const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    function tokens() { return query.toLowerCase().split(/\s+/).filter(Boolean); }
    function flatMatches() {
        if (lastMatches && lastMatches.q === query && lastMatches.flat === flat) return lastMatches.list;
        const toks = tokens();
        const list = [];
        for (const e of flat) {
            if (!toks.every((t) => e.hay.includes(t))) continue;
            const title = (e.n.title || "").toLowerCase();
            let score = 0;
            for (const t of toks) score += title.startsWith(t) ? 4 : title.includes(t) ? 2 : 1;
            if (e.folder) score += 0.5;
            list.push({ e, score });
        }
        list.sort((a, b) => b.score - a.score || byName.compare(a.e.n.title || "", b.e.n.title || ""));
        lastMatches = { q: query, flat, list };
        return list;
    }

    function renderBody() {
        const cur = current();
        host.classList.toggle("bm-searching", !!query);
        body.classList.toggle("bm-view-list", view === "list" || !!query);
        body.classList.toggle("bm-view-grid", view !== "list" && !query);
        if (!root) { body.innerHTML = ""; return; }
        if (query) {
            const toks = tokens();
            const list = flatMatches();
            if (!list.length) {
                const url = normalizeUrl(query);
                body.innerHTML = `<div class="bm-blank">
                    ${icon("search", "bm-blank-ico")}
                    <p>No bookmarks match <strong>${esc(query)}</strong></p>
                    ${url ? `<button type="button" class="btn-tonal" data-act="add-query">${icon("add")}Add ${esc(hostOf(url))}</button>` : ""}
                </div>`;
                return;
            }
            body.innerHTML = `<div class="bm-items" role="list" aria-label="Search results">${list.slice(0, 300).map((m) => itemHtml(m.e.n, toks, true)).join("")}</div>`;
            return;
        }
        if (!total) { body.innerHTML = heroHtml(); return; }
        const kids = (cur && cur.children) || [];
        if (!kids.length) {
            body.innerHTML = `<div class="bm-blank bm-drop-zone">
                <span class="bm-blank-folder">${icon("folder")}</span>
                <p>Nothing in <strong>${esc(folderName(cur))}</strong> yet</p>
                <p class="bm-blank-sub">Add a link, or drag bookmarks here.</p>
                <button type="button" class="btn-tonal" data-act="add">${icon("add")}Add bookmark</button>
            </div>`;
            return;
        }
        // The grid ends with a quiet "Add" tile, so adding stays one click away while scrolling.
        const addTile = view === "list" ? "" : `<div class="bm-add-tile" role="listitem"><button type="button" class="bm-link" data-act="add">
            <span class="bm-ico">${icon("add")}</span><span class="bm-text"><span class="bm-title">Add</span></span></button></div>`;
        body.innerHTML = `<div class="bm-items" role="list" aria-label="${esc(folderName(cur))}">${kids.map((n) => itemHtml(n)).join("")}${addTile}</div>`;
    }

    function render(keepScroll) {
        // The list under an open menu is about to be replaced (a change from sync or another window): close the menu
        // and keep the keyboard on its item.
        if (!menu.hidden) {
            if (menu.contains(document.activeElement)) focusAfter = { id: menuFor, fallback: true };
            closeMenu(false);
        }
        const top = body.scrollTop;
        // A radio group is one Tab stop: only the checked view button takes focus from Tab (arrows switch).
        for (const b of host.querySelectorAll(".bm-seg [data-view]")) {
            const on = (b.dataset.view === "list") === (view === "list");
            b.setAttribute("aria-checked", String(on));
            b.tabIndex = on ? 0 : -1;
        }
        renderNav();
        renderBody();
        if (keepScroll) body.scrollTop = top;
        applyFocusAfter();
    }

    // Where keyboard focus goes after the list is redrawn (the focused item may have been replaced or removed).
    // { id, fallback }: the item to focus; with fallback, the first thing left to act on when that item is gone.
    let focusAfter = null;
    function applyFocusAfter() {
        if (!focusAfter) return;
        const want = focusAfter;
        focusAfter = null;
        const a = document.activeElement;
        // Leave focus alone if the user has already moved somewhere else that is still on screen.
        if (a && a !== document.body && a.isConnected && a.offsetParent && !body.contains(a)) return;
        let el = want.id ? body.querySelector(`.bm-item[data-id="${CSS.escape(want.id)}"] .bm-link`) : null;
        if (!el && want.fallback) el = body.querySelector(".bm-quick-url, .bm-blank .btn-tonal, .bm-link");
        if (!el) return;
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: "nearest" });
    }
    // After creating a node: focus it once it is drawn (at once if the redraw already happened).
    function focusMade(id) {
        focusAfter = { id, fallback: false };
        if (byId.has(id)) applyFocusAfter();
    }

    // ---- loading and live updates -------------------------------------------------------------------------------------
    let refreshTimer = 0, importing = false;
    async function refresh() {
        if (!BM) { root = { id: "0", children: [] }; indexTree(root); render(); return; }
        const [tree] = await BM.getTree();
        const prevFolder = ui.folderId;
        const prevTrail = trail(ui.folderId); // read before the index is rebuilt
        indexTree(tree);
        if (!byId.has(ui.folderId) || byId.get(ui.folderId).url || byId.get(ui.folderId) === root) {
            // The open folder went away: climb to the nearest folder that still exists.
            const up = prevTrail.reverse().find((f) => byId.has(f.id) && !byId.get(f.id).url && byId.get(f.id) !== root);
            ui.folderId = up ? up.id : (roots().find((r) => (r.children || []).length) || roots()[0] || {}).id || null;
        }
        render(prevFolder === ui.folderId);
    }
    function scheduleRefresh() {
        if (importing) return;
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => refresh().catch(report), 40);
    }
    if (BM) {
        for (const ev of ["onCreated", "onRemoved", "onChanged", "onMoved", "onChildrenReordered"]) {
            if (BM[ev]) BM[ev].addListener(scheduleRefresh);
        }
        if (BM.onImportBegan) BM.onImportBegan.addListener(() => { importing = true; });
        if (BM.onImportEnded) BM.onImportEnded.addListener(() => { importing = false; scheduleRefresh(); });
    }

    const saveUi = () => Lemon.store.set("bookmarksUi", ui).catch(() => {});
    function go(folderId) {
        if (!byId.has(folderId)) return;
        // The redraw replaces the folder tile or nav button that was pressed. Keep the keyboard in the column: a press in
        // the list goes on to the first item of the opened folder, a press in the nav row to the button now standing for
        // where it went (the root tab, or the back arrow so Enter keeps climbing). Anything else in the column (a
        // snackbar's "Show") also lands on the first item; focus still on screen (the search field) stays put.
        const a = document.activeElement;
        const fromNav = !!a && nav.contains(a);
        if (a && host.contains(a) && !fromNav) focusAfter = { id: null, fallback: true };
        ui.folderId = folderId;
        saveUi();
        if (query) { query = ""; search.value = ""; searchClear.hidden = true; }
        render();
        body.scrollTop = 0;
        if (fromNav && !a.isConnected) {
            const b = nav.querySelector(`[data-nav="${CSS.escape(folderId)}"]`) || nav.querySelector(".bm-up, .bm-root.on")
                || body.querySelector(".bm-link");
            if (b) b.focus();
        }
    }

    function report(err) {
        console.warn("Material Desk bookmarks:", err);
        snack(String((err && err.message) || err || "Something went wrong").replace(/^Error:\s*/, ""));
    }

    // ---- snackbar -----------------------------------------------------------------------------------------------------
    let snackTimer = 0;
    function snack(text, action, onAction) {
        clearTimeout(snackTimer);
        snackEl.innerHTML = `<span class="bm-snack-text">${esc(text)}</span>` +
            (action ? `<button type="button" class="bm-snack-act">${esc(action)}</button>` : "") +
            `<button type="button" class="bm-snack-x" aria-label="Dismiss">${icon("close")}</button>`;
        snackEl.hidden = false;
        snackEl.classList.remove("bm-in"); void snackEl.offsetWidth; snackEl.classList.add("bm-in");
        const close = () => { clearTimeout(snackTimer); snackEl.hidden = true; };
        if (action) $(".bm-snack-act", snackEl).onclick = () => { close(); onAction(); };
        $(".bm-snack-x", snackEl).onclick = close;
        snackTimer = setTimeout(close, 5000);
    }

    // ---- menu ---------------------------------------------------------------------------------------------------------
    let menuFor = null, menuReturn = null;
    // Position an overlay inside the column. The page may be zoomed (html { zoom }), so rects are scaled back.
    function colPoint(x, y) {
        const r = col.getBoundingClientRect();
        const k = col.offsetWidth ? r.width / col.offsetWidth : 1;
        return { x: (x - r.left) / k, y: (y - r.top) / k, w: col.offsetWidth, h: col.offsetHeight, k };
    }
    function openMenu(id, anchor, point) {
        const n = byId.get(id);
        if (!n) return;
        const locked = !!n.unmodifiable;
        const rows = n.url ? [
            ["open-new", "openNew", "Open in new tab"],
            ["copy", "link", "Copy link"],
            !locked && ["edit", "edit", "Edit"],
            !locked && ["move", "move", "Move to folder"],
            !locked && ["delete", "del", "Delete"],
        ] : [
            ["open", "folder", "Open"],
            n._links && ["open-all", "openNew", `Open all (${n._links})`],
            !locked && ["rename", "edit", "Rename"],
            !locked && ["move", "move", "Move to folder"],
            !locked && ["delete", "del", "Delete"],
        ];
        menu.innerHTML = rows.filter(Boolean).map(([act, ic, label]) =>
            `<button type="button" role="menuitem" class="bm-menu-item${act === "delete" ? " bm-danger" : ""}" data-menu="${act}" tabindex="-1">${icon(ic)}<span>${esc(label)}</span></button>`
        ).join("");
        menuFor = id;
        menuReturn = anchor;
        menu.hidden = false;
        const box = anchor.getBoundingClientRect();
        const p = point ? colPoint(point.x, point.y) : colPoint(box.right, box.bottom);
        const a = colPoint(box.left, box.top);
        const mw = menu.offsetWidth, mh = menu.offsetHeight;
        let left = point ? p.x : p.x - mw;
        let top = point ? p.y : p.y + 4;
        if (top + mh > p.h - 8) top = point ? p.y - mh : a.y - mh - 4;
        left = Math.max(8, Math.min(left, p.w - mw - 8));
        top = Math.max(8, Math.min(top, p.h - mh - 8));
        menu.style.left = left + "px";
        menu.style.top = top + "px";
        const first = menu.querySelector("[role=menuitem]");
        if (first) first.focus();
        host.querySelectorAll(".bm-item.bm-menu-on").forEach((el) => el.classList.remove("bm-menu-on"));
        const item = body.querySelector(`.bm-item[data-id="${CSS.escape(id)}"]`);
        if (item) item.classList.add("bm-menu-on");
    }
    function closeMenu(restore) {
        if (menu.hidden) return;
        menu.hidden = true;
        host.querySelectorAll(".bm-item.bm-menu-on").forEach((el) => el.classList.remove("bm-menu-on"));
        if (restore && menuReturn && menuReturn.isConnected) menuReturn.focus();
        menuFor = null;
    }
    menu.addEventListener("keydown", (e) => {
        const items = [...menu.querySelectorAll("[role=menuitem]")];
        const i = items.indexOf(document.activeElement);
        if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
        else if (e.key === "Home") { e.preventDefault(); items[0].focus(); }
        else if (e.key === "End") { e.preventDefault(); items[items.length - 1].focus(); }
        else if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); closeMenu(true); }
    });
    menu.addEventListener("click", (e) => {
        const b = e.target.closest("[data-menu]");
        if (!b) return;
        const id = menuFor;
        closeMenu(true); // focus back on the item first, so a sheet opened next returns there when it closes
        act(b.dataset.menu, id);
    });
    document.addEventListener("pointerdown", (e) => {
        if (!menu.hidden && !menu.contains(e.target) && !e.target.closest(".bm-more")) closeMenu(false);
    }, true);
    window.addEventListener("blur", () => closeMenu(false));
    window.addEventListener("resize", () => closeMenu(false));

    async function act(what, id) {
        const n = byId.get(id);
        if (!n) return;
        try {
            if (what === "open") go(id);
            else if (what === "open-new") openUrl(n.url, true, false);
            else if (what === "open-all") {
                const links = [];
                const walk = (x) => { if (x.url && safeUrl(x.url)) links.push(x.url); (x.children || []).forEach(walk); };
                walk(n);
                links.slice(0, 50).forEach((u) => openUrl(u, true, false));
                if (links.length > 50) snack("Opened the first 50 bookmarks");
            }
            else if (what === "copy") { await navigator.clipboard.writeText(n.url); snack("Link copied"); }
            else if (what === "edit") bookmarkSheet(n);
            else if (what === "rename") folderSheet(n);
            else if (what === "move") moveSheet(n);
            else if (what === "delete") askDelete(n);
        } catch (err) { report(err); }
    }

    // ---- delete with undo ---------------------------------------------------------------------------------------------
    function askDelete(n) {
        if (n.url || !(n.children || []).length) return removeNode(n);
        let links = 0, folders = 0;
        const walk = (x) => (x.children || []).forEach((c) => { if (c.url) links++; else folders++; walk(c); });
        walk(n);
        const parts = [links && plural(links, "bookmark", "bookmarks"), folders && plural(folders, "folder", "folders")].filter(Boolean);
        openSheet(`
            <h3 class="bm-sheet-title">Delete ${esc(folderName(n))}?</h3>
            <p class="bm-sheet-text">It holds ${esc(parts.join(" and "))}. You can undo for a few seconds.</p>
            <div class="bm-sheet-actions">
                <button type="button" class="bm-text-btn" data-sheet="cancel" data-autofocus>Cancel</button>
                <button type="button" class="bm-btn-danger" data-sheet="ok">Delete</button>
            </div>`, { label: "Delete folder", onOk: () => { closeSheet(); removeNode(n); } });
    }
    async function removeNode(n) {
        // Focus moves on to the next item (or the one before), so the keyboard keeps its place in the list.
        const el = body.querySelector(`.bm-item[data-id="${CSS.escape(n.id)}"]`);
        const sib = el && [el.nextElementSibling, el.previousElementSibling].find((x) => x && x.classList.contains("bm-item"));
        try {
            const [snap] = await BM.getSubTree(n.id);
            if (el) focusAfter = { id: sib ? sib.dataset.id : null, fallback: true };
            if (n.url) await BM.remove(n.id); else await BM.removeTree(n.id);
            snack(`Deleted ${n.url ? (n.title || hostOf(n.url)) : folderName(n)}`, "Undo", () => restore(snap).catch(report));
        } catch (err) { focusAfter = null; report(err); }
    }
    async function restore(snap) {
        const parentId = byId.has(snap.parentId) ? snap.parentId : (roots()[1] || roots()[0]).id;
        const make = async (x, parent, index) => {
            const o = { parentId: parent, title: x.title || "" };
            if (x.url) o.url = x.url;
            const siblings = (byId.get(parent) || {}).children || [];
            if (index != null && index <= siblings.length) o.index = index;
            const made = await BM.create(o);
            for (const c of x.children || []) await make(c, made.id);
            return made;
        };
        await make(snap, parentId, snap.index);
    }

    // ---- sheets (add/edit, folder, move, confirm) ----------------------------------------------------------------------
    let sheetOpts = null, sheetReturn = null;
    function openSheet(html, opts) {
        closeMenu(false);
        sheetReturn = document.activeElement;
        sheetOpts = opts || {};
        sheet.innerHTML = html;
        sheet.setAttribute("aria-label", sheetOpts.label || "");
        sheet.hidden = false; scrim.hidden = false;
        sheet.classList.remove("bm-in"); void sheet.offsetWidth; sheet.classList.add("bm-in");
        const f = sheet.querySelector("[data-autofocus]") || sheet.querySelector("input, select, button:not([data-sheet=cancel])");
        if (f) { f.focus(); if (f.select && f.value) f.select(); }
    }
    function closeSheet() {
        if (sheet.hidden) return;
        sheet.hidden = true; scrim.hidden = true; sheet.innerHTML = "";
        sheetOpts = null;
        if (sheetReturn && sheetReturn.isConnected && sheetReturn !== document.body) sheetReturn.focus();
    }
    scrim.addEventListener("click", closeSheet);
    sheet.addEventListener("click", (e) => {
        const b = e.target.closest("[data-sheet]");
        if (!b || !sheetOpts) return;
        if (b.dataset.sheet === "cancel") closeSheet();
        else if (b.dataset.sheet === "ok" && sheetOpts.onOk) sheetOpts.onOk();
        else if (b.dataset.sheet === "delete" && sheetOpts.onDelete) sheetOpts.onDelete();
    });
    sheet.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeSheet(); return; }
        if (e.key === "Tab") { // keep focus inside the sheet
            const f = [...sheet.querySelectorAll("input, select, button, [tabindex='0']")].filter((x) => !x.disabled && x.offsetParent);
            if (!f.length) return;
            if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
            else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        }
    });
    sheet.addEventListener("submit", (e) => { e.preventDefault(); if (sheetOpts && sheetOpts.onOk) sheetOpts.onOk(); });

    function folderOptions(selectedId, excludeId) {
        const out = [];
        const walk = (n, depth) => {
            if (n.url || n.id === excludeId || n.unmodifiable) return; // managed folders cannot take new items
            if (n !== root) {
                out.push(`<option value="${n.id}"${n.id === selectedId ? " selected" : ""}>${"  ".repeat(depth)}${esc(folderName(n))}</option>`);
            }
            (n.children || []).forEach((c) => walk(c, n === root ? 0 : depth + 1));
        };
        walk(root, 0);
        return out.join("");
    }

    function bookmarkSheet(n, preset) {
        const editing = !!(n && n.url);
        const parentId = editing ? n.parentId : (preset && preset.parentId) || (current() || {}).id;
        const url = editing ? n.url : (preset && preset.url) || "";
        const title = editing ? n.title : (preset && preset.url ? titleFromUrl(preset.url) : "");
        openSheet(`
            <form class="bm-form" novalidate>
                <div class="bm-sheet-head">
                    <span class="bm-sheet-badge">${icon(editing ? "edit" : "bookmarkAdd")}</span>
                    <h3 class="bm-sheet-title">${editing ? "Edit bookmark" : "Add bookmark"}</h3>
                    <button type="button" class="icon-btn" data-sheet="cancel" aria-label="Close">${icon("close")}</button>
                </div>
                <label class="bm-label" for="bm-f-url">Link</label>
                <input id="bm-f-url" class="field" name="url" type="text" inputmode="url" value="${esc(url)}"
                    placeholder="Paste or type a link" autocomplete="off" spellcheck="false" ${editing ? "" : "data-autofocus"}
                    aria-describedby="bm-f-err">
                <p id="bm-f-err" class="bm-err" hidden>Enter a full link, like example.com</p>
                <label class="bm-label" for="bm-f-title">Name</label>
                <input id="bm-f-title" class="field" name="title" type="text" value="${esc(title)}" placeholder="Name"
                    autocomplete="off" ${editing ? "data-autofocus" : ""} data-auto="${editing ? "0" : "1"}">
                <label class="bm-label" for="bm-f-folder">Folder</label>
                <div class="bm-select">${icon("folder")}<select id="bm-f-folder" name="folder">${folderOptions(parentId)}</select>${icon("expand", "bm-select-caret")}</div>
                <div class="bm-sheet-actions">
                    ${editing ? `<button type="button" class="bm-text-btn bm-danger" data-sheet="delete">${icon("del")}Delete</button><span class="bm-grow"></span>` : ""}
                    <button type="button" class="bm-text-btn" data-sheet="cancel">Cancel</button>
                    <button type="submit" class="btn-filled">Save</button>
                </div>
            </form>`, {
            label: editing ? "Edit bookmark" : "Add bookmark",
            onDelete: () => { closeSheet(); removeNode(n); },
            onOk: async () => {
                const f = $(".bm-form", sheet);
                // An existing link kept as it is saves even when it is not one this page would make (a bookmarklet).
                const href = editing && f.url.value.trim() === n.url ? n.url : normalizeUrl(f.url.value);
                if (!href) { $("#bm-f-err", sheet).hidden = false; f.url.setAttribute("aria-invalid", "true"); f.url.focus(); return; }
                const name = f.title.value.trim() || titleFromUrl(href);
                const folder = f.folder.value;
                try {
                    if (editing) {
                        focusAfter = { id: n.id, fallback: true }; // the redraw replaces the focused link
                        await BM.update(n.id, { title: name, url: href });
                        if (folder !== n.parentId) await BM.move(n.id, { parentId: folder });
                        closeSheet();
                    } else {
                        await BM.create({ parentId: folder, title: name, url: href });
                        closeSheet();
                        if (folder !== ui.folderId) go(folder);
                        snack(`Added ${name}`);
                    }
                } catch (err) { focusAfter = null; report(err); }
            },
        });
        wireUrlField($("#bm-f-url", sheet), $("#bm-f-title", sheet));
    }

    // Paste-friendly link field: tidy what was pasted and fill the name from the host while the name is untouched.
    function wireUrlField(urlEl, titleEl) {
        const sync = () => {
            const href = normalizeUrl(urlEl.value);
            urlEl.removeAttribute("aria-invalid");
            const err = $("#bm-f-err", sheet); if (err) err.hidden = true;
            if (titleEl && titleEl.dataset.auto === "1") titleEl.value = href ? titleFromUrl(href) : "";
        };
        urlEl.addEventListener("input", sync);
        urlEl.addEventListener("paste", (e) => {
            const text = (e.clipboardData && e.clipboardData.getData("text")) || "";
            const href = normalizeUrl(text);
            // Pasting into part of a link (a path at the end, say) is a normal paste.
            if (!href || (urlEl.value && !(urlEl.selectionStart === 0 && urlEl.selectionEnd === urlEl.value.length))) return;
            e.preventDefault();
            urlEl.value = href;
            sync();
            if (titleEl && titleEl.dataset.auto === "1") titleEl.focus();
        });
        if (titleEl) titleEl.addEventListener("input", () => { titleEl.dataset.auto = titleEl.value ? "0" : "1"; });
    }

    function folderSheet(n) {
        const editing = !!n;
        const parentId = (current() || {}).id;
        openSheet(`
            <form class="bm-form" novalidate>
                <div class="bm-sheet-head">
                    <span class="bm-sheet-badge bm-badge-folder">${icon(editing ? "edit" : "newFolder")}</span>
                    <h3 class="bm-sheet-title">${editing ? "Rename folder" : "New folder"}</h3>
                    <button type="button" class="icon-btn" data-sheet="cancel" aria-label="Close">${icon("close")}</button>
                </div>
                <label class="bm-label" for="bm-f-name">Name</label>
                <input id="bm-f-name" class="field" name="title" type="text" value="${esc(editing ? n.title : "")}"
                    placeholder="Folder name" autocomplete="off" data-autofocus>
                ${editing ? "" : `<label class="bm-label" for="bm-f-folder">Inside</label>
                <div class="bm-select">${icon("folder")}<select id="bm-f-folder" name="folder">${folderOptions(parentId)}</select>${icon("expand", "bm-select-caret")}</div>`}
                <div class="bm-sheet-actions">
                    <button type="button" class="bm-text-btn" data-sheet="cancel">Cancel</button>
                    <button type="submit" class="btn-filled">${editing ? "Save" : "Create"}</button>
                </div>
            </form>`, {
            label: editing ? "Rename folder" : "New folder",
            onOk: async () => {
                const f = $(".bm-form", sheet);
                const name = f.title.value.trim() || "New folder";
                try {
                    if (editing) { focusAfter = { id: n.id, fallback: true }; await BM.update(n.id, { title: name }); closeSheet(); }
                    else {
                        const parent = f.folder.value;
                        const made = await BM.create({ parentId: parent, title: name });
                        closeSheet();
                        // Made somewhere else: open that folder so the new one is in view (as adding a bookmark does).
                        if (parent !== ui.folderId) { go(parent); snack(`Created ${name} in ${folderName(byId.get(parent))}`); }
                        // Focus the new folder once it is drawn. The fallback keeps the keyboard in the list should the
                        // button that opened the sheet be gone (the welcome card's "New folder", or a nav row redrawn).
                        focusAfter = { id: made.id, fallback: true };
                        if (byId.has(made.id)) applyFocusAfter();
                    }
                } catch (err) { focusAfter = null; report(err); }
            },
        });
    }

    function moveSheet(n) {
        const rows = [];
        const walk = (x, depth) => {
            if (x.url || x.id === n.id || x.unmodifiable) return; // managed folders cannot take new items
            if (x !== root) {
                const here = x.id === n.parentId;
                rows.push(`<button type="button" class="bm-move-row${here ? " here" : ""}" data-to="${x.id}" style="--depth:${depth}"
                    ${here ? 'aria-current="true"' : ""}>${icon("folder")}<span>${esc(folderName(x))}</span>${here ? `<span class="bm-move-here">Here now</span>` : ""}</button>`);
            }
            (x.children || []).forEach((c) => walk(c, x === root ? 0 : depth + 1));
        };
        walk(root, 0);
        const name = n.url ? (n.title || hostOf(n.url)) : folderName(n);
        openSheet(`
            <div class="bm-sheet-head">
                <span class="bm-sheet-badge bm-badge-folder">${icon("move")}</span>
                <h3 class="bm-sheet-title">Move ${esc(name)}</h3>
                <button type="button" class="icon-btn" data-sheet="cancel" aria-label="Close">${icon("close")}</button>
            </div>
            <div class="bm-move-list" role="group" aria-label="Folders">${rows.join("")}</div>`, { label: "Move to folder" });
        sheet.querySelector(".bm-move-list").addEventListener("click", async (e) => {
            const b = e.target.closest("[data-to]");
            if (!b) return;
            try {
                // The item leaves this folder: the keyboard goes on to what is left.
                if (b.dataset.to !== n.parentId) { focusAfter = { id: n.id, fallback: true }; await BM.move(n.id, { parentId: b.dataset.to }); }
                closeSheet();
                if (b.dataset.to !== n.parentId) snack(`Moved to ${folderName(byId.get(b.dataset.to))}`, "Show", () => go(b.dataset.to));
            } catch (err) { focusAfter = null; report(err); }
        });
        const here = sheet.querySelector(".bm-move-row:not(.here)");
        if (here) here.focus();
    }

    // ---- header, search, nav, body events -----------------------------------------------------------------------------
    $(".bm-fab").addEventListener("click", () => bookmarkSheet(null));
    $(".bm-gear").addEventListener("click", () => col.dispatchEvent(new CustomEvent("lemon:settings", { detail: { open: true } })));
    $(".bm-seg").addEventListener("click", (e) => {
        const b = e.target.closest("[data-view]");
        if (b && b.dataset.view !== view) Lemon.settings.set({ bookmarksView: b.dataset.view });
    });
    $(".bm-seg").addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            const next = view === "list" ? "grid" : "list";
            Lemon.settings.set({ bookmarksView: next }).then(() => $(`.bm-seg [data-view=${next}]`).focus());
        }
    });

    let searchFrame = 0;
    search.addEventListener("input", () => {
        cancelAnimationFrame(searchFrame);
        searchFrame = requestAnimationFrame(() => {
            query = search.value.trim();
            searchClear.hidden = !search.value;
            renderNav(); renderBody();
            body.scrollTop = 0;
        });
    });
    search.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && search.value) { e.preventDefault(); e.stopPropagation(); clearSearch(); }
        else if (e.key === "ArrowDown") { const f = body.querySelector(".bm-link"); if (f) { e.preventDefault(); f.focus(); } }
        else if (e.key === "Enter") {
            const first = body.querySelector(".bm-item");
            if (first) {
                e.preventDefault();
                const n = byId.get(first.dataset.id);
                if (n && n.url) openUrl(n.url, e.ctrlKey || e.metaKey, e.shiftKey); else if (n) go(n.id);
            } else {
                const add = body.querySelector("[data-act=add-query]");
                if (add) add.click();
            }
        }
    });
    function clearSearch() {
        search.value = ""; query = ""; searchClear.hidden = true;
        renderNav(); renderBody();
        search.focus();
    }
    searchClear.addEventListener("click", clearSearch);

    nav.addEventListener("click", (e) => {
        const b = e.target.closest("[data-nav]");
        if (b) go(b.dataset.nav);
        else if (e.target.closest("[data-act=new-folder]")) folderSheet(null);
    });

    // Clicks: a link opens here, Ctrl/Cmd or middle click opens a new tab; folders open in place.
    body.addEventListener("click", (e) => {
        const more = e.target.closest(".bm-more");
        if (more) { e.preventDefault(); const it = more.closest(".bm-item"); openMenu(it.dataset.id, more); return; }
        const actBtn = e.target.closest("[data-act]");
        if (actBtn) {
            const a = actBtn.dataset.act;
            if (a === "add") bookmarkSheet(null);
            else if (a === "new-folder") folderSheet(null);
            else if (a === "add-query") bookmarkSheet(null, { url: normalizeUrl(query), parentId: (current() || {}).id });
            return;
        }
        const link = e.target.closest(".bm-link");
        if (!link) return;
        e.preventDefault();
        if (link.dataset.folder) { go(link.dataset.folder); return; }
        const n = byId.get(link.closest(".bm-item").dataset.id);
        if (n) openUrl(n.url, e.ctrlKey || e.metaKey || e.button === 1, e.shiftKey);
    });
    body.addEventListener("auxclick", (e) => {
        if (e.button !== 1) return;
        const link = e.target.closest("a.bm-link");
        if (!link) return;
        e.preventDefault();
        const n = byId.get(link.closest(".bm-item").dataset.id);
        if (n) openUrl(n.url, true, e.shiftKey);
    });
    body.addEventListener("mousedown", (e) => { if (e.button === 1 && e.target.closest("a.bm-link")) e.preventDefault(); });
    body.addEventListener("contextmenu", (e) => {
        const it = e.target.closest(".bm-item");
        if (!it) return;
        e.preventDefault();
        openMenu(it.dataset.id, it.querySelector(".bm-link"), { x: e.clientX, y: e.clientY });
    });
    // Grid columns as drawn (1 in the list view).
    function gridCols(items) {
        if (!body.classList.contains("bm-view-grid") || !items.length) return 1;
        const top0 = items[0].offsetTop;
        return items.filter((x) => x.offsetTop === top0).length || 1;
    }
    async function moveBy(n, key) {
        const parent = byId.get(n.parentId);
        const kids = (parent && parent.children) || [];
        const from = kids.indexOf(n);
        if (from < 0) return;
        const cols = gridCols([...body.querySelectorAll(".bm-item")]);
        if (cols === 1 && (key === "ArrowLeft" || key === "ArrowRight")) return;
        const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[key];
        const to = Math.max(0, Math.min(kids.length - 1, from + step));
        if (to === from) return;
        try {
            focusAfter = { id: n.id, fallback: false };
            // chrome.bookmarks.move counts the index before the item is taken out, so moving down needs one more.
            await BM.move(n.id, { parentId: parent.id, index: to > from ? to + 1 : to });
        } catch (err) { focusAfter = null; report(err); }
    }
    body.addEventListener("keydown", (e) => {
        const link = e.target.closest(".bm-link");
        if (!link) return;
        const it = link.closest(".bm-item");
        if (!it) return; // the grid's "Add" tile is a plain button
        const n = byId.get(it.dataset.id);
        if ((e.key === "F10" && e.shiftKey) || e.key === "ContextMenu") { e.preventDefault(); openMenu(it.dataset.id, link); return; }
        // A folder with items asks first (focus stays in that sheet); removeNode moves focus on after the delete.
        if (n && !n.unmodifiable && e.key === "Delete") { e.preventDefault(); act("delete", n.id); return; }
        // Alt+arrows reorder the focused item inside its folder (the keyboard twin of dragging).
        if (e.altKey && !query && n && !n.unmodifiable && /^Arrow(Up|Down|Left|Right)$/.test(e.key)) {
            e.preventDefault();
            moveBy(n, e.key);
            return;
        }
        if (n && !n.unmodifiable && e.key === "F2") { e.preventDefault(); act(n.url ? "edit" : "rename", n.id); return; }
        if (n && !n.url && e.key === " ") { e.preventDefault(); go(n.id); return; }
        if (!query && e.key === "Backspace") { const t = trail(ui.folderId); if (t.length > 1) { e.preventDefault(); go(t[t.length - 2].id); } return; } // go() keeps focus in the list
        // Arrow keys move between items (grid: by row too).
        const items = [...body.querySelectorAll(".bm-item")];
        const i = items.indexOf(it);
        const cols = gridCols(items);
        const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
        if (step === undefined) {
            if (e.key === "Home" || e.key === "End") { e.preventDefault(); items[e.key === "Home" ? 0 : items.length - 1].querySelector(".bm-link").focus(); }
            return;
        }
        if (cols === 1 && (e.key === "ArrowRight" || e.key === "ArrowLeft")) return;
        e.preventDefault();
        const j = i + step;
        if (j < 0 && e.key === "ArrowUp") { search.focus(); return; }
        if (items[j]) { const l = items[j].querySelector(".bm-link"); l.focus(); l.scrollIntoView({ block: "nearest" }); }
    });

    // Quick add in the empty state.
    body.addEventListener("submit", async (e) => {
        if (!e.target.classList.contains("bm-quick")) return;
        e.preventDefault();
        const input = $(".bm-quick-url", e.target);
        const href = normalizeUrl(input.value);
        const hint = $(".bm-quick-hint", body);
        if (!href) { input.setAttribute("aria-invalid", "true"); hint.textContent = "That does not look like a link. Try example.com"; hint.classList.add("bm-bad"); input.focus(); return; }
        const parent = roots()[0];
        try {
            const made = await BM.create({ parentId: parent.id, title: titleFromUrl(href), url: href });
            ui.folderId = parent.id; saveUi();
            focusMade(made.id); // the welcome card is replaced by the list: keep the keyboard on the new bookmark
            snack(`Added ${made.title || titleFromUrl(href)}`, "Edit", () => { const m = byId.get(made.id); if (m) bookmarkSheet(m); });
        } catch (err) { report(err); }
    });
    body.addEventListener("input", (e) => {
        if (!e.target.classList.contains("bm-quick-url")) return;
        const hint = $(".bm-quick-hint", body);
        const href = normalizeUrl(e.target.value);
        e.target.removeAttribute("aria-invalid");
        hint.classList.remove("bm-bad");
        const bar = roots()[0];
        hint.textContent = href ? `Saves ${titleFromUrl(href)} to ${bar ? rootLabel(bar) : "Bookmarks bar"}` : `Saves to ${bar ? rootLabel(bar) : "Bookmarks bar"}`;
    });
    body.addEventListener("paste", (e) => {
        if (!e.target.classList.contains("bm-quick-url")) return;
        const href = normalizeUrl((e.clipboardData && e.clipboardData.getData("text")) || "");
        const el = e.target;
        if (!href || (el.value && !(el.selectionStart === 0 && el.selectionEnd === el.value.length))) return;
        e.preventDefault();
        e.target.value = href;
        e.target.dispatchEvent(new Event("input", { bubbles: true }));
    });

    // ---- drag and drop ------------------------------------------------------------------------------------------------
    // Reorder inside a folder, drop onto a folder (or a breadcrumb) to move into it, drop links from other apps to add.
    let drag = null, dropMark = null, springTimer = 0, springId = null;
    const hasLink = (dt) => dt && [...dt.types].some((t) => t === "text/uri-list");
    function clearDrop() {
        if (dropMark) dropMark.classList.remove("bm-drop-before", "bm-drop-after", "bm-drop-into");
        dropMark = null;
        nav.querySelectorAll(".bm-drop-into").forEach((x) => x.classList.remove("bm-drop-into"));
        body.classList.remove("bm-drop-end");
    }
    // A drag of ours carries DND_TYPE. Without it a leftover `drag` is stale: the spring-open redraw removed the dragged
    // row, so its dragend never reached the document. Forget it, so a link dropped later is added, not taken for a move.
    function endDrag() {
        clearDrop(); clearTimeout(springTimer); springId = null; drag = null;
        host.classList.remove("bm-dragging-on");
        host.querySelectorAll(".bm-dragging").forEach((x) => x.classList.remove("bm-dragging"));
    }
    function syncDrag(dt) { if (drag && !(dt && [...dt.types].includes(DND_TYPE))) endDrag(); }
    // A pointer press cannot happen during a drag, so the next one tidies a drag whose dragend was lost.
    document.addEventListener("pointerdown", () => { if (drag) endDrag(); }, true);
    function dropTarget(e) {
        const t = dropSpot(e);
        // Managed bookmarks (enterprise policy) cannot be changed: nothing drops into them.
        return t && !(byId.get(t.parentId) || {}).unmodifiable ? t : null;
    }
    function dropSpot(e) {
        const cur = current();
        const it = e.target.closest(".bm-item");
        if (!total) return { parentId: roots()[0].id, index: undefined, end: true }; // the welcome card saves to the bar
        if (!it) return { parentId: cur.id, index: undefined, end: true };
        const n = byId.get(it.dataset.id);
        if (!n || (drag && n.id === drag.id)) return null;
        const r = it.getBoundingClientRect();
        const grid = body.classList.contains("bm-view-grid");
        const f = grid ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height;
        if (!n.url && f > 0.25 && f < 0.75) {
            if (drag && (insideOf(n.id, drag.id))) return null;
            return { el: it, into: n.id, parentId: n.id, index: undefined };
        }
        const before = f < 0.5;
        return { el: it, before, parentId: n.parentId, index: n.index + (before ? 0 : 1) };
    }
    body.addEventListener("dragstart", (e) => {
        const it = e.target.closest && e.target.closest(".bm-item[draggable=true]");
        if (!it || query) return;
        const n = byId.get(it.dataset.id);
        if (!n) return;
        drag = { id: n.id };
        closeMenu(false);
        e.dataTransfer.effectAllowed = "copyMove";
        e.dataTransfer.setData(DND_TYPE, n.id);
        if (n.url) { e.dataTransfer.setData("text/uri-list", n.url); e.dataTransfer.setData("text/plain", n.url); }
        else e.dataTransfer.setData("text/plain", folderName(n));
        requestAnimationFrame(() => it.classList.add("bm-dragging"));
        host.classList.add("bm-dragging-on");
    });
    body.addEventListener("dragover", (e) => {
        syncDrag(e.dataTransfer);
        if (query || (!drag && !hasLink(e.dataTransfer))) return;
        const t = dropTarget(e);
        clearDrop();
        if (!t) { clearTimeout(springTimer); springId = null; return; }
        e.preventDefault();
        e.dataTransfer.dropEffect = drag ? "move" : "copy";
        if (t.el) { dropMark = t.el; t.el.classList.add(t.into ? "bm-drop-into" : t.before ? "bm-drop-before" : "bm-drop-after"); }
        else body.classList.add("bm-drop-end");
        // Hovering on a folder opens it after a moment, so a link can travel deeper.
        if (t.into && springId !== t.into) {
            clearTimeout(springTimer); springId = t.into;
            springTimer = setTimeout(() => { if (springId) { const id = springId; springId = null; clearDrop(); go(id); } }, 900);
        } else if (!t.into) { clearTimeout(springTimer); springId = null; }
    });
    body.addEventListener("dragleave", (e) => { if (!body.contains(e.relatedTarget)) { clearDrop(); clearTimeout(springTimer); springId = null; } });
    body.addEventListener("drop", (e) => {
        syncDrag(e.dataTransfer);
        if (query) return;
        const t = dropTarget(e);
        clearDrop(); clearTimeout(springTimer); springId = null;
        if (!t) return;
        e.preventDefault();
        doDrop(e.dataTransfer, t.parentId, t.index);
    });
    nav.addEventListener("dragover", (e) => {
        syncDrag(e.dataTransfer);
        const b = e.target.closest("[data-drop]");
        if (!b || (byId.get(b.dataset.drop) || {}).unmodifiable || (!drag && !hasLink(e.dataTransfer))) return;
        if (drag && (b.dataset.drop === drag.id || insideOf(b.dataset.drop, drag.id))) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = drag ? "move" : "copy";
        clearDrop();
        b.classList.add("bm-drop-into");
    });
    nav.addEventListener("dragleave", (e) => { const b = e.target.closest("[data-drop]"); if (b && !b.contains(e.relatedTarget)) b.classList.remove("bm-drop-into"); });
    nav.addEventListener("drop", (e) => {
        syncDrag(e.dataTransfer);
        const b = e.target.closest("[data-drop]");
        if (!b || (byId.get(b.dataset.drop) || {}).unmodifiable) return;
        e.preventDefault();
        clearDrop();
        doDrop(e.dataTransfer, b.dataset.drop, undefined);
    });
    document.addEventListener("dragend", endDrag);
    async function doDrop(dt, parentId, index) {
        const id = drag && drag.id;
        drag = null;
        host.classList.remove("bm-dragging-on");
        try {
            if (id) {
                if (parentId === id || insideOf(parentId, id)) return;
                const dest = { parentId };
                if (index !== undefined) dest.index = index;
                await BM.move(id, dest);
                return;
            }
            const raw = (dt.getData("text/uri-list") || "").split(/\r?\n/).find((l) => l && !l.startsWith("#")) || dt.getData("text/plain");
            const href = normalizeUrl(raw);
            if (!href) return;
            const o = { parentId, title: titleFromUrl(href), url: href };
            if (index !== undefined) o.index = index;
            const made = await BM.create(o);
            snack(`Added ${made.title || o.title}`, "Edit", () => { const m = byId.get(made.id); if (m) bookmarkSheet(m); });
        } catch (err) { report(err); }
    }

    // Esc anywhere in the column closes the open overlay.
    col.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (!menu.hidden) { e.preventDefault(); closeMenu(true); }
        else if (!sheet.hidden) { e.preventDefault(); closeSheet(); }
    });
    // Settings slides over the column: close what is open under it.
    col.addEventListener("lemon:settings", () => { closeMenu(false); closeSheet(); });

    // ---- Google apps --------------------------------------------------------------------------------------------------
    const APPS = [
        ["Gmail", "mail", "https://mail.google.com/"],
        ["Calendar", "calendar", "https://calendar.google.com/"],
        ["Drive", "drive", "https://drive.google.com/"],
        ["Docs", "docs", "https://docs.google.com/"],
        ["YouTube", "youtube", "https://www.youtube.com/"],
        ["Maps", "maps", "https://maps.google.com/"],
        ["Photos", "photos", "https://photos.google.com/"],
        ["Classroom", "school", "https://classroom.google.com/"],
        ["Meet", "meet", "https://meet.google.com/"],
        ["Translate", "translate", "https://translate.google.com/"],
    ];
    function renderApps() {
        if (!appsHost) return;
        appsHost.innerHTML = `
            <section class="bm-apps${ui.appsOpen ? " open" : ""}" aria-label="Google apps">
                <button type="button" class="bm-apps-head" aria-expanded="${ui.appsOpen}" aria-controls="bm-apps-grid">
                    <span class="bm-apps-badge">${icon("apps")}</span>
                    <span class="bm-apps-title">Google apps</span>
                    ${icon("expand", "bm-apps-caret")}
                </button>
                <div class="bm-apps-wrap"><div class="bm-apps-grid" id="bm-apps-grid"${ui.appsOpen ? "" : " inert"}>
                    ${APPS.map(([name, ic, url]) => `<a class="bm-app" href="${url}" title="${name}" draggable="false">
                        <span class="bm-app-ico">${icon(ic)}</span><span class="bm-app-name">${name}</span></a>`).join("")}
                </div></div>
            </section>`;
        const sec = appsHost.firstElementChild;
        sec.querySelector(".bm-apps-head").addEventListener("click", () => {
            ui.appsOpen = !ui.appsOpen;
            saveUi();
            sec.classList.toggle("open", ui.appsOpen);
            sec.querySelector(".bm-apps-head").setAttribute("aria-expanded", String(ui.appsOpen));
            sec.querySelector(".bm-apps-grid").inert = !ui.appsOpen;
        });
        sec.addEventListener("click", (e) => {
            const a = e.target.closest(".bm-app");
            if (!a) return;
            e.preventDefault();
            openUrl(a.href, e.ctrlKey || e.metaKey, e.shiftKey);
        });
        sec.addEventListener("auxclick", (e) => {
            const a = e.target.closest(".bm-app");
            if (!a || e.button !== 1) return;
            e.preventDefault();
            openUrl(a.href, true, e.shiftKey);
        });
    }

    // ---- start --------------------------------------------------------------------------------------------------------
    (async () => {
        await Lemon.ready;
        view = Lemon.settings.get().bookmarksView === "list" ? "list" : "grid";
        const saved = await Lemon.store.get("bookmarksUi", null);
        if (saved && typeof saved === "object") ui = { ...ui, ...saved };
        renderApps();
        await refresh();
        Lemon.settings.onChange((s, patch) => {
            if ("bookmarksView" in patch) { view = s.bookmarksView === "list" ? "list" : "grid"; render(true); }
        });
    })().catch(report);
})();
