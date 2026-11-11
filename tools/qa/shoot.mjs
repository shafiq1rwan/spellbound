// QA driver: runs the game in system Edge (headless) via playwright-core, draws runes with real
// pointer input (mouse or CDP touch), and saves screenshots + console errors.
//   node tools/qa/shoot.mjs <scenario> [width height dpr touch]
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL = process.env.QA_URL ?? "http://localhost:5173/";
const [scenario = "menu", W = "390", H = "844", DPR = "2", TOUCH = "0"] = process.argv.slice(2);
const out = `qa-shots`;
mkdirSync(out, { recursive: true });
const tag = `${scenario}_${W}x${H}`;

const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: +DPR, hasTouch: TOUCH === "1", isMobile: TOUCH === "1" });
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(`[${m.type()}] ${m.text()}`); });
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
const reqs = [];
page.on("request", (r) => { const u = r.url(); if (!u.startsWith(URL) && !u.startsWith("data:") && !u.startsWith("blob:")) reqs.push(u); });

const sleep = (ms) => page.waitForTimeout(ms);
const shot = async (name, clip) => page.screenshot({ path: `${out}/${tag}_${name}.png`, ...(clip ? { clip } : {}) });
/** stitch several clipped frames into one strip image (rendered by the browser itself) */
async function strip(name, frames) {
  const html = '<body style="margin:0;background:#000;display:flex">' + frames.map((b) => '<img style="display:block" src="data:image/png;base64,' + b.toString("base64") + '">').join("") + "</body>";
  const p2 = await ctx.newPage();
  await p2.setContent(html);
  await p2.waitForTimeout(100);
  const w = await p2.evaluate(() => document.body.scrollWidth), h = await p2.evaluate(() => document.body.scrollHeight);
  await p2.setViewportSize({ width: Math.min(w, 4000), height: h });
  await p2.screenshot({ path: `${out}/${tag}_${name}.png`, fullPage: true });
  await p2.close();
}
const cdp = await ctx.newCDPSession(page);

/** draw a shape (unit coords, -0.5..0.5) centred at css (cx,cy) with size s */
async function draw(points, cx, cy, s, { touch = TOUCH === "1", stepMs = 12 } = {}) {
  const P = points.map(([x, y]) => [cx + x * s, cy + y * s]);
  if (touch) {
    const tp = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp(...P[0]) });
    for (const p of P.slice(1)) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: tp(...p) }); await sleep(stepMs); }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await page.mouse.move(...P[0]);
    await page.mouse.down();
    for (const p of P.slice(1)) { await page.mouse.move(...p, { steps: 1 }); await sleep(stepMs); }
    await page.mouse.up();
  }
}
const dens = (vs, n = 12) => { const o = []; for (let i = 0; i < vs.length - 1; i++) for (let k = 0; k < n; k++) o.push([vs[i][0] + (vs[i + 1][0] - vs[i][0]) * k / n, vs[i][1] + (vs[i + 1][1] - vs[i][1]) * k / n]); o.push(vs[vs.length - 1]); return o; };
const SHAPES = {
  triangle: dens([[0, -0.5], [0.45, 0.4], [-0.45, 0.4], [0, -0.5]]),
  circle: Array.from({ length: 40 }, (_, i) => { const a = -Math.PI / 2 + (i / 39) * Math.PI * 2.05; return [Math.cos(a) * 0.48, Math.sin(a) * 0.48]; }),
  zigzag: dens([[-0.45, -0.4], [0.45, -0.4], [-0.45, 0.4], [0.45, 0.4]]),
  spiral: Array.from({ length: 70 }, (_, i) => { const u = i / 69, th = u * 2.1 * Math.PI * 2, r = 0.05 + u * 0.45; return [Math.cos(th) * r, Math.sin(th) * r]; }),
  scribble: dens([[-0.4, 0], [0.4, 0.05], [-0.1, 0.1]]),
};
const slow = (k) => page.evaluate((k) => { const g = window.__game.scene.getScene("Game"); g.slowmo = k; g.tweens.timeScale = k; g.time.timeScale = k; g.anims.globalTimeScale = k; }, k);
const game = () => page.evaluate(() => {
  const g = window.__game?.scene.getScene("Game");
  return g && g.sys.isActive() ? { hp: g.hp, wave: g.wave, kills: g.stats.kills, enemies: g.enemies.filter((e) => e.alive).length, lvl: g.xp.level, fps: Math.round(window.__game.loop.actualFps), casts: g.stats.casts, combo: g.spells.combo } : null;
});
const startGame = async (tutorialDone = true) => {
  await page.evaluate((td) => localStorage.setItem("spellbound-arena.v2", JSON.stringify({ version: 2, tutorialDone: td, runs: 0, settings: { sfx: 0.8, music: 0.5, quality: "high", reducedMotion: false, debugRunes: true } })), tutorialDone);
  await page.reload();
  await page.waitForFunction(() => window.__game?.scene.isActive("Menu"), null, { timeout: 20000 });
  await sleep(300);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__game?.scene.isActive("Game"), null, { timeout: 20000 });
  await sleep(500);
};

