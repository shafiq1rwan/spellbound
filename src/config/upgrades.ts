import type { SpellId } from "./spells";

export type UpgradeId = `spell:${SpellId}` | "haste" | "vitality" | "potion" | "power" | "wisdom" | "mastery";

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  icon: string;
  max: number;
  /** 0 common, 1 rare, 2 epic */
  rarity: number;
  weight: number;
  desc: (nextLevel: number) => string;
}

export const GENERIC_UPGRADES: UpgradeDef[] = [
  { id: "haste", name: "Quickened Mind", icon: "ic_haste", max: 4, rarity: 1, weight: 1, desc: () => "Spells recharge 12% faster." },
  { id: "vitality", name: "Heart Rune", icon: "ic_heart", max: 3, rarity: 1, weight: 0.9, desc: () => "+1 max heart, heal 1." },
  { id: "potion", name: "Healing Draught", icon: "ic_potion", max: 99, rarity: 0, weight: 1.2, desc: () => "Heal 2 hearts." },
  { id: "power", name: "Arcane Focus", icon: "ic_arcane", max: 3, rarity: 2, weight: 0.7, desc: () => "Spells deal 12% more damage." },
  { id: "wisdom", name: "Scholar's Crystal", icon: "ic_xp", max: 3, rarity: 0, weight: 0.8, desc: () => "Gain 20% more XP." },
];

/**
 * Repeatable fallback, offered only to fill the level-up screen once the normal pool runs short
 * (every spell at level 5 and every upgrade maxed, usually past wave 25). Without it the screen
 * had no cards and the paused game could never resume.
 */
export const MASTERY: UpgradeDef = { id: "mastery", name: "Mastery", icon: "ic_arcane", max: 999, rarity: 2, weight: 0, desc: () => "+6% spell damage, heal 1." };

export const RARITY_COLORS = [0x9c8bd0, 0x8fd3ff, 0xffe59a];
export const RARITY_NAMES = ["COMMON", "RARE", "EPIC"];
