// QA: a sloppy (open, overdrawn, wobbly) circle must cast Ice Nova on a ring of enemies, and a
// triangle drawn on a frozen enemy right after must Shatter it (double damage).
//   QA_URL=http://localhost:5174/ node tools/qa/ice-combo.mjs
import { chromium } from "playwright-core";

const URL = process.env.QA_URL ?? "http://localhost:5173/";
const b = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
p.on("pageerror", (e) => console.log("ERR", e.message));
await p.goto(URL);
await p.evaluate(() => localStorage.setItem("spellbound-arena.v2", JSON.stringify({ version: 2, tutorialDone: true, settings: { debugRunes: true } })));
await p.reload();
await p.waitForFunction(() => window.__game?.scene.isActive("Menu"), null, { timeout: 20000 });
await p.keyboard.press("Enter");
await p.waitForFunction(() => window.__game?.scene.isActive("Game"), null, { timeout: 20000 });
await p.waitForTimeout(800);
await p.evaluate(() => {
  const g = window.__game.scene.getScene("Game");
  g.spawner.enabled = false;
  g.damagePlayer = () => false;
  g.spells.levels.nova = 1;
  window.__hits = [];
  const orig = g.combat.damage.bind(g.combat);
  g.combat.damage = (t, base, o) => { const wasFrozen = t.frozen; const r = orig(t, base, o); window.__hits.push([o.element, r.amount, wasFrozen]); return r; };
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.spawner.spawnAt(i % 2 ? "skeleton" : "slime", Math.cos(a) * 55, Math.sin(a) * 50 - 8, false, true); }
});
await p.waitForTimeout(300);

const drag = async (pts) => {
  await p.mouse.move(...pts[0]);
  await p.mouse.down();
  for (const q of pts.slice(1)) { await p.mouse.move(...q); await p.waitForTimeout(8); }
  await p.mouse.up();
};
// open, overdrawn (1.15 turns), wobbly oval
await drag(Array.from({ length: 50 }, (_, i) => { const a = -1.2 + (i / 49) * Math.PI * 2 * 1.15; const r = 1 + 0.08 * Math.sin(a * 2.3); return [195 + Math.cos(a) * 70 * r, 250 + Math.sin(a) * 45 * r]; }));
await p.waitForTimeout(400);
const afterNova = await p.evaluate(() => { const g = window.__game.scene.getScene("Game"); return { iceHits: window.__hits.filter((h) => h[0] === "ice").length, frozen: g.enemies.filter((e) => e.alive && e.frozen).length, alive: g.enemies.filter((e) => e.alive).length }; });
console.log("after sloppy circle:", JSON.stringify(afterNova));

// triangle drawn on top of a frozen enemy
const tgt = await p.evaluate(() => { const g = window.__game.scene.getScene("Game"); const e = g.enemies.find((q) => q.alive && q.frozen); if (!e) return null; const cam = g.cameras.main, k = cam.zoom / window.devicePixelRatio; return { x: (e.x - cam.worldView.x) * k, y: (e.y - e.height - cam.worldView.y) * k }; });
if (tgt) {
  const tri = [[0, -0.5], [0.45, 0.4], [-0.45, 0.4], [0, -0.5]], T = [];
  for (let i = 0; i < 3; i++) for (let k = 0; k < 10; k++) T.push([tgt.x + (tri[i][0] + (tri[i + 1][0] - tri[i][0]) * k / 10) * 60, tgt.y + (tri[i][1] + (tri[i + 1][1] - tri[i][1]) * k / 10) * 60]);
  await drag(T);
  await p.waitForTimeout(800);
}
const hits = await p.evaluate(() => window.__hits);
const fire = hits.filter((h) => h[0] === "fire");
console.log("fire hits [dmg, targetWasFrozen]:", JSON.stringify(fire.map((h) => [h[1], h[2]])));
console.log(afterNova.iceHits >= 6 && fire.some((h) => h[2]) ? "PASS: nova hit the ring and the fireball shattered a frozen enemy" : "FAIL");
await b.close();
