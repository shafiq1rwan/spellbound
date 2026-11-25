// QA (v1.10.0): the four late-wave monsters. Spawns each one next to the wizard and checks its rule:
// Big Slime splits into 3 slimes, Fire Imp ignores Fire but not Lightning and throws a fireball, Shield
// Knight's shield blocks one hit then breaks, Bomb Beetle blows up beside the wizard (2 hearts) and, popped
// early, blasts the monsters around it. Also screenshots the line-up and the "NEW" wave banner + tip.
//   QA_URL=http://localhost:5173/ node tools/qa/monsters.mjs [outDir]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const URL = process.env.QA_URL ?? "http://localhost:5173/";
const OUT = process.argv[2] ?? "qa-shots";
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await p.goto(URL);
await p.evaluate(() => localStorage.setItem("spellbound-arena.v2", JSON.stringify({ version: 2, tutorialDone: true, settings: {} })));
await p.reload();
await p.waitForFunction(() => window.__game?.scene.isActive("Menu"), null, { timeout: 30000 });
await p.keyboard.press("Enter");
await p.waitForFunction(() => window.__game?.scene.isActive("Game") && window.__game.scene.getScene("Game").wave >= 1, null, { timeout: 30000 });

// a quiet arena: no wave spawns, no level-ups, every hit on the wizard recorded but not applied
await p.evaluate(() => {
  const g = window.__game.scene.getScene("Game");
  g.spawner.enabled = false;
  for (const e of g.enemies) e.die();
  g.xp.pendingLevels = 0;
  g.xp.drop = () => {};
  window.__hits = [];
  g.damagePlayer = (n, x, y, ig, src) => { window.__hits.push({ n, src }); return true; };
});
const ok = [], bad = [];
const check = (name, cond, info = "") => (cond ? ok : bad).push(`${name}${info ? ` (${info})` : ""}`);
const run = (fn, arg) => p.evaluate(fn, arg);

// 1. Big Slime splits into three slimes
let r = await run(() => {
  const g = window.__game.scene.getScene("Game");
  const e = g.spawner.spawnAt("bigslime", 30, -40, false, true);
  const before = g.enemies.filter((x) => x.alive && x.kind === "slime").length;
  g.combat.damage(e, 9999, { element: "arcane", dx: 0, dy: -1, kb: 0, heavy: false });
  return { dead: !e.alive, slimes: g.enemies.filter((x) => x.alive && x.kind === "slime").length - before };
});
check("Big Slime splits into 3", r.dead && r.slimes === 3, `dead ${r.dead}, +${r.slimes} slimes`);

// 2. Fire Imp: Fire does nothing, Lightning hurts
r = await run(() => {
  const g = window.__game.scene.getScene("Game");
  for (const e of g.enemies) e.die();
  const e = g.spawner.spawnAt("imp", -40, -60, false, true);
  const hp0 = e.hp;
  g.combat.damage(e, 50, { element: "fire", dx: 0, dy: -1, kb: 20, heavy: false });
  const afterFire = e.hp;
  g.combat.damage(e, 10, { element: "bolt", dx: 0, dy: -1, kb: 5, heavy: false });
  return { hp0, afterFire, afterBolt: e.hp };
});
check("Fire Imp ignores Fire", r.afterFire === r.hp0, `${r.hp0} -> ${r.afterFire}`);
check("Fire Imp is hurt by Lightning", r.afterBolt < r.afterFire, `-> ${r.afterBolt}`);

// 3. the imp throws a fireball that reaches the wizard (and can be shot down)
await run(() => { window.__hits.length = 0; });
await p.waitForTimeout(5500);
r = await run(() => ({ hits: window.__hits.map((h) => h.src), orbs: window.__game.scene.getScene("Game").enemies.filter((e) => e.alive && e.kind === "orb").length }));
check("Fire Imp's fireball hits the wizard", r.hits.includes("imp-fireball"), `hits: ${r.hits.join(",") || "none"}`);

