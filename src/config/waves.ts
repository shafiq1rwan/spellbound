import { ENEMIES, type EnemyKind } from "./enemies";

export type MobKind = Exclude<EnemyKind, "boss">;

export interface WaveDef {
  durationMs: number;
  /**
   * Difficulty knob: enemy HP arriving per second (HP/s). The spawner derives its spawn interval
   * from this, the enemy mix and group size, so changing the mix never silently changes difficulty.
   */
  pressure: number;
  /** spawn weights by kind */
  weights: Partial<Record<MobKind, number>>;
  maxAlive: number;
  /** how many enemies per spawn event */
  group: [number, number];
  elites: number;
  boss?: boolean;
  /** per-enemy toughness (slower to kill, not more of them) */
  hpMul: number;
}

/**
 * Difficulty curve. Pressure starts low and grows a steady ~33% per wave, so each wave is a small
 * step up rather than a wall. Measured with tools/qa/sim-run.mjs (see docs/DIFFICULTY.md).
 */
export const PRESSURE_BASE = 7;
export const PRESSURE_GROWTH = 1.28;
export const pressureFor = (wave: number) =>
  wave <= 10 ? PRESSURE_BASE * Math.pow(PRESSURE_GROWTH, wave - 1)
             : PRESSURE_BASE * Math.pow(PRESSURE_GROWTH, 9) * Math.pow(1.15, wave - 10); // gentler in endless

// v1.9.0: wave 2 is slimes only. It was the wave that lost the most players in both 500-player tests
// (v1.6.2: 41 deaths; v1.7.8: 75% completion, 46 deaths) because bats (2.2x a slime's speed) arrived in
// the same wave as the player's first new rune, Ice Nova. Bats now debut in wave 3 at half their old weight.
const AUTHORED: Omit<WaveDef, "pressure">[] = [
  { durationMs: 30000, weights: { slime: 1 }, maxAlive: 6, group: [1, 1], elites: 0, hpMul: 1 },
  { durationMs: 32000, weights: { slime: 1 }, maxAlive: 8, group: [1, 2], elites: 0, hpMul: 1 },
  { durationMs: 34000, weights: { slime: 3, bat: 1, skeleton: 1 }, maxAlive: 10, group: [1, 2], elites: 0, hpMul: 1 },
  { durationMs: 36000, weights: { slime: 3, bat: 2, skeleton: 1.5 }, maxAlive: 12, group: [1, 2], elites: 0, hpMul: 1.03 },
  { durationMs: 38000, weights: { slime: 2, bat: 2, skeleton: 2 }, maxAlive: 14, group: [1, 3], elites: 1, hpMul: 1.06 },
  { durationMs: 38000, weights: { slime: 2, bat: 2, skeleton: 2, golem: 0.4 }, maxAlive: 16, group: [1, 3], elites: 1, hpMul: 1.1 },
  { durationMs: 40000, weights: { slime: 2, bat: 2.5, skeleton: 2, golem: 0.6 }, maxAlive: 19, group: [2, 3], elites: 1, hpMul: 1.14 },
  { durationMs: 40000, weights: { slime: 1.5, bat: 3, skeleton: 2.5, golem: 0.8, bigslime: 3 }, maxAlive: 22, group: [2, 3], elites: 2, hpMul: 1.18 },
  { durationMs: 42000, weights: { slime: 2, bat: 3, skeleton: 3, golem: 1, bigslime: 1 }, maxAlive: 25, group: [2, 4], elites: 2, hpMul: 1.22 },
  { durationMs: 30000, weights: { slime: 2, bat: 2 }, maxAlive: 7, group: [1, 2], elites: 0, boss: true, hpMul: 1.25 },
];

/**
 * v1.10.0: a new monster every couple of waves after the golem (wave 6), so long runs keep changing: waves
 * 1-7 are unchanged, then the Big Slime (8), the Guardian (10), the Fire Imp (12), the Bomb Beetle (14) and
 * the Shield Knight (16). The wave that brings one in features it (weight 3) and opens with it.
 */
export const NEW_MONSTERS: Partial<Record<number, MobKind>> = { 8: "bigslime", 12: "imp", 14: "beetle", 16: "knight" };
export const MONSTER_INFO: Partial<Record<MobKind, { name: string; tip: string }>> = {
  bigslime: { name: "BIG SLIME", tip: "Big Slimes split into three little slimes when popped!" },
  imp: { name: "FIRE IMP", tip: "Fire can't hurt Fire Imps. Use Ice, Lightning or Arcane!" },
  beetle: { name: "BOMB BEETLE", tip: "Pop Bomb Beetles early and they blast the monsters around them!" },
  knight: { name: "SHIELD KNIGHT", tip: "Shield Knights block the first hit. Break the shield, then strike!" },
};
/** endless waves: each newer monster joins the mix from its wave on, with this weight */
const LATE: [MobKind, number, number][] = [["bigslime", 8, 1], ["imp", 12, 0.8], ["beetle", 14, 0.9], ["knight", 16, 1]];
/** from wave 17 every monster is known: each wave features a different one, so no two waves in a row look alike */
const FEATURED: MobKind[] = ["imp", "beetle", "knight", "bigslime", "golem", "skeleton", "bat"];

function endlessWeights(wave: number, base: WaveDef["weights"]): WaveDef["weights"] {
  const w: WaveDef["weights"] = { ...base };
  for (const [k, from, weight] of LATE) if (wave >= from) w[k] = Math.max(w[k] ?? 0, weight);
  const intro = NEW_MONSTERS[wave];
  if (intro) w[intro] = 3;
  else if (wave >= 17) {
    const f = FEATURED[(wave - 17) % FEATURED.length];
    w[f] = (w[f] ?? 1) * 2.2;
  }
  return w;
}

export function waveDef(wave: number): WaveDef {
  if (wave <= AUTHORED.length) {
    const d = AUTHORED[wave - 1];
    // boss waves: the adds are a light trickle, the Guardian is the threat
    return { ...d, pressure: d.boss ? pressureFor(wave) * 0.3 : pressureFor(wave) };
  }
  // endless: cycle the mid-game mixes, Guardian every 10th wave
  const loop = wave - AUTHORED.length;
  if (wave % 10 === 0) return { ...AUTHORED[9], pressure: pressureFor(wave) * 0.3, hpMul: 1.25 + loop * 0.06 };
  const base = AUTHORED[5 + ((loop - 1) % 4)];
  return {
    ...base,
    weights: endlessWeights(wave, base.weights),
    pressure: pressureFor(wave),
    maxAlive: Math.min(30, Math.round(base.maxAlive + loop * 0.8)),
    elites: base.elites + Math.floor(loop / 4),
    hpMul: base.hpMul + loop * 0.05,
  };
}

/** average HP of one spawned enemy for this wave's mix (used to turn pressure into a spawn rate) */
export function avgSpawnHp(d: WaveDef) {
  const ws = Object.entries(d.weights) as [MobKind, number][];
  const total = ws.reduce((a, [, w]) => a + w, 0);
  // a Big Slime brings its three slimes with it
  const hp = (k: MobKind) => ENEMIES[k].hp + (ENEMIES[k].split ? ENEMIES[k].split!.n * ENEMIES[ENEMIES[k].split!.kind].hp : 0);
  return (ws.reduce((a, [k, w]) => a + hp(k) * w, 0) / total) * d.hpMul;
}

/** milliseconds between spawn events so that HP arrives at `pressure` per second */
export function spawnIntervalMs(d: WaveDef) {
  const avgGroup = (d.group[0] + d.group[1]) / 2;
  return (avgGroup * avgSpawnHp(d) * 1000) / d.pressure;
}
