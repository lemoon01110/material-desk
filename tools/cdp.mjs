// node tools/cdp.mjs eval "<js>" | shot out.png [x y w h] | nav URL | nocache | drag X1 Y1 X2 Y2
// Env: CDP_PORT (default 9333), TARGET (substring of the page URL to attach to). Start Chrome with
// --remote-debugging-port=PORT (headless is fine: google-chrome-stable --headless=new --user-data-dir=$(mktemp -d) --remote-debugging-port=PORT URL).
// node cdp.mjs eval "<js>" | shot out.png [x y w h] | nav url
import fs from "fs";
const port = +(process.env.CDP_PORT || 9333);
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const t = targets.find(t => t.type === "page" && (!process.env.TARGET || t.url.includes(process.env.TARGET)));
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = {};
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
await new Promise(r => ws.onopen = r);
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const [cmd, a, ...rest] = process.argv.slice(2);
if (cmd === "eval") {
  const r = await send("Runtime.evaluate", { expression: a, awaitPromise: true, returnByValue: true });
  console.log(JSON.stringify(r.result.result?.value ?? r.result, null, 1));
} else if (cmd === "shot") {
  const p = { format: "png" };
  if (rest.length === 4) p.clip = { x: +rest[0], y: +rest[1], width: +rest[2], height: +rest[3], scale: 1 };
  const r = await send("Page.captureScreenshot", p);
  fs.writeFileSync(a, Buffer.from(r.result.data, "base64"));
  console.log("saved", a);
} else if (cmd === "drag") {
  // drag X1 Y1 X2 Y2 (CSS px): a real mouse drag in 10 steps
  const [x1, y1, x2, y2] = [a, ...rest].map(Number);
  const m = (type, x, y, extra = {}) => send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1, ...extra });
  await m("mouseMoved", x1, y1, { buttons: 0 }); await m("mousePressed", x1, y1);
  for (let i = 1; i <= 10; i++) { await m("mouseMoved", x1 + (x2 - x1) * i / 10, y1 + (y2 - y1) * i / 10); await new Promise(r => setTimeout(r, 20)); }
  await m("mouseReleased", x2, y2); console.log("dragged");
} else if (cmd === "press" || cmd === "move" || cmd === "release") {
  // press X Y | move X Y | release X Y: one mouse step each (for screenshots mid-drag)
  const type = { press: "mousePressed", move: "mouseMoved", release: "mouseReleased" }[cmd];
  if (cmd === "press") await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: +a, y: +rest[0], buttons: 0 });
  await send("Input.dispatchMouseEvent", { type, x: +a, y: +rest[0], button: "left", buttons: cmd === "release" ? 0 : 1, clickCount: 1 });
  console.log(cmd);
} else if (cmd === "nocache") {
  await send("Network.clearBrowserCache"); console.log("cleared");
} else if (cmd === "nav") {
  await send("Page.navigate", { url: a }); await new Promise(r => setTimeout(r, 4000)); console.log("ok");
}
ws.close();