// 4. Shield Knight: the first hit is blocked, the shield breaks, the second hit lands
r = await run(() => {
  const g = window.__game.scene.getScene("Game");
  for (const e of g.enemies) e.die();
  const e = g.spawner.spawnAt("knight", 45, 20, false, true);
  const hp0 = e.hp;
  g.combat.damage(e, 15, { element: "arcane", dx: 1, dy: 0, kb: 10, heavy: false });
  const after1 = { hp: e.hp, shield: e.shield, anim: e.sprite.anims.currentAnim?.key };
  g.combat.damage(e, 15, { element: "arcane", dx: 1, dy: 0, kb: 10, heavy: false });
  return { hp0, after1, hp2: e.hp };
});
check("Shield Knight blocks the first hit", r.after1.hp === r.hp0 && r.after1.shield === 0, `hp ${r.hp0} -> ${r.after1.hp}, shield ${r.after1.shield}`);
check("Shield Knight shows the bare sprite", String(r.after1.anim).startsWith("knight_bare:"), r.after1.anim);
check("Shield Knight takes the second hit", r.hp2 < r.hp0, `-> ${r.hp2}`);

// 5. Bomb Beetle reaches the wizard and blows up: 2 hearts
await run(() => {
  const g = window.__game.scene.getScene("Game");
  for (const e of g.enemies) e.die();
  window.__hits.length = 0;
  window.__beetle = g.spawner.spawnAt("beetle", 0, 70, false, true);
});
await p.waitForTimeout(4500);
r = await run(() => ({ hits: window.__hits, alive: window.__beetle.alive }));
check("Bomb Beetle explodes beside the wizard for 2", !r.alive && r.hits.some((h) => h.src === "beetle" && h.n === 2), JSON.stringify(r.hits));

// 6. a popped beetle blasts the monsters around it, not the wizard
r = await run(async () => {
  const g = window.__game.scene.getScene("Game");
  window.__hits.length = 0;
  const bt = g.spawner.spawnAt("beetle", 0, -70, false, true);
  const a = g.spawner.spawnAt("skeleton", 14, -70, false, true), c = g.spawner.spawnAt("skeleton", -12, -62, false, true);
  const far = g.spawner.spawnAt("skeleton", 60, -10, false, true);
  const hp = [a.hp, c.hp, far.hp];
  g.combat.damage(bt, 9999, { element: "arcane", dx: 0, dy: -1, kb: 0, heavy: false });
  await new Promise((res) => setTimeout(res, 400));
  return { hp, now: [a.hp, c.hp, far.hp], hits: window.__hits.length };
});
check("popped Bomb Beetle blasts its neighbours", r.now[0] < r.hp[0] && r.now[1] < r.hp[1], `${r.hp} -> ${r.now}`);
check("popped Bomb Beetle spares monsters further away", r.now[2] === r.hp[2]);
check("popped Bomb Beetle doesn't hurt the wizard", r.hits === 0);

// 7. line-up screenshot: the four new monsters and their elites around the wizard
await run(() => {
  const g = window.__game.scene.getScene("Game");
  for (const e of g.enemies) e.die();
  const kinds = ["bigslime", "imp", "beetle", "knight"];
  kinds.forEach((k, i) => {
    const x = -66 + i * 44;
    g.spawner.spawnAt(k, x, -70, false, true);
    g.spawner.spawnAt(k, x, 70, true, true);
  });
  g.worldPaused = true;
});
await p.waitForTimeout(900);
await p.screenshot({ path: `${OUT}/monsters-lineup.png` });

// 8. the wave that introduces a monster: banner, then the tip
await run(() => {
  const g = window.__game.scene.getScene("Game");
  for (const e of g.enemies) e.die();
  g.worldPaused = false;
  g.spawner.enabled = true;
  g.spawner.startWave(12);
});
await p.waitForTimeout(700);
await p.screenshot({ path: `${OUT}/monsters-banner.png` });
await p.waitForTimeout(3200);
await p.screenshot({ path: `${OUT}/monsters-tip.png` });
r = await run(() => window.__game.scene.getScene("Game").enemies.filter((e) => e.alive).map((e) => e.kind));
check("wave 12 opens with a Fire Imp", r[0] === "imp", r.join(","));

console.log("PASS:\n  " + ok.join("\n  "));
if (bad.length) console.log("FAIL:\n  " + bad.join("\n  "));
console.log(errors.length ? `ERRORS:\n  ${[...new Set(errors)].join("\n  ")}` : "no page errors");
await b.close();
process.exit(bad.length || errors.length ? 1 : 0);
