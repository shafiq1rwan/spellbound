// QA: the HUD on a phone inside Poki. Emulates a touch phone and draws stand-ins on top of the page for
// Poki's top-left button (65x50 CSS px, 23 px down, measured on a Pixel 7a) and a punch-hole camera
// (top centre in portrait, left side in landscape), then screenshots a run with 8 hearts (the most possible).
//   QA_URL=http://localhost:5173/ node tools/qa/pokiframe.mjs [width height dpr]
import { chromium } from "playwright-core";
const URL = process.env.QA_URL ?? "http://localhost:5173/";
const [W = "412", H = "915", DPR = "2.625"] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const p = await (await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: +DPR, isMobile: true, hasTouch: true })).newPage();
p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
await p.goto(URL);
await p.evaluate(() => localStorage.setItem("spellbound-arena.v2", JSON.stringify({ version: 2, tutorialDone: true, settings: {} })));
await p.reload();
await p.waitForFunction(() => window.__game?.scene.isActive("Menu"), null, { timeout: 30000 });
const overlay = () => p.evaluate(() => {
  const portrait = innerHeight >= innerWidth;
  const add = (css) => { const d = document.createElement("div"); d.style.cssText = "position:fixed;z-index:99;pointer-events:none;" + css; document.body.appendChild(d); };
  add("left:0;top:23px;width:65px;height:50px;border-radius:0 25px 25px 0;background:rgba(255,255,255,.85)");
  if (portrait) add("left:calc(50% - 7px);top:10px;width:14px;height:14px;border-radius:50%;background:#000;outline:2px solid red");
  else add("left:10px;top:calc(50% - 7px);width:14px;height:14px;border-radius:50%;background:#000;outline:2px solid red");
});
await overlay();
await p.screenshot({ path: `qa-shots/poki_menu_${W}x${H}.png` });
await p.evaluate(() => window.__game.scene.getScene("Menu").startRun?.());
await p.waitForFunction(() => window.__game?.scene.isActive("Game"), null, { timeout: 30000 });
await p.waitForTimeout(2500);
await p.evaluate(() => { const g = window.__game.scene.getScene("Game"); g.maxHp = 8; g.hp = 6; g.heal(1); });
await p.waitForTimeout(400);
await p.screenshot({ path: `qa-shots/poki_hud_${W}x${H}.png` });
// the most crowded top of the screen: the wave 2 rune unlock (banner + pictogram) with 8 hearts
await p.evaluate(() => { const g = window.__game.scene.getScene("Game"); for (const e of g.enemies) if (e.alive) e.die(); g.spawner.startWave(2); });
await p.waitForTimeout(900);
await p.screenshot({ path: `qa-shots/poki_unlock_${W}x${H}.png` });
console.log(`${W}x${H}@${DPR}: saved qa-shots/poki_menu_${W}x${H}.png poki_hud_${W}x${H}.png and poki_unlock_${W}x${H}.png`);
await b.close();
