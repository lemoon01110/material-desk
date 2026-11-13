/*
 * Side column sizes, as presets rather than free resizing. A tall grip sits in the middle of the gap between each side column and the center. Drag it: it follows the
 * pointer, and on release the column snaps (animated) to the preset in that direction nearest to where it was let
 * go: folded (just its icon) < normal (320px) < wide (half the page, over the center). Arrow keys step one preset.
 * Settings: todoCollapsed / bookmarksCollapsed (folded) and todoSize /
 * bookmarksSize ("normal" | "wide"). Wide lays the column over half the page, covering the center's widgets (the
 * center does not move); both may be wide at once, together covering the page. Folding keeps the column's track, so the center does not move.
 * Narrow windows (below NARROW page px): the center takes the width and each column keeps its saved state, floating
 * over the page when open, so a new tab or window never opens with a column unexpectedly closed.
 */
(function () {
    const ICONS = {
        // The checklist is drawn from y 2 to 17, so its box starts 2.5 higher to center it (owner 2026-11-12: "a bit up").
        todo: '<svg viewBox="0 -2.5 24 24" aria-hidden="true"><path d="M3 5.5 4.5 4l2 2 4-4L12 3.5l-5.5 5.5zM14 5h7v2h-7zm-11 8.5L4.5 12l2 2 4-4 1.5 1.5-5.5 5.5zM14 13h7v2h-7z"/></svg>',
        bookmarks: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1"/></svg>',
    };
    const GRIP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h2v16H8zm6 0h2v16h-2z"/></svg>';
    const SIDES = [
        { fold: "todoCollapsed", size: "todoSize", col: "todo-col", name: "to-do", icon: ICONS.todo, side: "left", cls: "todo" },
        { fold: "bookmarksCollapsed", size: "bookmarksSize", col: "right-col", name: "bookmarks", icon: ICONS.bookmarks, side: "right", cls: "bookmarks" },
    ];
    const NARROW = 1240;       // page px: below this both columns are rails with drawers
    
    const root = document.documentElement;
    let grid = null;

    const isNarrow = () => grid && grid.clientWidth < NARROW;
    // Wide covers the center, so it always fits.
    const wideFits = () => !!grid;
    const state = (s) => {
        const st = Lemon.settings.get();
        if (st[s.fold]) return "fold";
        if (st[s.size] === "full") return "full";
        return st[s.size] === "wide" && wideFits() ? "wide" : "normal";
    };

    // A column turned off in Settings (settings todo / bookmarks) is never wide or full: it would cover the other one.
    const shown = (s) => !!Lemon.settings.get()[s.cls];
    function applyWide() {
        for (const s of SIDES) {
            root.classList.toggle("wide-" + s.cls, shown(s) && state(s) === "wide");
            root.classList.toggle("full-" + s.cls, shown(s) && state(s) === "full");
        }
    }

    // Full: the whole page, one step beyond half.
    const ORDER = ["fold", "normal", "wide", "full"];
    // ---- The size change, animated (owner 2026-11-12: "clicking the title to collapse has no animation"). Folding
    // hides the column's contents at once and wide or full move it out of the grid, so neither can be a CSS
    // transition. Instead a stand-in panel (a "ghost" with the panel's own color, corners and shadow) grows or
    // shrinks from where the column was to where it lands: into the folded icon, out of it, or to half or the whole
    // page. The real column waits hidden under it and fades in when it arrives.
    const EASE = "cubic-bezier(0.2, 0.9, 0.25, 1)", MORPH_MS = 340;
    const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
    // What is on screen for a column: the folded icon, or the panel itself.
    function lookOf(s) {
        const col = document.getElementById(s.col);
        const el = Lemon.settings.get()[s.fold] ? col.querySelector(".fold-rail") : col;
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return { el, rect: { x: r.left, y: r.top, w: r.width, h: r.height }, radius: cs.borderRadius,
            bg: cs.backgroundColor, shadow: cs.boxShadow };
    }
    let morphing = null;
    async function morph(s, change, from) {
        const col = document.getElementById(s.col);
        if (!window.__lemonSettled || reduced() || !col || !shown(s)) return change();
        if (morphing) morphing.finish();
        const a = from || lookOf(s);
        root.classList.add("fold-morphing");          // no CSS width transition: the ghost does the moving
        const done = await change();
        const b = lookOf(s);
        if (Math.abs(a.rect.w - b.rect.w) < 2 && Math.abs(a.rect.h - b.rect.h) < 2 && Math.abs(a.rect.x - b.rect.x) < 2) {
            root.classList.remove("fold-morphing"); return done;
        }
        const ghost = document.createElement("div");
        ghost.className = "fold-ghost";
        Object.assign(ghost.style, { left: a.rect.x + "px", top: a.rect.y + "px", width: a.rect.w + "px", height: a.rect.h + "px" });
        document.body.appendChild(ghost);
        root.classList.add("morph-" + s.cls);        // the real column (or icon) stays hidden until the ghost lands
        const frame = (k) => ({ left: k.rect.x + "px", top: k.rect.y + "px", width: k.rect.w + "px", height: k.rect.h + "px",
            borderRadius: k.radius, backgroundColor: k.bg === "rgba(0, 0, 0, 0)" ? getComputedStyle(ghost).backgroundColor : k.bg,
            boxShadow: k.shadow });
        const anim = ghost.animate([frame(a), frame(b)], { duration: MORPH_MS, easing: EASE, fill: "forwards" });
        const end = () => {
            if (morphing !== run) return;
            morphing = null;
            root.classList.remove("morph-" + s.cls, "fold-morphing");
            b.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
            ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease-out" }).onfinish = () => ghost.remove();
        };
        const run = { finish: () => { anim.finish(); } };
        morphing = run;
        anim.onfinish = end;
        return done;
    }

    // Returns the settings promise (keys.js waits for it before focusing inside a column that was folded).
    function setState(s, to, from) { return morph(s, () => setStateNow(s, to), from); }
    function setStateNow(s, to) {
        if (to === "fold") return Lemon.settings.set({ [s.fold]: true, [s.size]: "normal" });
        // Both columns may be wide at once.
        else if (to === "wide") return Lemon.settings.set({ [s.fold]: false, [s.size]: "wide" });
        // Only one column can fill the page; the other steps back to its own half or less.
        else if (to === "full") {
            const other = SIDES.find((o) => o !== s);
            const patch = { [s.fold]: false, [s.size]: "full" };
            if (Lemon.settings.get()[other.size] === "full") patch[other.size] = "wide";
            return Lemon.settings.set(patch);
        }
        return Lemon.settings.set({ [s.fold]: false, [s.size]: "normal" });
    }
    // Width (page px) each preset gives the column, for picking the one nearest to where the grip was let go.
    function presetWidth(name) {
        if (name === "fold") return 64;
        if (name === "wide") return grid.clientWidth / 2 - 24;
        if (name === "full") return grid.clientWidth - 32;
        return parseFloat(getComputedStyle(root).getPropertyValue("--side-w")) || 320;
    }

    function start() {
        grid = document.querySelector(".lemon");
        if (!grid) return;
        const handles = [];
        for (const s of SIDES) {
            const col = document.getElementById(s.col);
            if (!col) continue;
            const rail = document.createElement("button");
            rail.className = "fold-rail";
            rail.type = "button";
            rail.innerHTML = s.icon;
            rail.ariaLabel = `Open ${s.name}`;
            rail.title = `Open ${s.name} (or drag it out)`;
            rail.addEventListener("click", () => {   // the folded icon opens the column at normal width
                if (rail.dataset.dragged) { delete rail.dataset.dragged; return; }   // that was a drag, not a click
                setState(s, "normal");
            });
            col.appendChild(rail);

            const handle = document.createElement("button");
            handle.type = "button";
            handle.className = `fold-handle fold-${s.side}`;
            handle.innerHTML = GRIP;
            let drag = null;
            const widthAt = (clientX) => {   // zoom-proof: a share of the page, back to page px
                const r = grid.getBoundingClientRect();
                const frac = (clientX - r.left) / r.width;
                return (s.side === "left" ? frac : 1 - frac) * grid.offsetWidth - 16;
            };
            // While dragging, the column itself follows the grip:
            // it floats over the page at the live width, and the grip stays attached to its edge.
            const live = (w) => {
                col.style.width = w + "px";
                const x = s.side === "left" ? 16 + w + 8 : grid.offsetWidth - 16 - w - 8;
                handle.style.left = x + "px";
            };
            const release = () => {
                root.classList.remove("resizing-" + s.cls);
                handle.classList.remove("dragging");
                col.style.width = "";
                handle.style.left = "";
                // Back to what the settings say (a drag that changes nothing leaves no settings event).
                root.classList.toggle("fold-" + s.cls, !!Lemon.settings.get()[s.fold]);
                applyWide();
            };
            // The grip, and when folded the icon itself (a lone grip next to a folded column looks detached), drag the
            // column out; both use the same live-follow and snap.
            const bindDrag = (el) => {
                el.addEventListener("pointerdown", (e) => {
                    if (e.button !== 0 || (el === rail && !Lemon.settings.get()[s.fold])) return;
                    el.setPointerCapture(e.pointerId);
                    drag = { x: e.clientX, started: false, el };
                });
                el.addEventListener("pointermove", (e) => {
                    if (!drag || drag.el !== el) return;
                    if (!drag.started) {
                        if (Math.abs(e.clientX - drag.x) < 4) return;
                        drag.started = true;
                        if (el === rail) rail.dataset.dragged = "1";
                        handle.classList.add("dragging");
                        root.classList.remove("fold-" + s.cls, "wide-" + s.cls, "full-" + s.cls);
                        root.classList.add("resizing-" + s.cls);
                    }
                    live(Math.round(Math.min(presetWidth("full"), Math.max(64, widthAt(e.clientX)))));
                });
                el.addEventListener("pointerup", (e) => { if (drag && drag.el === el) finish(e); });
                el.addEventListener("pointercancel", () => {
                    if (drag && drag.el === el) { drag = null; delete rail.dataset.dragged; release(); }   // no click follows
                });
            };
            const finish = (e) => {
                if (!drag) return;
                const d = drag; drag = null;
                if (!d.started) return;
                const from = lookOf(s);   // where the dragged column is now, so the snap grows or shrinks from there
                release();
                const dx = (e.clientX - d.x) * (s.side === "left" ? 1 : -1);   // + = grow
                if (Math.abs(dx) < 16) return;
                const now = ORDER.indexOf(state(s));
                const allowed = ORDER.filter((n) => n !== "wide" || wideFits());
                const ahead = allowed.filter((n) => dx > 0 ? ORDER.indexOf(n) > now : ORDER.indexOf(n) < now);
                if (!ahead.length) return;
                const w = widthAt(e.clientX);
                ahead.sort((a, b) => Math.abs(presetWidth(a) - w) - Math.abs(presetWidth(b) - w));
                setState(s, ahead[0], from);
            };
            bindDrag(handle);
            bindDrag(rail);
            handle.addEventListener("keydown", (e) => {
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                e.preventDefault();
                const grow = (e.key === "ArrowRight") === (s.side === "left");
                const allowed = ORDER.filter((n) => n !== "wide" || wideFits());
                const i = allowed.indexOf(state(s)) + (grow ? 1 : -1);
                if (i < 0 || i >= allowed.length) return;
                // Folding hides this grip: the focus goes to the folded icon, which opens the column again.
                setState(s, allowed[i]).then(() => { if (allowed[i] === "fold") rail.focus({ preventScroll: true }); }, () => {});
            });
            grid.appendChild(handle);
            handles.push([s, handle]);
        }
        const paint = () => {
            applyWide();
            for (const [s, h] of handles) {
                const now = state(s);
                const words = { fold: "folded", normal: "normal width", wide: "half the page", full: "the whole page" }[now];
                h.title = `Drag to resize ${s.name} (now ${words})`;
                h.ariaLabel = `Resize ${s.name}, now ${words}. Arrow keys change it`;
            }
        };
        new ResizeObserver(() => {
            root.classList.toggle("narrow", isNarrow());
            paint();
        }).observe(grid);
        Lemon.settings.onChange((all, patch) => {
            if (SIDES.some((s) => s.fold in patch || s.size in patch || s.cls in patch)) paint();
        });
        // Clicking a column's title collapses it: back to normal from half or full, folded from normal.
        document.addEventListener("click", (e) => {
            const t = e.target.closest("#todo-col .td-h, #right-col .bm-heading");
            if (!t) return;
            const s = SIDES.find((x) => t.closest("#" + x.col));
            setState(s, state(s) === "normal" ? "fold" : "normal");
        });
        for (const sel of ["#todo-col .td-h", "#right-col .bm-heading"]) {
            const t = document.querySelector(sel);
            if (t) { t.classList.add("fold-title"); t.title = "Click to collapse"; }
        }
        // For keyboard shortcuts (keys.js): step a column one size smaller or bigger, or toggle its fold.
        window.LemonLayout = {
            step(side, dir) {
                const sd = SIDES.find((x) => x.side === side);
                if (!shown(sd)) return Promise.resolve();   // turned off in Settings
                const order = ORDER.filter((n) => n !== "wide" || wideFits());
                const i = order.indexOf(state(sd)) + dir;
                return i >= 0 && i < order.length ? setState(sd, order[i]) : Promise.resolve();
            },
            // Returns the settings promise: the column's contents are shown once it settles.
            toggle(side) {
                const sd = SIDES.find((x) => x.side === side);
                if (!shown(sd)) return Promise.resolve();
                return setState(sd, state(sd) === "fold" ? "normal" : "fold");
            },
        };
        paint();
        paintBadge();
        if (chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch.todo) paintBadge(); });
        }
        setInterval(paintBadge, 60 * 1000);
        // Layout settled: allow animation again (after two frames, so the first paint never animates).
        requestAnimationFrame(() => requestAnimationFrame(() => { window.__lemonSettled = true; root.classList.remove("lemon-loading"); }));
    }
    // Due badge on the folded to-do icon, so a folded column still shows what is due: open to-dos that are overdue or due today; red when anything is
    // overdue or due within the hour (and it pulses a few times when something becomes due soon).
    function dueSummary(data) {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        const soonCut = new Date(now.getTime() + 60 * 60 * 1000);
        const soonHm = `${pad(soonCut.getHours())}:${pad(soonCut.getMinutes())}`;
        let over = 0, todayN = 0, soon = null;
        for (const it of (data && data.items) || []) {
            if (it.done || !it.due) continue;
            if (it.due < today || (it.due === today && it.time && it.time < hm)) over++;
            else if (it.due === today) {
                todayN++;
                if (it.time && (soonCut.getDate() !== now.getDate() || it.time <= soonHm) && (!soon || it.time < soon.time)) soon = it;
            }
        }
        return { over, today: todayN, soon };
    }
    const fmt12 = (t) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
    async function paintBadge() {
        const rail = document.querySelector("#todo-col > .fold-rail");
        if (!rail) return;
        let badge = rail.querySelector(".fold-badge");
        if (!badge) { badge = document.createElement("span"); badge.className = "fold-badge"; rail.appendChild(badge); }
        const sum = dueSummary(await Lemon.store.get("todo", null));
        const n = sum.over + sum.today;
        badge.hidden = n === 0;
        badge.textContent = n > 99 ? "99+" : String(n);
        const urgent = sum.over > 0 || !!sum.soon;
        badge.classList.toggle("urgent", urgent);
        const wasSoon = badge.dataset.soon || "";
        const soonId = sum.soon ? sum.soon.id + sum.soon.time : "";
        badge.classList.toggle("soon", !!soonId && soonId !== wasSoon);
        badge.dataset.soon = soonId;
        const bits = [];
        if (sum.over) bits.push(`${sum.over} overdue`);
        if (sum.today) bits.push(`${sum.today} due today`);
        if (sum.soon) bits.push(`next: ${sum.soon.title} at ${fmt12(sum.soon.time)}`);
        rail.title = (bits.length ? bits.join(", ") + ". " : "") + "Open to-do (or drag it out)";
        rail.ariaLabel = "Open to-do" + (bits.length ? ", " + bits.join(", ") : "");
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => Lemon.ready.then(start));
    else Lemon.ready.then(start);
})();
