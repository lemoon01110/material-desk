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
        if (!root.classList.contains(cls) || !window.LemonLayout) return done();
        const end = () => { mo.disconnect(); clearTimeout(timer); done(); };
        const mo = new MutationObserver(() => { if (!root.classList.contains(cls)) end(); });
        const timer = setTimeout(end, 1000);
        mo.observe(root, { attributes: true, attributeFilter: ["class"] });
        window.LemonLayout.toggle(side);
    });
    const inRight = (fn) => { openCol("right").then(fn); return true; };

    let sheet = null;
    function toggleHelp(force) {
        const show = force !== undefined ? force : !sheet;
        if (!show) { if (sheet) { sheet.remove(); sheet = null; } return; }
        sheet = document.createElement("div");
        sheet.className = "kb-sheet";
        sheet.setAttribute("role", "dialog");
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

    document.addEventListener("keydown", (e) => {
        if (e.defaultPrevented) return;
        if (e.key === "Escape" && sheet) { e.preventDefault(); toggleHelp(false); return; }
        const t = e.target;
        const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
        if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
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
