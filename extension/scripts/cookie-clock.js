/*
 * The cookie clock, after the CookieClock widget of End4's dots-hyprland (illogical-impulse) desktop (GPL-3.0):
 * 14-sided cookie, full minute lines, time column in the middle, hollow hour hand, thin minute hand, second dot,
 * day and month bubbles. Same sizes as the original QML (a 230 px clock), in the Material colors that
 * scripts/lemon.js puts in the --dl-* variables. Mounts into #clock-host; writes the date into #dlDate.
 */
(function () {
    const SIZE = 230, C = SIZE / 2;
    const NS = "http://www.w3.org/2000/svg";

    // Outlines in a 0..1 box, exported from a port of the Material shapes library (Apache-2.0) run under node: the
    // 14-sided MaterialCookie, and the Pentagon and Pill shapes of the date bubbles. Exact outlines, so the clock
    // matches the desktop widget it is modeled on.
    const SHAPES = {
        "cookie": "M0.92681 0.74642C0.91867 0.76051 0.9045 0.77112 0.88678 0.77391C0.87529 0.77573 0.86379 0.77754 0.85229 0.77936C0.82661 0.78341 0.80703 0.80451 0.8049 0.83043C0.80395 0.84203 0.803 0.85363 0.80205 0.86523C0.79912 0.90098 0.76398 0.92494 0.72963 0.91461C0.71849 0.91125 0.70734 0.9079 0.6962 0.90455C0.67129 0.89705 0.6445 0.90757 0.63134 0.93C0.62545 0.94004 0.61956 0.95008 0.61367 0.96012C0.59552 0.99106 0.55347 0.9974 0.527 0.97318C0.51841 0.96532 0.50983 0.95747 0.50124 0.94961C0.48205 0.93206 0.45335 0.9299 0.43176 0.9444C0.4221 0.95089 0.41244 0.95738 0.40278 0.96387C0.373 0.98387 0.33236 0.97134 0.31902 0.93804C0.31469 0.92723 0.31037 0.91643 0.30604 0.90562C0.29637 0.88148 0.27144 0.86709 0.2457 0.87079C0.23418 0.87244 0.22266 0.8741 0.21114 0.87575C0.17563 0.88085 0.14446 0.85192 0.14689 0.81613C0.14768 0.80452 0.14847 0.79291 0.14925 0.7813C0.15102 0.75535 0.1348 0.73157 0.11001 0.72373C0.09891 0.72022 0.08781 0.71671 0.07671 0.71321C0.04251 0.70239 0.02697 0.66281 0.04469 0.63162C0.05044 0.6215 0.05619 0.61138 0.06194 0.60126C0.07478 0.57865 0.07049 0.55018 0.05156 0.53236C0.04308 0.52439 0.0346 0.51641 0.02612 0.50843C0 0.48385 0.00318 0.44145 0.03267 0.42103C0.04225 0.41441 0.05182 0.40779 0.06139 0.40116C0.08277 0.38636 0.09125 0.35886 0.08192 0.33458C0.07775 0.32372 0.07357 0.31286 0.06939 0.30199C0.05652 0.26851 0.07778 0.23168 0.11322 0.22609C0.12471 0.22427 0.13621 0.22246 0.14771 0.22064C0.17339 0.21659 0.19297 0.19549 0.1951 0.16957C0.19605 0.15797 0.197 0.14637 0.19795 0.13477C0.20088 0.09902 0.23602 0.07506 0.27037 0.08539C0.28151 0.08875 0.29266 0.0921 0.3038 0.09545C0.32871 0.10295 0.3555 0.09243 0.36866 0.07C0.37455 0.05996 0.38044 0.04992 0.38633 0.03988C0.40448 0.00894 0.44653 0.0026 0.473 0.02682C0.48159 0.03468 0.49017 0.04253 0.49876 0.05039C0.51795 0.06794 0.54665 0.0701 0.56824 0.0556C0.5779 0.04911 0.58756 0.04262 0.59722 0.03613C0.627 0.01613 0.66764 0.02866 0.68098 0.06196C0.68531 0.07277 0.68963 0.08357 0.69396 0.09438C0.70363 0.11852 0.72856 0.13291 0.7543 0.12921C0.76582 0.12756 0.77734 0.1259 0.78886 0.12425C0.82437 0.11915 0.85554 0.14808 0.85311 0.18387C0.85232 0.19548 0.85153 0.20709 0.85075 0.2187C0.84898 0.24465 0.8652 0.26843 0.88999 0.27627C0.90109 0.27978 0.91219 0.28329 0.92329 0.28679C0.95749 0.29761 0.97303 0.33719 0.95531 0.36838C0.94956 0.3785 0.94381 0.38862 0.93806 0.39874C0.92522 0.42135 0.92951 0.44982 0.94844 0.46764C0.95692 0.47561 0.9654 0.48359 0.97388 0.49157C1 0.51615 0.99682 0.55855 0.96733 0.57897C0.95775 0.58559 0.94818 0.59221 0.93861 0.59884C0.91723 0.61364 0.90875 0.64114 0.91808 0.66542C0.92225 0.67628 0.92643 0.68714 0.93061 0.69801C0.93704 0.71475 0.93494 0.73233 0.92681 0.74642Z",
        "pentagon": "M0.79655 0.93127C0.76922 0.95095 0.73586 0.96226 0.70052 0.96226C0.56684 0.96226 0.43316 0.96226 0.29948 0.96226C0.22879 0.96226 0.16603 0.91704 0.14364 0.84999C0.10319 0.72883 0.06274 0.60768 0.02228 0.48652C0 0.41978 0.0241 0.34632 0.08159 0.30575C0.18892 0.23001 0.29626 0.15427 0.40359 0.07853C0.46139 0.03774 0.53861 0.03774 0.59641 0.07853C0.70374 0.15427 0.81108 0.23001 0.91841 0.30575C0.9759 0.34632 1 0.41978 0.97772 0.48652C0.93726 0.60768 0.89681 0.72883 0.85636 0.84999C0.84516 0.88352 0.82388 0.91158 0.79655 0.93127Z",
        "pill": "M0.56022 0.96844C0.50948 0.98601 0.45518 0.9933 0.40051 0.98919C0.3972 0.98894 0.39389 0.9887 0.39059 0.98845C0.18764 0.97322 0.02477 0.81477 0.00395 0.61232C0.00263 0.59952 0.00132 0.58671 0 0.57391C0.00064 0.45874 0.04928 0.34905 0.13421 0.27126C0.18995 0.22021 0.24569 0.16916 0.30143 0.1181C0.38229 0.04405 0.49015 0.0067 0.59949 0.01491C0.6028 0.01516 0.60611 0.01541 0.60941 0.01566C0.81236 0.03089 0.97523 0.18933 0.99605 0.39178C0.99737 0.40458 0.99868 0.41739 1 0.4302C0.99936 0.54537 0.95072 0.65505 0.86579 0.73284C0.81005 0.78389 0.75431 0.83495 0.69857 0.886C0.65814 0.92303 0.61096 0.95088 0.56022 0.96844Z"
    };

    function el(tag, attrs, parent) {
        const e = document.createElementNS(NS, tag);
        for (const k in attrs) e.setAttribute(k, attrs[k]);
        if (parent) parent.appendChild(e);
        return e;
    }

    function build(host) {
        const box = document.createElement("div");
        box.id = "cookieClock";

        // Back layer: cookie and the minute/hour lines (Lines.qml: margins 10 + 12, hours 18x4, minutes 7x2).
        const back = el("svg", { viewBox: `0 0 ${SIZE} ${SIZE}`, class: "cc-layer" });
        // Shadow on a group around the scaled path, so it is measured in clock pixels (StyledDropShadow: radius 8, 30% black).
        el("path", { d: SHAPES.cookie, class: "cc-cookie", transform: `scale(${SIZE})` }, el("g", { class: "cc-shadow" }, back));
        for (let i = 0; i < 60; i++) {
            el("rect", { x: C - 1, y: 22, width: 2, height: 7, rx: 1, class: "cc-mark",
                transform: `rotate(${i * 6} ${C} ${C})` }, back);
        }
        for (let i = 0; i < 12; i++) {
            el("rect", { x: C - 2, y: 22, width: 4, height: 18, rx: 2, class: "cc-mark",
                transform: `rotate(${i * 30} ${C} ${C})` }, back);
        }
        box.appendChild(back);

        // Time column (TimeColumn.qml: hour, minute, AM/PM stacked, 68 px and 26 px, spacing -16).
        const column = document.createElement("div");
        column.className = "cc-column";
        const hh = document.createElement("span"), mm = document.createElement("span"),
            ap = document.createElement("span");
        ap.className = "cc-ampm";
        column.append(hh, mm, ap);
        box.appendChild(column);

        // Front layer: hands, center dot and the date bubbles.
        const front = el("svg", { viewBox: `0 0 ${SIZE} ${SIZE}`, class: "cc-layer" });
        // Hour hand: 72 long, 20 wide, from 10 behind the center; hollow with a 4 px border drawn inside.
        const hour = el("rect", { x: C - 8, y: C - 60, width: 16, height: 68, rx: 8, class: "cc-hour" }, front);
        // Minute hand: thin, 95 long, 5 wide, from 2.5 behind the center.
        const minute = el("rect", { x: C - 2.5, y: C - 92.5, width: 5, height: 95, rx: 2.5, class: "cc-minute" }, front);
        // Second dot: 20 px, its center 75 from the middle.
        const second = el("circle", { cx: C, cy: C - 75, r: 10, class: "cc-second" }, front);
        el("circle", { cx: C, cy: C, r: 3, class: "cc-center" }, front);
        // Date bubbles, 64 px, where DateIndicator.qml puts them: day in a pentagon in the top left corner of the clock,
        // month in a pill in the bottom right corner.
        el("path", { d: SHAPES.pentagon, class: "cc-day", transform: "scale(64)" }, front);
        const day = el("text", { x: 32, y: 32, class: "cc-daytext" }, front);
        el("path", { d: SHAPES.pill, class: "cc-month", transform: `translate(${SIZE - 64} ${SIZE - 64}) scale(64)` }, front);
        const month = el("text", { x: SIZE - 32, y: SIZE - 32, class: "cc-monthtext" }, front);
        box.appendChild(front);

        host.appendChild(box);

        let last = "";
        function tick() {
            const now = new Date();
            const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
            hour.setAttribute("transform", `rotate(${30 * ((h % 12) + m / 60)} ${C} ${C})`);
            minute.setAttribute("transform", `rotate(${6 * m} ${C} ${C})`);
            second.setAttribute("transform", `rotate(${6 * s} ${C} ${C})`);
            const key = `${h}:${m}:${now.getDate()}`;
            if (key !== last) {
                last = key;
                hh.textContent = String(h % 12 || 12).padStart(2, "0");
                mm.textContent = String(m).padStart(2, "0");
                ap.textContent = h < 12 ? "AM" : "PM";
                day.textContent = now.getDate();
                month.textContent = String(now.getMonth() + 1).padStart(2, "0");
                const date = document.getElementById("dlDate");
                if (date) date.textContent = now.toLocaleDateString("en-US",
                    { weekday: "long", month: "long", day: "numeric" });
            }
        }
        tick();
        setTimeout(() => { tick(); setInterval(tick, 1000); }, 1000 - new Date().getMilliseconds());
    }

    // Tab icon: a home in the light accent, which stays visible on a dark tab strip. Redrawn when the look changes.
    function setTabIcon() {
        const css = getComputedStyle(document.documentElement);
        const fg = css.getPropertyValue("--dl-primary").trim() || "#ffb4a4";
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fg}" ` +
            `d="M4 21V9.5l8-6 8 6V21h-6v-6.5h-4V21z"/></svg>`;
        const link = document.getElementById("favicon");
        if (!link) return;
        link.href = "data:image/svg+xml," + encodeURIComponent(svg);
        link.setAttribute("type", "image/svg+xml");
    }

    function start() {
        // The tab icon follows the look (colors arrive from lemon.js before load).
        window.addEventListener("load", setTabIcon);
        document.addEventListener("lemon:look", setTabIcon);
        const host = document.getElementById("clock-host");
        if (!host || document.getElementById("cookieClock")) return;
        build(host);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
})();
