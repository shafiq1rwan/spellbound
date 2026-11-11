import type { EnemyKind } from "./enemies";

export interface WaveDef {
  durationMs: number;
  /** spawn interval range (ms) */
  interval: [number, number];
  /** spawn weights by kind */
  weights: Partial<Record<Exclude<EnemyKind, "boss">, number>>;
  maxAlive: number;
  /** how many enemies per spawn event */
  group: [number, number];
  elites: number;
  boss?: boolean;
  hpMul: number;
}

/** Hand-authored opening; later waves come from `waveDef()` scaling. */
const AUTHORED: WaveDef[] = [
  { durationMs: 30000, interval: [2100, 2900], weights: { slime: 1 }, maxAlive: 6, group: [1, 2], elites: 0, hpMul: 1 },
  { durationMs: 32000, interval: [1500, 2200], weights: { slime: 3, bat: 1 }, maxAlive: 11, group: [1, 3], elites: 0, hpMul: 1 },
  { durationMs: 34000, interval: [1400, 2000], weights: { slime: 3, bat: 2, skeleton: 1.3 }, maxAlive: 13, group: [1, 3], elites: 0, hpMul: 1.05 },
  { durationMs: 36000, interval: [1200, 1800], weights: { slime: 3, bat: 2.5, skeleton: 2 }, maxAlive: 16, group: [2, 3], elites: 0, hpMul: 1.1 },
  { durationMs: 38000, interval: [1200, 1700], weights: { slime: 2, bat: 2, skeleton: 2, golem: 0.6 }, maxAlive: 17, group: [2, 3], elites: 1, hpMul: 1.15 },
  { durationMs: 38000, interval: [1100, 1600], weights: { slime: 2, bat: 3, skeleton: 2, golem: 0.8 }, maxAlive: 19, group: [2, 4], elites: 1, hpMul: 1.25 },
  { durationMs: 40000, interval: [1000, 1500], weights: { slime: 2, bat: 2, skeleton: 3, golem: 1 }, maxAlive: 21, group: [2, 4], elites: 2, hpMul: 1.35 },
  { durationMs: 40000, interval: [950, 1400], weights: { slime: 3, bat: 3, skeleton: 2, golem: 1.2 }, maxAlive: 22, group: [3, 4], elites: 2, hpMul: 1.45 },
  { durationMs: 42000, interval: [900, 1300], weights: { slime: 2, bat: 3, skeleton: 3, golem: 1.4 }, maxAlive: 24, group: [3, 5], elites: 3, hpMul: 1.55 },
  { durationMs: 30000, interval: [3200, 4200], weights: { slime: 2, bat: 2 }, maxAlive: 8, group: [1, 2], elites: 0, boss: true, hpMul: 1.6 },
];

export function waveDef(wave: number): WaveDef {
  if (wave <= AUTHORED.length) return AUTHORED[wave - 1];
  // endless: cycle through the authored mid-game waves with rising pressure; boss every 10th wave
  const loop = wave - AUTHORED.length;
  const base = AUTHORED[4 + ((loop - 1) % 5)];
  const k = 1 + loop * 0.12;
  if (wave % 10 === 0) return { ...AUTHORED[9], hpMul: 1.6 + loop * 0.18 };
  return {
    ...base,
    interval: [Math.max(550, base.interval[0] / k), Math.max(800, base.interval[1] / k)],
    maxAlive: Math.min(32, Math.round(base.maxAlive + loop * 1.2)),
    elites: base.elites + Math.floor(loop / 3),
    hpMul: base.hpMul + loop * 0.14,
  };
}
