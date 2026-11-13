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
    /** orbs pop out of the enemy and bounce on the ground for this long, then fly to the wizard */
    popMs: 1000,
    /** bounce: share of vertical speed kept per bounce, and of ground speed */
    bounce: 0.5,
    bounceFriction: 0.6,
    /** fly-in speed (px/s): starts at pullSpeed, accelerates by pullAccel per second, capped at pullMax */
    pullSpeed: 260,
    pullAccel: 1400,
    pullMax: 720,
    /**
     * xp needed to go from level n to n+1. Early levels are discounted (35% at level 1, easing to 100%
     * by level 6) so the first upgrade + pet land within ~15 s: early rewards keep new players playing.
     */
    toNext: (lvl: number) => Math.max(3, Math.round((4 + lvl * 3 + Math.pow(lvl, 1.6)) * Math.min(1, 0.35 + 0.13 * (lvl - 1)))),
  },

  /** straight swipe = light slash on every enemy the trail crosses (a basic attack; runes stay stronger) */
  swipe: {
    damage: 9,
    cooldownMs: 550,
    /** how close (world px) to the trail an enemy must be to get hit, on top of its radius */
    reach: 9,
    knockback: 18,
  },

  combo: {
    windowMs: 4000,
    perStack: 0.025,
    maxStacks: 20,
    /** extra combo stacks for switching to a different element (rewards mixing spells) */
    varietyBonus: 2,
  },

  feel: {
    hitstopSmallMs: 0,
    hitstopHeavyMs: 55,
    hitstopKillHeavyMs: 70,
    /** screen shake peaks, in art pixels (1 art px = 2-4 device px on a phone) */
    shakeSmall: 2,
    shakeHeavy: 3,
  },

  spawn: {
    /** enemies appear in a band this deep just inside the screen edge (clear of the HUD), in art px */
    band: 14,
    /** never spawn nearer than this to the wizard. 140 keeps portrait spawns at the top and bottom (the
     *  side edges are only ~95 art px away); on very short screens the farthest spot found is used */
    minDistance: 140,
    /** the purple portal: the enemy is visible but harmless and untargetable for this long (warning time) */
    portalMs: 900,
  },

  waveBreakMs: 2600,
  /** hearts restored when a wave is cleared */
  healOnWaveClear: 1,
};
