import type { Element } from "./palette";

export type EnemyKind = "slime" | "bat" | "skeleton" | "golem" | "bigslime" | "imp" | "beetle" | "knight" | "boss";

export interface EnemyDef {
  kind: EnemyKind;
  hp: number;
  speed: number;           // world px / s
  radius: number;          // collision radius
  contactDamage: number;
  xp: number;
  knockbackResist: number; // 0..1
  shadow: number;          // shadow sprite index
  shadowOffset: number;    // y offset of shadow below origin (flying)
  hoverHeight?: number;
  attackRange?: number;
  attackWindupMs?: number;
  attackCooldownMs?: number;
  attackDamage?: number;
  scoreWeight: number;
  /** v1.10.0: takes no damage from this element (shows IMMUNE) */
  immune?: Element;
  /** v1.10.0: hits fully blocked before HP counts (the Shield Knight's shield) */
  shield?: number;
  /** v1.10.0: popped by the player, it splits into these (the Big Slime) */
  split?: { kind: Exclude<EnemyKind, "boss">; n: number };
  /** v1.10.0: at most this many alive at once; the spawner picks another kind instead (imps hang back out of
   *  reach, so without a cap they piled up: 20 alive by wave 17 in a long bot run) */
  maxAlive?: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  slime: { kind: "slime", hp: 20, speed: 17, radius: 8, contactDamage: 1, xp: 1, knockbackResist: 0, shadow: 1, shadowOffset: 0, scoreWeight: 1 },
  bat: { kind: "bat", hp: 12, speed: 38, radius: 7, contactDamage: 1, xp: 1, knockbackResist: 0, shadow: 0, shadowOffset: 12, hoverHeight: 0, scoreWeight: 1 },
  skeleton: {
    kind: "skeleton", hp: 48, speed: 19, radius: 8, contactDamage: 1, xp: 3, knockbackResist: 0.25, shadow: 1, shadowOffset: 0,
    attackRange: 24, attackWindupMs: 420, attackCooldownMs: 1500, attackDamage: 1, scoreWeight: 3,
  },
  golem: {
    kind: "golem", hp: 140, speed: 9, radius: 15, contactDamage: 1, xp: 8, knockbackResist: 0.9, shadow: 3, shadowOffset: 0,
    attackRange: 36, attackWindupMs: 780, attackCooldownMs: 2600, attackDamage: 2, scoreWeight: 8,
  },
  // ---- v1.10.0: one new monster every couple of waves after the golem, so long runs keep changing
  /** wave 8: slow and tough, splits into three slimes when popped */
  bigslime: { kind: "bigslime", hp: 60, speed: 13, radius: 12, contactDamage: 1, xp: 3, knockbackResist: 0.45, shadow: 2, shadowOffset: 0, scoreWeight: 4, split: { kind: "slime", n: 3 } },
  /** wave 12: hovers at a distance and throws a slow fireball; Fire doesn't hurt it */
  imp: {
    kind: "imp", hp: 28, speed: 26, radius: 7, contactDamage: 1, xp: 3, knockbackResist: 0, shadow: 0, shadowOffset: 12,
    attackRange: 72, attackWindupMs: 850, attackCooldownMs: 3400, attackDamage: 1, scoreWeight: 3, immune: "fire", maxAlive: 3,
  },
  /** wave 14: runs in and blows up beside the wizard (2 damage); popped early, it blasts the monsters around it */
  beetle: {
    kind: "beetle", hp: 24, speed: 30, radius: 7, contactDamage: 0, xp: 2, knockbackResist: 0.1, shadow: 1, shadowOffset: 0,
    attackRange: 12, attackWindupMs: 600, attackDamage: 2, scoreWeight: 2,
  },
  /** wave 16: a skeleton whose shield blocks the first hit */
  knight: {
    kind: "knight", hp: 40, speed: 17, radius: 8, contactDamage: 1, xp: 5, knockbackResist: 0.35, shadow: 1, shadowOffset: 0,
    attackRange: 24, attackWindupMs: 460, attackCooldownMs: 1600, attackDamage: 1, scoreWeight: 5, shield: 1,
  },
  boss: { kind: "boss", hp: 1600, speed: 12, radius: 26, contactDamage: 1, xp: 60, knockbackResist: 1, shadow: 4, shadowOffset: 44, scoreWeight: 60 },
};

export const ELITE = { hpMul: 2.5, speedMul: 1.15, xpMul: 4, scale: 1.2 };
