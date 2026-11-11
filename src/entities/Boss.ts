// Ancient Arcane Guardian — floating construct with detached hands and orbiting fragments.
// Pattern: orb volley (orbs can be shot down) -> summon -> orb volley -> focus beam (telegraphed;
// interrupt it by dealing enough damage while it charges). Phase 2 below 50% HP.
import Phaser from "phaser";
import { ENEMIES } from "../config/enemies";
import { PAL } from "../config/palette";
import { Audio } from "../core/Audio";
import { bus, EV } from "../core/bus";
import { DEPTH } from "../systems/VFXManager";
import { Enemy, type Target } from "./Enemy";
import type { GameScene } from "../scenes/GameScene";

type Act = "enter" | "idle" | "volley" | "summon" | "charge" | "beam" | "stagger" | "dead";

export class Boss implements Target {
  g: GameScene;
  x = 0;
  y = -300;
  height = 44;
  radius = ENEMIES.boss.radius;
  hp: number;
  maxHp: number;
  alive = true;
  isBoss = true;
  frozen = false;
  xp = ENEMIES.boss.xp;
  body: Phaser.GameObjects.Sprite;
  hands: Phaser.GameObjects.Image[];
  frags: Phaser.GameObjects.Image[];
  shadow: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  line: Phaser.GameObjects.Graphics;
  private act: Act = "enter";
  private t = 0;
  private actT = 0;
  private cycle = 0;
  private phase2 = false;
  private chargeDmg = 0;
  private flashUntil = 0;
  private home = { x: 0, y: -92 };
  private stunUntil = 0;

  constructor(g: GameScene, hpMul: number) {
    this.g = g;
    this.maxHp = this.hp = Math.round(ENEMIES.boss.hp * hpMul);
    const w = g.wizard;
    this.home = { x: w.x, y: w.y - Math.min(100, g.viewHalfH() - 46) };
    this.x = this.home.x;
    this.y = this.home.y - 160;
    this.shadow = g.add.image(this.x, this.y, "shadow4").setDepth(DEPTH.shadow).setScale(1.3);
    this.glow = g.add.image(this.x, this.y, "glow_big").setBlendMode(Phaser.BlendModes.ADD).setTint(PAL.violet).setAlpha(0.35).setDisplaySize(130, 130);
    this.body = g.add.sprite(this.x, this.y, "boss").play("boss:idle");
    this.hands = [0, 1].map((i) => g.add.image(this.x, this.y, "boss_hand").setFlipX(i === 1));
    this.frags = [0, 1, 2].map((i) => g.add.image(this.x, this.y, `boss_frag${i}`));
    this.line = g.add.graphics().setDepth(DEPTH.fxHigh).setBlendMode(Phaser.BlendModes.ADD);
    g.vfx.play("portal", this.home.x, this.home.y + this.height, { scale: 3, depth: DEPTH.sigil });
    Audio.play("boss_roar");
    g.vfx.shake(0.006, 600);
    g.tweens.add({ targets: this, y: this.home.y, duration: 1600, ease: "Cubic.easeOut", onComplete: () => { this.act = "idle"; this.actT = 0; } });
    bus.emit(EV.BOSS_HP, 1, "ANCIENT GUARDIAN");
  }

  /** body centre for VFX */
  get cy() { return this.y - this.height; }

