// QA: what fills the Game scene's display list over a long run? A god-mode bot plays (like soak.mjs) and
// every `step` seconds this prints the live Game objects grouped by type and texture, so anything that is
// created and never destroyed shows up as a growing line.
//   QA_URL=http://localhost:5173/ node tools/qa/objects.mjs [seconds] [step] [startWave]
import { chromium } from "playwright-core";
const URL = process.env.QA_URL ?? "http://localhost:5173/";
const [SEC = "240", STEP = "60", START = "1"] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })).newPage();
p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
await p.goto(URL);
await p.evaluate(() => localStorage.setItem("spellbound-arena.v2", JSON.stringify({ version: 2, tutorialDone: true, settings: {} })));
await p.reload();
await p.waitForFunction(() => window.__game?.scene.isActive("Menu"), null, { timeout: 30000 });
await p.keyboard.press("Enter");
await p.waitForFunction(() => window.__game?.scene.isActive("Game") && window.__game.scene.getScene("Game").wave >= 1, null, { timeout: 30000 });
await p.evaluate((start) => {
  const game = window.__game, g = game.scene.getScene("Game");
  g.damagePlayer = () => false;
  if (start > 1) g.spawner.startWave(start);
  setInterval(() => {
    if (!g.sys.isActive() || g.over) return;
    const w = g.wizard, ts = g.targets();
    if (!ts.length) return;
    const ready = (s) => g.spells.levels[s] > 0 && g.spells.cooldownFrac(s) === 0;
    const id = ["nova", "lightning", "arcane", "fireball"].find(ready) ?? "fireball";
    const t = ts.reduce((a, c) => (Math.hypot(c.x - w.x, c.y - w.y) < Math.hypot(a.x - w.x, a.y - w.y) ? c : a));
    g.spells.cast(id, t.x, t.y - t.height);
  }, 700);
  setInterval(() => {
    const u = game.scene.getScene("Upgrade");
    if (u && u.sys.isActive() && u.ready && !u.picked) u.pick(0);
  }, 300);
}, +START);
const hist = () => p.evaluate(() => {
  const g = window.__game.scene.getScene("Game"), h = {};
  for (const o of g.children.list) {
    const k = `${o.type}:${o.texture?.key ?? "-"}${o.visible === false ? " (hidden)" : ""}`;
    h[k] = (h[k] ?? 0) + 1;
  }
  return { wave: g.wave, alive: g.enemies.filter((e) => e.alive).length, total: g.children.list.length, h };
});
let prev = await hist();
console.log(`start: wave ${prev.wave}, ${prev.total} objects`);
for (let t = +STEP; t <= +SEC; t += +STEP) {
  await p.waitForTimeout(+STEP * 1000);
  const cur = await hist();
  const grew = Object.entries(cur.h).map(([k, v]) => [k, v, v - (prev.h[k] ?? 0)]).filter(([, , d]) => d !== 0).sort((a, b) => b[2] - a[2]);
  const kinds = await p.evaluate(() => {
    const k = {};
    for (const e of window.__game.scene.getScene("Game").enemies) if (e.alive) k[e.kind] = (k[e.kind] ?? 0) + 1;
    return Object.entries(k).map(([a, n]) => `${a} ${n}`).join(", ");
  });
  console.log(`\n+${t}s: wave ${cur.wave}, ${cur.alive} enemies alive (${kinds}), ${cur.total} objects`);
  for (const [k, v, d] of grew.slice(0, 12)) console.log(`  ${String(d > 0 ? "+" + d : d).padStart(5)}  ${String(v).padStart(4)}  ${k}`);
  prev = cur;
}
await b.close();
