// QA: the wave-2 rune unlock (banner + pictogram + sample drawing), optionally with a level-up during it.
//   QA_URL=http://localhost:4173/ node tools/qa/unlock.mjs [width height dpr] [levelup 0|1] [notch css px]
// notch: simulates a phone notch / status bar by padding the safe-area probe (#safe) at the top.
import { chromium } from "playwright-core";
const URL = process.env.QA_URL ?? "http://localhost:5173/";
const [W = "390", H = "844", DPR = "2", LV = "1", NOTCH = "0"] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const p = await (await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: +DPR })).newPage();
p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
if (+NOTCH) await p.addInitScript((n) => document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = `#safe{padding-top:${n}px !important}`; document.head.appendChild(st); }), +NOTCH);
await p.goto(URL);
await p.evaluate(() => localStorage.setItem("spellbound-arena.v2", JSON.stringify({ version: 2, tutorialDone: true, settings: {} })));
await p.reload();
await p.waitForFunction(() => window.__game?.scene.isActive("Menu"), null, { timeout: 30000 });
await p.waitForTimeout(1500);
await p.keyboard.press("Enter");
await p.waitForFunction(() => window.__game?.scene.isActive("Game"), null, { timeout: 30000 });
await p.waitForTimeout(1500);
await p.evaluate(() => { const g = window.__game.scene.getScene("Game"); for (const e of g.enemies) if (e.alive) e.die(); g.spawner.startWave(2); });
const tag = `${W}x${H}${+NOTCH ? "_notch" + NOTCH : ""}`;
const shot = (name) => p.screenshot({ path: `qa-shots/unlock_${tag}_${name}.png` });
const t0 = Date.now(), timeline = [];
let leveled = false, cardsAt = null, demoEnd = null, shots = 0;
while (Date.now() - t0 < 7000) {
  const ms = Date.now() - t0;
  if (LV === "1" && !leveled && ms > 600) { leveled = true; await p.evaluate(() => { const g = window.__game.scene.getScene("Game"); g.xp.add(g.xp.toNext); }); }
  const st = await p.evaluate(() => ({ demo: window.__game.scene.isActive("Tutorial"), cards: window.__game.scene.isActive("Upgrade") }));
  if (st.demo) demoEnd = ms;
  if (st.cards && cardsAt === null) { cardsAt = ms; await shot("3_cards"); }
  if (shots === 0 && ms > 700) { shots++; await shot("1_banner"); }
  if (shots === 1 && ms > 1900) { shots++; await shot("2_drawing"); }
  await p.waitForTimeout(150);
}
console.log(`${tag}: sample drawing on screen until ~${demoEnd} ms; level-up cards opened at ${cardsAt ?? "never"} ms${cardsAt && demoEnd && cardsAt > demoEnd ? " (after the unlock finished)" : ""}`);
await b.close();