  damage(amount: number) {
    if (!this.alive || this.act === "enter") return false;
    this.hp -= amount;
    if (this.act === "charge") this.chargeDmg += amount;
    bus.emit(EV.BOSS_HP, Math.max(0, this.hp / this.maxHp), "ANCIENT GUARDIAN");
    if (!this.phase2 && this.hp < this.maxHp * 0.5) this.enterPhase2();
    if (this.hp <= 0) { this.hp = 0; return true; }
    return false;
  }
  react(_dx: number, _dy: number, _force: number, heavy: boolean, stunMs = 0) {
    this.flashUntil = this.g.now + (heavy ? 100 : 60);
    if (heavy && this.act !== "charge") {
      this.body.play("boss:hurt");
      this.body.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.alive && this.body.play(this.act === "charge" ? "boss:charge" : "boss:idle"));
    }
    if (stunMs) this.stunUntil = this.g.now + stunMs * 0.3;
  }
  slow() { /* immune */ }
  freeze() { /* immune */ }
  thaw() { /* immune */ }
  push() { /* immovable */ }

  private enterPhase2() {
    this.phase2 = true;
    Audio.play("boss_roar", { rate: 1.15 });
    this.g.vfx.shake(0.008, 500);
    this.g.vfx.play("shock", this.x, this.cy, { scale: 3, add: true, tint: PAL.violet });
    this.glow.setTint(PAL.pink);
    bus.emit(EV.WAVE_BANNER, "THE GUARDIAN AWAKENS", "PHASE 2", PAL.pink);
  }

  private fireVolley() {
    const n = this.phase2 ? 5 : 3;
    const w = this.g.wizard;
    const base = Math.atan2(w.y - this.cy, w.x - this.x);
    Audio.play("orb_fire");
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.28;
      const sp = this.phase2 ? 40 : 32;
      const hx = this.hands[i % 2].x, hy = this.hands[i % 2].y + 14;
      this.g.time.delayedCall(i * 120, () => {
        if (!this.alive) return;
        const orb = new Enemy(this.g, "orb", hx, hy, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp });
        this.g.enemies.push(orb);
        this.g.vfx.burst("dot", hx, hy - 14, 5, { tint: PAL.violet });
      });
    }
  }
  private summon() {
    const kinds = this.phase2 ? ["skeleton", "bat", "slime"] as const : ["slime", "bat", "slime"] as const;
    kinds.forEach((k, i) => {
      const a = Math.PI * 0.15 + (i / (kinds.length - 1)) * Math.PI * 0.7;
      const px = this.x + Math.cos(a) * 70, py = this.y + Math.sin(a) * 40 - 10;
      this.g.time.delayedCall(i * 160, () => this.alive && this.g.spawner.spawnAt(k, px, py, false));
    });
  }

  update(dtMs: number) {
    if (!this.alive) return;
    const g = this.g, dt = dtMs / 1000;
    this.t += dt;
    const stunned = g.now < this.stunUntil;
    if (!stunned) this.actT += dtMs;
    const speedK = this.phase2 ? 1.35 : 1;
    // drift
    if (this.act !== "enter" && this.act !== "dead") {
      const amp = Math.max(0, Math.min(46, g.cameras.main.worldView.width / 2 - 56));
      const tx = this.home.x + Math.sin(this.t * 0.45 * speedK) * amp;
      const ty = this.home.y + Math.sin(this.t * 0.9 * speedK) * 8;
      this.x += (tx - this.x) * Math.min(1, dt * 1.5);
      this.y += (ty - this.y) * Math.min(1, dt * 1.5);
    }
    const gap = (this.phase2 ? 1700 : 2500);
    switch (this.act) {
      case "idle":
        if (this.actT > gap) {
          const seq: Act[] = ["volley", "summon", "volley", "charge"];
          this.act = seq[this.cycle++ % seq.length];
          this.actT = 0;
          if (this.act === "volley") this.fireVolley();
          if (this.act === "summon") { this.summon(); Audio.play("spawn", { rate: 0.6 }); }
          if (this.act === "charge") {
            this.chargeDmg = 0;
            this.body.play("boss:charge");
            Audio.play("charge_beam");
            bus.emit(EV.HINT, "BREAK ITS FOCUS! HIT IT HARD!", 2400);
          }
        }
        break;
      case "volley":
      case "summon":
        if (this.actT > 900) { this.act = "idle"; this.actT = 0; }
        break;
      case "charge": {
        const dur = this.phase2 ? 2100 : 2500;
        const k = this.actT / dur;
        const w = g.wizard;
        this.line.clear();
        const flash = Math.floor(this.actT / (k > 0.7 ? 60 : 120)) % 2 === 0;
        this.line.lineStyle(1 + k * 2, PAL.pink, flash ? 0.6 : 0.25);
        this.line.lineBetween(this.x, this.cy, w.x, w.y - 12);
        g.vfx.burst("dot", this.x + (Math.random() - 0.5) * 40, this.cy + (Math.random() - 0.5) * 40, 1, { tint: PAL.lavender });
        if (this.chargeDmg >= this.maxHp * 0.07) {
          // interrupted!
          this.line.clear();
          this.act = "stagger";
          this.actT = 0;
          this.body.play("boss:hurt");
          Audio.play("stun");
          g.vfx.floatText(this.x, this.cy - 30, "STAGGERED!", PAL.gold, 1.4, 1100);
          g.vfx.play("starburst", this.x, this.cy, { scale: 2.4, add: true, tint: PAL.gold });
          g.hitstop(80);
        } else if (this.actT >= dur) {
          this.line.clear();
          this.act = "beam";
          this.actT = 0;
          Audio.play("beam");
          g.vfx.shake(0.007, 250);
          g.vfx.bolt(this.x, this.cy, w.x, w.y - 12, { color: PAL.pink, ms: 380 });
          g.vfx.bolt(this.x, this.cy, w.x, w.y - 12, { color: PAL.violet, ms: 380 });
          g.vfx.illuminate(PAL.pink, 0.1);
          g.damagePlayer(2, this.x, this.cy, true);
        }
        break;
      }
      case "beam":
      case "stagger":
        if (this.actT > (this.act === "stagger" ? 1400 : 700)) {
          this.act = "idle";
          this.actT = 0;
          this.body.play("boss:idle");
        }
        break;
    }
    // presentation
    const b = this.body;
    b.setPosition(Math.round(this.x), Math.round(this.cy)).setDepth(this.y);
    if (g.now < this.flashUntil) b.setTintFill(0xffffff);
    else if (this.act === "stagger") b.setTint(0xfff0a0);
    else b.clearTint();
    this.shadow.setPosition(this.x, this.y).setDepth(DEPTH.shadow);
    this.glow.setPosition(this.x, this.cy).setDepth(this.y - 2).setAlpha(0.28 + Math.sin(this.t * 3) * 0.08 + (this.act === "charge" ? 0.25 : 0));
    const handLift = this.act === "volley" || this.act === "summon" ? -14 : this.act === "charge" ? -6 : 0;
    this.hands.forEach((h, i) => {
      const side = i === 0 ? -1 : 1;
      const hx = this.x + side * (44 + Math.sin(this.t * 2 + i) * 3);
      const hy = this.cy + 16 + handLift + Math.sin(this.t * 2.4 + i * 2) * 3;
      h.x += (hx - h.x) * Math.min(1, dt * 8);
      h.y += (hy - h.y) * Math.min(1, dt * 8);
      h.setDepth(this.y + 1);
      if (g.now < this.flashUntil) h.setTintFill(0xffffff); else h.clearTint();
    });
    const rs = this.phase2 ? 1.6 : 0.9;
    this.frags.forEach((f, i) => {
      const a = this.t * rs + (i / 3) * Math.PI * 2;
      f.setPosition(this.x + Math.cos(a) * 40, this.cy + Math.sin(a) * 16 - 4);
      f.setDepth(Math.sin(a) > 0 ? this.y + 2 : this.y - 3);
    });
  }

  die() {
    if (this.act === "dead") return;
    this.alive = false;
    this.act = "dead";
    const g = this.g;
    this.line.clear();
    bus.emit(EV.BOSS_HP, null, "");
    Audio.play("boss_roar", { rate: 0.8 });
    g.hitstop(120);
    for (let i = 0; i < 9; i++) {
      g.time.delayedCall(i * 150, () => {
        const ex = this.x + (Math.random() - 0.5) * 60, ey = this.cy + (Math.random() - 0.5) * 50;
        g.vfx.play(i % 3 === 2 ? "explosion_big" : "explosion", ex, ey, { tint: i % 2 ? 0xe0b0ff : undefined });
        Audio.play("fire_boom", { rate: 0.8 + Math.random() * 0.3, maxConcurrent: 3 });
        g.vfx.shake(0.005, 120);
      });
    }
    g.time.delayedCall(1400, () => {
      Audio.play("big_boom");
      g.vfx.illuminate(0xffffff, 0.22, 500);
      g.vfx.play("starburst", this.x, this.cy, { scale: 4, add: true });
      g.vfx.play("shock", this.x, this.y, { scale: 3.5, add: true, tint: PAL.violet });
      g.vfx.glow(this.x, this.cy, PAL.violet, 200, 900, 0.9);
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 60;
        g.vfx.bit(i < 4 ? `boss_frag${i % 3}` : `rock${i % 3}`, this.x, this.y, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, 120 + Math.random() * 100, 1600);
      }
      [this.body, ...this.hands, ...this.frags, this.glow, this.shadow].forEach((o) => o.destroy());
      this.line.destroy();
      g.onBossDefeated(this);
    });
  }
}
