import type { Element } from "./palette";

export type SpellId = "fireball" | "nova" | "lightning" | "arcane";
export type RuneId = "triangle" | "circle" | "zigzag" | "spiral";

export interface SpellDef {
  id: SpellId;
  rune: RuneId;
  element: Element;
  name: string;
  runeName: string;
  icon: string;
  runeIcon: string;
  /** cooldown in ms at level 1 */
  cooldown: number;
  /** wave on which the rune unlocks */
  unlockWave: number;
  levels: SpellLevel[];
}

export interface SpellLevel {
  desc: string;
  damage: number;
  // fireball
  count?: number;
  scale?: number;
  splash?: number;
  meteor?: boolean;
  // nova
  radius?: number;
  slow?: number;
  slowMs?: number;
  freezeMs?: number;
  shards?: number;
  pulses?: number;
  // lightning
  chains?: number;
  chainRange?: number;
  stunMs?: number;
  fork?: boolean;
  // arcane
  missiles?: number;
  pierce?: number;
  vortex?: boolean;
  knockback?: number;
}

export const SPELLS: Record<SpellId, SpellDef> = {
  fireball: {
    id: "fireball", rune: "triangle", element: "fire", name: "Fireball", runeName: "Triangle",
    icon: "ic_fireball", runeIcon: "rune_fire", cooldown: 450, unlockWave: 1,
    levels: [
      { desc: "Hurl a blazing fireball.", damage: 22, count: 1, scale: 1, splash: 16, knockback: 26 },
      { desc: "Bigger fireball, hotter trail.", damage: 28, count: 1, scale: 1.35, splash: 20, knockback: 32 },
      { desc: "Splits into three fireballs.", damage: 22, count: 3, scale: 1.35, splash: 20, knockback: 32 },
      { desc: "Explodes for heavy splash damage.", damage: 25, count: 3, scale: 1.45, splash: 30, knockback: 40 },
      { desc: "METEOR: a colossal fireball.", damage: 38, count: 3, scale: 1, splash: 42, knockback: 55, meteor: true },
    ],
  },
  nova: {
    id: "nova", rune: "circle", element: "ice", name: "Ice Nova", runeName: "Circle",
    icon: "ic_nova", runeIcon: "rune_ice", cooldown: 2000, unlockWave: 2,
    levels: [
      { desc: "Big frost ring: freezes, pushes foes back.", damage: 20, radius: 70, slow: 0.5, slowMs: 2500, freezeMs: 1500, knockback: 34 },
      { desc: "Wider ring, longer freeze.", damage: 26, radius: 82, slow: 0.55, slowMs: 3000, freezeMs: 1800, knockback: 38 },
      { desc: "Launches ice shards outward.", damage: 30, radius: 90, slow: 0.55, slowMs: 3000, freezeMs: 2100, shards: 8, knockback: 40 },
      { desc: "Huge ring, more shards.", damage: 36, radius: 102, slow: 0.6, slowMs: 3200, freezeMs: 2400, shards: 12, knockback: 44 },
      { desc: "ABSOLUTE ZERO: double pulse.", damage: 42, radius: 116, slow: 0.6, slowMs: 3500, freezeMs: 3000, shards: 16, pulses: 2, knockback: 50 },
    ],
  },
  lightning: {
    id: "lightning", rune: "zigzag", element: "bolt", name: "Lightning Chain", runeName: "Zigzag",
    icon: "ic_bolt", runeIcon: "rune_bolt", cooldown: 1000, unlockWave: 3,
    levels: [
      { desc: "Bolt that jumps between foes.", damage: 26, chains: 2, chainRange: 62 },
      { desc: "Chains to one more enemy.", damage: 30, chains: 3, chainRange: 66 },
      { desc: "Stuns everything it strikes.", damage: 32, chains: 4, chainRange: 70, stunMs: 450 },
      { desc: "Longer reach, more chains.", damage: 36, chains: 5, chainRange: 80, stunMs: 500 },
      { desc: "STORM: every bolt forks.", damage: 40, chains: 6, chainRange: 86, stunMs: 600, fork: true },
    ],
  },
  arcane: {
    id: "arcane", rune: "spiral", element: "arcane", name: "Arcane Barrage", runeName: "Spiral",
    icon: "ic_arcane", runeIcon: "rune_arcane", cooldown: 1500, unlockWave: 4,
    levels: [
      { desc: "Homing arcane missiles.", damage: 11, missiles: 4, pierce: 1, knockback: 14 },
      { desc: "Two more missiles.", damage: 12, missiles: 6, pierce: 1, knockback: 16 },
      { desc: "Missiles pierce a foe.", damage: 13, missiles: 7, pierce: 2, knockback: 18 },
      { desc: "A dense barrage.", damage: 14, missiles: 9, pierce: 2, knockback: 20 },
      { desc: "VORTEX: pulls foes into a rift.", damage: 15, missiles: 10, pierce: 2, knockback: 20, vortex: true },
    ],
  },
};

export const SPELL_ORDER: SpellId[] = ["fireball", "nova", "lightning", "arcane"];
export const RUNE_TO_SPELL: Record<RuneId, SpellId> = {
  triangle: "fireball", circle: "nova", zigzag: "lightning", spiral: "arcane",
};
