import type { SpellId } from "./spells";

export type UpgradeId = `spell:${SpellId}` | "haste" | "vitality" | "magnet" | "potion" | "power" | "wisdom";

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
  { id: "haste", name: "Quickened Mind", icon: "ic_haste", max: 4, rarity: 1, weight: 1, desc: () => "All spell cooldowns -12%." },
  { id: "vitality", name: "Heart Rune", icon: "ic_heart", max: 3, rarity: 1, weight: 0.9, desc: () => "+1 max heart and heal 1." },
  { id: "magnet", name: "Soul Magnet", icon: "ic_magnet", max: 3, rarity: 0, weight: 1, desc: () => "XP pull radius +45%." },
  { id: "potion", name: "Healing Draught", icon: "ic_potion", max: 99, rarity: 0, weight: 1.2, desc: () => "Restore 2 hearts." },
  { id: "power", name: "Arcane Focus", icon: "ic_arcane", max: 3, rarity: 2, weight: 0.7, desc: () => "All spell damage +12%." },
  { id: "wisdom", name: "Scholar's Crystal", icon: "ic_xp", max: 3, rarity: 0, weight: 0.8, desc: () => "+20% XP gained." },
];

export const RARITY_COLORS = [0x9c8bd0, 0x8fd3ff, 0xffe59a];
export const RARITY_NAMES = ["COMMON", "RARE", "EPIC"];
