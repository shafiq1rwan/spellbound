// QA: CPU profile of a late-game fight (every spell Lv 5, all 4 familiars, haste maxed).
// Prints the functions with the most self time, grouped, plus frame-time stats.
//   QA_URL=http://localhost:5174/ node tools/qa/profile.mjs [wave] [seconds] [cpuThrottle]
import { chromium } from "playwright-core";
const URL = process.env.QA_URL ?? "http://localhost:5173/";
const wave = Number(process.argv[2] ?? 12), secs = Number(process.argv[3] ?? 10), throttle = Number(process.argv[4] ?? 4);
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
await p.evaluate((wave) => {
  const g = window.__game.scene.getScene("Game");
  for (const s of ["fireball", "nova", "lightning", "arcane"]) { g.spells.levels[s] = 5; g.upgrades.counts[`spell:${s}`] = 4; }
  Object.assign(g.upgrades.counts, { haste: 4, vitality: 3, magnet: 3, power: 3, wisdom: 3 });
  g.spells.cdMult = Math.pow(0.88, 4);
  g.damagePlayer = () => false;
  g.spawner.startWave(wave);
  const ids = ["fireball", "nova", "lightning", "arcane"]; let k = 0;
  setInterval(() => { const ts = g.targets(); if (!ts.length) return; const t = ts[Math.floor(Math.random() * ts.length)];
    for (let i = 0; i < 4; i++) { const id = ids[k++ % 4]; if (g.spells.cooldownFrac(id) === 0) { g.spells.cast(id, t.x, t.y - t.height); break; } } }, 700);
  setInterval(() => { const u = window.__game.scene.getScene("Upgrade"); if (u.sys.isActive() && u.ready && !u.picked && u.choices.length) u.pick(0); }, 300);
  window.__ft = [];
  let last = performance.now();
  window.__long = [];
  const loop = (now) => { const d = now - last; window.__ft.push(d); if (d > 60) window.__long.push({ ms: Math.round(d), wave: g.wave, upgrade: window.__game.scene.isActive("Upgrade"), lvl: g.xp.level, boss: !!(g.boss && g.boss.alive) }); last = now; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}, wave);
await p.waitForTimeout(6000); // let pets spawn and the fight fill up
const cdp = await p.context().newCDPSession(p);
if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
await p.evaluate(() => (window.__ft = []));
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
await cdp.send("Profiler.start");
await p.waitForTimeout(secs * 1000);
const { profile } = await cdp.send("Profiler.stop");
const ft = await p.evaluate(() => window.__ft.slice());
const counts = await p.evaluate(() => { const g = window.__game.scene.getScene("Game"); let parts = 0; for (const o of g.children.list) if (o.type === "ParticleEmitter") parts += o.getAliveParticleCount();
  return { pets: g.familiars.pets.length, enemies: g.enemies.filter((e) => e.alive).length, proj: g.spells.projectiles.filter((q) => q.active).length, particles: parts, objs: g.children.list.length, tweens: g.tweens.getTweens().length }; });
// self time per node
const dt = {};
const ids = profile.samples, deltas = profile.timeDeltas;
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
for (let i = 0; i < ids.length; i++) dt[ids[i]] = (dt[ids[i]] ?? 0) + (deltas[i] ?? 0);
const self = new Map();
let total = 0;
for (const [id, t] of Object.entries(dt)) {
  const n = byId.get(Number(id)); const cf = n.callFrame;
  const file = cf.url.split("/").pop().split("?")[0];
  const key = `${cf.functionName || "(anon)"} ${file}:${cf.lineNumber + 1}`;
  self.set(key, (self.get(key) ?? 0) + t); total += t;
}
const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 28);
ft.sort((a, b) => a - b);
const avg = ft.reduce((a, c) => a + c, 0) / ft.length;
console.log(`frames ${ft.length} in ${secs}s @${throttle}x CPU: avg ${avg.toFixed(1)} ms (${(1000 / avg).toFixed(0)} fps), p95 ${ft[Math.floor(ft.length * 0.95)].toFixed(1)} ms, worst ${ft[ft.length - 1].toFixed(0)} ms`);
console.log("live:", JSON.stringify(counts));
console.log("long frames (>60ms):", JSON.stringify(await p.evaluate(() => window.__long)));
console.log("top self time:");
for (const [k, t] of top) console.log(`${(100 * t / total).toFixed(1).padStart(5)}%  ${k}`);
await b.close();
