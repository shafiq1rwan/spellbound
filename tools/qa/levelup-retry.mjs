// QA: regression for the v1.9.2 freeze. A level-up in a second run (after TRY AGAIN) used a level-up
// sprite destroyed with the first run; the error stopped Phaser's loop and froze the game. Plays a
// level-up, dies, retries, levels up again, and checks for page errors and that frames keep coming.
//   QA_URL=http://localhost:5173/ node tools/qa/levelup-retry.mjs
import { chromium } from "playwright-core";
const URL = process.env.QA_URL ?? "http://localhost:5173/";
const b = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
if (process.env.QA_DEBUG) { p.on("framenavigated", (f) => f === p.mainFrame() && console.log("  [navigated]", f.url())); p.on("console", (m) => console.log("  [console]", m.type(), m.text().slice(0, 160))); p.on("crash", () => console.log("  [crash]")); }
await p.addInitScript(() => { window.__frames = 0; const f = () => { window.__frames++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
await p.goto(URL);
await p.evaluate(() => localStorage.setItem("spellbound-arena.v2", JSON.stringify({ version: 2, tutorialDone: true, settings: {} })));
await p.reload();
await p.waitForFunction(() => window.__game?.scene.isActive("Menu"), null, { timeout: 30000 });
await p.waitForTimeout(2500); // the level-up sheet loads in the background after the menu appears
await p.keyboard.press("Enter");
const levelUp = async (label) => {
  // a new run has started (not the old one still showing behind the game-over screen) and is 1.5 s in
  await p.waitForFunction(() => { const G = window.__game, g = G.scene.getScene("Game"); return G.scene.isActive("Game") && !G.scene.isActive("GameOver") && !g.over && g.stats.timeMs > 1500; }, null, { timeout: 30000 });
  await p.evaluate(() => window.__game.scene.getScene("Game").openUpgrade());
  const opened = await p.waitForFunction(() => window.__game.scene.isActive("Upgrade") && window.__game.scene.getScene("Upgrade").ready, null, { timeout: 8000 }).then(() => true, () => false);
  if (opened) await p.evaluate(() => window.__game.scene.getScene("Upgrade").pick(0));
  const f0 = await p.evaluate(() => window.__game.loop.frame);
  await p.waitForTimeout(1500);
  const f1 = await p.evaluate(() => window.__game.loop.frame);
  console.log(`${label}: cards opened ${opened}, game loop advanced ${f1 - f0} frames in 1.5 s, errors so far: ${errors.length ? errors.join(" | ") : "none"}`);
};
await levelUp("run 1 level-up");
await p.evaluate(() => { const g = window.__game.scene.getScene("Game"); g.hp = 1; g.damagePlayer(5, g.wizard.x + 10, g.wizard.y, false, "test"); });
await p.waitForFunction(() => window.__game.scene.isActive("GameOver"), null, { timeout: 30000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__game.scene.getScene("GameOver").retry());
await levelUp("run 2 level-up (after TRY AGAIN)");
// safety net: an error thrown inside one frame must not stop the game loop
await p.evaluate(() => { window.__game.events.once("prerender", () => { throw new Error("injected test error"); }); });
const f0 = await p.evaluate(() => window.__game.loop.frame);
await p.waitForTimeout(1500);
const f1 = await p.evaluate(() => window.__game.loop.frame);
const reported = await p.evaluate(() => window.__analytics.log.filter((e) => e.category === "error").map((e) => e.what));
console.log(`injected error: game loop advanced ${f1 - f0} frames in 1.5 s afterwards; reported as ${JSON.stringify(reported)}`);
await b.close();
