// QA: frames of the spawn portal and the level-up pillar in the real game, in slow motion (0.15x) so each
// screenshot lands mid-effect. Saves qa-shots/fx_spawn_*.png and qa-shots/fx_levelup_*.png.
//   QA_URL=http://localhost:5173/ node tools/qa/fxshots.mjs [width height dpr]
import { chromium } from "playwright-core";
const URL = process.env.QA_URL ?? "http://localhost:5173/";
const [W = "390", H = "844", DPR = "2"] = process.argv.slice(2);
const SLOW = 0.15;
const b = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const p = await (await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: +DPR })).newPage();
p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
await p.goto(URL);
await p.evaluate(() => localStorage.setItem("spellbound-arena.v2", JSON.stringify({ version: 2, tutorialDone: true, settings: {} })));
await p.reload();
await p.waitForFunction(() => window.__game?.scene.isActive("Menu"), null, { timeout: 30000 });
await p.keyboard.press("Enter");
await p.waitForFunction(() => window.__game?.scene.isActive("Game"), null, { timeout: 30000 });
await p.waitForTimeout(1500);
const slow = (k) => p.evaluate((k) => {
  const g = window.__game.scene.getScene("Game");
  g.time.timeScale = k; g.tweens.timeScale = k; g.anims.globalTimeScale = k;
}, k);
await p.evaluate(() => {
  const g = window.__game.scene.getScene("Game");
  g.damagePlayer = () => false;
  g.spawner.update = () => {}; // only our spawns
  for (const e of g.enemies) if (e.alive) e.die();
});
await p.waitForTimeout(800);
await slow(SLOW);
await p.evaluate(() => {
  const g = window.__game.scene.getScene("Game"), w = g.wizard;
  [["slime", -90, -150], ["skeleton", 70, -170], ["bat", -60, 150], ["golem", 80, 140]].forEach(([k, dx, dy]) => g.spawner.spawnAt(k, w.x + dx, w.y + dy, false, false));
});
const t0 = Date.now();
for (const ms of [40, 200, 380, 520, 700, 900]) {
  await p.waitForTimeout(Math.max(0, ms / SLOW - (Date.now() - t0)));
  await p.screenshot({ path: `qa-shots/fx_spawn_${ms}.png` });
}
await slow(1);
await p.waitForTimeout(400);
await p.evaluate(() => { const g = window.__game.scene.getScene("Game"); for (const e of g.enemies) if (e.alive) e.die(); });
await p.waitForTimeout(800);
await slow(SLOW);
await p.evaluate(() => window.__game.scene.getScene("Game").openUpgrade());
const t1 = Date.now();
for (const ms of [60, 150, 300, 450]) {
  await p.waitForTimeout(Math.max(0, ms / SLOW - (Date.now() - t1)));
  await p.screenshot({ path: `qa-shots/fx_levelup_${ms}.png` });
}
await p.waitForFunction(() => window.__game.scene.isActive("Upgrade"), null, { timeout: 20000 });
await p.waitForTimeout(300);
await p.screenshot({ path: `qa-shots/fx_levelup_cards.png` });
await b.close();
console.log("saved qa-shots/fx_spawn_*.png, fx_levelup_*.png");
