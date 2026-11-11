export type EnemyKind = "slime" | "bat" | "skeleton" | "golem" | "boss";

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
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  slime: { kind: "slime", hp: 20, speed: 17, radius: 8, contactDamage: 1, xp: 1, knockbackResist: 0, shadow: 1, shadowOffset: 0, scoreWeight: 1 },
  bat: { kind: "bat", hp: 12, speed: 38, radius: 7, contactDamage: 1, xp: 1, knockbackResist: 0, shadow: 0, shadowOffset: 12, hoverHeight: 0, scoreWeight: 1 },
  skeleton: {
    kind: "skeleton", hp: 48, speed: 19, radius: 8, contactDamage: 1, xp: 3, knockbackResist: 0.25, shadow: 1, shadowOffset: 0,
    attackRange: 24, attackWindupMs: 420, attackCooldownMs: 1500, attackDamage: 1, scoreWeight: 3,
  },
  golem: {
    kind: "golem", hp: 170, speed: 9, radius: 15, contactDamage: 1, xp: 8, knockbackResist: 0.9, shadow: 3, shadowOffset: 0,
    attackRange: 36, attackWindupMs: 780, attackCooldownMs: 2600, attackDamage: 2, scoreWeight: 8,
  },
  boss: { kind: "boss", hp: 1600, speed: 12, radius: 26, contactDamage: 1, xp: 60, knockbackResist: 1, shadow: 4, shadowOffset: 44, scoreWeight: 60 },
};

export const ELITE = { hpMul: 3.5, speedMul: 1.15, xpMul: 4, scale: 1.2 };
