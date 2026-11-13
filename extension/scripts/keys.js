/*
 * Keyboard shortcuts for the whole new tab.
 * Single keys, only when not typing in a field. "?" shows the list. Most are toggles: the same key closes what it
 * opened. The to-do column keeps its own "n" (new to-do)
 * and "/" (search to-dos). Chrome puts the cursor in the address bar on a new tab: click the page or press F6 first.
 */
(function () {
    const KEYS = [
        ["Search", [["s", "Search the web"], ["e", "Search engine menu (toggle)"]]],
        ["To-do", [["n", "New to-do"], ["/", "Search to-dos"], ["1", "Fold or open the to-do column"],
            ["[", "To-do column smaller"], ["]", "To-do column bigger"]]],
        ["Bookmarks", [["b", "Search bookmarks"], ["a", "Add a bookmark"], ["2", "Fold or open the bookmarks column"],
            ["{", "Bookmarks column smaller"], ["}", "Bookmarks column bigger"], ["g", "Google apps (toggle)"]]],
        ["Page", [["w", "Weather details (toggle)"], ["h", "Weather hours or days (toggle)"], [",", "Settings (toggle)"],
            ["?", "These shortcuts (toggle)"], ["Esc", "Close what is open"]]],
    ];
    const $ = (s) => document.querySelector(s);
    const click = (s) => { const el = $(s); if (el) { el.click(); return true; } return false; };
    const focus = (s) => { const el = $(s); if (el) { el.focus(); if (el.select) el.select(); return true; } return false; };
    // Folded columns open first, so their controls exist. The fold class goes only after the setting is saved, so wait
    // for it (a field inside a folded column is display: none and cannot take focus).
    const openCol = (side) => new Promise((done) => {
        const cls = side === "left" ? "fold-todo" : "fold-bookmarks", root = document.documentElement;
        const other = side === "left" ? "full-bookmarks" : "full-todo";
        // Hidden under the other column's full page: step that one back to half first, then focus inside.
        if (!root.classList.contains(cls) && root.classList.contains(other) && window.LemonLayout && window.LemonLayout.reveal) {
            return window.LemonLayout.reveal(side).then(done, done);
        }
        if (!root.classList.contains(cls) || !window.LemonLayout) return done();
        const end = () => { mo.disconnect(); clearTimeout(timer); done(); };
        const mo = new MutationObserver(() => { if (!root.classList.contains(cls)) end(); });
        const timer = setTimeout(end, 1000);
        mo.observe(root, { attributes: true, attributeFilter: ["class"] });
        window.LemonLayout.toggle(side);
    });
    const inRight = (fn) => { openCol("right").then(fn); return true; };

    // Every shortcut key in the list above (the to-do column also takes a capital N for a new to-do).
    const SHORTCUTS = new Set(KEYS.flatMap(([, list]) => list.map(([k]) => k)).filter((k) => k !== "Esc").concat("N"));

    let sheet = null, back = null;
    function toggleHelp(force) {
        const show = force !== undefined ? force : !sheet;
        if (!show) {
            if (!sheet) return;
            sheet.remove(); sheet = null;
            // Give the keyboard its place back (the bookmark, or the weather details the sheet was opened over).
            const to = back; back = null;
            if (to && to !== document.body && to.isConnected && to.focus) to.focus({ preventScroll: true });
            return;
        }
        if (sheet) return;
        back = document.activeElement;
        sheet = document.createElement("div");
        sheet.className = "kb-sheet";
        sheet.setAttribute("role", "dialog");
        sheet.setAttribute("aria-modal", "true");
        sheet.setAttribute("aria-label", "Keyboard shortcuts");
        sheet.innerHTML = `<div class="kb-card"><div class="kb-head"><h2>Keyboard shortcuts</h2>
            <button type="button" class="icon-btn kb-x" aria-label="Close">&times;</button></div>
            <div class="kb-grid">${KEYS.map(([g, list]) => `<section><h3>${g}</h3>${list.map(([k, d]) =>
                `<div class="kb-row"><kbd>${k}</kbd><span>${d}</span></div>`).join("")}</section>`).join("")}</div>
            <p class="kb-note">On a fresh new tab the cursor is in the address bar: click the page or press F6, then use the keys.</p></div>`;
        sheet.addEventListener("click", (e) => { if (e.target === sheet || e.target.closest(".kb-x")) toggleHelp(false); });
        document.body.appendChild(sheet);
        sheet.querySelector(".kb-x").focus();
    }

    // The sheet is modal and covers the page, so while it is open it gets every key first and nothing under it sees
    // one. This listener is on window in the capture phase, so it runs before the weather details' capture listener on
    // document and the to-do column's document listener: those close their own dialog on Escape, and without this one
    // Escape over the sheet closed the details or the open to-do under it instead of the sheet. Stopping the event
    // does not stop its default action, so Enter and Space still press the close button and the arrow and page keys
    // still scroll a long sheet.
    const typingIn = (t) => !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    window.addEventListener("keydown", (e) => {
        if (!sheet) {
            // Another modal dialog is open (the weather details, the bookmark Add sheet): keep the page shortcuts away
            // from the page behind it. Only "?" and the details' own toggle "w" go through. Escape, Tab, the arrows and
            // Enter are not shortcuts, so the dialog still gets them. A dialog counts while the focus is in it (or
            // nowhere, after a click on its text): a closing one has already given the focus back to the page.
            if (typingIn(e.target) || e.ctrlKey || e.metaKey || e.altKey || !SHORTCUTS.has(e.key) || e.key === "?") return;
            const t = e.target, open = [...document.querySelectorAll("[aria-modal='true']")]
                .find((d) => !d.hidden && d.getClientRects().length && (d.contains(t) || t === document.body || !t));
            if (open && !(e.key === "w" && open.id === "dlw-detail")) e.stopPropagation();
            return;
        }
        e.stopPropagation();
        if (e.key === "Escape" || (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey)) {
            e.preventDefault(); toggleHelp(false); return;
        }
        if (e.key !== "Tab") return;
        // Keep the focus inside the sheet (it can also be on body after a click on the card's text).
        const f = [...sheet.querySelectorAll("button, a[href], [tabindex='0']")].filter((el) => el.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], end = f[f.length - 1], at = document.activeElement;
        if (!sheet.contains(at) || (e.shiftKey && at === first) || (!e.shiftKey && at === end)) {
            e.preventDefault(); (e.shiftKey ? end : first).focus();
        }
    }, true);
    // Clicks on the sheet are the sheet's alone: the weather details close on a pointerdown outside themselves, and the
    // sheet over them is outside.
    window.addEventListener("pointerdown", (e) => { if (sheet && sheet.contains(e.target)) e.stopPropagation(); }, true);

    document.addEventListener("keydown", (e) => {
        if (e.defaultPrevented) return;
        if (typingIn(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
        const visible = (sel) => { const el = $(sel); return !!el && el.offsetParent !== null; };
        const act = {
            "s": () => focus(".sb-input"),
            "e": () => click(".sb-engine"),
            "b": () => inRight(() => focus("#right-col .bm-search")),
            "a": () => inRight(() => click("#right-col .bm-fab")),
            "g": () => inRight(() => click("#right-col .bm-apps-head")),
            "1": () => { window.LemonLayout && window.LemonLayout.toggle("left"); return true; },
            "2": () => { window.LemonLayout && window.LemonLayout.toggle("right"); return true; },
            "w": () => visible(".dlw-close") ? click(".dlw-close") : (click(".dlb-more") || click("#dlWeather")),
            // The strip marks the section in view (aria-current on its jump button): go to the other one.
            "h": () => { const on = $(".dlb-jump[aria-current]"); return click(on && on.dataset.sec === "h" ? ".dlb-jump-d" : ".dlb-jump-h"); },
            ",": () => {
                const col = $("#right-col");
                if (col && col.classList.contains("st-open")) return click("#right-col .st-back");
                return inRight(() => click("#right-col .bm-gear"));
            },
            "?": () => { toggleHelp(); return true; },
            "[": () => { window.LemonLayout && window.LemonLayout.step("left", -1); return true; },
            "]": () => { window.LemonLayout && window.LemonLayout.step("left", 1); return true; },
            "{": () => { window.LemonLayout && window.LemonLayout.step("right", -1); return true; },
            "}": () => { window.LemonLayout && window.LemonLayout.step("right", 1); return true; },
        }[e.key];
        if (act && act() !== false) e.preventDefault();
    });
})();
