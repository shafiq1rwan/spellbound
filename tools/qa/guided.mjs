// QA: first-run guided tutorial with the world paused. Prints state after each step and saves shots.
//   QA_URL=http://localhost:5174/ node tools/qa/guided.mjs
import { chromium } from "playwright-core";
const URL = process.env.QA_URL ?? "http://localhost:5173/";
const b = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
await p.goto(URL);
await p.evaluate(() => localStorage.clear());
await p.reload();
await p.waitForFunction(() => window.__game?.scene.isActive("Menu"), null, { timeout: 20000 });
await p.keyboard.press("Enter");
await p.waitForFunction(() => window.__game?.scene.isActive("Game"), null, { timeout: 20000 });
await p.waitForTimeout(1500);
const dens = (vs, n = 12) => { const o = []; for (let i = 0; i < vs.length - 1; i++) for (let k = 0; k < n; k++) o.push([vs[i][0] + (vs[i + 1][0] - vs[i][0]) * k / n, vs[i][1] + (vs[i + 1][1] - vs[i][1]) * k / n]); o.push(vs[vs.length - 1]); return o; };
async function draw(pts, cx, cy, s) {
  const P = pts.map(([x, y]) => [cx + x * s, cy + y * s]); const tp = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp(...P[0]) });
  for (const q of P.slice(1)) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: tp(...q) }); await p.waitForTimeout(8); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
const TRI = dens([[0, -0.5], [0.45, 0.4], [-0.45, 0.4], [0, -0.5]]);
const slimeCss = () => p.evaluate(() => { const g = window.__game.scene.getScene("Game"), cam = g.cameras.main, k = cam.zoom / window.devicePixelRatio; const e = g.enemies.find((q) => q.alive); return e ? { x: (e.x - cam.worldView.x) * k, y: (e.y - e.height - cam.worldView.y) * k, wx: Math.round(e.x), wy: Math.round(e.y), hp: e.hp } : null; });
const state = () => p.evaluate(() => { const g = window.__game.scene.getScene("Game"); const h = window.__game.scene.getScene("HUD"); return { paused: g.worldPaused, tutorial: g.tutorial, wave: g.wave, alive: g.enemies.filter((e) => e.alive).length, slotsShown: h.slots.filter((s) => s.c.visible).map((s) => s.id).join(",") }; });
const shot = (n) => p.screenshot({ path: `qa-shots/guided_${n}.png`, clip: { x: 0, y: 60, width: 390, height: 600 } });
const s1 = await slimeCss();
await p.waitForTimeout(2000);
const s1b = await slimeCss();
console.log("1. slime held still for 2s:", s1.wx === s1b.wx && s1.wy === s1b.wy, JSON.stringify(await state()));
await shot("1_trace");
await draw(Array.from({ length: 20 }, (_, i) => [i / 19, 0]), s1.x - 60, s1.y, 120); // swipe through it
await p.waitForTimeout(300);
console.log("2. swipe during tutorial -> slime hp:", (await slimeCss())?.hp, "(20 = no damage)");
await shot("2_swipe_rejected");
await p.waitForTimeout(500);
await draw(TRI, s1.x, s1.y, 60);
await p.waitForTimeout(1600);
const s2 = await slimeCss();
console.log("3. traced triangle -> next slime at", s2 && `${s2.wx},${s2.wy}`, JSON.stringify(await state()));
await shot("3_aim");
await draw(TRI, s2.x, s2.y, 60);
await p.waitForTimeout(1200);
await shot("4_survive");
await p.waitForTimeout(1500);
console.log("4. after aim step:", JSON.stringify(await state()));
console.log("events:", (await p.evaluate(() => window.__analytics.log.filter((e) => e.category === "tutorial" || e.category === "drawing").map((e) => e.what + ":" + e.action))).join(", "));
await b.close();
