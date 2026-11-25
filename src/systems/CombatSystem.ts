// CombatSystem: one path for all damage — multipliers, the Frozen+X "Shatter" combination,
// damage numbers, hit reactions, hit-stop/shake for heavy hits, kills, XP drops and score.
import { ELEMENT_COLORS, PAL, type Element } from "../config/palette";
import { GAME } from "../config/game";
import { ENEMIES } from "../config/enemies";
import { Audio } from "../core/Audio";
import { Analytics } from "../core/Analytics";
import type { Target } from "../entities/Enemy";
import { Enemy } from "../entities/Enemy";
import type { GameScene } from "../scenes/GameScene";
import { DEPTH } from "./VFXManager";

/** a popped Bomb Beetle hurts monsters this close (art px, plus their radius) */
const BEETLE_BLAST = { radius: 34, damage: 30 };

export interface HitOpts {
  element: Element;
  dx: number;
  dy: number;
  kb: number;
  heavy: boolean;
  stunMs?: number;
  noShatter?: boolean;
  quiet?: boolean;
}

export class CombatSystem {
  g: GameScene;
  private lastHitstop = 0;
  constructor(g: GameScene) {
    this.g = g;
  }

  damage(t: Target, base: number, o: HitOpts) {
    const g = this.g;
    // off-screen enemies can't be hurt (they haven't "arrived" yet): see GameScene.visibleTargets
    if (!t.alive || !g.inView(t)) return { killed: false, amount: 0 };
    // v1.10.0: the Fire Imp ignores Fire; the Shield Knight's shield takes a whole hit
    if (t instanceof Enemy) {
      if (t.def.immune && t.def.immune === o.element) { t.shrugOff(o.dx, o.dy); return { killed: false, amount: 0 }; }
      if (t.shield > 0) { t.breakShield(o.dx, o.dy); return { killed: false, amount: 0 }; }
    }
    let amount = base * g.spells.damageMult();
    let shatter = false;
    // Spell combination: hitting a frozen enemy with fire/lightning/arcane shatters it for double damage
    if (t.frozen && !o.noShatter && o.element !== "ice") {
      shatter = true;
      amount *= 2;
      Analytics.track("combo", "shatter", "reached", "run");
      t.thaw();
      Audio.play("shatter", { maxConcurrent: 3 });
      g.vfx.burst("shard", t.x, t.y - t.height, 10, { speed: [60, 160] });
      g.vfx.play("shock_ice", t.x, t.y, { scale: 0.8, add: true });
      g.vfx.floatText(t.x, t.y - t.height - 16, "SHATTER!", PAL.iceCyan, 1, 800);
    }
    amount = Math.max(1, Math.round(amount));
    const killed = t.damage(amount);
    const heavy = o.heavy || shatter;
    const col = ELEMENT_COLORS[o.element];
    g.vfx.number(t.x, t.y - t.height * 2 - 6, amount, shatter ? 0xffffff : col.text, heavy || amount >= 40);
    if (!o.quiet) {
      g.vfx.play("hitflash", t.x + (Math.random() - 0.5) * 4, t.y - t.height, { add: true, tint: col.light, scale: heavy ? 1.4 : 1 });
      Audio.play(heavy ? "hit_heavy" : "hit", { vol: heavy ? 0.9 : 0.55, rate: 0.9 + Math.random() * 0.25, maxConcurrent: 4, minGapMs: 35 });
    }
    t.react(o.dx, o.dy, o.kb, heavy, o.stunMs);
    if (o.stunMs && t.alive && !t.isBoss) Audio.play("stun", { vol: 0.3, maxConcurrent: 2, minGapMs: 80 });
    if (heavy) {
      this.hitstop(GAME.feel.hitstopHeavyMs);
      g.vfx.shake(GAME.feel.shakeSmall, 90);
    }
    if (killed) this.kill(t, heavy);
    return { killed, amount };
  }

  hitstop(ms: number) {
    const now = performance.now();
    if (ms <= 0 || now - this.lastHitstop < 160) return;
    this.lastHitstop = now;
    this.g.hitstop(ms);
  }

  kill(t: Target, heavy: boolean) {
    const g = this.g;
    if (t.isBoss) {
      t.die();
      return;
    }
    const e = t as Enemy;
    e.die();
    if (e.kind === "orb") return;
    g.stats.kills++;
    g.stats.score += ENEMIES[e.kind as keyof typeof ENEMIES].scoreWeight * 10 * (1 + Math.floor(g.wave / 3)) * (e.elite ? 3 : 1);
    if (heavy || e.kind === "golem") this.hitstop(GAME.feel.hitstopKillHeavyMs);
    g.xp.drop(e.x, e.y, e.xp);
    if (e.elite && e.kind === "slime") {
      // elite slimes split in two
      for (const s of [-1, 1]) g.spawner.spawnAt("slime", e.x + s * 10, e.y, false, true);
    }
    // v1.10.0: a Big Slime bursts into little slimes; a popped Bomb Beetle blasts the monsters around it
    const split = ENEMIES[e.kind as keyof typeof ENEMIES].split;
    if (split) {
      for (let i = 0; i < split.n; i++) {
        const a = (i / split.n) * Math.PI * 2 + Math.random() * 0.6;
        g.spawner.spawnAt(split.kind, e.x + Math.cos(a) * 11, e.y + Math.sin(a) * 7, false, true);
      }
    }
    if (e.kind === "beetle") {
      const x = e.x, y = e.y;
      g.time.delayedCall(90, () => this.blast(x, y));
    }
  }

  private blast(x: number, y: number) {
    const g = this.g;
    g.vfx.play("shock", x, y, { scale: 1.2, add: true, tint: PAL.fireOrange, depth: DEPTH.fxLow });
    for (const t of g.targets()) {
      if ((t as Enemy).kind === "orb") continue;
      if (Math.hypot(t.x - x, t.y - y) <= BEETLE_BLAST.radius + t.radius)
        this.damage(t, BEETLE_BLAST.damage, { element: "fire", dx: t.x - x, dy: t.y - y, kb: 40, heavy: false, quiet: true });
    }
  }
}
