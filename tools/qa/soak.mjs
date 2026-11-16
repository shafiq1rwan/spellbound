// QA: long-session soak for hangs, hitches and leaks. A bot plays like sim-run.mjs (casts about once a
// second, picks upgrade cards) with default (high) effects on a slowed CPU, and presses TRY AGAIN after
// every death. Records every frame gap over 100 ms with what was on screen, browser long tasks, and every
// 10 s the JS heap and live counts (Game objects, tweens, timers, bus listeners, textures), so anything
// that grows from run to run shows up.
//   QA_URL=http://localhost:5173/ node tools/qa/soak.mjs [runs] [maxSecPerRun] [cpuThrottle] [god 0|1]
// god=1: the wizard takes no damage, so one run goes deep into the late waves (use runs=1).
import { chromium } from "playwright-core";
const URL = process.env.QA_URL ?? "http://localhost:5173/";
const [RUNS = "5", MAXSEC = "240", THROTTLE = "4", GOD = "0"] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
p.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE ERROR", m.text()); });
await p.addInitScript(() => {
  const perf = (window.__perf = { gaps: [], long: [], frames: 0 });
  let last = performance.now();
  const loop = (t) => {
    const d = t - last;
    last = t;
    perf.frames++;
    if (d > 100) {
      const G = window.__game, g = G?.scene?.getScene?.("Game");
      perf.gaps.push({
        at: Math.round(t), d: Math.round(d), wave: g?.wave, alive: g?.enemies?.filter((e) => e.alive).length,
        scenes: G?.scene?.getScenes(true).map((s) => s.sys.settings.key).join(","),
      });
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) perf.long.push({ at: Math.round(e.startTime), d: Math.round(e.duration) }); })
      .observe({ entryTypes: ["longtask"] });
  } catch { /* not supported */ }
});
const cdp = await p.context().newCDPSession(p);
await p.goto(URL);
await p.evaluate(() => localStorage.setItem("spellbound-arena.v2", JSON.stringify({ version: 2, tutorialDone: true, settings: {} })));
await p.reload();
await p.waitForFunction(() => window.__game?.scene.isActive("Menu"), null, { timeout: 30000 });
await cdp.send("Emulation.setCPUThrottlingRate", { rate: +THROTTLE });
await p.keyboard.press("Enter");
await p.waitForFunction(() => window.__game?.scene.isActive("Game"), null, { timeout: 30000 });

await p.evaluate((god) => {
  const game = window.__game;
  setInterval(() => {
    const g = game.scene.getScene("Game");
    if (!g || !g.sys.isActive() || g.over) return;
    if (god && !g.__god) { g.__god = true; g.damagePlayer = () => false; }
    if (Math.random() < 0.2) return; // fumbled rune
    const w = g.wizard, ts = g.targets();
    if (!ts.length) return;
    const near = (r) => ts.filter((t) => Math.hypot(t.x - w.x, t.y - w.y) < r).length;
    const ready = (s) => g.spells.levels[s] > 0 && g.spells.cooldownFrac(s) === 0;
    let id = "fireball";
    if (ready("nova") && near(70) >= 3) id = "nova";
    else if (ready("arcane") && near(110) >= 3) id = "arcane";
    else if (ready("lightning") && ts.length >= 2) id = "lightning";
    else if (ready("nova") && near(40) >= 1) id = "nova";
    const t = ts.reduce((a, c) => (Math.hypot(c.x - w.x, c.y - w.y) < Math.hypot(a.x - w.x, a.y - w.y) ? c : a));
    g.spells.cast(id, t.x, t.y - t.height);
  }, 900);
  setInterval(() => {
    const u = game.scene.getScene("Upgrade");
    if (u && u.sys.isActive() && u.ready && !u.picked) {
      const pref = u.choices.findIndex((c) => c.id.startsWith("spell:") || c.id === "potion" || c.id === "vitality");
      u.pick(pref >= 0 ? pref : 0);
    }
  }, 300);
}, +GOD);

const sample = () => p.evaluate(() => {
  const G = window.__game, g = G.scene.getScene("Game"), h = G.scene.getScene("HUD"), bus = window.__bus;
  const listeners = (em) => em.eventNames().reduce((n, e) => n + em.listenerCount(e), 0);
  return {
    t: Math.round(g.stats.timeMs / 1000), wave: g.wave, over: g.over, alive: g.enemies.filter((e) => e.alive).length,
    enemiesArr: g.enemies.length,
    heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1,
    gameObjs: g.children.list.length, hudObjs: h?.children?.list.length ?? 0,
    tweens: g.tweens.getTweens().length + (h?.tweens.getTweens().length ?? 0),
    timers: (g.time._active?.length ?? 0) + (h?.time._active?.length ?? 0),
    bus: listeners(bus), gameEv: listeners(G.events), textures: G.textures.getTextureKeys().length,
    frames: window.__perf.frames, gaps: window.__perf.gaps.length, long: window.__perf.long.length,
  };
});

const runs = [];
for (let r = 1; r <= +RUNS; r++) {
  const t0 = Date.now();
  console.log(`--- run ${r}`);
  let s;
  while (true) {
    await p.waitForTimeout(10000);
    s = await sample();
    console.log(`t=${String(s.t).padStart(3)}s w${String(s.wave).padStart(2)} alive ${String(s.alive).padStart(2)} (arr ${s.enemiesArr})  heap ${s.heapMB}MB  objs ${s.gameObjs}/${s.hudObjs}  tweens ${s.tweens}  timers ${s.timers}  bus ${s.bus}  gameEv ${s.gameEv}  tex ${s.textures}  gaps ${s.gaps}  long ${s.long}`);
    if (s.over || (Date.now() - t0) / 1000 > +MAXSEC) break;
  }
  runs.push({ r, wave: s.wave, t: s.t, died: s.over });
  if (r < +RUNS) {
    // retry like a player: wait for the game-over screen, press TRY AGAIN (or end this run by dying)
    await p.evaluate(() => {
      const g = window.__game.scene.getScene("Game");
      if (!g.over) { delete g.damagePlayer; g.hp = 1; g.damagePlayer(5, g.wizard.x + 10, g.wizard.y, false, "soak"); }
    });
    await p.waitForFunction(() => window.__game.scene.isActive("GameOver"), null, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(1500);
    await p.evaluate(() => window.__game.scene.getScene("GameOver").retry());
    await p.waitForFunction(() => { const g = window.__game.scene.getScene("Game"); return window.__game.scene.isActive("Game") && !g.over && g.stats.timeMs < 5000; }, null, { timeout: 30000 });
  }
}
const perf = await p.evaluate(() => window.__perf);
console.log("\nruns:", runs.map((x) => `#${x.r} ${x.died ? "died" : "alive"} w${x.wave} ${x.t}s`).join("  "));
const big = perf.gaps.filter((g) => g.d >= 250);
console.log(`frame gaps >100 ms: ${perf.gaps.length}; >=250 ms: ${big.length}; max ${Math.max(0, ...perf.gaps.map((g) => g.d))} ms`);
for (const g of perf.gaps.sort((a, b) => b.d - a.d).slice(0, 15)) console.log(`  ${g.d} ms at ${(g.at / 1000).toFixed(1)}s  wave ${g.wave} alive ${g.alive} [${g.scenes}]`);
console.log(`long tasks: ${perf.long.length}; max ${Math.max(0, ...perf.long.map((l) => l.d))} ms`);
await b.close();
