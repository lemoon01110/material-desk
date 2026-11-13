// Dev only (tools/dev.sh): enough of the chrome.* extension APIs for the page to run on http://127.0.0.1.
// storage.local persists in localStorage ("mock:" keys); bookmarks live in memory (seeded below, reset on reload).
// storage.managed returns the managed look written by tools/dev.sh (like the optional desktop integration), or
// nothing with ?store, which is how a Chrome Web Store install sees it (the Wallpaper settings are then in charge).
(function () {
  const ev = () => { const l = []; return { addListener: (f) => l.push(f), removeListener: (f) => { const i = l.indexOf(f); if (i >= 0) l.splice(i, 1); }, _fire: (...a) => l.forEach((f) => f(...a)) }; };
  const cbOrPromise = (v, cb) => { if (cb) { setTimeout(() => cb(v), 0); return; } return Promise.resolve(v); };
  const chrome = window.chrome = window.chrome || {};
  const changed = ev();
  chrome.storage = {
    local: {
      get(keys, cb) {
        const all = JSON.parse(localStorage.getItem("mock:local") || "{}");
        let out = {};
        if (keys == null) out = all;
        else if (typeof keys === "string") { if (keys in all) out[keys] = all[keys]; }
        else if (Array.isArray(keys)) keys.forEach((k) => { if (k in all) out[k] = all[k]; });
        else Object.keys(keys).forEach((k) => { out[k] = k in all ? all[k] : keys[k]; });
        return cbOrPromise(JSON.parse(JSON.stringify(out)), cb);
      },
      set(items, cb) {
        const all = JSON.parse(localStorage.getItem("mock:local") || "{}");
        Object.assign(all, items); localStorage.setItem("mock:local", JSON.stringify(all));
        changed._fire(Object.fromEntries(Object.entries(items).map(([k, v]) => [k, { newValue: v }])), "local");
        return cbOrPromise(undefined, cb);
      },
      remove(keys, cb) {
        const all = JSON.parse(localStorage.getItem("mock:local") || "{}");
        [].concat(keys).forEach((k) => delete all[k]); localStorage.setItem("mock:local", JSON.stringify(all));
        return cbOrPromise(undefined, cb);
      },
    },
    session: { get: (k, cb) => cbOrPromise({}, cb), set: (i, cb) => cbOrPromise(undefined, cb) },
    managed: { get: (k, cb) => cbOrPromise(new URLSearchParams(location.search).has("store") ? {} : (window.__devLook || {}), cb) },
    onChanged: changed,
  };
  // Bookmarks: a small tree like Chrome's (0 = root, 1 = Bookmarks bar, 2 = Other, 3 = Mobile).
  let next = 100;
  const node = (title, url, children) => ({ id: String(next++), title, url, dateAdded: Date.now() - next * 6e6, children });
  const tree = { id: "0", title: "", children: [
    { id: "1", title: "Bookmarks bar", parentId: "0", children: [
      node("GitHub", "https://github.com/"), node("Wikipedia", "https://www.wikipedia.org/"),
      node("Reading", undefined, [node("Example News", "https://news.example.com/"), node("Example Blog", "https://blog.example.org/")]),
      node("MDN Web Docs", "https://developer.mozilla.org/"), node("YouTube", "https://www.youtube.com/"),
    ] },
    { id: "2", title: "Other bookmarks", parentId: "0", children: [node("Example Recipes", "https://recipes.example.net/")] },
    { id: "3", title: "Mobile bookmarks", parentId: "0", children: [] },
  ] };
  if (new URLSearchParams(location.search).has("noBookmarks")) tree.children.forEach((r) => (r.children = []));
  const fix = (n, parentId) => { if (parentId) n.parentId = parentId; (n.children || []).forEach((c, i) => { c.index = i; fix(c, n.id); }); if (n.url) delete n.children; };
  fix(tree);
  const find = (id, n = tree) => { if (n.id === id) return n; for (const c of n.children || []) { const f = find(id, c); if (f) return f; } return null; };
  const clone = (n) => JSON.parse(JSON.stringify(n));
  const strip = (n) => { const c = clone(n); delete c.children; return c; };
  const bm = chrome.bookmarks = {
    onCreated: ev(), onRemoved: ev(), onChanged: ev(), onMoved: ev(),
    getTree: (cb) => cbOrPromise([clone(tree)], cb),
    getSubTree: (id, cb) => cbOrPromise([clone(find(id))], cb),
    getChildren: (id, cb) => cbOrPromise((find(id).children || []).map(strip), cb),
    get: (id, cb) => cbOrPromise([].concat(id).map((i) => strip(find(i))), cb),
    getRecent: (n, cb) => { const all = []; const w = (x) => { if (x.url) all.push(strip(x)); (x.children || []).forEach(w); }; w(tree); all.sort((a, b) => b.dateAdded - a.dateAdded); return cbOrPromise(all.slice(0, n), cb); },
    search: (q, cb) => { const s = (typeof q === "string" ? q : q.query || "").toLowerCase(); const out = []; const w = (x) => { if (x.id !== "0" && ((x.title || "").toLowerCase().includes(s) || (x.url || "").toLowerCase().includes(s))) out.push(strip(x)); (x.children || []).forEach(w); }; w(tree); return cbOrPromise(out, cb); },
    create(o, cb) { const p = find(o.parentId || "2"); const n = { id: String(next++), parentId: p.id, title: o.title || "", dateAdded: Date.now() }; if (o.url) n.url = o.url; else n.children = []; p.children.splice(o.index ?? p.children.length, 0, n); fix(tree); bm.onCreated._fire(n.id, strip(n)); return cbOrPromise(strip(n), cb); },
    update(id, ch, cb) { const n = find(id); Object.assign(n, ch); bm.onChanged._fire(id, ch); return cbOrPromise(strip(n), cb); },
    move(id, dest, cb) { const n = find(id); const old = find(n.parentId); const from = old.children.indexOf(n); old.children.splice(from, 1); const p = find(dest.parentId || n.parentId); let at = dest.index ?? p.children.length; if (p === old && dest.index != null && dest.index > from) at--; /* real Chrome: index counts before removal */ p.children.splice(at, 0, n); fix(tree); bm.onMoved._fire(id, { parentId: p.id }); return cbOrPromise(strip(n), cb); },
    remove(id, cb) { const n = find(id); const p = find(n.parentId); p.children.splice(p.children.indexOf(n), 1); fix(tree); bm.onRemoved._fire(id, { parentId: p.id, node: clone(n) }); return cbOrPromise(undefined, cb); },
  };
  bm.removeTree = bm.remove;
  chrome.runtime = { id: "devlemon", getURL: (p) => p, lastError: undefined, getContexts: () => Promise.resolve([]),
    getManifest: () => ({ version: "dev" }) };
  chrome.permissions = { contains: (_, cb) => cbOrPromise(true, cb), request: (_, cb) => cbOrPromise(true, cb) };
  // chrome.search.query stands in for "the user's default search engine": it logs the call (also kept in
  // window.__searchLog for tests) and goes to a fake results address, so it is plain which path a search took.
  window.__searchLog = [];
  chrome.search = { query: (o) => {
    window.__searchLog.push(o);
    console.log("[mock] chrome.search.query", JSON.stringify(o));
    const url = "https://default-search.example/results?q=" + encodeURIComponent(o.text);
    if (o.disposition === "NEW_TAB" || o.disposition === "NEW_WINDOW") window.open(url); else location.href = url;
    return Promise.resolve();
  } };
  chrome.tabs = { create: (o) => window.open(o.url), update: (o) => { location.href = o.url; }, onRemoved: ev() };
})();
