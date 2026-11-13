/*
 * Weather from Open-Meteo (free, no key) for the weather card (weather-card.js), plus flat weather icons drawn in the
 * page's Material colors. location: "lat,lon" (GPS), a place name typed in settings, or "auto:ip" (ipinfo).
 */
(function () {
    // WMO weather code -> [weatherapi.com icon number (unused since the palette icons below), text].
    const CODES = {
        0: [113, "Clear"], 1: [116, "Mostly clear"], 2: [116, "Partly cloudy"], 3: [122, "Overcast"],
        45: [248, "Fog"], 48: [260, "Freezing fog"],
        51: [266, "Light drizzle"], 53: [266, "Drizzle"], 55: [266, "Heavy drizzle"],
        56: [281, "Freezing drizzle"], 57: [284, "Freezing drizzle"],
        61: [296, "Light rain"], 63: [302, "Rain"], 65: [308, "Heavy rain"],
        66: [311, "Freezing rain"], 67: [314, "Freezing rain"],
        71: [326, "Light snow"], 73: [332, "Snow"], 75: [338, "Heavy snow"], 77: [350, "Snow grains"],
        80: [353, "Light showers"], 81: [356, "Showers"], 82: [359, "Heavy showers"],
        85: [368, "Snow showers"], 86: [371, "Heavy snow showers"],
        95: [389, "Thunderstorm"], 96: [395, "Thunderstorm, hail"], 99: [395, "Thunderstorm, hail"],
    };
    // Flat icons in the page's own Material colors (stock weather icons are fixed blue and clash with the theme).
    // kind: clear, partly, cloud, fog, rain, snow, storm. paint(part, how) gives the color attribute of a part
    // ("glow" sun and moon, "back" a sun or moon behind a cloud, "cloud" clouds and fog, "wet" drops and lightning)
    // for "fill" or "stroke".
    function draw(kind, day, paint) {
        const cloud = paint("cloud", "fill"), wet = paint("wet", "fill"), wetLine = paint("wet", "stroke");
        const sun = (cx, cy, r, part = "glow") => `<circle cx="${cx}" cy="${cy}" r="${r}" ${paint(part, "fill")}/>` +
            [...Array(8)].map((_, i) => { const t = i * Math.PI / 4, a = r + 4, b = r + 9;
                return `<line x1="${cx + a * Math.cos(t)}" y1="${cy + a * Math.sin(t)}" x2="${cx + b * Math.cos(t)}" ` +
                    `y2="${cy + b * Math.sin(t)}" ${paint(part, "stroke")} stroke-width="4" stroke-linecap="round"/>`; }).join("");
        const moon = (cx, cy, r, part = "glow") => `<path ${paint(part, "fill")} d="M${cx + r * 0.35} ${cy - r}a${r} ${r} 0 1 0 ${r * 0.65} ${r * 1.55}` +
            `a${r * 0.8} ${r * 0.8} 0 0 1 -${r * 0.65} -${r * 1.55}z"/>`;
        const cl = (dy = 0) => `<path ${cloud} transform="translate(0 ${dy})" d="M20 46h26a10 10 0 0 0 1-20` +
            `a14 14 0 0 0-27-3a11 11 0 0 0 0 23z"/>`;
        const drops = (ch) => [18, 30, 42].map((x) => ch === "snow"
            ? `<circle cx="${x + 2}" cy="54" r="3" ${wet}/>`
            : `<line x1="${x + 4}" y1="50" x2="${x}" y2="59" ${wetLine} stroke-width="4" stroke-linecap="round"/>`).join("");
        return {
            clear: day ? sun(32, 32, 13) : moon(30, 32, 18),
            partly: (day ? sun(23, 22, 8, "back") : moon(22, 20, 11, "back")) + cl(6),
            cloud: cl(4),
            fog: [22, 32, 42].map((y, i) => `<line x1="${12 + i * 4}" y1="${y}" x2="${52 - i * 4}" y2="${y}" ` +
                `${paint("cloud", "stroke")} stroke-width="5" stroke-linecap="round"/>`).join(""),
            rain: cl(-4) + drops("rain"),
            snow: cl(-4) + drops("snow"),
            storm: cl(-4) + `<path ${wet} d="M34 40l-9 13h7l-3 10l11-15h-7l3-8z"/>`,
        }[kind];
    }
    // As an image (data: URL), colored with the look's roles at the time of the call.
    function icon(kind, day) {
        const c = (window.desktopLook && window.desktopLook.colors) || {};
        const hex = { glow: c.tertiary || "#dcc48c", back: c.tertiary || "#dcc48c",
            cloud: c.on_surface_variant || "#d8c2bd", wet: c.primary || "#ffb4a4" };
        return "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
            draw(kind, day, (part, how) => `${how}="${hex[part]}"`) + "</svg>");
    }
    // As inline SVG, colored by CSS through --wi-glow, --wi-back, --wi-cloud and --wi-wet (weather.css), so it follows
    // a look change without a redraw and can sit on any container with that container's on_* colors.
    function iconSvg(kind, day) {
        return `<svg class="wi" viewBox="0 0 64 64" aria-hidden="true">` +
            draw(kind, day, (part, how) => `style="${how}:var(--wi-${part})"`) + "</svg>";
    }
    const kindOf = (code) => code <= 1 ? "clear" : code === 2 ? "partly" : code === 3 ? "cloud"
        : code <= 48 ? "fog" : (code >= 71 && code <= 77) || code === 85 || code === 86 ? "snow"
        : code >= 95 ? "storm" : "rain";

    const NAME_KEY = "dlPlaceName";   // localStorage cache of the last coordinates' place name
    // Every request gives up after 10 seconds (a held-open request left "Getting the weather…" up for good).
    const get = (url) => fetch(url, { signal: AbortSignal.timeout(10000) });
    const json = async (url) => {
        const r = await get(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
    };

    async function place(location) {
        const m = /^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/.exec(location || "");
        if (m) {
            // City name for the coordinates (BigDataCloud's free client-side lookup), else ipinfo's guess. Kept in
            // localStorage per coordinates, so the same coordinates are looked up once, not on every refresh.
            let name, saved = null;
            const at = `${m[1]},${m[3]}`;
            try { saved = JSON.parse(localStorage.getItem(NAME_KEY)); } catch (e) { /* none */ }
            if (saved && saved.at === at && typeof saved.name === "string") name = saved.name;
            if (!name) {
                try {
                    const r = await json("https://api.bigdatacloud.net/data/reverse-geocode-client?" +
                        `latitude=${m[1]}&longitude=${m[3]}&localityLanguage=en`);
                    name = r.city || r.locality;
                    if (name) localStorage.setItem(NAME_KEY, JSON.stringify({ at, name: String(name) }));
                } catch (e) { /* none */ }
            }
            if (!name) name = window.weatherCity;
            if (!name) {
                try { name = (await json("https://ipinfo.io/json/")).city; } catch (e) { /* none */ }
            }
            return { lat: m[1], lon: m[3], name: name || "Here" };
        }
        if (location && location !== "auto:ip") {
            // "Springfield, Illinois" or "Paris, FR": the name is searched, the part after the comma picks the hit
            // (state, region or country), else the best match is used.
            const [city, ...rest] = location.split(",");
            const qual = rest.join(",").trim().toLowerCase();
            const r = await json(`https://geocoding-api.open-meteo.com/v1/search?count=${qual ? 10 : 1}&name=` +
                encodeURIComponent(city.trim()));
            const hits = Array.isArray(r.results) ? r.results : [];
            const hit = (qual && hits.find((h) => [h.admin1, h.admin2, h.country, h.country_code]
                .some((x) => typeof x === "string" && x.toLowerCase() === qual))) || hits[0];
            if (hit) return { lat: hit.latitude, lon: hit.longitude, name: hit.name };
            throw new Error("Place not found");   // a typo should say so, not quietly show the internet address's city
        }
        const ip = await json("https://ipinfo.io/json/");
        if (typeof ip.loc !== "string") throw new Error("No location");
        const [lat, lon] = ip.loc.split(",");
        return { lat, lon, name: ip.city || "Here" };
    }

    // US AQI from Open-Meteo's air quality service (same coordinates). Optional: null when it fails.
    async function air(p) {
        try {
            const r = await get(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${p.lat}` +
                `&longitude=${p.lon}&current=us_aqi,pm2_5,pm10,ozone&timezone=auto`);
            if (!r.ok) return null;
            const c = (await r.json()).current;
            // Numbers only: anything else from the service becomes null (the card shows a dash).
            const n = (x) => (x == null || x === "" || !Number.isFinite(+x) ? null : +x);
            return c && n(c.us_aqi) != null ? { aqi: n(c.us_aqi), pm25: n(c.pm2_5), pm10: n(c.pm10), ozone: n(c.ozone) } : null;
        } catch (e) { return null; }
    }

    // For the weather card (weather-card.js). Everything metric (Celsius, km/h, mm, hPa, meters); the card converts.
    // Times are the place's local clock as Open-Meteo gives them ("2025-06-01T16:59"), so no time zone math here.
    // Shape (version 2): now fields at the top level, `hours` = 25 hours from the current one, `days` = 10 days from
    // today, `air` = { aqi, pm25, pm10, ozone } or null.
    window.weatherIcon = icon;
    window.weatherIconSvg = iconSvg;
    window.weatherKind = kindOf;
    window.weatherText = (code, isDay) => code === 0 && isDay ? "Sunny" : (CODES[code] || [0, "Cloudy"])[1];
    window.openMeteoForecast = async function (location) {
        const p = await place(location);
        // Coordinates go into request URLs: numbers only, rounded to 3 decimals (about 100 m) whatever their source.
        p.lat = Math.round(+p.lat * 1000) / 1000; p.lon = Math.round(+p.lon * 1000) / 1000;
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) throw new Error("Place not found");
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}` +
            "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,is_day,wind_speed_10m," +
            "wind_direction_10m,wind_gusts_10m,cloud_cover,pressure_msl,precipitation,uv_index,visibility,dew_point_2m" +
            "&hourly=temperature_2m,weather_code,is_day,precipitation_probability,precipitation,pressure_msl" +
            "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max," +
            "precipitation_sum,sunrise,sunset,uv_index_max,daylight_duration" +
            "&timezone=auto&forecast_days=10&past_hours=3&forecast_hours=30";
        const [d, aq] = await Promise.all([json(url), air(p)]);
        if (!d.current || !d.hourly || !d.daily || !Array.isArray(d.hourly.time) || !Array.isArray(d.daily.time)) throw new Error(d.reason || "No forecast");
        const c = d.current, h = d.hourly, dl = d.daily;
        const T = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, D = /^\d{4}-\d{2}-\d{2}$/;
        if (!T.test(String(c.time))) throw new Error("Unexpected weather data");   // used as a string below
        // The hour the current conditions fall in (the last hourly time not after now).
        let at = 0;
        h.time.forEach((t, i) => { if (t <= c.time) at = i; });
        const hours = h.time.slice(at, at + 25).map((t, k) => {
            const i = at + k;
            return { time: t, temp: h.temperature_2m?.[i], code: h.weather_code?.[i], isDay: h.is_day?.[i],
                rain: h.precipitation_probability?.[i] ?? 0, mm: h.precipitation?.[i] ?? 0 };
        });
        // Pressure change over the last 3 hours (hPa), for rising / falling / steady.
        const pb = h.pressure_msl?.[Math.max(at - 3, 0)];
        const before = pb != null && pb !== "" && Number.isFinite(+pb) ? +pb : null;
        const today = Math.max(dl.time.indexOf(c.time.slice(0, 10)), 0);
        const days = dl.time.slice(today).map((date, k) => {
            const i = today + k;
            return { date, code: dl.weather_code?.[i], min: dl.temperature_2m_min?.[i], max: dl.temperature_2m_max?.[i],
                rain: dl.precipitation_probability_max?.[i] ?? 0, mm: dl.precipitation_sum?.[i] ?? 0,
                sunrise: dl.sunrise?.[i], sunset: dl.sunset?.[i], uvMax: dl.uv_index_max?.[i],
                daylight: dl.daylight_duration?.[i] };
        });
        // Everything from the network is checked before it reaches the page (it is rendered into HTML): times and
        // dates must look like Open-Meteo's ISO strings, numbers must be finite numbers, the place is plain text.
        const n = (x) => (x == null || x === "" || !Number.isFinite(+x) ? null : +x);
        for (const hr of hours) for (const k of ["temp", "code", "isDay", "rain", "mm"]) hr[k] = n(hr[k]) ?? 0;
        for (const d of days) {
            for (const k of ["code", "min", "max", "rain", "mm", "uvMax", "daylight"]) d[k] = n(d[k]) ?? 0;
            if (!T.test(String(d.sunrise))) d.sunrise = null;
            if (!T.test(String(d.sunset))) d.sunset = null;
        }
        const goodHours = hours.filter((hr) => T.test(String(hr.time)));
        const goodDays = days.filter((d) => D.test(String(d.date)));
        if (!goodHours.length || !goodDays.length) throw new Error("Unexpected weather data");
        hours.length = 0; hours.push(...goodHours);
        days.length = 0; days.push(...goodDays);
        for (const k of Object.keys(c)) if (k !== "time") c[k] = n(c[k]);
        p.name = String(p.name == null ? "" : p.name).replace(/[<>&"]/g, "").slice(0, 80);
        return {
            v: 2, place: p.name, fetched: Date.now(), time: c.time, offset: n(d.utc_offset_seconds),
            temp: c.temperature_2m, feels: c.apparent_temperature, humidity: c.relative_humidity_2m,
            dew: c.dew_point_2m, wind: c.wind_speed_10m, windDir: c.wind_direction_10m, gusts: c.wind_gusts_10m,
            cloud: c.cloud_cover, pressure: c.pressure_msl,
            pressureTrend: before != null && c.pressure_msl != null ? c.pressure_msl - before : 0,
            precip: c.precipitation, uv: c.uv_index, visibility: c.visibility,
            code: c.weather_code, isDay: c.is_day,
            min: days[0].min, max: days[0].max, hours, days, air: aq,
        };
    };
})();
