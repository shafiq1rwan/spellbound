import Phaser from "phaser";

/** Cross-scene event bus (GameScene -> HUD/overlays). */
export const bus = new Phaser.Events.EventEmitter();

export const EV = {
  HP: "hp",                 // (hp, maxHp, delta)
  XP: "xp",                 // (xp, toNext, level)
  WAVE: "wave",             // (wave, isBoss)
  WAVE_BANNER: "waveBanner",// (text, sub, color)
  COMBO: "combo",           // (stacks)
  COOLDOWNS: "cooldowns",   // ()
  UNLOCK: "unlock",         // (spellId)
  CLEAR_TEXT: "clearText",  // () hide banners and hints now (e.g. the level-up cards are opening)
  HINT: "hint",             // (text|null, ms)
  CAST: "cast",             // (spellId)
  FAIL: "fail",             // ()
  BOSS_HP: "bossHp",        // (frac|null, name)
  LOW_HP: "lowHp",          // (bool)
  PAUSE_REQ: "pauseReq",    // ()
  STROKE: "stroke",         // (active)
  DEBUG: "debugRune",       // (result)
} as const;
