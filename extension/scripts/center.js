/*
 * Center column: the long search bar (#search-host) and the date pill style hook (#dlDate is filled by
 * cookie-clock.js). Search: pick the engine from the button on the left (setting `engine`), suggestions while typing
 * (setting `suggestions`; only with Google or DuckDuckGo, from that engine's own suggest service), arrow keys to pick
 * one, Enter to go. Text that looks like an address opens it directly.
 */
(function () {
    const ENGINES = {
        google: { name: "Google", mark: "G", url: "https://www.google.com/search?q=" },
        duckduckgo: { name: "DuckDuckGo", mark: "D", url: "https://duckduckgo.com/?q=" },
        bing: { name: "Bing", mark: "B", url: "https://www.bing.com/search?q=" },
        brave: { name: "Brave", mark: "Br", url: "https://search.brave.com/search?q=" },
        wikipedia: { name: "Wikipedia", mark: "W", url: "https://en.wikipedia.org/w/index.php?search=" },
        youtube: { name: "YouTube", mark: "Y", url: "https://www.youtube.com/results?search_query=" },
    };
    const SEARCH_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 3a6.5 6.5 0 0 1 5.16 10.45l5.45 5.44-1.42 1.42-5.44-5.45A6.5 6.5 0 1 1 9.5 3m0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9"/></svg>';
    // End4's 12-sided cookie (same shape library as the clock), behind the engine letter.
    const COOKIE = '<svg class="sb-cookie" viewBox="0 0 1 1" aria-hidden="true"><path d="M0.92409 0.74485C0.91128 0.76703 0.88955 0.78405 0.8623 0.79001C0.82615 0.79792 0.79792 0.82615 0.79001 0.8623C0.7781 0.91679 0.7219 0.94923 0.66875 0.93231C0.6335 0.92108 0.59493 0.93142 0.57001 0.95877C0.53244 1 0.46756 1 0.42999 0.95877C0.40507 0.93142 0.3665 0.92108 0.33125 0.93231C0.2781 0.94923 0.2219 0.91679 0.20999 0.8623C0.20208 0.82615 0.17385 0.79792 0.1377 0.79001C0.08321 0.7781 0.05077 0.7219 0.06769 0.66875C0.07892 0.6335 0.06858 0.59493 0.04123 0.57001C0 0.53244 0 0.46756 0.04123 0.42999C0.06858 0.40507 0.07892 0.3665 0.06769 0.33125C0.05077 0.2781 0.08321 0.2219 0.1377 0.20999C0.17385 0.20208 0.20208 0.17385 0.20999 0.1377C0.2219 0.08321 0.2781 0.05077 0.33125 0.06769C0.3665 0.07892 0.40507 0.06858 0.42999 0.04123C0.46756 0 0.53244 0 0.57001 0.04123C0.59493 0.06858 0.6335 0.07892 0.66875 0.06769C0.7219 0.05077 0.7781 0.08321 0.79001 0.1377C0.79792 0.17385 0.82615 0.20208 0.8623 0.20999C0.91679 0.2219 0.94923 0.2781 0.93231 0.33125C0.92108 0.3665 0.93142 0.40507 0.95877 0.42999C1 0.46756 1 0.53244 0.95877 0.57001C0.93142 0.59493 0.92108 0.6335 0.93231 0.66875C0.94077 0.69533 0.93689 0.72266 0.92409 0.74485Z"/></svg>';
    const ARROW_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11h10.17l-4.58-4.59L12 5l7 7-7 7-1.41-1.41L15.17 13H5z"/></svg>';

    // An address: a scheme (https://, chrome://), localhost, an IPv4 address, or a host whose last part is letters.
    // So "3.14", "v1.2.3" and "README.md" are searched, not opened. A bare "name.ext" with a common file extension
    // (no path, no port) also counts as a search.
    const FILE_EXT = /\.(md|txt|js|mjs|ts|tsx|jsx|py|sh|json|css|html?|xml|ya?ml|toml|ini|cfg|conf|log|csv|tsv|pdf|docx?|xlsx?|pptx?|png|jpe?g|gif|svg|webp|mp3|mp4|mkv|mov|wav|zip|tar|gz|7z|exe|deb|rpm|c|h|cpp|hpp|rs|go|java|kt|rb|php|lua|qml|lock)$/i;
    const hasScheme = (t) => /^[a-z][\w+.-]*:\/\//i.test(t);
    const looksLikeUrl = (t) => !/\s/.test(t) && (hasScheme(t) || /^localhost(:\d+)?(\/\S*)?$/i.test(t) ||
        /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/\S*)?$/.test(t) ||
        (/^(?:[a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(t) && (/[/:]/.test(t) || !FILE_EXT.test(t))));
    // Script-carrying schemes never open from the search bar: "javascript://..." is searched as text.
    const safeUrl = (u) => { try { return !/^(javascript|data|vbscript|blob|filesystem):$/i.test(new URL(u).protocol); } catch (e) { return false; } };
    const COLS = 3;   // engine menu columns (styles/center.css)
    const engine = () => ENGINES[Lemon.settings.get().engine] || ENGINES.google;

    function go(text, newTab) {
        const t = text.trim();
        if (!t) return;
        let url = looksLikeUrl(t) ? (hasScheme(t) ? t : (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:|\/|$)/i.test(t) ? "http://" : "https://") + t)
            : engine().url + encodeURIComponent(t);
        if (!safeUrl(url)) url = engine().url + encodeURIComponent(t);
        const tabs = window.chrome && chrome.tabs;
        if (newTab && tabs) tabs.create({ url });
        // chrome://, file:// and the like are blocked from a page's location; the tabs API may open them.
        else if (!/^https?:/i.test(url) && tabs) tabs.update({ url });
        else location.href = url;
    }

    // Only Google and DuckDuckGo give suggestions, each for its own engine: what is typed for Bing, Brave, Wikipedia or
    // YouTube is never sent to another company.
    const suggestsFor = (s) => s.suggestions && (s.engine === "google" || s.engine === "duckduckgo" || !ENGINES[s.engine]);
    async function suggest(q) {
        if (!suggestsFor(Lemon.settings.get()) || q.length < 1 || looksLikeUrl(q)) return [];
        try {
            if (Lemon.settings.get().engine === "duckduckgo") {
                const r = await (await fetch("https://duckduckgo.com/ac/?type=list&q=" + encodeURIComponent(q))).json();
                return (r[1] || []).slice(0, 7);
            }
            const r = await (await fetch("https://www.google.com/complete/search?client=chrome&q=" + encodeURIComponent(q))).json();
            return (r[1] || []).slice(0, 7);
        } catch (e) {
            return [];
        }
    }

    function build(host) {
        host.innerHTML = `
            <form class="sb" role="search" autocomplete="off">
                <button type="button" class="sb-engine" aria-haspopup="listbox" aria-expanded="false"
                    aria-controls="sb-engines">${COOKIE}<b></b></button>
                <input class="sb-input" type="text" spellcheck="false" aria-label="Search or type a web address"
                    aria-autocomplete="list" aria-controls="sb-list">
                <button type="submit" class="sb-go" aria-label="Search">${SEARCH_ICON}</button>
            </form>
            <ul class="sb-menu" id="sb-engines" role="listbox" aria-label="Search engine" hidden></ul>
            <ul class="sb-menu sb-suggest" id="sb-list" role="listbox" hidden></ul>`;
        const form = host.querySelector(".sb"), input = host.querySelector(".sb-input");
        const engBtn = host.querySelector(".sb-engine"), engMenu = host.querySelector("#sb-engines");
        const list = host.querySelector("#sb-list");
        let items = [], active = -1, typed = "", seq = 0;

        function paintEngine() {
            const e = engine();
            engBtn.querySelector("b").textContent = e.mark;
            engBtn.title = e.name + " (change engine)";
            engBtn.setAttribute("aria-label", `Search engine: ${e.name}`);
            input.placeholder = `Search ${e.name} or type a web address`;
        }
        function showEngines(open) { engMenu.hidden = !open; engBtn.setAttribute("aria-expanded", open); }
        function closeAll() { list.hidden = true; showEngines(false); active = -1; }

        function showList() {
            list.innerHTML = items.map((s, i) => `
                <li role="option" id="sb-opt-${i}" aria-selected="${i === active}" data-i="${i}">
                    ${SEARCH_ICON}<span>${s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])}</span>${ARROW_ICON}
                </li>`).join("");
            list.hidden = items.length === 0;
            input.setAttribute("aria-activedescendant", active >= 0 ? "sb-opt-" + active : "");
            if (active >= 0) list.querySelector("#sb-opt-" + active)?.scrollIntoView({ block: "nearest" });
        }

        input.addEventListener("input", async () => {
            typed = input.value; active = -1;
            const mine = ++seq;
            const got = await suggest(typed.trim());
            if (mine !== seq) return;
            items = got.filter((s) => s.toLowerCase() !== typed.trim().toLowerCase());
            showList();
        });
        input.addEventListener("keydown", (e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                if (!items.length) return;
                e.preventDefault();
                // Cycle through the suggestions and back to what was typed (-1).
                const n = items.length + 1, step = e.key === "ArrowDown" ? 1 : -1;
                active = ((active + 1 + step + n) % n) - 1;
                input.value = active >= 0 ? items[active] : typed;
                showList();
            } else if (e.key === "Escape") {
                seq++; // a reply still on its way must not open the list again
                if (!list.hidden || !engMenu.hidden) {
                    e.preventDefault();
                    // Back to what was typed, not the highlighted suggestion.
                    if (!list.hidden && active >= 0) input.value = typed;
                    closeAll();
                }
                else { input.value = ""; typed = ""; items = []; }
            }
        });
        form.addEventListener("submit", (e) => { e.preventDefault(); go(input.value); });
        list.addEventListener("mousedown", (e) => {
            const li = e.target.closest("li");
            if (!li || e.button === 2) return;
            e.preventDefault();
            go(items[+li.dataset.i], e.button === 1 || e.ctrlKey || e.metaKey);
        });
        input.addEventListener("blur", () => setTimeout(() => { list.hidden = true; }, 120));
        input.addEventListener("focus", () => { if (items.length && input.value && suggestsFor(Lemon.settings.get())) list.hidden = false; });

        engMenu.innerHTML = Object.entries(ENGINES).map(([k, e]) =>
            `<li role="option" data-k="${k}" tabindex="-1"><i>${COOKIE}<b>${e.mark}</b></i><span>${e.name}</span></li>`).join("");
        function markEngine() {
            const k = Lemon.settings.get().engine;
            engMenu.querySelectorAll("li").forEach((li) => li.setAttribute("aria-selected", li.dataset.k === k));
        }
        engBtn.addEventListener("click", () => {
            list.hidden = true;
            markEngine();
            showEngines(engMenu.hidden);
            if (!engMenu.hidden) engMenu.querySelector('[aria-selected="true"]')?.focus();
        });
        engMenu.addEventListener("click", (e) => {
            const li = e.target.closest("li");
            if (!li) return;
            Lemon.settings.set({ engine: li.dataset.k });
            showEngines(false);
            input.focus();
        });
        engMenu.addEventListener("keydown", (e) => {
            const all = [...engMenu.querySelectorAll("li")], i = all.indexOf(document.activeElement);
            // Three columns: left/right step one engine, up/down one row; both wrap around.
            const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLS, ArrowUp: -COLS }[e.key];
            if (step) {
                e.preventDefault();
                all[(i + step + all.length) % all.length].focus();
            } else if (e.key === "Enter" || e.key === " ") {
                e.preventDefault(); document.activeElement.click();
            } else if (e.key === "Escape") { showEngines(false); engBtn.focus(); }
            else if (e.key === "Tab") showEngines(false);
        });
        document.addEventListener("click", (e) => { if (!host.contains(e.target)) closeAll(); });

        paintEngine();
        Lemon.settings.onChange((s, patch) => {
            if ("engine" in patch) paintEngine();
            // Suggestions turned off (or an engine without them): drop what was shown and any reply on its way.
            if (("suggestions" in patch || "engine" in patch) && !suggestsFor(s)) { seq++; items = []; active = -1; list.hidden = true; }
        });
    }

    function start() {
        const host = document.getElementById("search-host");
        if (host) Lemon.ready.then(() => build(host));
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
})();
