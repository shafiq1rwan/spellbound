// QA: estimates GPU fill load in a late-game fight. Every 250 ms it adds up the on-screen area
// (device pixels) of everything drawn with additive blending, by category, and reports peak and
// average as "screens" (1.0 = the whole screen painted once more).
//   QA_URL=http://localhost:5174/ node tools/qa/overdraw.mjs [wave] [seconds] [pets 0|1]
import { chromium } from "playwright-core";
const URL = process.env.QA_URL ?? "http://localhost:5173/";
const wave = Number(process.argv[2] ?? 20), secs = Number(process.argv[3] ?? 15), pets = Number(process.argv[4] ?? 1);
const b = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
await p.goto(URL);
await p.evaluate(() => localStorage.setItem("spellbound-arena.v2", JSON.stringify({ version: 2, tutorialDone: true, settings: {} })));
await p.reload();
await p.waitForFunction(() => window.__game?.scene.isActive("Menu"), null, { timeout: 20000 });
await p.keyboard.press("Enter");
await p.waitForFunction(() => window.__game?.scene.isActive("Game"), null, { timeout: 20000 });
await p.waitForTimeout(1200);
await p.evaluate(({ wave, pets }) => {
  const g = window.__game.scene.getScene("Game");
  for (const s of ["fireball", "nova", "lightning", "arcane"]) { g.spells.levels[s] = 5; g.upgrades.counts[`spell:${s}`] = 4; }
  Object.assign(g.upgrades.counts, { haste: 4, vitality: 3, magnet: 3, power: 3, wisdom: 3 });
  g.spells.cdMult = Math.pow(0.88, 4);
  if (!pets) g.familiars.update = () => {};
  g.damagePlayer = () => false;
  g.spawner.startWave(wave);
  const ids = ["fireball", "nova", "lightning", "arcane"]; let k = 0;
  setInterval(() => { const ts = g.targets(); if (!ts.length) return; const t = ts[Math.floor(Math.random() * ts.length)];
    for (let i = 0; i < 4; i++) { const id = ids[k++ % 4]; if (g.spells.cooldownFrac(id) === 0) { g.spells.cast(id, t.x, t.y - t.height); break; } } }, 600);
  window.__od = [];
  const cam = g.cameras.main, z = cam.zoom, screen = g.scale.width * g.scale.height;
  setInterval(() => {
    if (!g.sys.isActive()) return;
    const v = cam.worldView, cat = {};
    const addA = (k, a) => { cat[k] = (cat[k] ?? 0) + a; };
    for (const o of g.children.list) {
      if (!o.visible || o.alpha <= 0.01) continue;
      if (o.type === "ParticleEmitter") {
        if (o.blendMode !== 1) continue;
        let n = 0; o.alive.forEach((pt) => { n += (pt.scaleX * o.frame.width * z) * (pt.scaleY * o.frame.height * z); });
        addA("particles", n); continue;
      }
      if (o.blendMode !== 1 || !o.displayWidth) continue;
      const w = Math.min(o.displayWidth, v.width * 2), h = Math.min(o.displayHeight, v.height * 2);
      // clip to the screen
      const x0 = Math.max(v.x, o.x - w * o.originX), x1 = Math.min(v.right, o.x + w * (1 - o.originX));
      const y0 = Math.max(v.y, o.y - h * o.originY), y1 = Math.min(v.bottom, o.y + h * (1 - o.originY));
      if (x1 <= x0 || y1 <= y0) continue;
      const area = (x1 - x0) * (y1 - y0) * z * z;
      const key = o.type === "Rectangle" ? "flash (full screen)" : o.texture?.key?.startsWith("glow") ? "glow" : o.type === "Graphics" ? "bolt" : `${o.texture?.key}`;
      addA(key, area);
    }
    const total = Object.values(cat).reduce((a, c) => a + c, 0);
    window.__od.push({ total: total / screen, cat: Object.fromEntries(Object.entries(cat).map(([k, a]) => [k, a / screen])) });
  }, 250);
}, { wave, pets });
await p.waitForTimeout(secs * 1000);
const od = await p.evaluate(() => window.__od);
const avg = od.reduce((a, c) => a + c.total, 0) / od.length;
const peak = od.reduce((a, c) => (c.total > a.total ? c : a));
const byCat = {};
for (const s of od) for (const [k, v] of Object.entries(s.cat)) byCat[k] = (byCat[k] ?? 0) + v / od.length;
console.log(`pets ${pets ? "on" : "off"}: additive overdraw avg ${avg.toFixed(2)} screens/frame, peak ${peak.total.toFixed(2)}`);
console.log("avg by source:", Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(" | "));
console.log("peak frame:", Object.entries(peak.cat).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(" | "));
await b.close();
