// QA: death -> revive offer (dev build simulates the rewarded ad) -> revived run continues ->
// second death offers no revive. Also measures time to the first level-up in a fresh run.
//   QA_URL=http://localhost:5174/ node tools/qa/revive.mjs   (dev server WITHOUT VITE_POKI=off is fine)
import { chromium } from "playwright-core";
const URL = process.env.QA_URL ?? "http://localhost:5173/";
const b = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
await p.goto(URL);
await p.evaluate(() => localStorage.setItem("spellbound-arena.v2", JSON.stringify({ version: 2, tutorialDone: true, settings: {} })));
await p.reload();
await p.waitForFunction(() => window.__game?.scene.isActive("Menu"), null, { timeout: 20000 });
await p.keyboard.press("Enter");
await p.waitForFunction(() => window.__game?.scene.isActive("Game"), null, { timeout: 20000 });
const G = () => p.evaluate(() => { const g = window.__game.scene.getScene("Game"); return { over: g.over, hp: g.hp, lvl: g.xp.level, t: Math.round(g.stats.timeMs / 100) / 10, hud: window.__game.scene.getScene("HUD").sys.settings.visible, wiz: g.wizard.dead }; });
await p.waitForTimeout(1000);
await p.evaluate(() => window.__game.scene.getScene("Game").damagePlayer(9, 10, 0, true, "slime"));
await p.waitForFunction(() => window.__game.scene.isActive("GameOver"), null, { timeout: 10000 });
await p.waitForTimeout(700);
await p.screenshot({ path: "qa-shots/revive_offer.png", clip: { x: 0, y: 150, width: 390, height: 600 } });
const labels = await p.evaluate(() => window.__game.scene.getScene("GameOver").btns.map((b) => b.label.text + (b.icon ? "+icon" : "") + ":" + b.bw + "x" + b.bh));
console.log("buttons:", labels.join(" | "));
// click REVIVE (third button)
await p.evaluate(() => { const go = window.__game.scene.getScene("GameOver"); const rb = go.btns[2]; rb.up.emit("pointerdown"); rb.up.emit("pointerup"); });
await p.waitForTimeout(1500);
console.log("after revive:", JSON.stringify(await G()));
await p.screenshot({ path: "qa-shots/revive_after.png", clip: { x: 0, y: 150, width: 390, height: 600 } });
await p.waitForTimeout(3500);
await p.evaluate(() => window.__game.scene.getScene("Game").damagePlayer(9, 10, 0, true, "bat"));
await p.waitForFunction(() => window.__game.scene.isActive("GameOver"), null, { timeout: 10000 });
await p.waitForTimeout(700);
console.log("second death buttons:", (await p.evaluate(() => window.__game.scene.getScene("GameOver").btns.map((b) => b.label.text))).join(" | "));
console.log("events:", (await p.evaluate(() => window.__analytics.log.filter((e) => ["revive", "wave", "death", "gameover"].includes(e.category)).map((e) => e.category + ":" + e.what + ":" + e.action))).join(", "));
// retry -> time to first level-up in a fresh run
await p.keyboard.press("Enter");
await p.waitForFunction(() => window.__game.scene.isActive("Game") && !window.__game.scene.getScene("Game").over, null, { timeout: 15000 });
const t0 = Date.now();
await p.evaluate(() => {
  const g = window.__game.scene.getScene("Game");
  setInterval(() => { const ts = g.targets(); if (!ts.length || g.over) return; const t = ts[0]; g.spells.cast("fireball", t.x, t.y - t.height); }, 1800);
});
await p.waitForFunction(() => window.__game.scene.getScene("Game").xp.level >= 2 || window.__game.scene.isActive("Upgrade"), null, { timeout: 90000 });
console.log(`first level-up after ${((Date.now() - t0) / 1000).toFixed(1)}s of play (casting a fireball every 1.8s)`);
await b.close();
