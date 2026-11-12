// Difficulty check: a simulated "average" player casts through the real spell system about once a
// second (drawing a rune takes ~0.6-1s on a phone), fumbles 20% of runes, picks sensible spells and
// takes upgrade cards. Prints a per-wave timeline (hearts, enemies alive) until death or the time limit.
//   QA_URL=http://localhost:5174/ node tools/qa/sim-run.mjs [maxSeconds] [castMs] [missRate] [smart 0|1]
// smart=1 picks the best spell for the situation; smart=0 draws a random known rune (a real casual player).
import { chromium } from "playwright-core";

const URL = process.env.QA_URL ?? "http://localhost:5173/";
const maxSec = Number(process.argv[2] ?? 420), castMs = Number(process.argv[3] ?? 950), miss = Number(process.argv[4] ?? 0.2), smart = Number(process.argv[5] ?? 1);
const b = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })).newPage();
p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
await p.goto(URL);
await p.evaluate(() => localStorage.setItem("spellbound-arena.v2", JSON.stringify({ version: 2, tutorialDone: true, settings: { quality: "low" } })));
await p.reload();
await p.waitForFunction(() => window.__game?.scene.isActive("Menu"), null, { timeout: 20000 });
await p.keyboard.press("Enter");
await p.waitForFunction(() => window.__game?.scene.isActive("Game"), null, { timeout: 20000 });

// the bot runs inside the page on a real-time interval
await p.evaluate(({ castMs, miss, smart }) => {
  const game = window.__game;
  const log = (window.__sim = { waves: {}, events: [] });
  let lastWave = 0;
  setInterval(() => {
    const g = game.scene.getScene("Game");
    if (!g || !g.sys.isActive() || g.over) return;
    if (g.wave !== lastWave) { lastWave = g.wave; log.waves[g.wave] = { t: Math.round(g.stats.timeMs / 1000), hp: g.hp }; }
    if (Math.random() < miss) return;                      // fumbled rune
    const w = g.wizard, ts = g.targets();
    if (!ts.length) return;
    const near = (r) => ts.filter((t) => Math.hypot(t.x - w.x, t.y - w.y) < r).length;
    const ready = (s) => g.spells.levels[s] > 0 && g.spells.cooldownFrac(s) === 0;
    let id = "fireball";
    if (!smart) {
      const known = ["fireball", "nova", "lightning", "arcane"].filter((s) => g.spells.levels[s] > 0);
      id = known[Math.floor(Math.random() * known.length)];
      if (!ready(id)) return;                               // drew a rune that was still recharging
    } else if (ready("nova") && near(70) >= 3) id = "nova";
    else if (ready("arcane") && near(110) >= 3) id = "arcane";
    else if (ready("lightning") && ts.length >= 2) id = "lightning";
    else if (ready("nova") && near(40) >= 1) id = "nova";
    const t = ts.reduce((a, c) => (Math.hypot(c.x - w.x, c.y - w.y) < Math.hypot(a.x - w.x, a.y - w.y) ? c : a));
    g.spells.cast(id, t.x, t.y - t.height);
  }, castMs);
  // pick upgrade cards like a player would (after the input delay)
  setInterval(() => {
    const u = game.scene.getScene("Upgrade");
    if (u && u.sys.isActive() && u.ready && !u.picked) {
      const pref = u.choices.findIndex((c) => c.id.startsWith("spell:") || c.id === "potion" || c.id === "vitality");
      u.pick(pref >= 0 ? pref : 0);
    }
  }, 300);
}, { castMs, miss, smart });

const t0 = Date.now();
let last = "";
while ((Date.now() - t0) / 1000 < maxSec) {
  await p.waitForTimeout(5000);
  const s = await p.evaluate(() => {
    const g = window.__game.scene.getScene("Game");
    return { over: g.over, wave: g.wave, hp: g.hp, maxHp: g.maxHp, t: Math.round(g.stats.timeMs / 1000), alive: g.enemies.filter((e) => e.alive).length, lvl: g.xp.level, kills: g.stats.kills };
  });
  const line = `t=${String(s.t).padStart(3)}s wave ${String(s.wave).padStart(2)}  hearts ${s.hp}/${s.maxHp}  alive ${String(s.alive).padStart(2)}  lvl ${s.lvl}  kills ${s.kills}`;
  if (line !== last) console.log(line);
  last = line;
  if (s.over) break;
}
const fin = await p.evaluate(() => { const g = window.__game.scene.getScene("Game"); return { over: g.over, wave: g.wave, t: Math.round(g.stats.timeMs / 1000), kills: g.stats.kills, lvl: g.xp.level, waves: window.__sim.waves }; });
console.log(`\nRESULT: ${fin.over ? "died" : "alive"} in wave ${fin.wave} at ${fin.t}s, level ${fin.lvl}, ${fin.kills} kills`);
console.log("wave starts (time s, hearts):", Object.entries(fin.waves).map(([w, v]) => `W${w}@${v.t}s/${v.hp}♥`).join("  "));
await b.close();
