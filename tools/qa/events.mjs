// QA: plays a short scripted session and prints every analytics event the game sent, so the event
// stream can be checked before a Poki playtest.
//   QA_URL=http://localhost:5174/ node tools/qa/events.mjs
import { chromium } from "playwright-core";

const URL = process.env.QA_URL ?? "http://localhost:5173/";
const b = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })).newPage();
const cdp = await p.context().newCDPSession(p);
p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
const sleep = (ms) => p.waitForTimeout(ms);
async function draw(points, cx, cy, s) {
  const P = points.map(([x, y]) => [cx + x * s, cy + y * s]);
  const tp = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp(...P[0]) });
  for (const q of P.slice(1)) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: tp(...q) }); await sleep(8); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
const dens = (vs, n = 12) => { const o = []; for (let i = 0; i < vs.length - 1; i++) for (let k = 0; k < n; k++) o.push([vs[i][0] + (vs[i + 1][0] - vs[i][0]) * k / n, vs[i][1] + (vs[i + 1][1] - vs[i][1]) * k / n]); o.push(vs[vs.length - 1]); return o; };
const TRI = dens([[0, -0.5], [0.45, 0.4], [-0.45, 0.4], [0, -0.5]]);
const VEE = dens([[-0.38, -0.42], [0, 0.42], [0.38, -0.42]]);
const SCRIBBLE = dens([[-0.4, 0], [0.4, 0.05], [-0.1, 0.1], [0.3, -0.2]]);

await p.goto(URL);
await p.evaluate(() => localStorage.clear()); // first-time player: tutorial runs
await p.reload();
await p.waitForFunction(() => window.__game?.scene.isActive("Menu"), null, { timeout: 20000 });
await sleep(400);
await p.keyboard.press("Enter");
await p.waitForFunction(() => window.__game?.scene.isActive("Game"), null, { timeout: 20000 });
await sleep(1200);
await draw(SCRIBBLE, 195, 330, 110);          // a failed attempt during the tutorial
await sleep(400);
await draw(TRI, 195, 330, 110);               // the tutorial fireball
await sleep(4500);                            // tutorial completes, wave 1 starts
await p.evaluate(() => { const g = window.__game.scene.getScene("Game"); g.spells.levels.arcane = 1; g.spawner.spawnAt("bat", 40, -60, false, true); g.spawner.spawnAt("bat", -40, -60, false, true); });
await sleep(400);
await draw(VEE, 195, 330, 110);               // V -> Arcane Barrage
await sleep(1500);
await p.evaluate(() => { const g = window.__game.scene.getScene("Game"); g.xp.add(12); });
await sleep(2500);
await p.keyboard.press("1");                  // pick an upgrade
await sleep(800);
await p.evaluate(() => { const g = window.__game.scene.getScene("Game"); g.spawner.spawnAt("skeleton", 20, -20, false, true); });
await sleep(400);
await p.evaluate(() => { const g = window.__game.scene.getScene("Game"); g.damagePlayer(9, 20, -20, true, "skeleton"); });
await sleep(4500);
const log = await p.evaluate(() => window.__analytics.log.map((e) => `${e.category} | ${e.what} | ${e.action}`));
console.log(log.join("\n"));
console.log(`\n${log.length} events`);
await b.close();
