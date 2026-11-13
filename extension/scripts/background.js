// Material Desk background worker: apply updates promptly.
//
// 1. Chrome downloads an update at startup but holds it while any page of this extension is open, and the new tab
//    page is open from the moment Chrome starts, so an update could wait for days. When an update is waiting, reload
//    into it as soon as no new tab page is open (checked now and a moment after any tab closes), so the next new tab
//    is already the new version.
//
// 2. Self-hosted installs (the optional desktop integration, tools/build.sh local): Chrome checks such an extension
//    only at startup and every few hours, so every new tab asks the worker, which requests a check at most every 3
//    minutes. Store installs are updated by the Chrome Web Store; the extra check is harmless there.

async function applyIfIdle() {
    const { updatePending } = await chrome.storage.session.get("updatePending");
    if (!updatePending) return;
    const open = await chrome.runtime.getContexts({ contextTypes: ["TAB"] });
    if (open.length === 0) chrome.runtime.reload();
}

chrome.runtime.onUpdateAvailable.addListener(async () => {
    await chrome.storage.session.set({ updatePending: true });
    applyIfIdle();
});

// A moment after a tab closes, so the closed page is gone from the open contexts.
chrome.tabs.onRemoved.addListener(() => { setTimeout(applyIfIdle, 1000); });
// ...or when a new tab goes on to a website (the usual path), which closes no tab. change.url is only given with the
// tabs permission, which the extension does not ask for, so a page starting to load is the signal.
chrome.tabs.onUpdated.addListener((id, change) => { if (change.status === "loading") setTimeout(applyIfIdle, 1000); });

let lastCheck = 0;
function checkForUpdate() {
    if (Date.now() - lastCheck < 3 * 60 * 1000) return;
    lastCheck = Date.now();
    chrome.runtime.requestUpdateCheck().catch(() => { /* throttled or offline: try on a later tab */ });
}
chrome.runtime.onStartup.addListener(checkForUpdate);
chrome.runtime.onMessage.addListener((msg) => { if (msg && msg.type === "lemon-check-update") checkForUpdate(); });
