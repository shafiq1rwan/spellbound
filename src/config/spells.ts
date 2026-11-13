import type { Element } from "./palette";

export type SpellId = "fireball" | "nova" | "lightning" | "arcane";
export type RuneId = "triangle" | "circle" | "zigzag" | "vee";

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
      { desc: "Throw a fireball.", damage: 22, count: 1, scale: 1, splash: 16, knockback: 26 },
      { desc: "Bigger fireball + Ember Wisp pet.", damage: 28, count: 1, scale: 1.35, splash: 20, knockback: 32 },
      { desc: "Splits into 3 fireballs.", damage: 22, count: 3, scale: 1.35, splash: 20, knockback: 32 },
      { desc: "Bigger, stronger explosions.", damage: 25, count: 3, scale: 1.45, splash: 30, knockback: 40 },
      { desc: "Meteor: a huge fireball.", damage: 38, count: 3, scale: 1, splash: 42, knockback: 55, meteor: true },
    ],
  },
  nova: {
    id: "nova", rune: "circle", element: "ice", name: "Ice Nova", runeName: "Circle",
    icon: "ic_nova", runeIcon: "rune_ice", cooldown: 2300, unlockWave: 2,
    levels: [
      { desc: "Ice ring: freezes and pushes back.", damage: 20, radius: 70, slow: 0.5, slowMs: 2500, freezeMs: 1100, knockback: 34 },
      { desc: "Wider ring + Frost Sprite pet.", damage: 26, radius: 82, slow: 0.55, slowMs: 3000, freezeMs: 1800, knockback: 38 },
      { desc: "Fires ice shards outward.", damage: 30, radius: 90, slow: 0.55, slowMs: 3000, freezeMs: 2100, shards: 8, knockback: 40 },
      { desc: "Huge ring, more shards.", damage: 36, radius: 102, slow: 0.6, slowMs: 3200, freezeMs: 2400, shards: 12, knockback: 44 },
      { desc: "Absolute Zero: pulses twice.", damage: 42, radius: 116, slow: 0.6, slowMs: 3500, freezeMs: 3000, shards: 16, pulses: 2, knockback: 50 },
    ],
  },
  lightning: {
    id: "lightning", rune: "zigzag", element: "bolt", name: "Lightning Chain", runeName: "Zigzag",
    icon: "ic_bolt", runeIcon: "rune_bolt", cooldown: 1000, unlockWave: 3,
    levels: [
      { desc: "Bolt jumps between enemies.", damage: 26, chains: 2, chainRange: 62 },
      { desc: "+1 jump + Spark Imp pet.", damage: 30, chains: 3, chainRange: 66 },
      { desc: "Stuns everything it hits.", damage: 32, chains: 4, chainRange: 70, stunMs: 450 },
      { desc: "Longer reach, more jumps.", damage: 36, chains: 5, chainRange: 80, stunMs: 500 },
      { desc: "Storm: every bolt splits.", damage: 40, chains: 6, chainRange: 86, stunMs: 600, fork: true },
    ],
  },
  arcane: {
    id: "arcane", rune: "vee", element: "arcane", name: "Arcane Barrage", runeName: "V",
    icon: "ic_arcane", runeIcon: "rune_arcane", cooldown: 1100, unlockWave: 4,
    levels: [
      { desc: "Missiles hit enemies near you.", damage: 13, missiles: 6, pierce: 1, knockback: 22 },
      { desc: "+2 missiles + Arcane Owl pet.", damage: 14, missiles: 8, pierce: 1, knockback: 24 },
      { desc: "Missiles go through 1 enemy.", damage: 15, missiles: 9, pierce: 2, knockback: 26 },
      { desc: "Even more missiles.", damage: 16, missiles: 11, pierce: 2, knockback: 28 },
      { desc: "Vortex: pulls enemies in.", damage: 17, missiles: 12, pierce: 2, knockback: 28, vortex: true },
    ],
  },
};

export const SPELL_ORDER: SpellId[] = ["fireball", "nova", "lightning", "arcane"];
export const RUNE_TO_SPELL: Record<RuneId, SpellId> = {
  triangle: "fireball", circle: "nova", zigzag: "lightning", vee: "arcane",
};
