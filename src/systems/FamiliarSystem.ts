// Familiars: reaching level 2 of a spell summons its elemental pet. Pets orbit the wizard and
// auto-cast a weaker version of their spell, getting stronger as that spell levels up. Drawing
// stays the main source of damage; pets cover the time a player spends drawing.
import Phaser from "phaser";
import { SPELLS, SPELL_ORDER, type SpellId } from "../config/spells";
import { ELEMENT_COLORS, PAL } from "../config/palette";
import { Audio } from "../core/Audio";
import { bus, EV } from "../core/bus";
import { Analytics } from "../core/Analytics";
import type { Target } from "../entities/Enemy";
import { DEPTH } from "./VFXManager";
import type { GameScene } from "../scenes/GameScene";

export const FAMILIAR_LEVEL = 2;

interface FamiliarDef {
  sprite: string;
  name: string;
  tag: string;
  /** cooldown (ms) at spell level 2..5 */
  cd: [number, number, number, number];
  /** share of the spell's current damage, at spell level 2..5 */
  power: [number, number, number, number];
  range: number;
}

export const FAMILIARS: Record<SpellId, FamiliarDef> = {
  // tuned with tools/qa/sim-run.mjs: pets add roughly a third on top of a casual player's own damage
  fireball: { sprite: "pet_fire", name: "EMBER WISP", tag: "ember-wisp", cd: [2000, 1850, 1700, 1550], power: [0.3, 0.34, 0.38, 0.42], range: 150 },
  nova: { sprite: "pet_ice", name: "FROST SPRITE", tag: "frost-sprite", cd: [3400, 3200, 3000, 2700], power: [0.22, 0.26, 0.3, 0.34], range: 46 },
  lightning: { sprite: "pet_bolt", name: "SPARK IMP", tag: "spark-imp", cd: [2300, 2150, 2000, 1800], power: [0.3, 0.34, 0.38, 0.42], range: 140 },
  arcane: { sprite: "pet_arcane", name: "ARCANE OWL", tag: "arcane-owl", cd: [2000, 1850, 1700, 1550], power: [0.6, 0.66, 0.72, 0.8], range: 150 },
};

interface Pet { id: SpellId; s: Phaser.GameObjects.Sprite; glow: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; t: number; ready: number; x: number; y: number }

export class FamiliarSystem {
  g: GameScene;
  pets: Pet[] = [];
  constructor(g: GameScene) {
    this.g = g;
  }

  private summon(id: SpellId) {
    const g = this.g, w = g.wizard, def = FAMILIARS[id], col = ELEMENT_COLORS[SPELLS[id].element];
    const s = g.add.sprite(w.x, w.y - 20, def.sprite).play(`${def.sprite}:idle`).setScale(0.2);
    const glow = g.add.image(w.x, w.y, "glow").setTint(col.main).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45).setDisplaySize(22, 22);
    const shadow = g.add.image(w.x, w.y, "shadow0").setAlpha(0.6).setDepth(DEPTH.shadow).setScale(0.7);
    g.tweens.add({ targets: s, scale: 1, duration: 420, ease: "Back.easeOut" });
    g.vfx.burst("twinkle", w.x, w.y - 20, 12, { tint: col.light, speed: [20, 70] });
    g.vfx.glow(w.x, w.y - 20, col.main, 60, 500, 0.8);
    Audio.play("levelup", { vol: 0.5, rate: 1.3 });
    bus.emit(EV.WAVE_BANNER, `+ ${def.name}`, "", col.main);
    Analytics.track("familiar", def.tag, "reached", "run");
    this.pets.push({ id, s, glow, shadow, t: Math.random() * 6, ready: g.now + 900, x: w.x, y: w.y - 20 });
  }

  private nearest(r: number): Target | null {
    const w = this.g.wizard;
    let best: Target | null = null, bd = r;
    for (const t of this.g.targets()) {
      const d = Math.hypot(t.x - w.x, t.y - w.y);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  private act(p: Pet) {
    const g = this.g, sm = g.spells, def = FAMILIARS[p.id];
    const lvl = sm.levels[p.id], i = Math.min(3, Math.max(0, lvl - FAMILIAR_LEVEL));
    const dmg = sm.level(p.id).damage * def.power[i];
    const target = this.nearest(def.range);
    if (!target) return false;
    switch (p.id) {
      case "fireball": sm.petFireball(p.x, p.y, target, dmg); break;
      case "nova": sm.petPulse(g.wizard.x, g.wizard.y, def.range + (lvl - 2) * 6, dmg, 0.35, lvl >= 4 ? 600 : 0); break;
      case "lightning": sm.petZap(p.x, p.y, target, dmg, lvl >= 4 ? 1 : 0); break;
      case "arcane": sm.petMissile(p.x, p.y, target, dmg); break;
    }
    // little cast "hop"
    g.tweens.add({ targets: p.s, scaleX: 1.25, scaleY: 0.8, duration: 70, yoyo: true });
    p.glow.setAlpha(0.9);
    return true;
  }

  update(dtMs: number) {
    const g = this.g;
    for (const id of SPELL_ORDER) if (g.spells.levels[id] >= FAMILIAR_LEVEL && !this.pets.some((p) => p.id === id)) this.summon(id);
    if (g.wizard.dead) {
      for (const p of this.pets) p.s.setAlpha(Math.max(0, p.s.alpha - dtMs / 600));
      return;
    }
    const w = g.wizard;
    // fixed spots around the wizard's head and shoulders (never in front of the body), gentle sway
    const SLOTS = [[-26, -30], [26, -30], [-32, -8], [32, -8]];
    this.pets.forEach((p, k) => {
      p.t += dtMs / 1000;
      const [sx, sy] = SLOTS[k % SLOTS.length];
      const tx = w.x + sx + Math.sin(p.t * 1.3 + k) * 3, ty = w.y + sy + Math.sin(p.t * 2.6 + k * 2) * 2.5;
      p.x += (tx - p.x) * Math.min(1, dtMs / 120);
      p.y += (ty - p.y) * Math.min(1, dtMs / 120);
      p.s.setPosition(Math.round(p.x), Math.round(p.y)).setDepth(p.y + 14);
      p.glow.setPosition(p.x, p.y).setDepth(p.y + 13).setAlpha(Math.max(0.35, p.glow.alpha - dtMs / 500));
      p.shadow.setPosition(p.x, p.y + 16);
      const tgt = this.nearest(140);
      if (tgt) p.s.setFlipX(tgt.x < p.x);
      if (g.now >= p.ready && !g.over && !g.tutorial) {
        const lvl = g.spells.levels[p.id], i = Math.min(3, Math.max(0, lvl - FAMILIAR_LEVEL));
        p.ready = g.now + (this.act(p) ? FAMILIARS[p.id].cd[i] * g.spells.cdMult : 300);
      }
    });
  }
}
