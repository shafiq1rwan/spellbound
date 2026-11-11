// Global tuning. Everything a designer is likely to tweak lives in src/config/*.
export const GAME = {
  /** target art-pixels across the shorter screen side; pixel scale = round(shortSide / this) */
  viewShortSide: 215,
  maxDevicePixelRatio: 2,

  player: {
    maxHp: 5,
    invulnMs: 1000,
    radius: 7,
    knockbackOnContact: 34,
  },

  rune: {
    /** minimum $1 score (0..1) to accept a rune */
    threshold: 0.72,
    /** score accepted even when geometric feature gates disagree */
    strongThreshold: 0.86,
    /** strokes shorter than this (CSS px) are treated as taps and ignored */
    minLengthPx: 28,
    /** max points kept while drawing */
    maxPoints: 400,
    /** radius (world px) around the rune's centre used to pick a target */
    targetPickRadius: 70,
  },

  xp: {
    baseMagnet: 44,
    /** px/s every orb drifts toward the wizard; grows by driftAccel per second on the ground */
    driftSpeed: 28,
    driftAccel: 18,
    driftMax: 110,
    /** px/s once inside the magnet radius */
    pullSpeed: 320,
    /** xp needed to go from level n to n+1 */
    toNext: (lvl: number) => Math.round(4 + lvl * 3 + Math.pow(lvl, 1.6)),
  },

  combo: {
    windowMs: 4000,
    perStack: 0.03,
    maxStacks: 20,
    varietyBonus: 1,
  },

  feel: {
    hitstopSmallMs: 0,
    hitstopHeavyMs: 55,
    hitstopKillHeavyMs: 70,
    shakeSmall: 0.0025,
    shakeHeavy: 0.006,
  },

  spawn: {
    /** spawn ring = just outside the visible camera rect, in world px */
    margin: 18,
    /** never spawn nearer than this to the wizard */
    minDistance: 95,
    portalMs: 520,
  },

  waveBreakMs: 2600,
};
