// QA: late-game load test. Jumps to a high wave with every spell at level 5, every upgrade and all
// familiars, then casts as fast as cooldowns allow and logs frame rate and live object counts.
// It also checks the level-up screen once every upgrade is maxed.
//   QA_URL=http://localhost:5174/ node tools/qa/endgame.mjs [wave] [seconds] [cpuThrottle]
// cpuThrottle (e.g. 6) slows the CPU like a mid-range phone, so the fps column means something.
import { chromium } from "playwright-core";
const URL = process.env.QA_URL ?? "http://localhost:5173/";
const wave = Number(process.argv[2] ?? 34), secs = Number(process.argv[3] ?? 40), throttle = Number(process.argv[4] ?? 1);
const b = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
if (throttle > 1) await (await p.context().newCDPSession(p)).send("Emulation.setCPUThrottlingRate", { rate: throttle });
await p.goto(URL);
await p.evaluate(() => localStorage.setItem("spellbound-arena.v2", JSON.stringify({ version: 2, tutorialDone: true, settings: {} })));
await p.reload();
await p.waitForFunction(() => window.__game?.scene.isActive("Menu"), null, { timeout: 20000 });
await p.keyboard.press("Enter");
await p.waitForFunction(() => window.__game?.scene.isActive("Game"), null, { timeout: 20000 });
await p.waitForTimeout(1500);
await p.evaluate((wave) => {
  const g = window.__game.scene.getScene("Game");
  for (const s of ["fireball", "nova", "lightning", "arcane"]) { g.spells.levels[s] = 5; g.upgrades.counts[`spell:${s}`] = 4; }
  Object.assign(g.upgrades.counts, { haste: 4, vitality: 3, magnet: 3, power: 3, wisdom: 3 });
  g.spells.cdMult = Math.pow(0.88, 4); g.spells.powerMult = Math.pow(1.12, 3);
  g.maxHp = 8; g.hp = 8;
  g.damagePlayer = () => false; // invulnerable: we're measuring load, not survival
  g.spawner.startWave(wave);
  const ids = ["fireball", "nova", "lightning", "arcane"];
  let k = 0;
  window.__bot = setInterval(() => {
    if (!g.sys.isActive()) return;
    const ts = g.targets(); if (!ts.length) return;
    const t = ts[Math.floor(Math.random() * ts.length)];
    for (let i = 0; i < 4; i++) { const id = ids[k++ % 4]; if (g.spells.cooldownFrac(id) === 0) { g.spells.cast(id, t.x, t.y - t.height); break; } }
  }, 250);
}, wave);
const stats = () => p.evaluate(() => {
  const game = window.__game, g = game.scene.getScene("Game");
  let particles = 0, emitters = 0;
  const offscreen = { fx: 0 };
  const v = g.cameras.main.worldView;
  for (const o of g.children.list) {
    if (o.type === "ParticleEmitter") { emitters++; particles += o.getAliveParticleCount(); }
  }
  const proj = g.spells.projectiles.filter((q) => q.active);
  offscreen.fx = proj.filter((q) => q.x < v.x || q.x > v.right || q.y < v.y || q.y > v.bottom).length;
  return {
    fps: Math.round(game.loop.actualFps), objs: g.children.list.length, particles, tweens: g.tweens.getTweens().length, timers: g.time._active?.length ?? -1,
    enemies: g.enemies.filter((e) => e.alive).length, offView: g.enemies.filter((e) => e.alive && (e.x < v.x || e.x > v.right || e.y < v.y || e.y > v.bottom)).length,
    proj: proj.length, projOff: offscreen.fx, lvl: g.xp.level, orbs: g.xp.orbs.filter((o) => o.active).length, orbPool: g.xp.orbs.length, wave: g.wave, upgrade: game.scene.isActive("Upgrade"),
  };
});
for (let t = 0; t < secs; t += 5) {
  await p.waitForTimeout(5000);
  const s = await stats();
  console.log(`t=${String(t + 5).padStart(3)}s fps ${String(s.fps).padStart(2)} objs ${String(s.objs).padStart(4)} particles ${String(s.particles).padStart(4)} tweens ${String(s.tweens).padStart(3)} timers ${String(s.timers).padStart(3)} enemies ${s.enemies} (off-view ${s.offView}) proj ${s.proj} (off-view ${s.projOff}) orbs ${s.orbs}/${s.orbPool} lvl ${s.lvl} wave ${s.wave}${s.upgrade ? " [UPGRADE OPEN]" : ""}`);
  // auto-pick level-up cards; report if the screen has nothing to pick
  const u = await p.evaluate(() => { const u = window.__game.scene.getScene("Upgrade"); if (!u.sys.isActive()) return null; if (u.ready && !u.picked && u.choices.length) u.pick(0); return u.choices.map((c) => c.id).join(",") || "NO CHOICES"; });
  if (u) console.log("   level-up choices:", u);
}
await p.screenshot({ path: "qa-shots/endgame.png" });
await b.close();
