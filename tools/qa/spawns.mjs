// QA: where enemies appear. Runs a wave with the wizard untouchable and no spells, records every spawn
// (on screen or not, distance from the wizard, inside a HUD area or not) and saves a screenshot.
//   QA_URL=http://localhost:5174/ node tools/qa/spawns.mjs [wave] [seconds] [width height dpr] [tag]
import { chromium } from "playwright-core";
const URL = process.env.QA_URL ?? "http://localhost:5173/";
const [WAVE = "6", SECS = "10", W = "390", H = "844", DPR = "2", TAG = ""] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const p = await (await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: +DPR })).newPage();
p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
await p.goto(URL);
await p.evaluate(() => localStorage.setItem("spellbound-arena.v2", JSON.stringify({ version: 2, tutorialDone: true, settings: {} })));
await p.reload();
await p.waitForFunction(() => window.__game?.scene.isActive("Menu"), null, { timeout: 30000 });
await p.keyboard.press("Enter");
await p.waitForFunction(() => window.__game?.scene.isActive("Game"), null, { timeout: 30000 });
await p.waitForTimeout(1200);
await p.evaluate((wave) => {
  const g = window.__game.scene.getScene("Game");
  g.damagePlayer = () => false;
  for (const e of g.enemies) if (e.alive) e.die();
  window.__spawns = [];
  const orig = g.spawner.spawnAt.bind(g.spawner);
  g.spawner.spawnAt = (k, x, y, elite, instant) => {
    const e = orig(k, x, y, elite, instant), v = g.cameras.main.worldView, w = g.wizard;
    window.__spawns.push({ k, d: Math.round(Math.hypot(x - w.x, y - w.y)), sx: x - v.x, sy: y - v.y, vw: v.width, vh: v.height });
    return e;
  };
  g.spawner.startWave(+wave);
}, WAVE);
await p.waitForTimeout(+SECS * 1000);
const r = await p.evaluate(() => {
  const g = window.__game.scene.getScene("Game"), L = { top: 0 }, v = g.cameras.main.worldView;
  const alive = g.enemies.filter((e) => e.alive), on = alive.filter((e) => g.inView(e)).length;
  const S = window.__spawns, onSpawn = S.filter((s) => s.sx >= 0 && s.sx <= s.vw && s.sy >= 0 && s.sy <= s.vh).length;
  const ds = S.map((s) => s.d).sort((a, b) => a - b);
  return { spawned: S.length, spawnedOnScreen: onSpawn, minDist: ds[0], medianDist: ds[Math.floor(ds.length / 2)], alive: alive.length, aliveOnScreen: on };
});
console.log(`wave ${WAVE}, ${SECS}s, ${W}x${H}: ${r.spawned} spawns, ${r.spawnedOnScreen} of them on screen; spawn distance min ${r.minDist} / median ${r.medianDist} art px; now ${r.alive} alive, ${r.aliveOnScreen} on screen`);
await p.screenshot({ path: `qa-shots/spawns_${W}x${H}${TAG ? "_" + TAG : ""}.png` });
await b.close();
