/*
 * Material Desk: the to-do column (its own column on the left, feature rich but calm at rest: the richness shows
 * when you act on an item). Mounts into <aside id="todo-col">. See ARCHITECTURE.md. Classes use td-.
 *
 * Data: chrome.storage.local key "todo" through Lemon.store, saved (debounced) on every change:
 *   { version: 1,
 *     lists: [{ id, name, color: role, sections: [{ id, name, collapsed }] }],      // "inbox" always exists
 *     items: [{ id, title, notes, listId, sectionId, due: "YYYY-MM-DD"|null, time: "HH:MM"|null,
 *               priority: 0|1|2|3 (1 = highest), tags: [], repeat: null|daily|weekdays|weekly|monthly,
 *               subtasks: [{ id, title, done }], done, completedAt, createdAt, order }],
 *     tagColors: { tag: role }, focusId, view, writer, savedAt }
 * Roles are Material color families: primary, secondary, tertiary, error, outline (neutral).
 * Dev only (127.0.0.1): ?seed (sample data), ?seed=empty, ?seed=200 (many items).
 */
(function () {
    "use strict";
    const col = document.getElementById("todo-col");
    if (!col || !window.Lemon) return;

    const KEY = "todo", VERSION = 1;
    const ROLES = ["secondary", "tertiary", "primary", "error", "outline"];
    const ROLE_LABEL = { primary: "Primary", secondary: "Secondary", tertiary: "Tertiary", error: "Red", outline: "Gray" };
    const TAG_ROLES = ["secondary", "tertiary", "primary"];
    // Colors offered for lists and tags. "error" stays valid in ROLES so old data loads, but is not offered: red is
    // kept for overdue and priority 1 (ARCHITECTURE.md), and it looks like primary on many wallpapers.
    const PALETTE = ["secondary", "tertiary", "primary", "outline"];
    const REPEATS = ["daily", "weekdays", "weekly", "monthly"];
    const REPEAT_LABEL = { daily: "Daily", weekdays: "Weekdays", weekly: "Weekly", monthly: "Monthly" };
    const PRI_ROLE = { 1: "error", 2: "tertiary", 3: "secondary" };
    const SMART = [["today", "Today"], ["upcoming", "Upcoming"], ["all", "All"], ["done", "Done"]];
    const FALLBACK = {
        primary: "#ffb4a4", primary_container: "#733427", on_primary_container: "#ffdad3",
        secondary: "#e7bdb4", secondary_container: "#5d3f39", on_secondary_container: "#ffdad3",
        tertiary: "#dcc48c", tertiary_container: "#554519", on_tertiary_container: "#f9e0a6",
        error: "#ffb4ab", error_container: "#93000a", on_error_container: "#ffdad6",
    };
    const TAB = uid();

    // ---- small helpers -------------------------------------------------------------------------------------------
    function uid() {
        try { return crypto.randomUUID(); } catch (e) { return "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2); }
    }
    // Ids end up in HTML attributes and selectors: only letters, digits, "_" and "-" are kept; anything else (for
    // example from an imported file) gets a fresh id.
    const safeId = (v, fresh = () => uid()) => (/^[\w-]{1,64}$/.test(String(v)) ? String(v) : fresh());
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const clone = (o) => JSON.parse(JSON.stringify(o));
    // Without a root, look in the column and then in the date pop-out (it lives on <body>, see "date pop-out").
    let pop = null;
    const $ = (sel, el) => (el ? el.querySelector(sel) : col.querySelector(sel) || (pop && pop.querySelector(sel)));
    const $$ = (sel, el) => (el ? Array.from(el.querySelectorAll(sel))
        : Array.from(col.querySelectorAll(sel)).concat(pop ? Array.from(pop.querySelectorAll(sel)) : []));
    const inUI = (el) => !!el && (col.contains(el) || (!!pop && pop.contains(el)));
    const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
    const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
    const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
    const cleanTag = (t) => String(t || "").toLowerCase().replace(/^#/, "").replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 30);

    function roleVars(role, prefix) {
        const p = prefix || "";
        if (role === "outline") {
            return `--${p}c: var(--dl-outline, #a08c88); --${p}cc: var(--dl-surface_container_highest, #3d3230); --${p}onc: var(--dl-on_surface, #f1dfdb);`;
        }
        const r = ROLES.includes(role) ? role : "secondary";
        return `--${p}c: var(--dl-${r}, ${FALLBACK[r]}); --${p}cc: var(--dl-${r}_container, ${FALLBACK[r + "_container"]}); --${p}onc: var(--dl-on_${r}_container, ${FALLBACK["on_" + r + "_container"]});`;
    }

    // Material Symbols style paths (24px grid).
    const I = {
        add: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
        search: "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
        more: "M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z",
        close: "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
        event: "M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14v10zm-7-7h5v5h-5z",
        time: "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z",
        flag: "M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6z",
        tag: "M20 10V8h-4V4h-2v4h-4V4H8v4H4v2h4v4H4v2h4v4h2v-4h4v4h2v-4h4v-2h-4v-4h4zm-6 4h-4v-4h4v4z",
        list: "M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z",
        section: "M3 5h18v2H3zm4 6h14v2H7zm0 6h14v2H7z",
        repeat: "M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z",
        notes: "M14 17H4v2h10v-2zm6-8H4v2h16V9zM4 15h16v-2H4v2zM4 5v2h16V5H4z",
        subtasks: "M22 7h-9v2h9V7zm0 8h-9v2h9v-2zM5.54 11 2 7.46l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41L5.54 11zm0 8L2 15.46l1.41-1.41 2.12 2.12 4.24-4.24 1.41 1.41L5.54 19z",
        delete: "M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z",
        grip: "M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z",
        expand: "M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z",
        less: "M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z",
        left: "M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z",
        right: "M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z",
        focus: "M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3-8c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z",
        back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
        download: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
        upload: "M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z",
        sun: "M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a1 1 0 0 0-1.41 1.41l1.06 1.06a1 1 0 0 0 1.41-1.41L5.99 4.58zm12.37 12.37a1 1 0 0 0-1.41 1.41l1.06 1.06a1 1 0 0 0 1.41-1.41l-1.06-1.06zm1.06-10.96a1 1 0 0 0-1.41-1.41l-1.06 1.06a1 1 0 0 0 1.41 1.41l1.06-1.06zM7.05 18.36a1 1 0 0 0-1.41-1.41l-1.06 1.06a1 1 0 0 0 1.41 1.41l1.06-1.06z",
        inbox: "M19 3H4.99C3.88 3 3.01 3.89 3.01 5L3 19c0 1.1.88 2 1.99 2H19c1.1 0 2-.9 2-2V5c0-1.11-.9-2-2-2zm0 12h-4c0 1.66-1.35 3-3 3s-3-1.34-3-3H4.99V5H19v10z",
        doneAll: "M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41 6 19l1.41-1.41L1.83 12 .41 13.41z",
        edit: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
    };
    const icon = (name, cls) => `<svg class="td-i${cls ? " " + cls : ""}" viewBox="0 0 24 24" aria-hidden="true"><path d="${I[name]}"/></svg>`;
    const CHECK = `<svg class="td-tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9" pathLength="1"/></svg>`;

    // ---- dates (all local, stored as "YYYY-MM-DD") ---------------------------------------------------------------
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const pad = (n) => String(n).padStart(2, "0");
    const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const parseYmd = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
    const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    const todayD = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
    const todayS = () => ymd(new Date());
    const dayDiff = (s) => Math.round((parseYmd(s) - todayD()) / 864e5);
    const isTodayMs = (ms) => !!ms && ymd(new Date(ms)) === todayS();
    const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();

    function nextWeekday(w, includeToday) {
        const d = todayD();
        let diff = (w - d.getDay() + 7) % 7;
        if (diff === 0 && !includeToday) diff = 7;
        return addDays(d, diff);
    }
    function fmtTime(t) {
        const [h, m] = t.split(":").map(Number);
        const hh = h % 12 || 12, ap = h < 12 ? "AM" : "PM";
        return m ? `${hh}:${pad(m)} ${ap}` : `${hh} ${ap}`;
    }
    function fmtDate(s, long) {
        const n = dayDiff(s), d = parseYmd(s);
        if (n === 0) return "Today";
        if (n === 1) return "Tomorrow";
        if (n === -1) return "Yesterday";
        if (n > 1 && n < 7) return long ? DAYS_LONG[d.getDay()] : DAYS[d.getDay()];
        const md = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
        if (d.getFullYear() !== new Date().getFullYear()) return `${md}, ${d.getFullYear()}`;
        return long ? `${DAYS[d.getDay()]}, ${md}` : md;
    }
    // A date inside a sentence: "today" and "tomorrow" in lower case, weekdays and months as they are.
    const relDate = (s) => fmtDate(s, true).replace(/^(Today|Tomorrow|Yesterday)$/, (w) => w.toLowerCase());
    const dueLabel = (it) => (it.due ? fmtDate(it.due) + (it.time ? " " + fmtTime(it.time) : "") : "");
    function nextDue(due, rule) {
        const step = (d) => {
            if (rule === "daily") return addDays(d, 1);
            if (rule === "weekly") return addDays(d, 7);
            if (rule === "weekdays") { let x = addDays(d, 1); while (x.getDay() === 0 || x.getDay() === 6) x = addDays(x, 1); return x; }
            const day = parseYmd(due).getDate();          // monthly: same day of month, clamped
            const y = d.getFullYear(), m = d.getMonth() + 1;
            return new Date(y, m, Math.min(day, daysIn(y, m)));
        };
        let d = step(parseYmd(due));
        const t = todayD();
        while (d <= t) d = step(d);
        return ymd(d);
    }

    // ---- quick-add parser ----------------------------------------------------------------------------------------
    // Dates, times, priority, #tags and @list come out of the text; the rest stays as the title.
    const WD = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3,
        thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };
    // "sat" and "sun" alone are left out on purpose ("Study for SAT").
    const WD_RE = "monday|mon|tuesday|tues|tue|wednesday|weds|wed|thursday|thurs|thur|thu|friday|fri|saturday|sunday";
    const WD_ALL = WD_RE + "|sat|sun";
    const MON = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
        jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
        dec: 11, december: 11 };
    const MON_RE = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec";
    const NUMW = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    const END = "(?=$|\\s|[,.;!?])";
    const PREP = "(?:(?:on|by|due)\\s+)?";

    function mkDate(year, month, day) {
        if (!(month >= 0 && month <= 11) || !(day >= 1)) return null;
        const t = todayD();
        let y = year ? (+year < 100 ? 2000 + +year : +year) : t.getFullYear();
        if (day > daysIn(y, month)) return null;
        let d = new Date(y, month, day);
        if (!year && d < t) { y += 1; if (day > daysIn(y, month)) return null; d = new Date(y, month, day); }
        return ymd(d);
    }

    // opts.keepDue: only report what was typed (no date filled in for a lone time or repeat).
    // opts.loose: also take a bare 24-hour time like "17:30" (date picker and time field, where text is only a date).
    function parseQuick(input, lists, opts) {
        opts = opts || {};
        let s = " " + input + " ";
        const out = { title: "", due: null, time: null, priority: 0, tags: [], listId: null, newList: null, repeat: null };
        const grab = (src, fn) => {
            const m = new RegExp("\\s" + src + END, "iu").exec(s);
            if (!m || fn(m) === false) return false;
            s = s.slice(0, m.index) + " " + s.slice(m.index + m[0].length);
            return true;
        };
        let tonight = false, weekdayToday = false;
        grab(`every\\s+(day|weekdays?|week|month|${WD_ALL})`, (m) => {
            const w = m[1].toLowerCase();
            if (w === "day") out.repeat = "daily";
            else if (w.startsWith("weekday")) out.repeat = "weekdays";
            else if (w === "week") out.repeat = "weekly";
            else if (w === "month") out.repeat = "monthly";
            else { out.repeat = "weekly"; out.due = ymd(nextWeekday(WD[w], true)); }
        });
        const t = todayD();
        const rules = [
            [`${PREP}(?:this\\s+)?(today|tonight|tod)`, (m) => { tonight = /tonight/i.test(m[1]); return ymd(t); }],
            [`${PREP}(tomorrow|tmrw|tmr|tmw)`, () => ymd(addDays(t, 1))],
            [`next\\s+week`, () => ymd(nextWeekday(1, false))],
            [`next\\s+month`, () => ymd(new Date(t.getFullYear(), t.getMonth() + 1, 1))],
            [`${PREP}(?:this\\s+)?weekend`, () => ymd(t.getDay() === 6 || t.getDay() === 0 ? t : addDays(t, 6 - t.getDay()))],
            [`in\\s+(\\d{1,3}|an?|one|two|three|four|five|six|seven|eight|nine|ten)\\s+(days?|weeks?|months?)`, (m) => {
                const n = NUMW[m[1].toLowerCase()] || +m[1], u = m[2].toLowerCase()[0];
                if (u === "m") return ymd(new Date(t.getFullYear(), t.getMonth() + n, Math.min(t.getDate(), daysIn(t.getFullYear(), t.getMonth() + n))));
                return ymd(addDays(t, u === "w" ? n * 7 : n));
            }],
            // A bare (or "this") weekday that is today means today ("Thursday 11:59 PM" typed on a Thursday is
            // tonight, not next week); "next <weekday>" still skips today. A time already past moves it a week on.
            [`${PREP}(?:(next|this)\\s+)?(${WD_RE})`, (m) => {
                const isNext = /next/i.test(m[1] || "");
                const d = nextWeekday(WD[m[2].toLowerCase()], !isNext);
                weekdayToday = !isNext && ymd(d) === ymd(t);
                return ymd(d);
            }],
            [`${PREP}(\\d{1,2})/(\\d{1,2})(?:/(\\d{4}|\\d{2}))?`, (m) => mkDate(m[3], +m[1] - 1, +m[2])],
            [`${PREP}(${MON_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?`, (m) => mkDate(m[3], MON[m[1].toLowerCase()], +m[2])],
            [`${PREP}(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MON_RE})(?:,?\\s+(\\d{4}))?`, (m) => mkDate(m[3], MON[m[2].toLowerCase()], +m[1])],
        ];
        if (!out.due) {
            for (const [src, fn] of rules) {
                if (grab(src, (m) => { const v = fn(m); if (!v) return false; out.due = v; })) break;
            }
        }
        grab(`(?:(?:at|@)\\s*)?(\\d{1,2})(?::([0-5]\\d))?\\s*(am|pm)`, (m) => {
            const h = +m[1];
            if (h < 1 || h > 12) return false;
            out.time = `${pad((h % 12) + (m[3].toLowerCase() === "pm" ? 12 : 0))}:${m[2] || "00"}`;
        }) || grab(`${opts.loose ? "(?:at\\s+)?" : "at\\s+"}([01]?\\d|2[0-3]):([0-5]\\d)`, (m) => { out.time = `${pad(+m[1])}:${m[2]}`; })
          || grab(`(?:at\\s+)?(noon|midnight)`, (m) => { out.time = /noon/i.test(m[1]) ? "12:00" : "00:00"; });
        if (tonight && !out.time) out.time = "20:00";
        if (weekdayToday && out.time && out.due === ymd(t)) {
            const now = new Date(), [h, mi] = out.time.split(":").map(Number);
            if (h * 60 + mi <= now.getHours() * 60 + now.getMinutes()) out.due = ymd(addDays(t, 7));
        }
        if (!opts.keepDue) {
            if (out.time && !out.due) {
                const now = new Date(), [h, mi] = out.time.split(":").map(Number);
                out.due = h * 60 + mi <= now.getHours() * 60 + now.getMinutes() ? ymd(addDays(t, 1)) : ymd(t);
            }
            if (out.repeat && !out.due) out.due = ymd(t);
        }
        grab(`(!{1,3}|p[1-3])`, (m) => { const v = m[1]; out.priority = v[0] === "!" ? 4 - v.length : +v[1]; });
        while (grab(`#(\\p{L}[\\p{L}\\p{N}_-]*)`, (m) => {
            const tag = cleanTag(m[1]);
            if (!tag) return false;
            if (!out.tags.includes(tag)) out.tags.push(tag);
        })) { /* all tags */ }
        grab(`@([\\p{L}\\p{N}_-]+)`, (m) => {
            const k = (n) => n.toLowerCase().replace(/\s+/g, "");
            const want = k(m[1]);
            const hit = (lists || []).find((l) => k(l.name) === want) || (lists || []).find((l) => k(l.name).startsWith(want));
            if (hit) out.listId = hit.id;
            else out.newList = m[1][0].toUpperCase() + m[1].slice(1);
        });
        out.title = s.replace(/\s+/g, " ").trim();
        return out;
    }

    // ---- state ---------------------------------------------------------------------------------------------------
    let S = null;
    const ui = {
        open: null, openTitle: "", picker: false, cal: null, calFocus: null,
        search: false, q: "", tag: null, doneOpen: false,
        sheet: false, colorFor: null, confirmDel: null, renameSec: null,
        cursor: null, lastAdded: null, sheetMsg: "", searchDone: new Set(),
    };
    const pendingDone = new Set();

    function freshState() {
        return { version: VERSION, lists: [{ id: "inbox", name: "Inbox", color: "secondary", sections: [] }], items: [],
            tagColors: {}, focusId: null, view: "today" };
    }
    function normalize(raw) {
        const s = freshState();
        if (raw && typeof raw === "object" && !Array.isArray(raw.items) && raw.todo && typeof raw.todo === "object") raw = raw.todo;
        if (!raw || typeof raw !== "object") return s;
        const seen = new Set();
        s.lists = [];
        for (const l of Array.isArray(raw.lists) ? raw.lists : []) {
            if (!l || typeof l !== "object" || !l.id || !/^[\w-]{1,64}$/.test(String(l.id)) || seen.has(String(l.id))) continue;
            seen.add(String(l.id));
            s.lists.push({
                id: String(l.id), name: String(l.name || "Untitled").slice(0, 40),
                color: ROLES.includes(l.color) ? l.color : "secondary",
                sections: (Array.isArray(l.sections) ? l.sections : []).filter((x) => x && x.id)
                    .map((x) => ({ id: safeId(x.id), name: String(x.name || "Section").slice(0, 40), collapsed: !!x.collapsed })),
            });
        }
        if (!seen.has("inbox")) s.lists.unshift({ id: "inbox", name: "Inbox", color: "secondary", sections: [] });
        const ids = new Set();
        (Array.isArray(raw.items) ? raw.items : []).forEach((it, i) => {
            if (!it || typeof it !== "object") return;
            let id = safeId(it.id);
            if (ids.has(id)) id = uid();
            ids.add(id);
            const list = s.lists.find((l) => l.id === String(it.listId)) || s.lists.find((l) => l.id === "inbox");
            const due = /^\d{4}-\d{2}-\d{2}$/.test(it.due) ? it.due : null;
            s.items.push({
                id, title: String(it.title == null ? "" : it.title).slice(0, 500),
                notes: String(it.notes == null ? "" : it.notes).slice(0, 20000), listId: list.id,
                sectionId: list.sections.some((x) => x.id === it.sectionId) ? it.sectionId : null,
                due, time: due && /^\d{2}:\d{2}$/.test(it.time) ? it.time : null,
                priority: [1, 2, 3].includes(it.priority) ? it.priority : 0,
                tags: Array.isArray(it.tags) ? [...new Set(it.tags.map(cleanTag).filter(Boolean))] : [],
                repeat: REPEATS.includes(it.repeat) ? it.repeat : null,
                subtasks: (Array.isArray(it.subtasks) ? it.subtasks : []).filter((x) => x && typeof x === "object")
                    .map((x) => ({ id: safeId(x.id), title: String(x.title == null ? "" : x.title).slice(0, 300), done: !!x.done })),
                done: !!it.done, completedAt: it.done ? Number(it.completedAt) || Date.now() : null,
                createdAt: Number(it.createdAt) || Date.now(), order: Number.isFinite(it.order) ? it.order : i,
            });
        });
        if (raw.tagColors && typeof raw.tagColors === "object") {
            for (const [k, v] of Object.entries(raw.tagColors)) if (ROLES.includes(v) && cleanTag(k)) s.tagColors[cleanTag(k)] = v;
        }
        s.focusId = s.items.some((i) => i.id === raw.focusId && !i.done) ? raw.focusId : null;
        const v = String(raw.view || "today");
        s.view = SMART.some(([k]) => k === v) || (v.startsWith("list:") && seen.has(v.slice(5))) ? v : "today";
        return s;
    }

    const find = (id) => S.items.find((i) => i.id === id);
    const listById = (id) => S.lists.find((l) => l.id === id) || S.lists[0];
    const listIdx = (id) => S.lists.findIndex((l) => l.id === id);
    const tagRole = (t) => {
        if (S.tagColors[t]) return S.tagColors[t];
        let h = 0;
        for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0;
        return TAG_ROLES[h % TAG_ROLES.length];
    };
    function isOverdue(it) {
        if (!it.due || it.done) return false;
        const n = dayDiff(it.due);
        if (n < 0) return true;
        if (n === 0 && it.time) {
            const [h, m] = it.time.split(":").map(Number), now = new Date();
            return now.getHours() * 60 + now.getMinutes() > h * 60 + m;
        }
        return false;
    }
    const pri = (it) => it.priority || 4;
    const byOrder = (a, b) => a.order - b.order;
    const byTime = (a, b) => (a.time ? 0 : 1) - (b.time ? 0 : 1) || (a.time || "").localeCompare(b.time || "")
        || pri(a) - pri(b) || listIdx(a.listId) - listIdx(b.listId) || a.order - b.order;
    const byDue = (a, b) => (a.due || "9999").localeCompare(b.due || "9999") || byTime(a, b);
    const focusItem = () => (S.focusId ? S.items.find((i) => i.id === S.focusId && !i.done) : null);

    // ---- saving and syncing --------------------------------------------------------------------------------------
    let saveTimer = null, pendingRemote = null, pendingBase = null;
    // savedAt stamps of this tab's own recent saves. A change carrying our tab id but another stamp (for example a
    // Settings import of a file exported from this tab) is applied, not ignored.
    const ownSaves = [];
    function save() { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 250); }
    function flush() {
        clearTimeout(saveTimer);
        saveTimer = null;
        if (!S) return;
        S.writer = TAB;
        S.savedAt = Date.now();
        ownSaves.push(S.savedAt);
        if (ownSaves.length > 30) ownSaves.shift();
        Promise.resolve(Lemon.store.set(KEY, S)).catch(() => snack("Could not save the to-do list. Storage is full or blocked."));
    }
    const commit = () => { save(); render(); };
    window.addEventListener("pagehide", () => { if (saveTimer) flush(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden && saveTimer) flush(); });

    const typingInCol = () => {
        const a = document.activeElement;
        return a && inUI(a) &&(a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && a.dataset.k !== "add" && a.dataset.k !== "q"));
    };
    // Another tab saved. While the user types here the remote copy waits; when it lands, local edits made in the
    // meantime (items and lists that changed since it arrived) are laid over it so nothing typed is lost.
    function mergeLocal(remote, base) {
        let changed = false;
        for (const key of ["items", "lists"]) {
            const before = new Map(base[key].map((x) => [x.id, JSON.stringify(x)]));
            const now = new Map(S[key].map((x) => [x.id, x]));
            for (const [id, x] of now) {
                if (before.get(id) === JSON.stringify(x)) continue;
                const i = remote[key].findIndex((r) => r.id === id);
                if (i >= 0) remote[key][i] = x; else remote[key].push(x);
                changed = true;
            }
            for (const id of before.keys()) {
                if (now.has(id)) continue;
                const i = remote[key].findIndex((r) => r.id === id);
                if (i >= 0 && id !== "inbox") { remote[key].splice(i, 1); changed = true; }
            }
        }
        return changed;
    }
    function applyRemote(value) {
        if (typingInCol()) {
            if (!pendingRemote) pendingBase = clone(S);
            pendingRemote = value;
            return;
        }
        const base = pendingRemote === value ? pendingBase : null;
        pendingRemote = null;
        pendingBase = null;
        const view = S ? S.view : "today";
        const next = normalize(value);
        const mine = base ? mergeLocal(next, base) : false;
        S = mine ? normalize(next) : next;
        if (mine) save();
        S.view = view.startsWith("list:") && !S.lists.some((l) => "list:" + l.id === view) ? "today" : view;
        if (ui.open && !find(ui.open)) ui.open = null;
        render();
    }
    const remoteAfterBlur = () => setTimeout(() => { if (pendingRemote && !typingInCol()) applyRemote(pendingRemote); }, 0);
    col.addEventListener("focusout", remoteAfterBlur);
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== "local" || !changes[KEY]) return;
            const nv = changes[KEY].newValue;
            if (nv && nv.writer === TAB && ownSaves.includes(nv.savedAt)) return;
            if (S) applyRemote(nv);
        });
    }

    // ---- skeleton ------------------------------------------------------------------------------------------------
    col.innerHTML = `
        <header class="td-head">
            <h2 class="panel-title td-h">To-do</h2>
            <div class="td-progress" hidden></div>
            <span class="td-flex"></span>
            <button class="icon-btn" type="button" data-act="search" data-k="h-search" aria-label="Search to-dos" title="Search (/)">${icon("search")}</button>
            <button class="icon-btn td-menu-btn" type="button" data-act="sheet" data-k="h-menu" aria-expanded="false" aria-label="Lists, tags and data" title="Lists, tags and data">${icon("more")}</button>
        </header>
        <div class="td-top">
            <form class="td-add" autocomplete="off">
                <label class="td-field">
                    ${icon("add", "td-field-ic")}
                    <input class="td-add-in" data-k="add" type="text" maxlength="500" spellcheck="true" placeholder="Add a to-do"
                        aria-label="Add a to-do. Understands dates like tmr or fri, times like 5pm, ! for priority, # for tags and @ for a list">
                    <kbd class="td-kbd" aria-hidden="true">n</kbd>
                </label>
                <div class="td-qchips" aria-live="polite"></div>
            </form>
            <div class="td-search" hidden>
                <label class="td-field">
                    <button type="button" class="td-back" data-act="search-close" aria-label="Close search">${icon("back")}</button>
                    <input class="td-search-in" data-k="q" type="text" placeholder="Search titles, notes, subtasks" aria-label="Search to-dos">
                </label>
                <div class="td-tagbar" role="group" aria-label="Filter by tag"></div>
            </div>
            <div class="td-nav">
                <div class="td-views" role="group" aria-label="Views"></div>
                <div class="td-lists" role="group" aria-label="Lists"></div>
            </div>
        </div>
        <div class="td-body panel-body"></div>
        <div class="td-sheet" role="dialog" aria-label="Lists, tags and data" hidden></div>
        <div class="td-snack" role="status" aria-live="polite" hidden></div>`;
    const body = $(".td-body"), addIn = $(".td-add-in"), qIn = $(".td-search-in"), sheet = $(".td-sheet"), snackEl = $(".td-snack");
    body.innerHTML = `<p class="td-loading" aria-hidden="true"></p>`;
    // The date pop-out belongs to the column but sits on <body> with position: fixed, because #todo-col clips its
    // overflow. It extrudes from the column's right edge (or opens inside a half or full width column).
    pop = document.createElement("div");
    pop.className = "td-pop";
    pop.id = "td-pop";
    pop.hidden = true;
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Date, time and repeat");
    pop.innerHTML = `<span class="td-pop-neck is-top" aria-hidden="true"></span><span class="td-pop-neck is-bot" aria-hidden="true"></span>
        <div class="td-pop-surface"><div class="td-pop-in"></div></div>`;
    document.body.appendChild(pop);
    const popIn = pop.querySelector(".td-pop-in");

    // ---- render --------------------------------------------------------------------------------------------------
    function render() {
        if (!S) return;
        const a = document.activeElement;
        const k = a && inUI(a) && a.dataset ? a.dataset.k : null;
        const navBefore = $$("[data-nav]").map((el) => el.dataset.k);
        const navIdx = k ? navBefore.indexOf(k) : -1;
        let sel = null;
        if (k && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) { try { sel = [a.selectionStart, a.selectionEnd]; } catch (e) { /* */ } }
        const st = body.scrollTop;
        const editorFocus = !!(a && a.closest && (a.closest(".td-item.is-open") || pop.contains(a)));

        renderProgress();
        renderNav();
        renderBody();
        const gone = ui.open && !body.querySelector(".td-item.is-open") ? ui.open : null;
        if (gone) {
            // An edit (date, list, unpin) took the open item out of this view: close it and say where it went.
            finalizeOpen();
            ui.open = null;
            ui.picker = false;
            renderBody();
        }
        renderSheet();
        body.scrollTop = st;
        renderPicker();

        const nav = $$("[data-nav]");
        let cur = nav.find((el) => el.dataset.k === "open:" + ui.cursor) || nav[0];
        nav.forEach((el) => (el.tabIndex = el === cur ? 0 : -1));
        if (k) {
            let el = $(`[data-k="${CSS.escape(k)}"]`);
            // Focus was in the pop-out and it closed: go back to the date pill that opened it.
            if (!ui.picker && pop.contains(a)) el = $('[data-k="e-due"]') || el;
            if (!el && navIdx >= 0 && nav.length) el = nav[Math.min(navIdx, nav.length - 1)];
            if (el && document.activeElement !== el) {
                el.focus({ preventScroll: true });
                if (sel && el.setSelectionRange) { try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* */ } }
            }
            if (el && el.dataset.nav !== undefined) { nav.forEach((n) => (n.tabIndex = -1)); el.tabIndex = 0; }
        }
        ui.lastAdded = null;
        scheduleMidnight();
        if (gone) {
            if (editorFocus && !col.contains(document.activeElement)) addIn.focus({ preventScroll: true });
            const it = find(gone);
            if (it) {
                const target = it.done ? "done" : "list:" + it.listId;
                const where = it.done ? "Done" : listById(it.listId).name + (it.due ? ", due " + relDate(it.due) : "");
                snack(`Moved to ${where}`, "Show", () => showItem(it.id, target));
            }
        }
    }

    function renderProgress() {
        const el = $(".td-progress");
        const t = todayS();
        const doneT = S.items.filter((i) => i.done && isTodayMs(i.completedAt)).length;
        const open = S.items.filter((i) => !i.done && i.due && i.due <= t).length;
        const total = doneT + open;
        el.hidden = total === 0;
        if (!total) return;
        const frac = doneT / total;
        const label = open === 0 ? "All done today" : `${doneT} of ${total} done today`;
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", label);
        el.innerHTML = `<svg class="td-ring${open === 0 ? " is-full" : ""}" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="td-ring-t" cx="12" cy="12" r="9"/>
                <circle class="td-ring-v" cx="12" cy="12" r="9" pathLength="100" stroke-dasharray="${(frac * 100).toFixed(1)} 100"/>
            </svg><span aria-hidden="true">${label}</span>`;
    }

    function renderNav() {
        $(".td-add").hidden = ui.search;
        $(".td-nav").hidden = ui.search;
        $(".td-search").hidden = !ui.search;
        const t = todayS();
        const open = S.items.filter((i) => !i.done);
        const n = {
            today: open.filter((i) => i.due && i.due <= t).length,
            upcoming: open.filter((i) => i.due && i.due > t).length,
            all: open.length,
            done: S.items.length - open.length,
        };
        const over = open.some(isOverdue);
        $(".td-views").innerHTML = SMART.map(([v, label]) => `<button type="button" class="td-seg" data-act="view" data-v="${v}" data-k="v:${v}" aria-pressed="${S.view === v}">${label}${
            n[v] && v !== "done" ? `<span class="td-n${v === "today" && over ? " is-over" : ""}">${n[v]}</span>` : ""}</button>`).join("");
        const counts = {};
        open.forEach((i) => (counts[i.listId] = (counts[i.listId] || 0) + 1));
        $(".td-lists").innerHTML = S.lists.map((l) => `<button type="button" class="td-lchip" data-act="view" data-v="list:${l.id}" data-k="v:list:${l.id}"
            aria-pressed="${S.view === "list:" + l.id}" style="${roleVars(l.color)}"><span class="td-dot"></span>${esc(l.name)}${
            counts[l.id] ? `<span class="td-n">${counts[l.id]}</span>` : ""}</button>`).join("")
            + `<button type="button" class="td-lchip td-lchip-add" data-act="new-list" data-k="v:new" aria-label="New list" title="New list">${icon("add")}</button>`;
        const box = $(".td-lists");
        box.classList.toggle("is-over", box.scrollWidth > box.clientWidth + 1);
        const sel = $(".td-lists [aria-pressed=true]");
        if (sel) {
            if (sel.offsetLeft < box.scrollLeft || sel.offsetLeft + sel.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollLeft = sel.offsetLeft - 8;
        }
        edges(box);
        if (ui.search) renderTagbar();
    }

    function renderTagbar() {
        const counts = new Map();
        S.items.forEach((i) => { if (!i.done) i.tags.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)); });
        S.items.forEach((i) => i.tags.forEach((t) => { if (!counts.has(t)) counts.set(t, 0); }));
        const tags = [...counts.keys()].sort();
        $(".td-tagbar").innerHTML = tags.length ? tags.map((t) => `<button type="button" class="td-tchip td-tfilter" data-act="tagf" data-v="${esc(t)}" data-k="tf:${esc(t)}"
            aria-pressed="${ui.tag === t}" style="${roleVars(tagRole(t))}">#${esc(t)}${counts.get(t) ? `<span class="td-n">${counts.get(t)}</span>` : ""}</button>`).join("")
            : `<span class="td-hint">Tags appear here once you add them with #name.</span>`;
        const bar = $(".td-tagbar");
        bar.classList.toggle("is-over", bar.scrollWidth > bar.clientWidth + 1);
        const on = bar.querySelector("[aria-pressed=true]");
        if (on && (on.offsetLeft < bar.scrollLeft || on.offsetLeft + on.offsetWidth > bar.scrollLeft + bar.clientWidth)) bar.scrollLeft = on.offsetLeft - 8;
        edges(bar);
    }

    // Rows -----------------------------------------------------------------------------------------------------
    function checkHTML(it, tabbable) {
        return `<button type="button" class="td-check" role="checkbox" aria-checked="${it.done}" data-act="toggle" data-k="chk:${it.id}"
            ${tabbable ? "" : 'tabindex="-1"'} aria-label="${it.done ? "Mark not done" : "Mark done"}: ${esc(it.title || "Untitled")}">${CHECK}</button>`;
    }
    function rowHTML(it, o) {
        o = o || {};
        if (ui.open === it.id) return editorHTML(it, o);
        const meta = [];
        if (it.due && o.noDate) {
            if (it.time || it.repeat) meta.push(`<span class="td-due">${icon(it.repeat ? "repeat" : "time")}${it.time ? fmtTime(it.time) : REPEAT_LABEL[it.repeat]}</span>`);
        } else if (it.due) {
            const cls = it.done ? "" : isOverdue(it) ? " is-over" : dayDiff(it.due) === 0 ? " is-today" : "";
            meta.push(`<span class="td-due${cls}">${icon(it.repeat ? "repeat" : "event")}${esc(dueLabel(it))}</span>`);
        } else if (it.repeat) meta.push(`<span class="td-mi">${icon("repeat")}${REPEAT_LABEL[it.repeat]}</span>`);
        for (const t of it.tags) meta.push(`<span class="td-tag" style="${roleVars(tagRole(t))}">#${esc(t)}</span>`);
        if (it.subtasks.length) {
            const d = it.subtasks.filter((s) => s.done).length;
            meta.push(`<span class="td-mi${d === it.subtasks.length ? " is-full" : ""}" title="Subtasks">${icon("subtasks")}${d}/${it.subtasks.length}</span>`);
        }
        if (it.notes.trim()) meta.push(`<span class="td-mi" title="Has notes">${icon("notes")}<span class="td-sr">Has notes</span></span>`);
        if (o.showList && it.listId !== "inbox") {
            const l = listById(it.listId);
            meta.push(`<span class="td-mlist" style="${roleVars(l.color)}"><span class="td-dot"></span>${esc(l.name)}</span>`);
        }
        const p = it.priority && !it.done ? it.priority : 0;
        return `<li class="td-item${it.done ? " is-done" : ""}${o.drag ? " is-drag" : ""}${ui.lastAdded === it.id ? " is-new" : ""}${p ? " has-pri" : ""}"
                data-id="${it.id}"${p ? ` style="${roleVars(PRI_ROLE[p], "p")}"` : ""}>
            ${checkHTML(it)}
            <button type="button" class="td-open" data-k="open:${it.id}" data-nav aria-expanded="false">
                <span class="td-ttl">${it.title ? esc(it.title) : '<span class="td-untitled">Untitled</span>'}${p ? `<span class="td-pri" aria-hidden="true">${"!".repeat(4 - p)}</span><span class="td-sr">, priority ${p}</span>` : ""}</span>
                ${meta.length ? `<span class="td-meta">${meta.join("")}</span>` : ""}
            </button>
        </li>`;
    }

    function editorHTML(it) {
        const list = listById(it.listId);
        const dueCls = it.due ? (it.done ? "" : isOverdue(it) ? " is-over" : dayDiff(it.due) === 0 ? " is-today" : " is-future") : "";
        const focused = S.focusId === it.id;
        const p = it.priority && !it.done ? it.priority : 0;
        return `<li class="td-item is-open${it.done ? " is-done" : ""}${p ? " has-pri" : ""}" data-id="${it.id}"${p ? ` style="${roleVars(PRI_ROLE[p], "p")}"` : ""}>
            <div class="td-ed-top">
                ${checkHTML(it, true)}
                <textarea class="td-ed-title" data-k="e-title" rows="1" maxlength="500" placeholder="Title" aria-label="Title">${esc(it.title)}</textarea>
                <button type="button" class="icon-btn td-ed-close" data-act="close" data-k="e-close" aria-label="Close (Esc)" title="Close (Esc)">${icon("less")}</button>
            </div>
            <div class="td-ed">
                <textarea class="td-ed-notes" data-k="e-notes" rows="1" maxlength="20000" placeholder="Notes" aria-label="Notes">${esc(it.notes)}</textarea>
                <ul class="td-subs" aria-label="Subtasks">
                    ${it.subtasks.map((s) => `<li class="td-sub${s.done ? " is-done" : ""}" data-sid="${s.id}">
                        <span class="td-sub-grip" title="Drag to reorder (or Alt+Up and Alt+Down)">${icon("grip")}</span>
                        <button type="button" class="td-check td-check-sm" role="checkbox" aria-checked="${s.done}" data-act="sub-toggle" data-k="sc:${s.id}"
                            aria-label="${s.done ? "Mark not done" : "Mark done"}: ${esc(s.title || "subtask")}">${CHECK}</button>
                        <input class="td-sub-in" data-k="s:${s.id}" value="${esc(s.title)}" maxlength="300" aria-label="Subtask. Alt+Up or Alt+Down moves it">
                        <button type="button" class="icon-btn td-sub-del" data-act="sub-del" aria-label="Delete subtask">${icon("close")}</button>
                    </li>`).join("")}
                    <li class="td-sub td-sub-new">
                        <span class="td-sub-plus">${icon("add")}</span>
                        <input class="td-sub-in" data-k="s-new" maxlength="300" placeholder="Add subtask" aria-label="Add subtask">
                    </li>
                </ul>
                <div class="td-props">
                    <div class="td-prop">
                        <span class="td-prop-i" title="Date">${icon("event")}</span>
                        <div class="td-prop-c">
                            <button type="button" class="td-pchip td-due-chip${dueCls}" data-act="picker" data-k="e-due" aria-haspopup="dialog" aria-controls="td-pop" aria-expanded="${ui.picker}">${it.due ? esc(dueLabel(it)) : "Add date"}</button>
                            ${it.repeat ? `<span class="td-pchip td-rep-chip">${icon("repeat")}${REPEAT_LABEL[it.repeat]}</span>` : ""}
                            ${it.due ? `<button type="button" class="icon-btn td-x" data-act="due" data-v="none" aria-label="Remove date" title="Remove date">${icon("close")}</button>` : ""}
                        </div>
                    </div>
                    <div class="td-prop">
                        <span class="td-prop-i" title="Priority">${icon("flag")}</span>
                        <div class="td-prop-c td-priseg" role="group" aria-label="Priority">
                            ${[0, 1, 2, 3].map((v) => `<button type="button" class="td-pseg" data-act="pri" data-v="${v}" data-k="pri:${v}" aria-pressed="${it.priority === v}"
                                ${v ? `style="${roleVars(PRI_ROLE[v], "p")}" aria-label="Priority ${v}"` : 'aria-label="No priority"'}>${v ? `<b aria-hidden="true">${"!".repeat(4 - v)}</b>P${v}` : "None"}</button>`).join("")}
                        </div>
                    </div>
                    <div class="td-prop">
                        <span class="td-prop-i" title="Tags">${icon("tag")}</span>
                        <div class="td-prop-c td-tags-ed">
                            ${it.tags.map((t) => `<span class="td-tchip" style="${roleVars(tagRole(t))}">#${esc(t)}<button type="button" class="td-tchip-x" data-act="tag-del" data-v="${esc(t)}" aria-label="Remove tag ${esc(t)}">${icon("close")}</button></span>`).join("")}
                            <input class="td-tag-in" data-k="e-tag" maxlength="30" placeholder="${it.tags.length ? "Add" : "Add tag"}" aria-label="Add tag, Enter to add">
                            <span class="td-tag-sugg"></span>
                        </div>
                    </div>
                    <div class="td-prop">
                        <span class="td-prop-i" title="List">${icon("list")}</span>
                        <div class="td-prop-c" role="group" aria-label="List">
                            ${S.lists.map((l) => `<button type="button" class="td-lchip td-lchip-s" data-act="set-list" data-v="${l.id}" data-k="sl:${l.id}" aria-pressed="${it.listId === l.id}" style="${roleVars(l.color)}"><span class="td-dot"></span>${esc(l.name)}</button>`).join("")}
                        </div>
                    </div>
                    ${list.sections.length ? `<div class="td-prop">
                        <span class="td-prop-i" title="Section">${icon("section")}</span>
                        <div class="td-prop-c" role="group" aria-label="Section">
                            ${[{ id: "", name: "No section" }, ...list.sections].map((sec) => `<button type="button" class="td-lchip td-lchip-s" data-act="set-sec" data-v="${sec.id}" data-k="ss:${sec.id}" aria-pressed="${(it.sectionId || "") === sec.id}">${esc(sec.name)}</button>`).join("")}
                        </div>
                    </div>` : ""}
                </div>
                <div class="td-ed-foot">
                    <button type="button" class="td-text-btn td-focus-btn" data-act="focus" data-k="e-focus" aria-pressed="${focused}" ${it.done ? "disabled" : ""}
                        title="Pin to the top of the column">${icon("focus")}${focused ? "Focused" : "Focus"}</button>
                    <span class="td-flex"></span>
                    <button type="button" class="td-text-btn td-danger" data-act="delete" data-k="e-del">${icon("delete")}Delete</button>
                </div>
            </div>
        </li>`;
    }

    function pickerHTML(it) {
        const base = it.due ? parseYmd(it.due) : todayD();
        const m = ui.cal || new Date(base.getFullYear(), base.getMonth(), 1);
        ui.cal = m;
        const t = todayS(), y = m.getFullYear(), mo = m.getMonth();
        const start = new Date(y, mo, 1 - new Date(y, mo, 1).getDay());
        const weeks = Math.ceil((new Date(y, mo, 1).getDay() + daysIn(y, mo)) / 7);
        const focusDay = ui.calFocus && ui.calFocus.slice(0, 7) === `${y}-${pad(mo + 1)}` ? ui.calFocus
            : it.due && it.due.slice(0, 7) === `${y}-${pad(mo + 1)}` ? it.due
            : t.slice(0, 7) === `${y}-${pad(mo + 1)}` ? t : `${y}-${pad(mo + 1)}-01`;
        let cells = "";
        for (let i = 0; i < weeks * 7; i++) {
            const d = addDays(start, i), s = ymd(d);
            const cls = (d.getMonth() !== mo ? " is-other" : "") + (s === t ? " is-today" : "") + (s === it.due ? " is-sel" : "") + (s < t ? " is-past" : "");
            cells += `<button type="button" class="td-day${cls}" data-act="due-date" data-v="${s}" data-k="d:${s}" tabindex="${s === focusDay ? 0 : -1}"
                aria-pressed="${s === it.due}" aria-label="${DAYS_LONG[d.getDay()]}, ${MONTHS_LONG[d.getMonth()]} ${d.getDate()}">${d.getDate()}</button>`;
        }
        const t0 = todayD();
        const quick = [["today", "Today", t0], ["tomorrow", "Tomorrow", addDays(t0, 1)], ["weekend", "Weekend", weekendD()],
            ["nextweek", "Next week", nextWeekday(1, false)]];
        const tchips = [["09:00", "9 AM"], ["12:00", "Noon"], ["17:00", "5 PM"]];
        const EVERY = { daily: "every day", weekdays: "every weekday", weekly: "every week", monthly: "every month" };
        const summary = it.due ? `${fmtDate(it.due, true)}${it.time ? " at " + fmtTime(it.time) : ""}${it.repeat ? ", " + EVERY[it.repeat] : ""}` : "No date yet";
        return `<div class="td-pop-head">
                <h3 class="td-pop-t">Schedule</h3>
                <span class="td-pop-sum${it.due ? (isOverdue(it) ? " is-over" : "") : " is-none"}" aria-live="polite">${esc(summary)}</span>
            </div>
            <div class="td-quick" role="group" aria-label="Quick dates">${quick.map(([v, l, d]) => `<button type="button" class="td-qbtn td-qday" data-act="due" data-v="${v}" data-k="q:${v}"
                aria-pressed="${it.due === ymd(d)}" aria-label="${l}, ${DAYS_LONG[d.getDay()]} ${MONTHS_LONG[d.getMonth()]} ${d.getDate()}"><span>${l}</span><small>${DAYS[d.getDay()]} ${d.getDate()}</small></button>`).join("")}</div>
            <input class="td-nl" data-k="e-nl" maxlength="80" placeholder="Or type: fri 5pm, in 3 days, every mon" aria-label="Type a date, then Enter">
            <div class="td-cal">
                <div class="td-cal-head">
                    <span class="td-cal-m" aria-live="polite">${MONTHS_LONG[mo]} ${y}</span>
                    <button type="button" class="icon-btn" data-act="cal" data-v="-1" data-k="cal-prev" aria-label="Previous month" title="Previous month (Page Up)">${icon("left")}</button>
                    <button type="button" class="icon-btn" data-act="cal" data-v="1" data-k="cal-next" aria-label="Next month" title="Next month (Page Down)">${icon("right")}</button>
                </div>
                <div class="td-cal-grid">${DAYS.map((d) => `<span class="td-dow" aria-hidden="true">${d.slice(0, 2)}</span>`).join("")}${cells}</div>
            </div>
            <div class="td-pop-row td-time-row">
                <span class="td-prop-i" title="Time">${icon("time")}</span>
                <span class="td-time-box">
                    <input class="td-time-in" data-k="e-time" maxlength="10" value="${it.time ? fmtTime(it.time) : ""}" placeholder="Time" aria-label="Time, like 5pm or 17:30, then Enter">
                    ${it.time ? `<button type="button" class="td-time-x" data-act="time" data-v="" data-k="t-x" aria-label="Remove time" title="Remove time">${icon("close")}</button>` : ""}
                </span>
                ${tchips.map(([v, l]) => `<button type="button" class="td-qbtn td-qbtn-s" data-act="time" data-v="${v}" data-k="t:${v}" aria-pressed="${it.time === v}">${l}</button>`).join("")}
            </div>
            <div class="td-pop-row td-rep-row" role="group" aria-label="Repeat">
                <span class="td-prop-i" title="Repeat">${icon("repeat")}</span>
                ${[["", "Off"], ...REPEATS.map((r) => [r, REPEAT_LABEL[r]])].map(([v, l]) => `<button type="button" class="td-qbtn td-qbtn-s" data-act="repeat" data-v="${v}" data-k="r:${v}" aria-pressed="${(it.repeat || "") === v}">${l}</button>`).join("")}
            </div>
            <div class="td-pop-foot">
                <button type="button" class="td-text-btn td-pop-clear" data-act="due" data-v="none" data-k="p-clear" ${it.due ? "" : "disabled"}>${icon("close")}Clear</button>
                <button type="button" class="td-pop-done" data-act="pop-done" data-k="p-done">Done</button>
            </div>`;
    }
    // Saturday, or today when it is already the weekend (same rule as typing "weekend").
    function weekendD() { const t = todayD(); return t.getDay() === 6 || t.getDay() === 0 ? t : addDays(t, 6 - t.getDay()); }

    // ---- date pop-out ----------------------------------------------------------------------------------------------
    // Extrudes from the column's right edge like a Caelestia drawer: same surface, concave necks where it meets the
    // column, grows out of the date pill's row (width and height), content fades in a beat later. In a half or full
    // width column it opens inside the column next to the pill instead. Folded: there is no editor, so it never opens.
    const POP_W = 400, NECK = 22, EDGE_R = 32;
    let popAnim = null, popMode = null, popNub = null, popClosing = false;
    const popEase = "cubic-bezier(0.38, 1.21, 0.22, 1)";            // expressive spatial (overshoots a little)
    const popEaseOut = "cubic-bezier(0.3, 0, 0.8, 0.15)";            // emphasized accelerate
    const rootCls = (c) => document.documentElement.classList.contains(c);
    const zoomOf = () => { const r = col.getBoundingClientRect(); return r.width / (col.offsetWidth || r.width) || 1; };
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

    function popGeom(pill) {
        const z = zoomOf();
        const cr = col.getBoundingClientRect(), pr = pill.getBoundingClientRect();
        const c = { l: cr.left / z, r: cr.right / z, t: cr.top / z, b: cr.bottom / z };
        const p = { l: pr.left / z, r: pr.right / z, t: pr.top / z, b: pr.bottom / z };
        const vw = window.innerWidth / z, vh = window.innerHeight / z;
        pop.classList.remove("is-compact");
        let H = popIn.offsetHeight;
        const room = Math.min(c.b, vh) - Math.max(c.t, 0) - 2 * (EDGE_R + NECK);
        if (H > room) { pop.classList.add("is-compact"); H = popIn.offsetHeight; }
        const W = POP_W;
        let mode = "edge", left = c.r;
        const wideCol = rootCls("wide-todo") || rootCls("full-todo");
        // Inside a wide column it sits just right of the editor's pills, so it covers none of them.
        let pillsR = p.r;
        for (const el of col.querySelectorAll(".td-item.is-open .td-props .td-prop-c > *")) {
            const r = el.getBoundingClientRect();
            if (r.width) pillsR = Math.max(pillsR, r.right / z);
        }
        if ((wideCol && c.r - pillsR >= W + 40) || vw - c.r < W + 12) {
            mode = "inside";
            left = clamp(pillsR + 24, c.l + 12, Math.min(c.r, vw) - W - 12);
        }
        const lo = mode === "edge" ? c.t + EDGE_R + NECK : Math.max(c.t, 0) + 12;
        const hi = (mode === "edge" ? c.b - EDGE_R - NECK : Math.min(c.b, vh) - 12) - H;
        // The header row lines up with the date pill (clamped so the whole panel stays on the column and on screen).
        const top = clamp(p.t + (p.b - p.t) / 2 - 22, lo, Math.max(lo, hi));
        const nubH = (p.b - p.t) + 12;
        const nub = { left: mode === "edge" ? c.r : left, top: p.t - 6, width: 0, height: nubH };
        return { mode, left, top, width: W, height: H, nub };
    }
    function setBox(g) {
        pop.style.left = g.left + "px";
        pop.style.top = g.top + "px";
        pop.style.width = g.width + "px";
        pop.style.height = g.height + "px";
    }
    function popSurface() {
        // Same surface as the column (its exact color and glass), whatever its mode (normal, narrow, wide, full).
        const cs = getComputedStyle(col);
        pop.style.setProperty("--tdp-bg", cs.backgroundColor);
        pop.style.setProperty("--tdp-blur", cs.backdropFilter && cs.backdropFilter !== "none" ? cs.backdropFilter : "blur(18px) saturate(1.1)");
    }
    const keyframe = (g) => ({ left: g.left + "px", top: g.top + "px", width: g.width + "px", height: g.height + "px" });

    function renderPicker() {
        const it = ui.open && find(ui.open);
        const blocked = rootCls("fold-todo") || rootCls("no-todo");
        const pill = it && ui.picker && !blocked ? col.querySelector('[data-k="e-due"]') : null;
        if (!pill) { ui.picker = false; closePop(); return; }
        pill.setAttribute("aria-expanded", "true");
        if (!pop.hidden && !popClosing) {
            popIn.innerHTML = pickerHTML(it);
            placePop();
            return;
        }
        openPop(pill, it);
    }
    function openPop(pill, it) {
        if (popAnim) { popAnim.cancel(); popAnim = null; }
        pop.getAnimations({ subtree: true }).forEach((a) => a.cancel());
        popClosing = false;
        pop.inert = false;
        pop.hidden = false;
        popSurface();
        popIn.innerHTML = pickerHTML(it);
        const g = popGeom(pill);
        popMode = g.mode;
        popNub = g.nub;
        pop.classList.toggle("is-inside", g.mode === "inside");
        pop.classList.toggle("is-edge", g.mode === "edge");
        setBox(g);
        if (reduced()) return;
        const from = Object.assign({}, g.nub, g.mode === "inside" ? { left: g.left } : {});
        popAnim = pop.animate([keyframe(from), keyframe(g)], { duration: 300, easing: popEase });
        popAnim.onfinish = () => { popAnim = null; };
        popIn.animate([{ opacity: 0, transform: "translateX(-10px)" }, { opacity: 1, transform: "none" }],
            { duration: 200, delay: 90, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "backwards" });
    }
    function placePop() {
        if (pop.hidden || popClosing) return;
        const pill = col.querySelector('[data-k="e-due"]');
        if (!pill) return;
        if (popAnim) { popAnim.finish(); popAnim = null; }
        const g = popGeom(pill);
        if (g.mode !== popMode) {
            popMode = g.mode;
            pop.classList.toggle("is-inside", g.mode === "inside");
            pop.classList.toggle("is-edge", g.mode === "edge");
            popSurface();
        }
        popNub = g.nub;
        setBox(g);
    }
    function closePop() {
        if (pop.hidden || popClosing) return;
        const pill = col.querySelector('[data-k="e-due"]');
        if (pill) pill.setAttribute("aria-expanded", "false");
        const done = () => {
            popClosing = false;
            popAnim = null;
            pop.getAnimations({ subtree: true }).forEach((a) => a.cancel());
            pop.hidden = true;
            pop.inert = false;
            popIn.innerHTML = "";
        };
        if (reduced() || !popNub) { done(); return; }
        popClosing = true;
        pop.inert = true;
        if (popAnim) { popAnim.cancel(); popAnim = null; }
        const cur = { left: parseFloat(pop.style.left), top: parseFloat(pop.style.top), width: parseFloat(pop.style.width), height: parseFloat(pop.style.height) };
        let nub = popNub;
        if (pill && col.contains(pill)) {
            const z = zoomOf(), pr = pill.getBoundingClientRect();
            nub = Object.assign({}, nub, { top: pr.top / z - 6, height: pr.height / z + 12 });
        }
        if (popMode === "inside") nub = Object.assign({}, nub, { left: cur.left });
        popIn.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 90, easing: "linear", fill: "forwards" });
        popAnim = pop.animate([keyframe(cur), keyframe(nub)], { duration: 210, easing: popEaseOut, fill: "forwards" });
        popAnim.onfinish = done;
    }
    function closePicker(refocus) {
        if (!ui.picker) return;
        ui.picker = false;
        renderPicker();
        if (refocus) { const d = col.querySelector('[data-k="e-due"]'); if (d) d.focus({ preventScroll: true }); }
    }
    body.addEventListener("scroll", () => { if (ui.picker) placePop(); }, { passive: true });
    window.addEventListener("resize", () => { if (ui.picker) placePop(); });
    if (window.ResizeObserver) new ResizeObserver(() => { if (ui.picker) placePop(); }).observe(col);
    // Folding (or hiding) the column closes the pop-out; switching normal, half and full moves it.
    new MutationObserver(() => {
        if (!ui.picker) return;
        if (rootCls("fold-todo") || rootCls("no-todo")) closePicker(false);
        else requestAnimationFrame(placePop);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // Groups and views -----------------------------------------------------------------------------------------
    function groupHTML(g) {
        return `<section class="td-group${g.cls ? " " + g.cls : ""}">
            ${g.head ? `<div class="td-gh"><h3 class="td-gh-t">${g.head}</h3>${g.count ? `<span class="td-gh-n">${g.count}</span>` : ""}<span class="td-flex"></span>${g.actions || ""}</div>` : ""}
            <ul class="td-ul">${g.items.map((i) => rowHTML(i, g.opts)).join("")}</ul>
        </section>`;
    }
    function doneHTML(items, scope) {
        if (!items.length) return "";
        items = items.slice().sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
        const shown = items.slice(0, 60);
        return `<section class="td-done">
            <div class="td-gh">
                <button type="button" class="td-done-toggle" data-act="toggle-done" data-k="done-t" aria-expanded="${ui.doneOpen}">${icon("expand")}${items.length} done</button>
                <span class="td-flex"></span>
                ${ui.doneOpen ? `<button type="button" class="td-text-btn" data-act="clear-done" data-v="${scope}" data-k="done-clear">Clear</button>` : ""}
            </div>
            ${ui.doneOpen ? `<ul class="td-ul">${shown.map((i) => rowHTML(i, { showList: scope !== "list" })).join("")}</ul>
                ${items.length > shown.length ? `<button type="button" class="td-text-btn td-more" data-act="view" data-v="done">Show all ${items.length} in Done</button>` : ""}` : ""}
        </section>`;
    }
    function emptyHTML(kind, extra) {
        const E = {
            today: [icon("sun"), "Nothing due today.", "Add something above. Try “finish essay 5pm !!”."],
            todayDone: [icon("doneAll"), "All clear for today.", "Everything due today is done."],
            upcoming: [icon("event"), "Nothing scheduled.", "Add a date with words like “fri”, “nov 20” or “in 3 days”."],
            all: [icon("inbox"), "No to-dos yet.", "Type one above and press Enter."],
            done: [icon("doneAll"), "Nothing done yet.", "Finished to-dos collect here."],
            list: [icon("list"), `${extra ? esc(extra.name) : "This list"} is empty.`, "Add something above and it lands here."],
            search: [icon("search"), "No matches.", "Try fewer words, or pick a different tag."],
            searchIdle: [icon("search"), "Search your to-dos.", "Words match titles, notes and subtasks. Tags below narrow it down."],
        }[kind];
        return `<div class="td-empty">${E[0]}<p class="td-empty-t">${E[1]}</p><p class="td-empty-s">${E[2]}</p></div>`;
    }

    function renderBody() {
        let h = "";
        if (ui.search) h = searchHTML();
        else {
            const v = S.view, focus = focusItem();
            const skip = focus && v !== "done" ? focus.id : null;
            if (skip) {
                h += groupHTML({ cls: "td-g-focus", head: `${icon("focus")}Focus`, items: [focus], opts: { showList: true },
                    actions: `<button type="button" class="td-text-btn" data-act="unfocus" data-k="unfocus">Unpin</button>` });
            }
            if (v === "today") h += todayHTML(skip);
            else if (v === "upcoming") h += upcomingHTML(skip);
            else if (v === "all") h += allHTML(skip);
            else if (v === "done") h += doneViewHTML();
            else h += listHTML(v.slice(5), skip);
        }
        body.innerHTML = h;
    }

    function todayHTML(skip) {
        const t = todayS();
        const open = S.items.filter((i) => !i.done && i.id !== skip && i.due && i.due <= t);
        const over = open.filter((i) => i.due < t).sort(byDue);
        const tod = open.filter((i) => i.due === t).sort(byTime);
        const doneT = S.items.filter((i) => i.done && isTodayMs(i.completedAt));
        let h = "";
        if (over.length) {
            h += groupHTML({ cls: "td-g-over", head: "Overdue", count: over.length, items: over, opts: { showList: true },
                actions: `<button type="button" class="td-text-btn" data-act="move-overdue" data-k="move-over" title="Move every overdue to-do to today">Move to today</button>` });
        }
        if (tod.length) {
            const d = todayD();
            h += groupHTML({ head: `Today<span class="td-gh-sub">${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}</span>`, items: tod, opts: { showList: true } });
        }
        const f = skip && focusItem();
        if (!open.length && !(f && f.due && f.due <= t)) h += emptyHTML(doneT.length ? "todayDone" : "today");
        return h + doneHTML(doneT, "today");
    }
    function upcomingHTML(skip) {
        const t = todayS();
        const items = S.items.filter((i) => !i.done && i.id !== skip && i.due && i.due > t).sort(byDue);
        const f = skip && focusItem();
        if (!items.length) return f && f.due && f.due > t ? "" : emptyHTML("upcoming");
        const days = new Map();
        items.forEach((i) => { if (!days.has(i.due)) days.set(i.due, []); days.get(i.due).push(i); });
        let h = "";
        for (const [due, arr] of days) {
            const d = parseYmd(due), n = dayDiff(due);
            const md = `${MONTHS[d.getMonth()]} ${d.getDate()}${d.getFullYear() !== new Date().getFullYear() ? ", " + d.getFullYear() : ""}`;
            const head = n === 1 ? `Tomorrow<span class="td-gh-sub">${DAYS[d.getDay()]}, ${md}</span>`
                : n < 7 ? `${DAYS_LONG[d.getDay()]}<span class="td-gh-sub">${md}</span>`
                : `${DAYS[d.getDay()]}, ${md}<span class="td-gh-sub">in ${n} days</span>`;
            h += groupHTML({ head, items: arr.sort(byTime), opts: { showList: true, noDate: true } });
        }
        return h;
    }
    function allHTML(skip) {
        const open = S.items.filter((i) => !i.done && i.id !== skip);
        let h = "";
        for (const l of S.lists) {
            const secIdx = (i) => (i.sectionId ? l.sections.findIndex((s) => s.id === i.sectionId) + 1 : 0);
            const arr = open.filter((i) => i.listId === l.id).sort((a, b) => secIdx(a) - secIdx(b) || a.order - b.order);
            if (!arr.length) continue;
            h += groupHTML({ cls: "td-g-list", head: `<span class="td-dot" style="${roleVars(l.color)}"></span>${esc(l.name)}`, count: arr.length, items: arr, opts: {} });
        }
        if (!open.length && !skip) h += emptyHTML("all");
        return h + doneHTML(S.items.filter((i) => i.done), "all");
    }
    function doneViewHTML() {
        const items = S.items.filter((i) => i.done).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
        if (!items.length) return emptyHTML("done");
        const days = new Map();
        items.forEach((i) => { const k = ymd(new Date(i.completedAt || 0)); if (!days.has(k)) days.set(k, []); days.get(k).push(i); });
        let h = "", first = true;
        for (const [day, arr] of days) {
            h += groupHTML({ head: fmtDate(day, true), count: arr.length, items: arr, opts: { showList: true },
                actions: first ? `<button type="button" class="td-text-btn" data-act="clear-done" data-v="all" data-k="done-clear">Clear all</button>` : "" });
            first = false;
        }
        return h;
    }
    function listHTML(id, skip) {
        const list = listById(id);
        const items = S.items.filter((i) => !i.done && i.listId === list.id && i.id !== skip);
        const bySec = new Map([[null, []]]);
        list.sections.forEach((s) => bySec.set(s.id, []));
        items.forEach((i) => (bySec.get(i.sectionId) || bySec.get(null)).push(i));
        for (const arr of bySec.values()) arr.sort(byOrder);
        let h = `<ul class="td-ul td-flow" data-list="${list.id}" aria-label="${esc(list.name)}. Drag or Alt+Up and Alt+Down to reorder">`;
        h += bySec.get(null).map((i) => rowHTML(i, { drag: true })).join("");
        for (const sec of list.sections) {
            const arr = bySec.get(sec.id);
            h += `<li class="td-sec" data-sec="${sec.id}">${ui.renameSec === sec.id
                ? `<input class="td-sec-in" data-k="sec:${sec.id}" value="${esc(sec.name)}" maxlength="40" aria-label="Section name, Enter to save">`
                : `<button type="button" class="td-sec-t" data-act="sec-collapse" data-v="${sec.id}" data-k="sect:${sec.id}" aria-expanded="${!sec.collapsed}">${icon("expand")}${esc(sec.name)}${arr.length ? `<span class="td-gh-n">${arr.length}</span>` : ""}</button>
                   <span class="td-flex"></span>
                   <button type="button" class="icon-btn td-sec-b" data-act="sec-rename" data-v="${sec.id}" aria-label="Rename section ${esc(sec.name)}">${icon("edit")}</button>
                   <button type="button" class="icon-btn td-sec-b" data-act="sec-del" data-v="${sec.id}" aria-label="Delete section ${esc(sec.name)}">${icon("delete")}</button>`}</li>`;
            if (!sec.collapsed) h += arr.map((i) => rowHTML(i, { drag: true })).join("");
        }
        h += `</ul>`;
        const f = skip && focusItem();
        if (!items.length && !list.sections.length && !(f && f.listId === list.id)) h += emptyHTML("list", list);
        h += `<div class="td-list-foot"><button type="button" class="td-text-btn" data-act="add-section" data-k="add-sec">${icon("add")}Add section</button></div>`;
        return h + doneHTML(S.items.filter((i) => i.done && i.listId === list.id), "list");
    }
    function searchHTML() {
        const words = ui.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (!words.length && !ui.tag) return emptyHTML("searchIdle");
        const hay = (i) => [i.title, i.notes, ...i.subtasks.map((s) => s.title), ...i.tags.map((t) => "#" + t), listById(i.listId).name].join("\n").toLowerCase();
        const match = (i) => (!ui.tag || i.tags.includes(ui.tag)) && words.every((w) => hay(i).includes(w));
        const open = S.items.filter((i) => !i.done && match(i)).sort(byDue);
        const done = S.items.filter((i) => i.done && match(i));
        ui.searchDone = new Set(done.map((i) => i.id));
        if (!open.length && !done.length) return emptyHTML("search");
        return (open.length ? groupHTML({ head: plural(open.length, "match").replace("matchs", "matches"), items: open, opts: { showList: true } }) : "")
            + doneHTML(done, "search");
    }

    // Sheet (lists, tags, data, keys) --------------------------------------------------------------------------
    function paletteHTML(target, current) {
        return `<div class="td-palette" role="group" aria-label="Pick a color">${PALETTE.map((r) => `<button type="button" class="td-swatch" data-act="set-color" data-v="${r}" data-for="${esc(target)}"
            data-k="pc:${r}" aria-pressed="${current === r}" aria-label="${ROLE_LABEL[r]}" title="${ROLE_LABEL[r]}" style="${roleVars(r)}"><span class="td-dot"></span></button>`).join("")}</div>`;
    }
    function renderSheet() {
        sheet.hidden = !ui.sheet;
        $(".td-menu-btn").setAttribute("aria-expanded", String(ui.sheet));
        // The sheet covers the column: keep focus and the accessibility tree inside it (the snackbar stays live).
        for (const el of [$(".td-head"), $(".td-top"), body]) el.inert = ui.sheet;
        if (!ui.sheet) { sheet.innerHTML = ""; return; }
        const counts = {};
        S.items.forEach((i) => { if (!i.done) counts[i.listId] = (counts[i.listId] || 0) + 1; });
        const tagCounts = new Map();
        S.items.forEach((i) => i.tags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) || 0) + (i.done ? 0 : 1))));
        const tags = [...tagCounts.keys()].sort();
        sheet.innerHTML = `
            <div class="td-sheet-head">
                <h3 class="panel-title td-sheet-h">Organize</h3>
                <span class="td-flex"></span>
                <button type="button" class="icon-btn" data-act="sheet" data-k="sh-close" aria-label="Close (Esc)" title="Close (Esc)">${icon("close")}</button>
            </div>
            <div class="td-sheet-body">
                <h4 class="td-sh-t">Lists</h4>
                <ul class="td-lm">${S.lists.map((l) => `
                    <li class="td-lm-row">
                        <button type="button" class="td-swatch" data-act="color-for" data-v="list:${l.id}" data-k="lc:${l.id}" aria-expanded="${ui.colorFor === "list:" + l.id}"
                            aria-label="Color of ${esc(l.name)}" title="Change color" style="${roleVars(l.color)}"><span class="td-dot"></span></button>
                        <input class="td-lm-name" data-k="ln:${l.id}" data-lid="${l.id}" value="${esc(l.name)}" maxlength="40" aria-label="Name of list ${esc(l.name)}">
                        <span class="td-n">${counts[l.id] || ""}</span>
                        ${l.id === "inbox" ? '<span class="td-lm-sp"></span>' : `<button type="button" class="icon-btn" data-act="list-del" data-v="${l.id}" data-k="ld:${l.id}" aria-label="Delete list ${esc(l.name)}">${icon("delete")}</button>`}
                    </li>
                    ${ui.colorFor === "list:" + l.id ? `<li>${paletteHTML("list:" + l.id, l.color)}</li>` : ""}
                    ${ui.confirmDel === l.id ? `<li class="td-confirm">
                        <p>Delete “${esc(l.name)}”?${counts[l.id] ? ` Its ${plural(counts[l.id], "to-do")} move to Inbox.` : ""}</p>
                        <div class="td-confirm-b">
                            <button type="button" class="td-text-btn" data-act="list-del-no" data-k="ldn">Cancel</button>
                            <button type="button" class="td-danger-btn" data-act="list-del-yes" data-v="${l.id}" data-k="ldy">Delete list</button>
                        </div>
                    </li>` : ""}`).join("")}
                </ul>
                <form class="td-newlist" autocomplete="off">
                    <input class="td-nl-in" data-k="newlist" maxlength="40" placeholder="New list name" aria-label="New list name">
                    <button type="submit" class="btn-tonal td-btn-s">Add list</button>
                </form>
                <h4 class="td-sh-t">Tags</h4>
                ${tags.length ? `<ul class="td-lm">${tags.map((t) => `
                    <li class="td-lm-row">
                        <button type="button" class="td-swatch" data-act="color-for" data-v="tag:${esc(t)}" data-k="tc:${esc(t)}" aria-expanded="${ui.colorFor === "tag:" + t}"
                            aria-label="Color of tag ${esc(t)}" title="Change color" style="${roleVars(tagRole(t))}"><span class="td-dot"></span></button>
                        <span class="td-lm-tag" style="${roleVars(tagRole(t))}">#${esc(t)}</span>
                        <span class="td-n">${tagCounts.get(t) || ""}</span>
                        <button type="button" class="icon-btn" data-act="tag-remove" data-v="${esc(t)}" data-k="tr:${esc(t)}" aria-label="Remove tag ${esc(t)} from every to-do">${icon("delete")}</button>
                    </li>
                    ${ui.colorFor === "tag:" + t ? `<li>${paletteHTML("tag:" + t, tagRole(t))}</li>` : ""}`).join("")}</ul>`
                    : `<p class="td-hint">No tags yet. Type #name when adding a to-do.</p>`}
                <h4 class="td-sh-t">Your data</h4>
                <div class="td-data">
                    <button type="button" class="btn-tonal td-btn-s" data-act="export" data-k="export">${icon("download")}Export</button>
                    <button type="button" class="btn-tonal td-btn-s" data-act="import" data-k="import">${icon("upload")}Import</button>
                    <input type="file" class="td-file" accept="application/json,.json" hidden>
                </div>
                <p class="td-hint">${ui.sheetMsg ? esc(ui.sheetMsg) : "Export saves lists and to-dos as a JSON file. Import replaces them, with undo."}</p>
                <h4 class="td-sh-t">Keyboard</h4>
                <dl class="td-keys">
                    <dt><kbd>n</kbd></dt><dd>Add a to-do</dd>
                    <dt><kbd>/</kbd></dt><dd>Search</dd>
                    <dt><kbd>↑</kbd> <kbd>↓</kbd></dt><dd>Move between to-dos</dd>
                    <dt><kbd>Space</kbd></dt><dd>Mark done</dd>
                    <dt><kbd>Enter</kbd></dt><dd>Open</dd>
                    <dt><kbd>Esc</kbd></dt><dd>Close</dd>
                    <dt><kbd>Alt</kbd> <kbd>↑</kbd> <kbd>↓</kbd></dt><dd>Reorder in a list</dd>
                    <dt><kbd>Del</kbd></dt><dd>Delete, with undo</dd>
                </dl>
            </div>`;
    }

    // ---- quick add -----------------------------------------------------------------------------------------------
    function quickChips() {
        const raw = addIn.value.trim();
        const box = $(".td-qchips");
        if (!raw) { box.innerHTML = ""; box.classList.remove("is-on"); return; }
        const p = parseQuick(raw, S.lists);
        const chips = [];
        const implicitToday = !p.due && S.view === "today";
        if (p.due || implicitToday) {
            const due = p.due || todayS();
            const n = dayDiff(due);
            chips.push(`<span class="td-qchip td-due${n < 0 ? " is-over" : n === 0 ? " is-today" : ""}${implicitToday ? " is-implicit" : ""}">${icon("event")}${esc(fmtDate(due, true))}</span>`);
        }
        if (p.time) chips.push(`<span class="td-qchip td-due">${icon("time")}${fmtTime(p.time)}</span>`);
        if (p.repeat) chips.push(`<span class="td-qchip td-due">${icon("repeat")}${REPEAT_LABEL[p.repeat]}</span>`);
        if (p.priority) chips.push(`<span class="td-qchip td-qpri" style="${roleVars(PRI_ROLE[p.priority], "p")}">${icon("flag")}P${p.priority}</span>`);
        p.tags.forEach((t) => chips.push(`<span class="td-qchip td-tchip" style="${roleVars(tagRole(t))}">#${esc(t)}</span>`));
        const viewList = S.view.startsWith("list:") ? S.view.slice(5) : "inbox";
        if (p.newList) chips.push(`<span class="td-qchip td-qlist">${icon("add")}New list ${esc(p.newList)}</span>`);
        else {
            const l = listById(p.listId || viewList);
            chips.push(`<span class="td-qchip td-qlist${p.listId ? "" : " is-implicit"}" style="${roleVars(l.color)}"><span class="td-dot"></span>${esc(l.name)}</span>`);
        }
        box.innerHTML = chips.join("") + (p.title ? "" : `<span class="td-hint">Add a title too</span>`);
        box.classList.add("is-on");
    }
    function addFromQuick() {
        const raw = addIn.value.trim();
        if (!raw) return;
        const p = parseQuick(raw, S.lists);
        if (!p.title) { addIn.closest(".td-field").classList.remove("is-shake"); void addIn.offsetWidth; addIn.closest(".td-field").classList.add("is-shake"); return; }
        let listId = p.listId;
        if (p.newList) {
            const l = { id: uid(), name: p.newList.slice(0, 40), color: ROLES[S.lists.length % 3], sections: [] };
            S.lists.push(l);
            listId = l.id;
        }
        if (!listId) listId = S.view.startsWith("list:") ? S.view.slice(5) : "inbox";
        const due = p.due || (S.view === "today" ? todayS() : null);
        const same = S.items.filter((i) => i.listId === listId && !i.done && !i.sectionId);
        const it = {
            id: uid(), title: p.title, notes: "", listId, sectionId: null, due, time: due ? p.time : null,
            priority: p.priority, tags: p.tags, repeat: p.repeat, subtasks: [], done: false, completedAt: null,
            createdAt: Date.now(), order: same.length ? Math.min(...same.map((i) => i.order)) - 1 : 0,
        };
        S.items.push(it);
        addIn.value = "";
        quickChips();
        ui.lastAdded = it.id;
        ui.cursor = it.id;
        commit();
        if (!visibleInView(it)) {
            const l = listById(listId);
            snack(`Added to ${l.name}${due ? ", due " + relDate(due) : ""}`, "Show", () => showItem(it.id, "list:" + listId));
        } else {
            const li = body.querySelector(`.td-item[data-id="${it.id}"]`);
            if (li) li.scrollIntoView({ block: "nearest" });
        }
    }
    function visibleInView(it) {
        const v = S.view, t = todayS();
        if (S.focusId === it.id && v !== "done") return true;
        if (v === "today") return !!it.due && it.due <= t;
        if (v === "upcoming") return !!it.due && it.due > t;
        if (v === "all") return true;
        if (v === "done") return false;
        return v === "list:" + it.listId;
    }

    // ---- actions -------------------------------------------------------------------------------------------------
    function setView(v) {
        if (ui.open) closeItem(false);
        S.view = v;
        ui.doneOpen = false;
        ui.renameSec = null;
        body.scrollTop = 0;
        commit();
    }
    // "Show" in a snackbar: leave search if needed, switch to the view that holds the item and put the cursor on it.
    function showItem(id, view) {
        if (ui.search) { ui.search = false; ui.q = ""; ui.tag = null; qIn.value = ""; }
        ui.cursor = id;
        setView(view);
        const b = $(`[data-k="open:${CSS.escape(id)}"]`);
        if (b) focusNav(b);
    }
    function openItem(id) {
        if (ui.open === id) { closeItem(true); return; }
        if (ui.open) finalizeOpen();
        const it = find(id);
        if (!it) return;
        ui.open = id;
        ui.cursor = id;
        ui.openTitle = it.title;
        ui.picker = false;
        ui.cal = null;
        ui.calFocus = null;
        render();
        const li = body.querySelector(".td-item.is-open");
        const ta = $(".td-ed-title");
        if (ta) { ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length); }
        if (li) scrollIntoBody(li.closest(".td-g-focus") || li);
    }
    function scrollIntoBody(el) {
        const b = body.getBoundingClientRect(), r = el.getBoundingClientRect();
        const z = b.height / (body.clientHeight || b.height) || 1;
        if (r.top < b.top) body.scrollTop -= (b.top - r.top) / z + 8;
        else if (r.bottom > b.bottom) body.scrollTop += Math.min((r.bottom - b.bottom) / z + 8, (r.top - b.top) / z - 8);
    }
    function finalizeOpen() {
        const it = ui.open && find(ui.open);
        if (!it) return;
        it.title = it.title.replace(/\s+/g, " ").trim();
        if (!it.title) it.title = ui.openTitle || "Untitled";
        it.subtasks = it.subtasks.filter((s) => s.title.trim());
        save();
    }
    function closeItem(refocus) {
        const id = ui.open;
        if (!id) return;
        finalizeOpen();
        ui.open = null;
        ui.picker = false;
        const hadFocus = col.contains(document.activeElement);
        render();
        if (refocus !== false && hadFocus) {
            const el = $(`[data-k="open:${CSS.escape(id)}"]`);
            if (el) { $$("[data-nav]").forEach((n) => (n.tabIndex = -1)); el.tabIndex = 0; el.focus({ preventScroll: true }); scrollIntoBody(el); }
        }
    }
    function toggleDone(id) {
        const it = find(id);
        if (!it || pendingDone.has(id)) return;
        if (it.done) { it.done = false; it.completedAt = null; commit(); return; }
        const li = body.querySelector(`.td-item[data-id="${CSS.escape(id)}"]`);
        if (li && !reduced()) {
            pendingDone.add(id);
            li.classList.add("is-completing");
            const chk = li.querySelector(".td-check");
            if (chk) chk.setAttribute("aria-checked", "true");
            setTimeout(() => { pendingDone.delete(id); completeNow(id); }, 560);
        } else completeNow(id);
    }
    function completeNow(id) {
        const it = find(id);
        if (!it || it.done) return;
        if (ui.open === id) { finalizeOpen(); ui.open = null; ui.picker = false; }
        if (it.repeat) {
            const copy = Object.assign(clone(it), { id: uid(), done: true, completedAt: Date.now(), repeat: null });
            S.items.push(copy);
            const prev = { due: it.due, subtasks: clone(it.subtasks) };
            it.due = nextDue(it.due || todayS(), it.repeat);
            it.subtasks.forEach((s) => (s.done = false));
            commit();
            snack(`Done. Next one ${relDate(it.due)}`, "Undo", () => {
                S.items = S.items.filter((x) => x.id !== copy.id);
                const cur = find(id);
                if (cur) { cur.due = prev.due; cur.subtasks = prev.subtasks; }
                commit();
            });
            return;
        }
        it.done = true;
        it.completedAt = Date.now();
        if (S.focusId === id) S.focusId = null;
        commit();
    }
    function deleteItem(id) {
        const idx = S.items.findIndex((i) => i.id === id);
        if (idx < 0) return;
        const [it] = S.items.splice(idx, 1);
        const wasFocus = S.focusId === id;
        if (wasFocus) S.focusId = null;
        if (ui.open === id) { ui.open = null; ui.picker = false; }
        commit();
        snack(`Deleted “${trunc(it.title || "Untitled", 28)}”`, "Undo", () => {
            if (!find(it.id)) S.items.splice(Math.min(idx, S.items.length), 0, it);
            if (wasFocus) S.focusId = it.id;
            commit();
        });
    }
    function setDue(it, v) {
        const t = todayD();
        if (v === "none") { it.due = null; it.time = null; it.repeat = null; }
        else it.due = ymd(v === "today" ? t : v === "tomorrow" ? addDays(t, 1) : v === "nextweek" ? nextWeekday(1, false) : v === "weekend" ? weekendD() : t);
        ui.picker = false;
    }
    function applyTimeText(it, text) {
        text = text.trim();
        if (!text) { it.time = null; return true; }
        const p = parseQuick(/^\d{1,2}$/.test(text) ? text + (+text < 7 || +text === 12 ? "pm" : +text > 12 ? ":00" : "am") : text, [], { keepDue: true, loose: true });
        if (!p.time) return false;
        it.time = p.time;
        if (!it.due) it.due = todayS();
        return true;
    }
    function shake(el) { if (!el) return; el.classList.remove("is-shake"); void el.offsetWidth; el.classList.add("is-shake"); }

    function act(name, v, el, e) {
        const li = el.closest(".td-item");
        const it = li ? find(li.dataset.id) : ui.open ? find(ui.open) : null;
        switch (name) {
            case "view": setView(v); break;
            case "search": openSearch(); break;
            case "search-close": closeSearch(); break;
            case "sheet": ui.sheet = !ui.sheet; ui.colorFor = null; ui.confirmDel = null; ui.sheetMsg = "";
                render(); (ui.sheet ? $('[data-k="sh-close"]') : $(".td-menu-btn")).focus(); break;
            case "new-list": ui.sheet = true; render(); $('[data-k="newlist"]').focus(); break;
            case "toggle": if (it) toggleDone(it.id); break;
            case "close": closeItem(true); break;
            case "picker":
                if (ui.picker) { closePicker(true); break; }
                if (rootCls("fold-todo")) break;
                ui.picker = true; ui.cal = null; ui.calFocus = null; render();
                if (ui.picker) { const nl = pop.querySelector('[data-k="e-nl"]'); if (nl) nl.focus({ preventScroll: true }); }
                break;
            case "pop-done": ui.picker = false; render(); { const d = col.querySelector('[data-k="e-due"]'); if (d) d.focus({ preventScroll: true }); } break;
            case "due": if (it) { setDue(it, v); commit(); const d = col.querySelector('[data-k="e-due"]'); if (d) d.focus(); } break;
            // A day in the calendar keeps the pop-out open (time and repeat can follow); Done or a click outside closes.
            case "due-date": if (it) { it.due = v; ui.calFocus = v; commit(); } break;
            case "cal": { const m = ui.cal || todayD(); ui.cal = new Date(m.getFullYear(), m.getMonth() + +v, 1); ui.calFocus = null; render(); break; }
            case "time": if (it) { it.time = v || null; if (v && !it.due) it.due = todayS(); commit(); } break;
            case "repeat": if (it) { it.repeat = v || null; if (v && !it.due) it.due = todayS(); commit(); } break;
            case "pri": if (it) { it.priority = +v; commit(); } break;
            case "tag-del": if (it) { it.tags = it.tags.filter((t) => t !== v); commit(); const ti = $('[data-k="e-tag"]'); if (ti) ti.focus(); } break;
            case "tag-add": if (it) { addTag(it, v); } break;
            case "set-list": if (it && it.listId !== v) {
                it.listId = v; it.sectionId = null;
                const same = S.items.filter((i) => i.listId === v && !i.done && i.id !== it.id);
                it.order = same.length ? Math.max(...same.map((i) => i.order)) + 1 : 0;
                commit();
            } break;
            case "set-sec": if (it) { it.sectionId = v || null; commit(); } break;
            case "focus": if (it && !it.done) { S.focusId = S.focusId === it.id ? null : it.id; commit(); } break;
            case "unfocus": S.focusId = null; commit(); break;
            case "delete": if (it) deleteItem(it.id); break;
            case "sub-toggle": if (it) { const s = it.subtasks.find((x) => x.id === el.closest(".td-sub").dataset.sid); if (s) { s.done = !s.done; commit(); } } break;
            case "sub-del": if (it) {
                const sid = el.closest(".td-sub").dataset.sid, i = it.subtasks.findIndex((x) => x.id === sid);
                it.subtasks.splice(i, 1); commit();
                const subs = $$(".td-sub-in");
                (subs[Math.max(0, i - 1)] || subs[0]).focus();
            } break;
            case "toggle-done": if (ui.open && ui.doneOpen && find(ui.open) && find(ui.open).done) closeItem(false); ui.doneOpen = !ui.doneOpen; render(); break;
            case "clear-done": clearDone(v); break;
            case "move-overdue": moveOverdue(); break;
            case "add-section": addSection(); break;
            case "sec-collapse": { const sec = curSection(v); if (sec) { sec.collapsed = !sec.collapsed; commit(); } break; }
            case "sec-rename": ui.renameSec = v; render(); { const si = $(`[data-k="sec:${CSS.escape(v)}"]`); if (si) { si.focus(); si.select(); } } break;
            case "sec-del": deleteSection(v); break;
            case "tagf": ui.tag = ui.tag === v ? null : v; render(); break;
            case "color-for": ui.colorFor = ui.colorFor === v ? null : v; render(); break;
            case "set-color": {
                const target = el.dataset.for || "";
                if (target.startsWith("list:")) { const l = S.lists.find((x) => x.id === target.slice(5)); if (l) l.color = v; }
                else if (target.startsWith("tag:")) S.tagColors[target.slice(4)] = v;
                ui.colorFor = null; commit();
                const back = $(`[data-k="${target.startsWith("list:") ? "lc:" + CSS.escape(target.slice(5)) : "tc:" + CSS.escape(target.slice(4))}"]`);
                if (back) back.focus();
                break;
            }
            case "list-del": ui.confirmDel = ui.confirmDel === v ? null : v; render(); { const y = $('[data-k="ldy"]'); if (y) y.focus(); } break;
            case "list-del-no": { const id = ui.confirmDel; ui.confirmDel = null; render(); const b = $(`[data-k="ld:${CSS.escape(id || "")}"]`); if (b) b.focus(); break; }
            case "list-del-yes": deleteList(v); break;
            case "tag-remove": removeTagEverywhere(v); break;
            case "export": exportData(); break;
            case "import": $(".td-file").click(); break;
            case "snack": { const fn = snackFn; hideSnack(); if (fn) fn(); break; }
            case "snack-x": hideSnack(); break;
            default: break;
        }
        void e;
    }

    function addTag(it, raw) {
        const t = cleanTag(raw);
        if (!t) return false;
        if (!it.tags.includes(t)) it.tags.push(t);
        commit();
        const ti = $('[data-k="e-tag"]');
        if (ti) { ti.value = ""; ti.focus(); }
        return true;
    }
    function clearDone(scope) {
        const view = S.view;
        const pick = (i) => i.done && (scope === "all" || (scope === "today" && isTodayMs(i.completedAt))
            || (scope === "list" && view === "list:" + i.listId) || (scope === "search" && ui.searchDone.has(i.id)));
        const removed = S.items.filter(pick);
        if (!removed.length) return;
        S.items = S.items.filter((i) => !pick(i));
        ui.doneOpen = false;
        commit();
        snack(`Cleared ${plural(removed.length, "done to-do")}`, "Undo", () => {
            const ids = new Set(S.items.map((i) => i.id));
            S.items.push(...removed.filter((i) => !ids.has(i.id)));
            commit();
        });
    }
    function moveOverdue() {
        const t = todayS();
        const moved = S.items.filter((i) => !i.done && i.due && i.due < t).map((i) => [i.id, i.due]);
        if (!moved.length) return;
        moved.forEach(([id]) => (find(id).due = t));
        commit();
        snack(`Moved ${plural(moved.length, "to-do")} to today`, "Undo", () => {
            moved.forEach(([id, due]) => { const i = find(id); if (i) i.due = due; });
            commit();
        });
    }
    const curList = () => (S.view.startsWith("list:") ? listById(S.view.slice(5)) : null);
    const curSection = (id) => { const l = curList(); return l && l.sections.find((s) => s.id === id); };
    function addSection() {
        const l = curList();
        if (!l) return;
        const sec = { id: uid(), name: "New section", collapsed: false };
        l.sections.push(sec);
        ui.renameSec = sec.id;
        commit();
        const si = $(`[data-k="sec:${CSS.escape(sec.id)}"]`);
        if (si) { si.focus(); si.select(); scrollIntoBody(si); }
    }
    function commitSecName(input, cancel) {
        const sec = curSection(input.closest(".td-sec").dataset.sec);
        ui.renameSec = null;
        if (sec && !cancel) sec.name = input.value.replace(/\s+/g, " ").trim().slice(0, 40) || sec.name;
        commit();
        if (sec) { const b = $(`[data-k="sect:${CSS.escape(sec.id)}"]`); if (b) b.focus(); }
    }
    function deleteSection(id) {
        const l = curList();
        if (!l) return;
        const idx = l.sections.findIndex((s) => s.id === id);
        if (idx < 0) return;
        const [sec] = l.sections.splice(idx, 1);
        const moved = S.items.filter((i) => i.sectionId === id).map((i) => i.id);
        moved.forEach((mid) => (find(mid).sectionId = null));
        commit();
        snack(`Deleted section “${trunc(sec.name, 24)}”`, "Undo", () => {
            const list = S.lists.find((x) => x.id === l.id);
            if (!list) return;
            list.sections.splice(Math.min(idx, list.sections.length), 0, sec);
            moved.forEach((mid) => { const i = find(mid); if (i && i.listId === list.id) i.sectionId = sec.id; });
            commit();
        });
    }
    function deleteList(id) {
        if (id === "inbox") return;
        const idx = S.lists.findIndex((l) => l.id === id);
        if (idx < 0) return;
        const [list] = S.lists.splice(idx, 1);
        const moved = S.items.filter((i) => i.listId === id).map((i) => [i.id, i.sectionId]);
        moved.forEach(([mid]) => { const i = find(mid); i.listId = "inbox"; i.sectionId = null; });
        if (S.view === "list:" + id) S.view = "list:inbox";
        ui.confirmDel = null;
        commit();
        snack(`Deleted list “${trunc(list.name, 24)}”`, "Undo", () => {
            if (!S.lists.some((l) => l.id === list.id)) S.lists.splice(Math.min(idx, S.lists.length), 0, list);
            moved.forEach(([mid, sec]) => { const i = find(mid); if (i) { i.listId = list.id; i.sectionId = sec; } });
            commit();
        });
    }
    function removeTagEverywhere(tag) {
        const had = S.items.filter((i) => i.tags.includes(tag)).map((i) => [i.id, i.tags.slice()]);
        had.forEach(([id]) => { const i = find(id); i.tags = i.tags.filter((t) => t !== tag); });
        const color = S.tagColors[tag];
        delete S.tagColors[tag];
        if (ui.tag === tag) ui.tag = null;
        commit();
        snack(`Removed #${trunc(tag, 20)} from ${plural(had.length, "to-do")}`, "Undo", () => {
            had.forEach(([id, tags]) => { const i = find(id); if (i) i.tags = tags; });
            if (color) S.tagColors[tag] = color;
            commit();
        });
    }
    function addList(name) {
        name = name.replace(/\s+/g, " ").trim().slice(0, 40);
        if (!name) return null;
        const l = { id: uid(), name, color: ROLES[S.lists.length % 3], sections: [] };
        S.lists.push(l);
        commit();
        return l;
    }

    // Export / import ------------------------------------------------------------------------------------------
    function exportData() {
        const data = clone(S);
        delete data.writer;
        delete data.savedAt;
        data.exportedAt = new Date().toISOString();
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `material-desk-todo-${todayS()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        ui.sheetMsg = `Saved material-desk-todo-${todayS()}.json with ${plural(S.items.length, "to-do")}.`;
        render();
    }
    col.addEventListener("change", async (e) => {
        const t = e.target;
        if (t.classList.contains("td-file")) {
            const f = t.files && t.files[0];
            t.value = "";
            if (!f) return;
            let raw;
            try { raw = JSON.parse(await f.text()); } catch (err) { ui.sheetMsg = "That file is not JSON. Pick a file made by Export."; render(); return; }
            const src = raw && Array.isArray(raw.items) ? raw : raw && raw.todo && Array.isArray(raw.todo.items) ? raw.todo : null;
            if (!src) { ui.sheetMsg = "No to-do data found in that file. Pick a file made by Export."; render(); return; }
            const prev = clone(S);
            const view = S.view;
            S = normalize(src);
            S.view = view.startsWith("list:") && !S.lists.some((l) => "list:" + l.id === view) ? "today" : view;
            ui.open = null;
            ui.sheetMsg = `Imported ${plural(S.items.length, "to-do")} in ${plural(S.lists.length, "list")}.`;
            commit();
            snack(`Imported ${plural(S.items.length, "to-do")}`, "Undo", () => { S = prev; ui.sheetMsg = ""; commit(); });
        } else if (t.classList.contains("td-lm-name")) {
            const l = S.lists.find((x) => x.id === t.dataset.lid);
            const name = t.value.replace(/\s+/g, " ").trim().slice(0, 40);
            if (l && name) { l.name = name; commit(); } else render();
        }
    });

    // Snackbar -------------------------------------------------------------------------------------------------
    let snackT = null, snackFn = null;
    function snack(msg, label, fn) {
        snackFn = fn || null;
        snackEl.innerHTML = `<span class="td-snack-msg">${esc(msg)}</span>${label ? `<button type="button" class="td-snack-btn" data-act="snack" data-k="snack">${esc(label)}</button>` : ""}
            <button type="button" class="icon-btn td-snack-x" data-act="snack-x" aria-label="Dismiss">${icon("close")}</button>`;
        snackEl.hidden = false;
        snackEl.classList.remove("is-in");
        void snackEl.offsetWidth;
        snackEl.classList.add("is-in");
        col.classList.add("td-has-snack");
        armSnack();
    }
    function armSnack() { clearTimeout(snackT); snackT = setTimeout(hideSnack, 5000); }
    function hideSnack() {
        clearTimeout(snackT);
        snackFn = null;
        const back = snackEl.contains(document.activeElement);
        snackEl.hidden = true;
        snackEl.innerHTML = "";
        col.classList.remove("td-has-snack");
        if (back) { const n = $$("[data-nav]")[0]; (n || addIn).focus(); }
    }
    snackEl.addEventListener("pointerenter", () => clearTimeout(snackT));
    snackEl.addEventListener("pointerleave", armSnack);
    snackEl.addEventListener("focusin", () => clearTimeout(snackT));
    snackEl.addEventListener("focusout", armSnack);

    // Search ---------------------------------------------------------------------------------------------------
    function openSearch() {
        if (ui.open) closeItem(false);
        ui.search = true;
        ui.sheet = false;
        render();
        qIn.focus();
        qIn.select();
    }
    function closeSearch() {
        ui.search = false;
        ui.q = "";
        ui.tag = null;
        qIn.value = "";
        render();
        $('[data-k="h-search"]').focus();
    }

    // ---- events --------------------------------------------------------------------------------------------------
    let suppressClick = false;
    function onClick(e) {
        if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); return; }
        const a = e.target.closest("[data-act]");
        // A click in the column but outside the pop-out closes the pop-out first (then does what it was meant to do).
        if (ui.picker && col.contains(e.target) && !(a && a.dataset.k === "e-due")) closePicker(false);
        if (a && inUI(a) && !a.disabled) { act(a.dataset.act, a.dataset.v, a, e); return; }
        const open = e.target.closest(".td-open");
        if (open) { openItem(open.closest(".td-item").dataset.id); return; }
        if (ui.open && body.contains(e.target) && !e.target.closest(".td-item.is-open")) closeItem(false);
    }
    col.addEventListener("click", onClick, false);
    pop.addEventListener("click", (e) => {
        // A time typed but not yet entered counts before the click acts (Done, a day, a repeat chip).
        const a = document.activeElement, it = ui.open && find(ui.open);
        if (it && a && a.dataset && a.dataset.k === "e-time" && pop.contains(a) && a.value.trim() !== (it.time ? fmtTime(it.time) : "")) {
            if (applyTimeText(it, a.value)) save(); else a.value = it.time ? fmtTime(it.time) : "";
        }
        onClick(e);
    }, false);
    // Buttons in the pop-out do not take focus on a mouse press, so a field's blur cannot re-render the panel
    // between press and release (that would swallow the click).
    pop.addEventListener("mousedown", (e) => { if (e.target.closest("button")) e.preventDefault(); });
    document.addEventListener("click", (e) => {
        if (!ui.open || inUI(e.target) || !e.target.isConnected) return;
        // Outside both: one layer at a time, the pop-out first, then the open item.
        if (ui.picker) { closePicker(false); return; }
        closeItem(false);
    });

    $(".td-add").addEventListener("submit", (e) => { e.preventDefault(); addFromQuick(); });
    sheet.addEventListener("submit", (e) => {
        if (!e.target.classList.contains("td-newlist")) return;
        e.preventDefault();
        const input = $('[data-k="newlist"]');
        const l = addList(input.value);
        if (!l) { shake(input); return; }
        ui.sheetMsg = "";
        render();
        const n = $('[data-k="newlist"]');
        n.value = "";
        n.focus();
    });
    const wheelX = (e) => {
        const box = e.currentTarget;
        if (box.scrollWidth <= box.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        box.scrollLeft += e.deltaY;
        e.preventDefault();
    };
    function edges(box) {
        box.classList.toggle("is-scrolled", box.scrollLeft > 2);
        box.classList.toggle("is-end", box.scrollLeft > 2 && box.scrollLeft + box.clientWidth >= box.scrollWidth - 2);
    }
    for (const box of [$(".td-lists"), $(".td-tagbar")]) {
        box.addEventListener("wheel", wheelX, { passive: false });
        box.addEventListener("scroll", () => edges(box), { passive: true });
    }

    col.addEventListener("input", (e) => {
        const t = e.target, k = t.dataset.k || "";
        const it = ui.open && find(ui.open);
        if (k === "add") quickChips();
        else if (k === "q") { ui.q = t.value; renderBody(); }
        else if (k === "e-title" && it) { it.title = t.value.replace(/\n/g, " "); save(); }
        else if (k === "e-notes" && it) { it.notes = t.value; save(); }
        else if (k.startsWith("s:") && it) { const s = it.subtasks.find((x) => x.id === k.slice(2)); if (s) { s.title = t.value; save(); } }
        else if (k === "e-tag" && it) tagSuggest(it, t.value);
        if (t.tagName === "TEXTAREA") grow(t);
    });
    function tagSuggest(it, v) {
        const box = $(".td-tag-sugg");
        if (!box) return;
        const q = cleanTag(v);
        if (!q) { box.innerHTML = ""; return; }
        const all = new Set();
        S.items.forEach((i) => i.tags.forEach((t) => all.add(t)));
        const hits = [...all].filter((t) => t.startsWith(q) && !it.tags.includes(t)).slice(0, 4);
        box.innerHTML = hits.map((t) => `<button type="button" class="td-tchip td-tchip-sugg" data-act="tag-add" data-v="${esc(t)}" style="${roleVars(tagRole(t))}">#${esc(t)}</button>`).join("");
    }
    const fieldSizing = typeof CSS !== "undefined" && CSS.supports && CSS.supports("field-sizing", "content");
    function grow(t) { if (fieldSizing) return; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }

    function onFocusIn(e) {
        const k = e.target.dataset ? e.target.dataset.k : "";
        if (k === "e-time" || k === "e-nl") e.target.select();
    }
    col.addEventListener("focusin", onFocusIn);
    pop.addEventListener("focusin", onFocusIn);
    col.addEventListener("focusout", onFocusOut);
    pop.addEventListener("focusout", onFocusOut);
    pop.addEventListener("focusout", remoteAfterBlur);
    function onFocusOut(e) {
        const t = e.target, k = t.dataset ? t.dataset.k || "" : "";
        if (k.startsWith("sec:") && ui.renameSec && !e.relatedTarget?.closest?.(".td-sec")) {
            if (t.isConnected) commitSecName(t, false);
        } else if (k === "e-time") {
            const it = ui.open && find(ui.open);
            if (it && t.isConnected && t.value.trim() !== (it.time ? fmtTime(it.time) : "")) {
                if (applyTimeText(it, t.value)) commit(); else t.value = it.time ? fmtTime(it.time) : "";
            }
        } else if (k.startsWith("s:")) {
            const it = ui.open && find(ui.open);
            if (it && t.isConnected) {
                const s = it.subtasks.find((x) => x.id === k.slice(2));
                if (s && !s.title.trim() && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(".td-sub"))) {
                    it.subtasks = it.subtasks.filter((x) => x !== s);
                    setTimeout(commit, 0);
                }
            }
        }
    }

    function rowsNav() { return $$("[data-nav]"); }
    function focusNav(el) {
        if (!el) return;
        rowsNav().forEach((n) => (n.tabIndex = -1));
        el.tabIndex = 0;
        el.focus({ preventScroll: true });
        scrollIntoBody(el.closest(".td-item") || el);
        const li = el.closest(".td-item");
        if (li) ui.cursor = li.dataset.id;
    }

    col.addEventListener("keydown", onKey);
    pop.addEventListener("keydown", onKey);
    function onKey(e) {
        const t = e.target, k = (t.dataset && t.dataset.k) || "";
        const it = ui.open && find(ui.open);
        if (e.key === "Tab" && pop.contains(t)) { trapTab(e); return; }
        if (e.key === "Escape") {
            if (handleEsc(t, k)) { e.preventDefault(); e.stopPropagation(); }
            return;
        }
        // Rows
        if (t.classList.contains("td-open")) {
            const nav = rowsNav(), i = nav.indexOf(t), id = t.closest(".td-item").dataset.id;
            if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); moveByKey(id, e.key === "ArrowUp" ? -1 : 1); return; }
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); focusNav(nav[i + 1]); }
            else if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); if (i > 0) focusNav(nav[i - 1]); else addIn.focus(); }
            else if (e.key === "Home") { e.preventDefault(); focusNav(nav[0]); }
            else if (e.key === "End") { e.preventDefault(); focusNav(nav[nav.length - 1]); }
            else if (e.key === " ") { e.preventDefault(); toggleDone(id); }
            else if (e.key === "Delete") { e.preventDefault(); deleteItem(id); }
            return;
        }
        if (k === "add" && e.key === "ArrowDown") { const n = rowsNav()[0]; if (n) { e.preventDefault(); focusNav(n); } return; }
        if (k === "q" && e.key === "ArrowDown") { const n = rowsNav()[0]; if (n) { e.preventDefault(); focusNav(n); } return; }
        if (k === "q" && e.key === "Enter") { e.preventDefault(); const n = rowsNav()[0]; if (n) focusNav(n); return; }
        if (!it && !k.startsWith("sec:")) return;
        if (k === "e-title" && e.key === "Enter") { e.preventDefault(); finalizeOpen(); $('[data-k="e-notes"]').focus(); }
        else if (k.startsWith("s:")) subtaskKeys(e, it, k.slice(2), t);
        else if (k === "s-new" && e.key === "Enter") {
            e.preventDefault();
            const v = t.value.trim();
            if (!v) return;
            it.subtasks.push({ id: uid(), title: v.slice(0, 300), done: false });
            t.value = "";
            commit();
            $('[data-k="s-new"]').focus();
        } else if (k === "s-new" && e.key === "Backspace" && !t.value && it.subtasks.length) {
            e.preventDefault();
            const ins = $$(".td-sub-in");
            ins[ins.length - 2].focus();
        } else if (k === "e-tag") {
            if ((e.key === "Enter" || e.key === "," || e.key === " ") && t.value.trim()) { e.preventDefault(); if (!addTag(it, t.value)) shake(t); }
            else if (e.key === "Enter") e.preventDefault();
            else if (e.key === "Backspace" && !t.value && it.tags.length) { e.preventDefault(); it.tags.pop(); commit(); $('[data-k="e-tag"]').focus(); }
        } else if (k === "e-time" && e.key === "Enter") {
            e.preventDefault();
            if (applyTimeText(it, t.value)) { commit(); } else shake(t);
        } else if (k === "e-nl" && e.key === "Enter") {
            e.preventDefault();
            const p = parseQuick(t.value, [], { keepDue: true, loose: true });
            if (!p.due && !p.time && !p.repeat) { shake(t); return; }
            if (p.due) it.due = p.due;
            if (p.time) it.time = p.time;
            if (p.repeat) it.repeat = p.repeat;
            if ((p.time || p.repeat) && !it.due) it.due = todayS();
            ui.picker = false;
            commit();
            const d = $('[data-k="e-due"]');
            if (d) d.focus();
        } else if (k.startsWith("d:")) {
            const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
            const mstep = { PageUp: -1, PageDown: 1 }[e.key];
            if (!step && !mstep) return;
            e.preventDefault();
            const from = parseYmd(k.slice(2));
            const d = step ? ymd(addDays(from, step)) : ymd(new Date(from.getFullYear(), from.getMonth() + mstep,
                Math.min(from.getDate(), daysIn(from.getFullYear(), from.getMonth() + mstep))));
            const target = $(`[data-k="d:${d}"]`);
            if (target && !target.classList.contains("is-other")) { $$(".td-day").forEach((b) => (b.tabIndex = -1)); target.tabIndex = 0; target.focus(); }
            else { ui.cal = new Date(parseYmd(d).getFullYear(), parseYmd(d).getMonth(), 1); ui.calFocus = d; render(); const n = $(`[data-k="d:${d}"]`); if (n) n.focus(); }
        } else if (k.startsWith("sec:") && e.key === "Enter") { e.preventDefault(); commitSecName(t, false); }
    }
    // The pop-out is a small dialog: Tab cycles inside it (Esc, Done or a click outside leave it).
    function trapTab(e) {
        const els = Array.from(pop.querySelectorAll("button, input")).filter((x) => !x.disabled && x.tabIndex >= 0 && x.offsetParent);
        if (!els.length) return;
        const i = els.indexOf(e.target);
        if (e.shiftKey && i <= 0) { e.preventDefault(); els[els.length - 1].focus(); }
        else if (!e.shiftKey && i === els.length - 1) { e.preventDefault(); els[0].focus(); }
    }
    function subtaskKeys(e, it, sid, t) {
        const i = it.subtasks.findIndex((x) => x.id === sid);
        if (i < 0) return;
        if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
            e.preventDefault();
            const j = i + (e.key === "ArrowUp" ? -1 : 1);
            if (j < 0 || j >= it.subtasks.length) return;
            const [s] = it.subtasks.splice(i, 1);
            it.subtasks.splice(j, 0, s);
            commit();
            return;
        }
        if (e.key === "Enter") {
            e.preventDefault();
            const ins = $$(".td-sub-in");
            (ins[i + 1] || $('[data-k="s-new"]')).focus();
        } else if (e.key === "Backspace" && !t.value) {
            e.preventDefault();
            it.subtasks.splice(i, 1);
            commit();
            const ins = $$(".td-sub-in");
            (ins[Math.max(0, i - 1)] || $('[data-k="s-new"]')).focus();
        } else if (e.key === "ArrowDown" && !e.altKey) { const ins = $$(".td-sub-in"); if (ins[i + 1]) { e.preventDefault(); ins[i + 1].focus(); } }
        else if (e.key === "ArrowUp" && !e.altKey && i > 0) { e.preventDefault(); $$(".td-sub-in")[i - 1].focus(); }
    }
    function handleEsc(t, k) {
        if (k === "add" && addIn.value) { addIn.value = ""; quickChips(); return true; }
        if (k === "add") { addIn.blur(); return true; }
        if (k.startsWith("sec:")) { commitSecName(t, true); return true; }
        if ((k === "e-tag" || k === "s-new") && t.value) { t.value = ""; if (k === "e-tag") { const b = $(".td-tag-sugg"); if (b) b.innerHTML = ""; } return true; }
        if (ui.open && ui.picker) { ui.picker = false; render(); const d = $('[data-k="e-due"]'); if (d) d.focus(); return true; }
        if (ui.open) { closeItem(true); return true; }
        if (ui.sheet) { ui.sheet = false; ui.colorFor = null; ui.confirmDel = null; render(); $(".td-menu-btn").focus(); return true; }
        if (ui.search) { closeSearch(); return true; }
        return false;
    }
    document.addEventListener("keydown", (e) => {
        if (document.documentElement.classList.contains("no-todo") || e.defaultPrevented) return;
        const t = e.target;
        const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
        if (e.key === "Escape" && !col.contains(t) && !typing && (ui.open || ui.sheet)) { handleEsc(t, ""); return; }
        if (typing || e.ctrlKey || e.metaKey || e.altKey || !S) return;
        if (e.key === "n" || e.key === "N") {
            e.preventDefault();
            if (ui.search) closeSearch();
            if (ui.sheet) { ui.sheet = false; render(); }
            addIn.focus();
        } else if (e.key === "/") { e.preventDefault(); openSearch(); }
    });

    // ---- reorder (keyboard and pointer) --------------------------------------------------------------------------
    // Renumber the whole list in the order on screen. Open items of the list that are not on screen (the pinned Focus
    // item, rows in collapsed sections) keep their place right after the visible item that came before them.
    function applyFlowOrder(flow) {
        let sec = null;
        const seen = [];
        for (const el of flow.children) {
            if (el.classList.contains("td-sec")) { sec = el.dataset.sec; continue; }
            const it = el.dataset.id && find(el.dataset.id);
            if (it) { it.sectionId = sec; seen.push(it); }
        }
        const shown = new Set(seen);
        const old = S.items.filter((i) => i.listId === flow.dataset.list && !i.done).sort(byOrder);
        const after = new Map([[null, []]]);
        let anchor = null;
        for (const i of old) {
            if (shown.has(i)) { anchor = i; continue; }
            if (!after.has(anchor)) after.set(anchor, []);
            after.get(anchor).push(i);
        }
        const seq = [...after.get(null)];
        for (const i of seen) seq.push(i, ...(after.get(i) || []));
        seq.forEach((i, n) => (i.order = n));
        const l = curList();
        const it = drag && drag.el && drag.el.dataset.id ? find(drag.el.dataset.id) : null;
        if (l && it && it.sectionId) { const s = l.sections.find((x) => x.id === it.sectionId); if (s) s.collapsed = false; }
    }
    function moveByKey(id, dir) {
        const flow = $(".td-flow");
        const li = flow && flow.querySelector(`.td-item[data-id="${CSS.escape(id)}"]`);
        if (!li) { snack("Open a list to reorder its to-dos."); return; }
        const sib = dir < 0 ? li.previousElementSibling : li.nextElementSibling;
        if (!sib) return;
        if (dir < 0) sib.before(li); else sib.after(li);
        let sec = null;
        for (const el of flow.children) { if (el.classList.contains("td-sec")) sec = el.dataset.sec; if (el === li) break; }
        applyFlowOrder(flow);
        const l = curList();
        if (l && sec) { const s = l.sections.find((x) => x.id === sec); if (s) s.collapsed = false; }
        ui.cursor = id;
        commit();
        const b = $(`[data-k="open:${CSS.escape(id)}"]`);
        if (b) focusNav(b);
    }

    let drag = null;
    body.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 || drag) return;
        const grip = e.target.closest(".td-sub-grip");
        if (grip) { e.preventDefault(); beginDrag(e, grip.closest(".td-sub"), "sub"); return; }
        const open = e.target.closest(".td-open");
        const li = open && open.closest(".td-item.is-drag");
        if (li) beginDrag(e, li, "item");
    });
    function beginDrag(e, el, kind) {
        drag = { kind, el, x: e.clientX, y: e.clientY, py: e.clientY, active: false, ty: 0, raf: 0, pid: e.pointerId };
        window.addEventListener("pointermove", onDragMove);
        window.addEventListener("pointerup", endDrag);
        window.addEventListener("pointercancel", endDrag);
        if (kind === "sub") startDrag();
    }
    function startDrag() {
        const el = drag.el, r = el.getBoundingClientRect();
        drag.active = true;
        drag.z = r.height / (el.offsetHeight || r.height) || 1;
        drag.grab = drag.y - r.top;
        drag.h = r.height;
        el.classList.add("td-dragging");
        el.parentElement.classList.add("td-drag-on");
        document.body.classList.add("td-noselect");
        try { el.setPointerCapture(drag.pid); } catch (e) { /* */ }
        if (drag.kind === "item" && ui.open) { /* rows in list view only; editor stays */ }
        tickScroll();
    }
    function onDragMove(e) {
        if (!drag) return;
        drag.py = e.clientY;
        if (!drag.active) {
            if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
            startDrag();
        }
        e.preventDefault();
        place();
    }
    function place() {
        const el = drag.el, parent = el.parentElement;
        const sel = drag.kind === "sub" ? ".td-sub[data-sid]" : ".td-item, .td-sec";
        const center = drag.py - drag.grab + drag.h / 2;
        const sibs = Array.from(parent.children).filter((c) => c !== el && c.matches(sel));
        let before = null;
        for (const s of sibs) {
            const r = s.getBoundingClientRect();
            if (center < r.top + r.height / 2) { before = s; break; }
        }
        if (drag.kind === "item" && !before && !sibs.length) return;
        if (before) { if (el.nextElementSibling !== before) parent.insertBefore(el, before); }
        else {
            const last = sibs[sibs.length - 1];
            if (last && last.nextElementSibling !== el) last.after(el);
        }
        el.style.transform = "";
        const nat = el.getBoundingClientRect().top;
        drag.ty = (drag.py - drag.grab - nat) / drag.z;
        el.style.transform = `translateY(${drag.ty}px)`;
    }
    function tickScroll() {
        if (!drag || !drag.active) return;
        const b = body.getBoundingClientRect(), edge = 44;
        let v = 0;
        if (drag.py < b.top + edge) v = -Math.ceil((b.top + edge - drag.py) / 4);
        else if (drag.py > b.bottom - edge) v = Math.ceil((drag.py - (b.bottom - edge)) / 4);
        if (v) { body.scrollTop += v; place(); }
        drag.raf = requestAnimationFrame(tickScroll);
    }
    function endDrag() {
        window.removeEventListener("pointermove", onDragMove);
        window.removeEventListener("pointerup", endDrag);
        window.removeEventListener("pointercancel", endDrag);
        if (!drag) return;
        const d = drag;
        cancelAnimationFrame(d.raf);
        if (d.active) {
            d.el.classList.remove("td-dragging");
            d.el.style.transform = "";
            if (d.el.parentElement) d.el.parentElement.classList.remove("td-drag-on");
            document.body.classList.remove("td-noselect");
            if (d.kind === "item") {
                suppressClick = true;
                setTimeout(() => (suppressClick = false), 50);
                const flow = d.el.closest(".td-flow");
                if (flow) applyFlowOrder(flow);
                ui.cursor = d.el.dataset.id;
                drag = null;
                commit();
            } else {
                const it = ui.open && find(ui.open);
                if (it) {
                    const order = $$(".td-sub[data-sid]").map((x) => x.dataset.sid);
                    it.subtasks.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
                }
                drag = null;
                commit();
            }
        }
        drag = null;
    }

    // ---- day change ----------------------------------------------------------------------------------------------
    let midnightT = null, renderedDay = todayS();
    function scheduleMidnight() {
        renderedDay = todayS();
        clearTimeout(midnightT);
        const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
        midnightT = setTimeout(() => { if (!typingInCol()) render(); else scheduleMidnight(); }, next - now);
    }
    document.addEventListener("visibilitychange", () => { if (!document.hidden && S && renderedDay !== todayS() && !typingInCol()) render(); });

    // ---- dev seed (127.0.0.1 only) -------------------------------------------------------------------------------
    function seedState(kind) {
        const s = freshState();
        if (kind === "empty") return s;
        const T = (n) => ymd(addDays(todayD(), n));
        const ago = (days, h) => { const d = addDays(todayD(), -days); d.setHours(h || 9); return d.getTime(); };
        s.lists.push(
            { id: "work", name: "Work", color: "tertiary", sections: [{ id: "sec-now", name: "This week", collapsed: false }, { id: "sec-proj", name: "Projects", collapsed: false }] },
            { id: "home", name: "Home", color: "primary", sections: [] });
        let n = 0;
        const add = (title, o) => {
            o = o || {};
            const subs = (o.subtasks || []).map((x) => (typeof x === "string" ? { id: uid(), title: x, done: false } : { id: uid(), title: x[0], done: x[1] }));
            s.items.push(Object.assign({ id: uid(), title, notes: "", listId: "inbox", sectionId: null, due: null, time: null, priority: 0, tags: [],
                repeat: null, done: false, completedAt: null, createdAt: Date.now(), order: n++ }, o, { subtasks: subs }));
            return s.items[s.items.length - 1];
        };
        if (/^\d+$/.test(kind)) {
            const words = ["Read", "Write", "Fix", "Plan", "Email", "Review", "Draft", "Clean", "Call", "Study"];
            const things = ["chapter notes", "the report", "the bike", "weekend trip", "the landlord", "pull request", "blog intro", "desk", "a friend", "flashcards"];
            for (let i = 0; i < +kind; i++) {
                add(`${words[i % 10]} ${things[(i * 7) % 10]} ${i + 1}`, { listId: ["inbox", "work", "home"][i % 3], due: i % 4 ? T((i % 15) - 3) : null,
                    time: i % 5 === 0 ? "17:00" : null, priority: i % 7 === 0 ? 1 : i % 5 === 0 ? 2 : 0, tags: i % 3 ? [["work", "errands", "health"][i % 3]] : [],
                    subtasks: i % 6 === 0 ? [["one", true], "two", "three"] : [], notes: i % 4 === 0 ? "Notes here" : "", done: i % 9 === 0, completedAt: i % 9 === 0 ? ago(i % 3) : null });
            }
            return s;
        }
        const calc = add("Finish the quarterly report", { listId: "work", sectionId: "sec-now", due: T(0), time: "17:00", priority: 1, tags: ["report"],
            subtasks: [["Collect the numbers", true], ["Draft the summary", true], "Charts", "Proofread", "Send for review"],
            notes: "Keep the summary to one page. Charts go in the appendix." });
        add("Reply to the team about the launch date", { due: T(0), priority: 1, tags: ["email"] });
        add("Gym: legs", { listId: "home", due: T(0), time: "17:30", repeat: "weekly", tags: ["health"] });
        add("Practice guitar 30 min", { listId: "home", due: T(0), repeat: "daily", tags: ["music"] });
        add("Read 20 pages", { listId: "home", due: T(0), repeat: "daily" });
        add("Outline the onboarding guide", { listId: "work", sectionId: "sec-now", due: T(-1), priority: 2, tags: ["docs"], notes: "Start with setup, then the first week." });
        add("Renew library books", { due: T(-2), tags: ["errands"] });
        add("Review the design mockups", { listId: "work", sectionId: "sec-now", due: T(1), tags: ["design"], notes: "Focus on the empty states and the mobile layout." });
        add("Buy batteries and light bulbs", { due: T(1), tags: ["errands"] });
        add("Write the test plan", { listId: "work", sectionId: "sec-now", due: T(2), time: "09:00", priority: 2, tags: ["qa"],
            subtasks: [["Scope", true], "Cases", "Edge cases", "Sign-off"], notes: "Cover the import and export paths." });
        add("Book the dentist", { listId: "home", due: T(3), tags: ["health"] });
        add("Prototype the new search page", { listId: "work", sectionId: "sec-proj", due: T(5), priority: 3, tags: ["design", "code"],
            subtasks: ["Sketch the layout", "Build a quick version", "Ask for feedback"] });
        add("Slides for the Thursday demo", { listId: "work", sectionId: "sec-proj", due: T(4), tags: ["code"], notes: "Keep it to 12 slides." });
        add("Plan the spring garden", { listId: "home", due: T(19), priority: 3, tags: ["garden"] });
        add("Call a friend", { listId: "home", due: T(6), tags: ["family"] });
        add("Haircut", { listId: "home", due: T(8) });
        add("Birthday gift", { listId: "home", due: T(9), priority: 2, tags: ["family"], subtasks: [["Make a list of ideas", true], "Order it", "Wrap it"] });
        add("Back up the laptop", { tags: ["setup"] });
        add("Look into evening classes", { tags: ["learning"], notes: "Compare the schedules and prices." });
        add("Try a new keyboard layout", { tags: ["setup"] });
        add("Clean the desk", { listId: "home" });
        add("Expense report", { listId: "work", sectionId: "sec-now", done: true, completedAt: ago(0, 8), tags: ["report"] });
        add("Pay the phone bill", { listId: "home", done: true, completedAt: ago(0, 7) });
        add("Submit the conference talk proposal", { done: true, completedAt: ago(1, 20), tags: ["learning"] });
        add("Email the plumber", { listId: "home", done: true, completedAt: ago(2, 18) });
        s.focusId = calc.id;
        s.tagColors = { report: "tertiary", email: "primary" };
        return s;
    }

    // ---- start ---------------------------------------------------------------------------------------------------
    (async function init() {
        let raw = null;
        try { raw = await Lemon.store.get(KEY, null); } catch (e) { raw = null; }
        const dev = location.hostname === "127.0.0.1" ? new URLSearchParams(location.search).get("seed") : null;
        if (dev !== null) raw = seedState(dev);
        S = normalize(raw);
        render();
        if (dev !== null) flush();
    })();
})();
