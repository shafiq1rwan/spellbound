import { ENEMIES, type EnemyKind } from "./enemies";

type MobKind = Exclude<EnemyKind, "boss">;

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
 * Difficulty curve. Pressure starts low and grows a steady ~25% per wave, so each wave is a small
 * step up rather than a wall. Measured with tools/qa/sim-run.mjs (see docs/DIFFICULTY.md).
 */
// v1.8.2: early waves start busier (9 HP/s instead of 7) and grow a little slower, meeting the old
// curve again around wave 10. Players found waves 1-3 too empty.
export const PRESSURE_BASE = 9;
export const PRESSURE_GROWTH = 1.25;
export const pressureFor = (wave: number) =>
  wave <= 10 ? PRESSURE_BASE * Math.pow(PRESSURE_GROWTH, wave - 1)
             : PRESSURE_BASE * Math.pow(PRESSURE_GROWTH, 9) * Math.pow(1.15, wave - 10); // gentler in endless

const AUTHORED: Omit<WaveDef, "pressure">[] = [
  { durationMs: 30000, weights: { slime: 1 }, maxAlive: 8, group: [2, 3], elites: 0, hpMul: 1 },
  { durationMs: 32000, weights: { slime: 3, bat: 1 }, maxAlive: 10, group: [2, 3], elites: 0, hpMul: 1 },
  { durationMs: 34000, weights: { slime: 3, bat: 2, skeleton: 1 }, maxAlive: 12, group: [2, 4], elites: 0, hpMul: 1 },
  { durationMs: 36000, weights: { slime: 3, bat: 2, skeleton: 1.5 }, maxAlive: 14, group: [2, 4], elites: 0, hpMul: 1.03 },
  { durationMs: 38000, weights: { slime: 2, bat: 2, skeleton: 2 }, maxAlive: 16, group: [3, 4], elites: 1, hpMul: 1.06 },
  { durationMs: 38000, weights: { slime: 2, bat: 2, skeleton: 2, golem: 0.4 }, maxAlive: 18, group: [3, 5], elites: 1, hpMul: 1.1 },
  { durationMs: 40000, weights: { slime: 2, bat: 2.5, skeleton: 2, golem: 0.6 }, maxAlive: 21, group: [3, 5], elites: 1, hpMul: 1.14 },
  { durationMs: 40000, weights: { slime: 2, bat: 3, skeleton: 2.5, golem: 0.8 }, maxAlive: 24, group: [4, 5], elites: 2, hpMul: 1.18 },
  { durationMs: 42000, weights: { slime: 2, bat: 3, skeleton: 3, golem: 1 }, maxAlive: 27, group: [4, 6], elites: 2, hpMul: 1.22 },
  { durationMs: 30000, weights: { slime: 2, bat: 2 }, maxAlive: 8, group: [2, 3], elites: 0, boss: true, hpMul: 1.25 },
];

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
    pressure: pressureFor(wave),
    maxAlive: Math.min(30, Math.round(base.maxAlive + loop * 0.8)),
    elites: base.elites + Math.floor(loop / 4),
    hpMul: base.hpMul + loop * 0.05,
  };
}

/**
 * How many directions one spawn event comes from, as weights for 1, 2, 3 and 4 directions. 2 is a pincer
 * (opposite sides: left + right, top-left + bottom-right, ...), 3 is three-way, 4 surrounds the wizard.
 * The event's group is split between them and they open at the same moment.
 */
export function directionWeights(wave: number): number[] {
  if (wave <= 1) return [0.45, 0.55];
  if (wave <= 4) return [0.3, 0.45, 0.25];
  return [0.2, 0.35, 0.25, 0.2];
}

/** average HP of one spawned enemy for this wave's mix (used to turn pressure into a spawn rate) */
export function avgSpawnHp(d: WaveDef) {
  const ws = Object.entries(d.weights) as [MobKind, number][];
  const total = ws.reduce((a, [, w]) => a + w, 0);
  return (ws.reduce((a, [k, w]) => a + ENEMIES[k].hp * w, 0) / total) * d.hpMul;
}

/** milliseconds between spawn events so that HP arrives at `pressure` per second */
export function spawnIntervalMs(d: WaveDef) {
  const avgGroup = (d.group[0] + d.group[1]) / 2;
  return (avgGroup * avgSpawnHp(d) * 1000) / d.pressure;
}
