import { GENERIC_UPGRADES, type UpgradeId } from "../config/upgrades";
import { SPELLS, SPELL_ORDER, type SpellId } from "../config/spells";
import type { GameScene } from "../scenes/GameScene";

export interface UpgradeChoice {
  id: UpgradeId;
  name: string;
  icon: string;
  desc: string;
  rarity: number;
  levelText: string;
  spell?: SpellId;
}

export class UpgradeManager {
  g: GameScene;
  counts: Partial<Record<UpgradeId, number>> = {};
  constructor(g: GameScene) {
    this.g = g;
  }

  choices(n = 3): UpgradeChoice[] {
    const g = this.g;
    const pool: { c: UpgradeChoice; w: number }[] = [];
    for (const s of SPELL_ORDER) {
      const lvl = g.spells.levels[s];
      if (lvl <= 0 || lvl >= 5) continue;
      const def = SPELLS[s];
      const next = def.levels[lvl];
      pool.push({
        w: 1.5,
        c: { id: `spell:${s}`, spell: s, name: def.name, icon: lvl + 1 === 5 && s === "fireball" ? "ic_meteor" : def.icon, desc: next.desc, rarity: lvl + 1 >= 5 ? 2 : lvl + 1 >= 3 ? 1 : 0, levelText: `LV ${lvl + 1}` },
      });
    }
    for (const u of GENERIC_UPGRADES) {
      const have = this.counts[u.id] ?? 0;
      if (have >= u.max) continue;
      if (u.id === "potion" && g.hp >= g.maxHp) continue;
      const w = u.id === "potion" && g.hp <= 2 ? 3 : u.weight;
      pool.push({ w, c: { id: u.id, name: u.name, icon: u.icon, desc: u.desc(have + 1), rarity: u.rarity, levelText: u.max > 1 && u.max < 99 ? `${have + 1}/${u.max}` : "" } });
    }
    const out: UpgradeChoice[] = [];
    // guarantee one spell upgrade when available
    const spellOpts = pool.filter((p) => p.c.spell);
    if (spellOpts.length) {
      const p = spellOpts[Math.floor(Math.random() * spellOpts.length)];
      out.push(p.c);
      pool.splice(pool.indexOf(p), 1);
    }
    while (out.length < n && pool.length) {
      const total = pool.reduce((a, p) => a + p.w, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (; idx < pool.length; idx++) { r -= pool[idx].w; if (r <= 0) break; }
      idx = Math.min(idx, pool.length - 1);
      out.push(pool[idx].c);
      pool.splice(idx, 1);
    }
    return out.sort(() => Math.random() - 0.5);
  }

  apply(id: UpgradeId) {
    const g = this.g;
    this.counts[id] = (this.counts[id] ?? 0) + 1;
    if (id.startsWith("spell:")) {
      const s = id.slice(6) as SpellId;
      g.spells.levels[s] = Math.min(5, g.spells.levels[s] + 1);
      return;
    }
    switch (id) {
      case "haste": g.spells.cdMult *= 0.88; break;
      case "vitality": g.maxHp += 1; g.heal(1); break;
      case "magnet": g.xp.magnetMult *= 1.45; break;
      case "potion": g.heal(2); break;
      case "power": g.spells.powerMult *= 1.12; break;
      case "wisdom": g.xp.gainMult *= 1.2; break;
    }
  }
}
