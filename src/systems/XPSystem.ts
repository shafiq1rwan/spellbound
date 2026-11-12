// XP orbs: float + pulse, drift toward the stationary wizard, get pulled in inside the magnet
// radius, sparkle + rising-pitch chime on collection. Pooled.
import Phaser from "phaser";
import { GAME } from "../config/game";
import { PAL } from "../config/palette";
import { Audio } from "../core/Audio";
import { bus, EV } from "../core/bus";
import type { GameScene } from "../scenes/GameScene";

interface Orb { ph: number; s: Phaser.GameObjects.Sprite; glow: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; x: number; y: number; vx: number; vy: number; z: number; vz: number; value: number; active: boolean; t: number; pulled: boolean }

export class XPSystem {
  g: GameScene;
  xp = 0;
  level = 1;
  magnetMult = 1;
  gainMult = 1;
  pendingLevels = 0;
  private orbs: Orb[] = [];
  private chain = 0;
  private lastPick = 0;

  constructor(g: GameScene) {
    this.g = g;
  }
  get toNext() {
    return GAME.xp.toNext(this.level);
  }
  get magnet() {
    return GAME.xp.baseMagnet * this.magnetMult;
  }

  drop(x: number, y: number, value: number) {
    let left = value;
    let active = 0;
    for (const o of this.orbs) if (o.active) active++;
    while (left > 0) {
      // cap the orbs on screen: past 60, the rest of the XP rides on one big orb
      if (active >= 60) { this.spawn(x, y, left); return; }
      const v = left >= 5 ? 5 : 1;
      left -= v;
      this.spawn(x, y, v);
      active++;
    }
  }

  private spawn(x: number, y: number, value: number) {
    let o = this.orbs.find((q) => !q.active);
    if (!o) {
      const g = this.g;
      o = {
        s: g.add.sprite(0, 0, "xp"), glow: g.add.image(0, 0, "glow").setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(16, 16),
        shadow: g.add.image(0, 0, "shadow0").setScale(0.6).setDepth(-8000), ph: 0, x: 0, y: 0, vx: 0, vy: 0, z: 0, vz: 0, value: 1, active: false, t: 0, pulled: false,
      };
      this.orbs.push(o);
    }
    const a = Math.random() * Math.PI * 2, sp = 15 + Math.random() * 25;
    Object.assign(o, { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, z: 6, vz: 60 + Math.random() * 30, value, active: true, t: 0, ph: Math.random() * 6, pulled: false });
    const big = value >= 5;
    o.s.setTexture(big ? "xp_big" : "xp").play(big ? "xp_big:play" : "xp:play").setVisible(true).setScale(big ? 1.2 : 1);
    o.glow.setVisible(true).setTint(big ? PAL.iceCyan : PAL.xpMint).setAlpha(0.5);
    o.shadow.setVisible(true);
  }

  update(dtMs: number) {
    const dt = dtMs / 1000, w = this.g.wizard;
    for (const o of this.orbs) {
      if (!o.active) continue;
      o.t += dt;
      // pop-out arc
      if (o.z > 0 || o.vz > 0) {
        o.vz -= 300 * dt;
        o.z = Math.max(0, o.z + o.vz * dt);
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        if (o.z === 0) o.vz = 0;
      }
      const dx = w.x - o.x, dy = w.y - 8 - o.y, d = Math.hypot(dx, dy) || 1;
      if (!w.dead) {
        if (d < this.magnet || o.pulled) {
          o.pulled = true;
          const sp = GAME.xp.pullSpeed * Math.min(1.5, 0.9 + o.t * 0.5);
          o.x += (dx / d) * sp * dt;
          o.y += (dy / d) * sp * dt;
        } else if (o.z === 0) {
          const drift = Math.min(GAME.xp.driftMax, GAME.xp.driftSpeed + GAME.xp.driftAccel * o.t);
          o.x += (dx / d) * drift * dt;
          o.y += (dy / d) * drift * dt;
        }
        if (d < 7) { this.collect(o); continue; }
      }
      const hover = 3 + Math.sin((o.t + o.ph) * 4) * 1.5 + o.z;
      o.s.setPosition(Math.round(o.x), Math.round(o.y - hover)).setDepth(o.y);
      o.glow.setPosition(o.x, o.y - hover).setDepth(o.y - 1).setAlpha(0.35 + Math.sin((o.t + o.ph) * 6) * 0.15);
      o.shadow.setPosition(o.x, o.y + 1);
    }
  }

  private collect(o: Orb) {
    o.active = false;
    o.s.setVisible(false).stop();
    o.glow.setVisible(false);
    o.shadow.setVisible(false);
    const now = this.g.now;
    this.chain = now - this.lastPick < 350 ? Math.min(this.chain + 1, 12) : 0;
    this.lastPick = now;
    Audio.play("xp", { vol: 0.45, rate: 1 + this.chain * 0.06, maxConcurrent: 3, minGapMs: 25 });
    this.g.vfx.burst("twinkle", this.g.wizard.x + (Math.random() - 0.5) * 6, this.g.wizard.y - 12, 1, { tint: o.value >= 5 ? PAL.iceCyan : PAL.xpMint });
    this.add(o.value);
  }

  add(v: number) {
    this.xp += v * this.gainMult;
    while (this.xp >= this.toNext) {
      this.xp -= this.toNext;
      this.level++;
      this.pendingLevels++;
    }
    bus.emit(EV.XP, this.xp, this.toNext, this.level);
  }

  /** pull every orb in (end of wave / boss defeat) */
  vacuum() {
    for (const o of this.orbs) if (o.active) o.pulled = true;
  }
}
