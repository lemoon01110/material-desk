/*
 * Center column: the long search bar (#search-host) and the date pill style hook (#dlDate is filled by
 * cookie-clock.js). Search: pick the engine from the button on the left (setting `engine`). "Chrome default" (the
 * default for new installs) hands the query to chrome.search.query, so the search engine set in Chrome's own settings
 * runs it. The others open that site's results page. Suggestions while typing (setting `suggestions`) only with Google
 * or DuckDuckGo, from that engine's own suggest service; arrow keys to pick one, Enter to go. Ctrl, Cmd or middle
 * click on a suggestion or the search button opens a new tab. Text that looks like an address opens it directly.
 * Voice (setting `voice`): the mic button types what you say with Chrome's own speech recognition (Chrome sends the
 * audio to Google to turn it into text; the page only gets the text), then searches. AI Mode (setting `aiMode`): a
 * button that asks Google's AI Mode, shown only while Google is the engine, so the other engines and "Chrome
 * default" never send a search to Google.
 */
(function () {
    const ENGINES = {
        // No URL: chrome.search.query runs the query with the user's default search engine.
        default: { name: "Chrome default", mark: "", hint: "The search engine set in Chrome", label: "the web" },
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
    const MIC_ICON = '<svg viewBox="0 -1 24 24" aria-hidden="true"><path d="M12 14q-1.25 0-2.125-.875T9 11V5q0-1.25.875-2.125T12 2t2.125.875T15 5v6q0 1.25-.875 2.125T12 14m-1 7v-3.075q-2.6-.35-4.3-2.325T5 11h2q0 2.075 1.463 3.538T12 16t3.538-1.463T17 11h2q0 2.625-1.7 4.6T13 17.925V21z"/></svg>';
    const AI_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.518 1a.254.254 0 0 0-.245.201 5.75 5.75 0 0 1-1.56 2.86 5.75 5.75 0 0 1-2.902 1.57.24.24 0 0 0-.196.236.246.246 0 0 0 .196.237 5.75 5.75 0 0 1 2.902 1.568 5.75 5.75 0 0 1 1.568 2.902.246.246 0 0 0 .237.196.246.246 0 0 0 .236-.196 5.75 5.75 0 0 1 1.57-2.902 5.75 5.75 0 0 1 2.86-1.56.254.254 0 0 0 .2-.245.254.254 0 0 0-.2-.246 5.75 5.75 0 0 1-2.862-1.56 5.75 5.75 0 0 1-1.558-2.86.25.25 0 0 0-.246-.201M9.5 2.8c-3.754 0-6.7 2.946-6.7 6.7s2.946 6.7 6.7 6.7c.556 0 2.22-.081 3.771-1.249l6.188 6.19a.2.2 0 0 0 .281 0l1.4-1.4a.2.2 0 0 0 0-.282l-6.185-6.184a6.2 6.2 0 0 0 .883-1.627 6.1 6.1 0 0 0 .322-1.634.2.2 0 0 0-.2-.213h-2a.2.2 0 0 0-.198.18 4.06 4.06 0 0 1-1.213 2.566c-.847.837-1.846 1.254-3.049 1.254-2.366 0-4.3-1.836-4.3-4.301 0-2.366 1.835-4.3 4.3-4.3.437 0 .848.075 1.244.19a.2.2 0 0 0 .197-.05L12.5 3.78a.2.2 0 0 0-.053-.32A6.6 6.6 0 0 0 9.5 2.8"/></svg>';
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    const ARROW_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11h10.17l-4.58-4.59L12 5l7 7-7 7-1.41-1.41L15.17 13H5z"/></svg>';

    // An address: a scheme (https://, chrome://, or about:blank as Chrome's address bar takes it), localhost, an IPv4
    // address, or a host whose last part is letters. So "3.14", "v1.2.3" and "README.md" are searched, not opened. A
    // bare "name.ext" with a common file extension (no path, no port) also counts as a search. Hosts may be written in
    // any script ("münchen.de", "例え.jp"), and a query or fragment may follow the host directly ("example.com?q=1").
    const FILE_EXT = /\.(md|txt|js|mjs|ts|tsx|jsx|py|sh|json|css|html?|xml|ya?ml|toml|ini|cfg|conf|log|csv|tsv|pdf|docx?|xlsx?|pptx?|png|jpe?g|gif|svg|webp|mp3|mp4|mkv|mov|wav|zip|tar|gz|7z|exe|deb|rpm|c|h|cpp|hpp|rs|go|java|kt|rb|php|lua|qml|lock)$/i;
    const hasScheme = (t) => /^[a-z][\w+.-]*:\/\//i.test(t) || /^about:[\w-]+$/i.test(t);
    const looksLikeUrl = (t) => !/\s/.test(t) && (hasScheme(t) || /^localhost(:\d+)?([/?#]\S*)?$/i.test(t) ||
        /^\d{1,3}(\.\d{1,3}){3}(:\d+)?([/?#]\S*)?$/.test(t) ||
        (/^(?:[\p{L}\p{N}-]+\.)+(?:\p{L}{2,}|xn--[a-z0-9-]+)(:\d+)?([/?#]\S*)?$/iu.test(t) &&
            (/[/:]/.test(t) || !FILE_EXT.test(t.replace(/[?#].*/, "")))));
    // Script-carrying schemes never open from the search bar: "javascript://..." is searched as text.
    const safeUrl = (u) => { try { return !/^(javascript|data|vbscript|blob|filesystem):$/i.test(new URL(u).protocol); } catch (e) { return false; } };
    // The engine's mark on its cookie: a letter, or a small search glyph for "Chrome default".
    const GLYPH = '<svg class="sb-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 3a6.5 6.5 0 0 1 5.16 10.45l5.45 5.44-1.42 1.42-5.44-5.45A6.5 6.5 0 1 1 9.5 3m0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9"/></svg>';
    const markOf = (e) => e.mark || GLYPH;
    // Up/down in the engine menu: rows are worked out from where the items are drawn (the first row is one wide item,
    // then rows of three), so this keeps working if the grid changes in styles/center.css. Wraps around.
    function rowStep(all, i, dir) {
        const rows = [];
        for (const [j, li] of all.entries()) {
            const top = Math.round(li.offsetTop);
            let row = rows.find((r) => Math.abs(r.top - top) < 4);
            if (!row) rows.push(row = { top, items: [] });
            row.items.push(j);
        }
        rows.sort((a, b) => a.top - b.top);
        const at = rows.findIndex((r) => r.items.includes(i));
        const target = rows[(at + dir + rows.length) % rows.length];
        // The item whose left edge is nearest: from the wide first row down to the first engine, up and down a column.
        const x = all[i].offsetLeft, d = (j) => Math.abs(all[j].offsetLeft - x);
        return target.items.reduce((best, j) => (d(j) < d(best) ? j : best));
    }
    const engine = () => ENGINES[Lemon.settings.get().engine] || ENGINES.google;
    const chromeSearch = () => window.chrome && chrome.search && typeof chrome.search.query === "function";

    // The query with Chrome's default search engine (the search permission). Returns false only when the API is
    // missing (a build without the permission), and go() then uses Google so the search still happens. A query Chrome
    // turns down is not sent to another engine behind the user's back.
    function chromeQuery(text, newTab) {
        if (!chromeSearch()) return false;
        try {
            const p = chrome.search.query({ text, disposition: newTab ? "NEW_TAB" : "CURRENT_TAB" });
            if (p && typeof p.catch === "function") p.catch((e) => console.warn("chrome.search.query", e));
        } catch (e) { console.warn("chrome.search.query", e); }
        return true;
    }

    function go(text, newTab) {
        const t = text.trim();
        if (!t) return;
        const e = engine();
        let url = looksLikeUrl(t) ? (hasScheme(t) ? t : (/^(localhost|\d{1,3}(\.\d{1,3}){3})([:/?#]|$)/i.test(t) ? "http://" : "https://") + t) : null;
        if (url && !safeUrl(url)) url = null;
        if (!url) {
            if (!e.url && chromeQuery(t, newTab)) return;
            url = (e.url || ENGINES.google.url) + encodeURIComponent(t);
        }
        openUrl(url, newTab);
    }
    function openUrl(url, newTab) {
        const tabs = window.chrome && chrome.tabs;
        if (newTab && tabs) tabs.create({ url });
        // chrome://, file:// and the like are blocked from a page's location; the tabs API may open them.
        else if (!/^https?:/i.test(url) && tabs) tabs.update({ url });
        else location.href = url;
    }

    // Only Google and DuckDuckGo give suggestions, each for its own engine: what is typed for Bing, Brave, Wikipedia or
    // YouTube is never sent to another company. "Chrome default" has none either: the page can not learn which engine
    // Chrome uses, so it can not ask that engine's suggest service.
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
                <button type="button" class="sb-icon sb-mic" aria-label="Search by voice" aria-pressed="false"
                    title="Search by voice. Chrome sends your voice to Google to turn it into text." hidden>${MIC_ICON}</button>
                <button type="button" class="sb-icon sb-ai" aria-label="Ask Google AI Mode" title="Ask Google AI Mode" hidden>${AI_ICON}</button>
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
            engBtn.querySelector("b").innerHTML = markOf(e);
            engBtn.title = e.name + " (change engine)";
            engBtn.setAttribute("aria-label", `Search engine: ${e.name}`);
            input.placeholder = `Search ${e.label || e.name} or type a web address`;
        }
        function showEngines(open) { engMenu.hidden = !open; engBtn.setAttribute("aria-expanded", open); }
        // Forget the suggestions (and any reply on its way): what is in the field becomes what was typed. Used when
        // the list no longer belongs to the text or the engine (voice wrote the field, the engine changed).
        function dropList() {
            seq++; typed = input.value; items = []; active = -1; list.hidden = true;
            input.setAttribute("aria-activedescendant", "");
        }
        function closeAll() {
            // Closed while a suggestion is highlighted (a click elsewhere): the field keeps that suggestion as its
            // text, so the old list is dropped rather than reopened later with a highlight the keys no longer follow.
            if (active >= 0) dropList();
            list.hidden = true; showEngines(false); active = -1;
            input.setAttribute("aria-activedescendant", "");
        }

        function showList() {
            list.innerHTML = items.map((s, i) => `
                <li role="option" id="sb-opt-${i}" aria-selected="${i === active}" data-i="${i}">
                    ${SEARCH_ICON}<span>${s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])}</span>${ARROW_ICON}
                </li>`).join("");
            list.hidden = items.length === 0;
            input.setAttribute("aria-activedescendant", active >= 0 ? "sb-opt-" + active : "");
            if (active >= 0) list.querySelector("#sb-opt-" + active)?.scrollIntoView({ block: "nearest" });
        }

        async function refresh() {
            const mine = ++seq;
            const got = await suggest(typed.trim());
            if (mine !== seq) return;
            items = got.filter((s) => s.toLowerCase() !== typed.trim().toLowerCase());
            showList();
        }
        input.addEventListener("input", () => {
            typed = input.value; active = -1;
            endHint();
            showEngines(false);
            refresh();
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
                    if (!list.hidden && active >= 0) { input.value = typed; active = -1; }
                    closeAll();
                }
                else { input.value = ""; typed = ""; items = []; }
            }
        });
        form.addEventListener("submit", (e) => { e.preventDefault(); go(input.value); });
        // Ctrl, Cmd or middle click on the search button: the results in a new tab.
        const goBtn = host.querySelector(".sb-go");
        goBtn.addEventListener("click", (e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); go(input.value, true); } });
        goBtn.addEventListener("mousedown", (e) => { if (e.button === 1) e.preventDefault(); }); // no autoscroll
        goBtn.addEventListener("auxclick", (e) => { if (e.button === 1) { e.preventDefault(); go(input.value, true); } });
        list.addEventListener("mousedown", (e) => {
            const li = e.target.closest("li");
            if (!li || e.button === 2) return;
            e.preventDefault();
            go(items[+li.dataset.i], e.button === 1 || e.ctrlKey || e.metaKey);
        });
        input.addEventListener("blur", () => setTimeout(() => { list.hidden = true; }, 120));
        // Focus in the field closes the engine menu (only one menu at a time) and brings the suggestions back, drawn
        // anew so the highlight is the one the arrow keys work from.
        input.addEventListener("focus", () => {
            showEngines(false);
            if (items.length && input.value && suggestsFor(Lemon.settings.get())) showList();
        });

        // "Chrome default" fills the first row (with a line saying what it is), the six sites sit under it, 3 by 2.
        engMenu.innerHTML = Object.entries(ENGINES).map(([k, e]) =>
            `<li role="option" data-k="${k}" tabindex="-1"${e.url ? "" : ' class="sb-wide"'}><i>${COOKIE}<b>${markOf(e)}</b></i>` +
            (e.hint ? `<span><span>${e.name}</span><small>${e.hint}</small></span>` : `<span>${e.name}</span>`) + `</li>`).join("");
        function markEngine() {
            const k = Lemon.settings.get().engine;
            engMenu.querySelectorAll("li").forEach((li) => li.setAttribute("aria-selected", li.dataset.k === k));
        }
        engBtn.addEventListener("click", () => {
            list.hidden = true;
            markEngine();
            const hadFocus = engMenu.contains(document.activeElement);
            showEngines(engMenu.hidden);
            if (!engMenu.hidden) engMenu.querySelector('[aria-selected="true"]')?.focus();
            // Closed from the keyboard (the "e" shortcut) while an engine had focus: focus comes back to the button,
            // as Escape does, instead of falling to the page.
            else if (hadFocus) engBtn.focus();
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
            // Left/right step one engine, up/down one row (to the nearest engine in that row); both wrap around.
            const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
            if (step) {
                e.preventDefault();
                all[(i + step + all.length) % all.length].focus();
            } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                all[rowStep(all, Math.max(i, 0), e.key === "ArrowDown" ? 1 : -1)].focus();
            } else if (e.key === "Enter" || e.key === " ") {
                e.preventDefault(); document.activeElement.click();
            } else if (e.key === "Escape") { showEngines(false); engBtn.focus(); }
            else if (e.key === "Tab") showEngines(false);
        });
        document.addEventListener("click", (e) => { if (!host.contains(e.target)) closeAll(); });

        // ---- Voice: Chrome's speech recognition types into the bar; a final result searches. Click again to stop.
        const mic = host.querySelector(".sb-mic"), ai = host.querySelector(".sb-ai");
        let rec = null, stopped = false, hintTimer = 0;
        function stopVoice() { if (rec) { stopped = true; try { rec.abort(); } catch (e) { /* */ } } }
        function voiceDone() {
            rec = null; mic.classList.remove("sb-listen"); mic.setAttribute("aria-pressed", "false");
            input.placeholder = ""; paintEngine();
        }
        // What went wrong, shown in place of the placeholder (short enough for the field on a 1280 px wide window
        // with both round buttons). It goes away after a few seconds, or as soon as something is typed; while the
        // field holds text the placeholder is not seen anyway, so the timer restores it either way.
        function hint(text) {
            clearTimeout(hintTimer);
            input.value = ""; dropList(); input.placeholder = text;
            hintTimer = setTimeout(() => { hintTimer = 0; if (!rec) paintEngine(); }, 4000);
        }
        function endHint() {
            if (!hintTimer) return;
            clearTimeout(hintTimer); hintTimer = 0;
            if (!rec) paintEngine();
        }
        const NOT_HEARD = "Didn't hear anything. Try the mic again";
        const VOICE_ERRORS = {
            "not-allowed": "Allow the microphone to search by voice",
            "service-not-allowed": "Voice search is not available here",
            "audio-capture": "No microphone found",
            "no-speech": NOT_HEARD,
            "network": "Voice search needs the internet",
            "language-not-supported": "Voice search does not know this language",
        };
        mic.addEventListener("click", () => {
            if (rec) { stopVoice(); return; }
            closeAll();
            endHint();
            // Each handler checks it still belongs to the current recognition, so a late event from an earlier one
            // can not end or overwrite the next.
            const r = rec = new Speech();
            stopped = false;
            r.lang = navigator.language || "en-US";
            r.interimResults = true;
            r.continuous = false;
            let said = "", sent = false;
            // Voice writes the field: the suggestions for what was typed before no longer belong to it, and the
            // arrow keys must come back to the spoken words, not the old typed text.
            const write = (text) => { input.value = text; dropList(); };
            r.onstart = () => {
                if (r !== rec) return;
                mic.classList.add("sb-listen"); mic.setAttribute("aria-pressed", "true");
                write(""); input.placeholder = "Listening…";
            };
            r.onresult = (e) => {
                if (r !== rec) return;
                said = [...e.results].map((x) => x[0].transcript).join("");
                write(said);
                if (e.results[e.results.length - 1].isFinal && said.trim() && !sent) { sent = true; go(said); }
            };
            r.onerror = (e) => {
                if (r !== rec) return;
                const user = stopped || e.error === "aborted";
                voiceDone();
                // Stopped by the user (mic clicked again, or voice turned off): nothing went wrong, say nothing.
                if (!user) hint(VOICE_ERRORS[e.error] || "Voice search did not work. Try again");
            };
            // Ended with no words and no error (Chrome does this when it hears only noise): say so, unless the user
            // stopped it.
            r.onend = () => {
                if (r !== rec) return;
                voiceDone();
                if (!said.trim() && !stopped) hint(NOT_HEARD);
            };
            try { r.start(); } catch (e) { voiceDone(); hint("Voice search did not work. Try again"); }
        });

        // ---- AI Mode: Google's AI answer page for what is typed (or AI Mode's start page). Ctrl, Cmd or middle click: new tab.
        const aiGo = (newTab) => {
            const t = input.value.trim();
            openUrl(t ? "https://www.google.com/search?udm=50&q=" + encodeURIComponent(t) : "https://www.google.com/search?udm=50", newTab);
        };
        ai.addEventListener("click", (e) => aiGo(e.ctrlKey || e.metaKey));
        ai.addEventListener("mousedown", (e) => { if (e.button === 1) e.preventDefault(); });
        ai.addEventListener("auxclick", (e) => { if (e.button === 1) { e.preventDefault(); aiGo(true); } });

        function paintButtons() {
            const s = Lemon.settings.get();
            mic.hidden = !(s.voice && Speech);
            ai.hidden = !(s.aiMode && s.engine === "google");
            if (mic.hidden) stopVoice();
        }
        paintButtons();

        paintEngine();
        Lemon.settings.onChange((s, patch) => {
            if ("voice" in patch || "aiMode" in patch || "engine" in patch) paintButtons();
            if ("engine" in patch) paintEngine();
            // Suggestions turned off: drop what was shown and any reply on its way. A new engine: the old list came
            // from the old engine's service, so drop it too, and ask the new engine (if it gives suggestions) for
            // what is in the field, but only while the field has focus (a change from another tab opens nothing).
            if ("suggestions" in patch && !suggestsFor(s)) dropList();
            if ("engine" in patch) {
                dropList();
                if (suggestsFor(s) && typed.trim() && document.activeElement === input) refresh();
            }
        });
    }

    function start() {
        const host = document.getElementById("search-host");
        if (host) Lemon.ready.then(() => build(host));
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
})();