await page.goto(URL);
await sleep(1500);
const cw = +W, ch = +H;
try {
  if (scenario === "menu") {
    await shot("menu");
  } else if (scenario === "tutorial") {
    await startGame(false);
    await sleep(1500);
    await shot("1_intro");
    await draw(SHAPES.triangle, cw / 2, ch * 0.4, Math.min(cw, ch) * 0.3);
    await sleep(120);
    await shot("2_cast");
    await sleep(2500);
    await shot("3_after");
  } else if (scenario === "slice") {
    // vertical slice: fireball vs slimes, frame-by-frame impact shots
    await startGame(true);
    await page.evaluate(() => { const g = window.__game.scene.getScene("Game"); g.spawner.enabled = false; for (const [x, y] of [[40, -70], [-50, -60], [10, 70]]) g.spawner.spawnAt("slime", x, y, false, true); });
    await sleep(600);
    await shot("0_ready");
    await draw(SHAPES.triangle, cw / 2 + 30, ch * 0.33, Math.min(cw, ch) * 0.28, { stepMs: 4 });
    await slow(0.12);
    const fr = []; const clip = { x: cw / 2 - 110, y: ch * 0.27, width: 220, height: 260 };
    for (let i = 0; i < 8; i++) { await sleep(110); fr.push(await page.screenshot({ clip, scale: "css" })); }
    await strip("1_fire_strip", fr);
    await slow(1);
    await sleep(800);
    await shot("2_after");
    console.log(JSON.stringify(await game()));
  } else if (scenario === "spells") {
    await startGame(true);
    await page.evaluate(() => {
      const g = window.__game.scene.getScene("Game");
      g.spawner.enabled = false;
      g.damagePlayer = () => false;
      for (const s of ["nova", "lightning", "arcane"]) g.spells.levels[s] = 1;
      const kinds = ["slime", "bat", "skeleton", "golem", "slime", "bat", "skeleton", "slime"];
      kinds.forEach((k, i) => { const a = (i / kinds.length) * Math.PI * 2; g.spawner.spawnAt(k, Math.cos(a) * 70, Math.sin(a) * 60 - 10, i === 3, true); });
    });
    await sleep(700);
    await shot("0_mob");
    for (const s of ["zigzag", "circle", "spiral", "triangle"]) {
      await draw(SHAPES[s], cw / 2, ch * 0.3, Math.min(cw, ch) * 0.26, { stepMs: 4 });
      await slow(0.12);
      await sleep(150);
      await shot(`1_${s}_a`);
      await sleep(500);
      await shot(`1_${s}_b`);
      await slow(1);
      await sleep(900);
    }
    await draw(SHAPES.scribble, cw / 2, ch * 0.3, Math.min(cw, ch) * 0.3);
    await sleep(100);
    await shot("2_fail");
    console.log(JSON.stringify(await game()));
  } else if (scenario === "stress") {
    await startGame(true);
    await page.evaluate(() => {
      const g = window.__game.scene.getScene("Game");
      g.spawner.enabled = false;
      g.damagePlayer = () => false;
      g.xp.gainMult = 0;
      for (const s of ["nova", "lightning", "arcane", "fireball"]) g.spells.levels[s] = 5;
      for (let i = 0; i < 32; i++) { const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 60; g.spawner.spawnAt(["slime", "bat", "skeleton", "golem"][i % 4], Math.cos(a) * r, Math.sin(a) * r, i % 7 === 0, true); }
    });
    const fps = [];
    for (let k = 0; k < 4; k++) {
      for (const s of ["triangle", "spiral", "zigzag", "circle"]) { await draw(SHAPES[s], cw / 2, ch * 0.3, Math.min(cw, ch) * 0.25, { stepMs: 8 }); await sleep(250); fps.push((await game())?.fps); }
      if (k === 1) { await slow(0.15); await sleep(200); await shot("chaos"); await slow(1); }
    }
    console.log("fps samples", fps.join(","));
    console.log(JSON.stringify(await game()));
  } else if (scenario === "upgrade") {
    await startGame(true);
    await page.evaluate(() => { const g = window.__game.scene.getScene("Game"); g.spawner.enabled = false; g.spells.levels.nova = 2; g.xp.add(9); });
    await sleep(2600);
    await shot("cards");
    await page.keyboard.press("1");
    await sleep(800);
    await shot("after");
    console.log(JSON.stringify(await game()));
  } else if (scenario === "boss") {
    await startGame(true);
    await page.evaluate(() => { const g = window.__game.scene.getScene("Game"); g.damagePlayer = () => false; for (const s of ["nova", "lightning", "arcane"]) g.spells.levels[s] = 3; g.spawner.startWave(10); });
    await sleep(4200);
    await shot("boss");
    for (const s of ["triangle", "zigzag", "spiral"]) { await draw(SHAPES[s], cw / 2, ch * 0.25, Math.min(cw, ch) * 0.25); await sleep(500); }
    await sleep(3000);
    await shot("boss_fight");
  } else if (scenario === "gameover") {
    await startGame(true);
    await page.evaluate(() => { const g = window.__game.scene.getScene("Game"); g.damagePlayer(5, 10, 0, true); });
    await sleep(600);
    await shot("dying");
    await sleep(3600);
    await shot("gameover");
    await page.keyboard.press("Enter");
    await sleep(2500);
    await shot("retry");
    console.log(JSON.stringify(await game()));
  } else if (scenario === "pause-tutorial") {
    // first-run tutorial on screen, then pause via the HUD button: the menu must be on top and the tutorial hidden
    await startGame(false);
    await sleep(1200);
    await shot("1_tutorial");
    const btn = await page.evaluate(() => { const h = window.__game.scene.getScene("HUD"); const S = h.cameras.main.zoom / window.devicePixelRatio; return { x: h.pauseBtn.x * S, y: h.pauseBtn.y * S }; });
    await page.mouse.click(btn.x, btn.y);
    await sleep(600);
    await shot("2_paused");
    const st = await page.evaluate(() => { const sc = window.__game.scene; const order = sc.getScenes(false).map((x) => x.sys.settings.key); return { tutorialVisible: sc.getScene("Tutorial").sys.settings.visible, tutorialPaused: sc.isPaused("Tutorial"), pauseAboveTutorial: order.indexOf("Pause") > order.indexOf("Tutorial") }; });
    console.log("while paused:", JSON.stringify(st));
    await page.keyboard.press("Escape");
    await sleep(600);
    await shot("3_resumed");
    console.log("after resume:", JSON.stringify(await page.evaluate(() => { const sc = window.__game.scene; return { tutorialVisible: sc.getScene("Tutorial").sys.settings.visible, tutorialRunning: sc.isActive("Tutorial"), gameRunning: sc.isActive("Game") }; })));
  } else if (scenario === "pause") {
    await startGame(true);
    await sleep(300);
    await page.evaluate(() => window.__game.scene.getScene("Game").pauseGame());
    await sleep(500);
    await shot("pause");
  } else if (scenario === "play") {
    // autoplay a real run for N seconds by drawing runes at the nearest enemy
    await startGame(true);
    const until = Date.now() + Number(process.env.QA_SECONDS ?? 40) * 1000;
    let i = 0;
    while (Date.now() < until) {
      const st = await page.evaluate(() => {
        const g = window.__game.scene.getScene("Game");
        if (!g || !g.sys.isActive()) return null;
        const t = g.targets()[0];
        if (!t) return { none: true };
        const cam = g.cameras.main, S = cam.zoom, dpr = window.devicePixelRatio;
        const rune = { fireball: "triangle", nova: "circle", lightning: "zigzag", arcane: "spiral" };
        const ready = Object.keys(rune).filter((s) => g.spells.levels[s] > 0 && g.spells.cooldownFrac(s) === 0);
        const near = g.enemies.filter((e) => e.alive && Math.hypot(e.x, e.y) < 45).length;
        const pick = ready.includes("nova") && near >= 2 ? "nova" : ready[Math.floor(Math.random() * ready.length)] ?? "fireball";
        return { shape: rune[pick], x: (t.x - cam.worldView.x) * S / dpr, y: (t.y - t.height - cam.worldView.y) * S / dpr };
      });
      if (st && !st.none) i++, await draw(SHAPES[st.shape], Math.min(cw - 60, Math.max(60, st.x)), Math.min(ch - 120, Math.max(120, st.y)), Math.min(cw, ch) * 0.2, { stepMs: 6 });
      else if (await page.evaluate(() => window.__game.scene.isActive("Upgrade"))) { await sleep(600); await page.keyboard.press("1"); }
      await sleep(350);
      if (i === 20) await shot("midrun");
    }
    await shot("end");
    console.log(JSON.stringify(await game()));
  }
} catch (e) {
  logs.push("[qa-error] " + e.stack);
}
console.log(`${tag}: ${logs.length} console issues`);
logs.slice(0, 20).forEach((l) => console.log("  " + l.slice(0, 400)));
if (reqs.length) console.log("external requests:", [...new Set(reqs)].join(" "));
writeFileSync(`${out}/${tag}_log.txt`, logs.join("\n"));
await browser.close();
