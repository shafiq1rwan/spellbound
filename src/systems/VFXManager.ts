// VFXManager: every transient effect goes through pools here (anim sprites, particles,
// damage numbers, decals, bouncing debris, lightning). Quality setting scales particle counts.
import Phaser from "phaser";
import { Save } from "../core/Save";
import { PAL } from "../config/palette";
import { strokeSegments } from "../ui/stroke";

export const DEPTH = {
  floor: -10000, decal: -9000, ambient: -8500, shadow: -8000, sigil: -7500,
  // entities use their y (range roughly -400..400)
  fxLow: 5000, fx: 6000, fxHigh: 7000, numbers: 8000, flash: 9000,
};

type Bit = { img: Phaser.GameObjects.Image; x: number; y: number; z: number; vx: number; vy: number; vz: number; spin: number; life: number; max: number; active: boolean; bounce: number };
type Decal = { img: Phaser.GameObjects.Image; life: number; max: number; active: boolean };

export class VFXManager {
  scene: Phaser.Scene;
  private animPool = new Map<string, Phaser.GameObjects.Sprite[]>();
  private emitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();
  private defaults = new Map<string, Phaser.Types.GameObjects.Particles.ParticleEmitterConfig>();
  private numbers: Phaser.GameObjects.BitmapText[] = [];
  private bits: Bit[] = [];
  private decals: Decal[] = [];
  private bolts: Phaser.GameObjects.Graphics[] = [];
  private glows: Phaser.GameObjects.Image[] = [];
  private loopers = new WeakSet<Phaser.GameObjects.Sprite>();
  private flashRect: Phaser.GameObjects.Rectangle;
  /** effective quality: the setting (1 high, 0.4 low) x autoQ */
  q = 1;
  private baseQ = 1;
  /** drops when the frame rate does (late waves on a weak phone), recovers when it's back */
  private autoQ = 1;
  private fpsT = 0;
  /** live particles across every emitter, recounted each frame and bumped on each burst */
  private aliveParticles = 0;
  reduced = false;
  // screen shake in ART pixels (Phaser's built-in shake scales with canvas size x zoom = far too strong here)
  private shakeAmp = 0;
  private shakeMs = 0;
  private shakeMax = 1;
  private shakeTick = 0;
  private baseScroll: { x: number; y: number } | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.refreshQuality();
    const mk = (key: string, tex: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, depth = DEPTH.fx, add = false) => {
      const e = scene.add.particles(0, 0, tex, { emitting: false, ...cfg });
      e.setDepth(depth);
      if (add) e.setBlendMode(Phaser.BlendModes.ADD);
      this.emitters.set(key, e);
      this.defaults.set(key, cfg);
    };
    mk("ember", "p_ember", { speed: { min: 20, max: 70 }, lifespan: { min: 250, max: 600 }, scale: { start: 1, end: 0 }, gravityY: -30, rotate: { min: 0, max: 360 } }, DEPTH.fx, true);
    mk("spark", "p_spark", { speed: { min: 40, max: 120 }, lifespan: { min: 150, max: 350 }, scale: { start: 1, end: 0 } }, DEPTH.fxHigh, true);
    mk("dot", "p_dot", { speed: { min: 5, max: 30 }, lifespan: { min: 300, max: 800 }, alpha: { start: 1, end: 0 } }, DEPTH.fxHigh, true);
    mk("twinkle", "p_twinkle", { speed: { min: 6, max: 30 }, lifespan: { min: 250, max: 600 }, scale: { start: 0.9, end: 0 }, rotate: { min: 0, max: 90 } }, DEPTH.fxHigh, true);
    mk("snow", "p_snow", { speed: { min: 10, max: 50 }, lifespan: { min: 500, max: 1200 }, gravityY: 25, alpha: { start: 1, end: 0 } }, DEPTH.fx, false);
    mk("shard", "p_shard", { speed: { min: 50, max: 140 }, lifespan: { min: 200, max: 450 }, scale: { start: 1, end: 0.3 }, rotate: { min: 0, max: 360 } }, DEPTH.fx);
    mk("drop", "p_drop", { speed: { min: 30, max: 90 }, lifespan: { min: 300, max: 600 }, gravityY: 160, scale: { start: 1, end: 0.4 } }, DEPTH.fx);
    mk("chip", "p_chip", { speed: { min: 30, max: 100 }, lifespan: { min: 300, max: 700 }, gravityY: 180, rotate: { min: 0, max: 360 } }, DEPTH.fx);
    mk("feather", "p_feather", { speed: { min: 10, max: 50 }, lifespan: { min: 300, max: 700 }, scale: { start: 1, end: 0 } }, DEPTH.fx, true);
    mk("mote", "p_dot", { speed: { min: 2, max: 8 }, lifespan: { min: 900, max: 1600 }, alpha: { start: 0.9, end: 0 }, gravityY: -6 }, DEPTH.fx, true);

    for (let i = 0; i < 40; i++) {
      const t = scene.add.bitmapText(0, 0, "pixel", "", 8).setOrigin(0.5).setDepth(DEPTH.numbers).setVisible(false);
      this.numbers.push(t);
    }
    this.flashRect = scene.add.rectangle(0, 0, 4000, 4000, 0xffffff, 0).setDepth(DEPTH.flash).setBlendMode(Phaser.BlendModes.ADD);
  }

  refreshQuality() {
    const s = Save.settings;
    this.baseQ = s.quality === "low" ? 0.4 : 1;
    this.q = this.baseQ * this.autoQ;
    this.reduced = s.reducedMotion;
  }

  // ------------------------------------------------------------ frame-animated effects
  play(key: string, x: number, y: number, o: { scale?: number; angle?: number; depth?: number; add?: boolean; tint?: number; alpha?: number; flipX?: boolean; anim?: string; onDone?: () => void; loop?: boolean } = {}) {
    const pool = this.animPool.get(key) ?? [];
    this.animPool.set(key, pool);
    let s = pool.find((p) => !p.active);
    if (!s) {
      if (pool.length >= 32) {
        // budget reached: recycle the oldest one-shot sprite of this kind instead of adding more
        const i = pool.findIndex((p) => !this.loopers.has(p));
        if (i < 0) { s = this.scene.add.sprite(0, 0, key); pool.push(s); }
        else { s = pool.splice(i, 1)[0]; pool.push(s); }
      } else {
        s = this.scene.add.sprite(0, 0, key);
        pool.push(s);
      }
    } else {
      pool.splice(pool.indexOf(s), 1);
      pool.push(s); // keep the pool ordered oldest-first
    }
    if (o.loop) this.loopers.add(s); else this.loopers.delete(s);
    s.setActive(true).setVisible(true).setPosition(x, y).setScale(o.scale ?? 1).setAngle(o.angle ?? 0)
      .setDepth(o.depth ?? DEPTH.fx).setAlpha(o.alpha ?? 1).setFlipX(!!o.flipX)
      .setBlendMode(o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    if (o.tint !== undefined) s.setTint(o.tint); else s.clearTint();
    s.removeAllListeners();
    s.play(o.anim ?? `${key}:play`);
    const spr = s;
    if (!o.loop)
      s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        spr.setActive(false).setVisible(false);
        o.onDone?.();
      });
    return s;
  }
  release(s: Phaser.GameObjects.Sprite) {
    s.stop();
    s.setActive(false).setVisible(false);
  }

  // ------------------------------------------------------------ particles
  burst(kind: string, x: number, y: number, n: number, o: { tint?: number; speed?: [number, number]; life?: [number, number]; scale?: number } = {}) {
    const e = this.emitters.get(kind);
    if (!e) return;
    // global particle budget (fill-rate is what lags phones): thin out, then skip
    const budget = 420 * this.q;
    const room = budget - this.aliveParticles;
    if (room < 1) return;
    const count = Math.min(Math.floor(room), Math.max(1, Math.round(n * this.q)));
    this.aliveParticles += count;
    if (o.tint !== undefined) e.setParticleTint(o.tint); else e.setParticleTint(0xffffff);
    const def = this.defaults.get(kind)!;
    if (o.speed) e.setParticleSpeed({ min: o.speed[0], max: o.speed[1] } as unknown as number);
    if (o.life) e.setParticleLifespan({ min: o.life[0], max: o.life[1] });
    if (o.scale) e.setParticleScale({ start: o.scale, end: 0 } as unknown as number);
    e.explode(count, x, y);
    // restore this emitter's defaults for the next caller
    if (o.speed) e.setParticleSpeed(def.speed as unknown as number);
    if (o.life) e.setParticleLifespan(def.lifespan as Phaser.Types.GameObjects.Particles.EmitterOpOnEmitType);
    if (o.scale) e.setParticleScale((def.scale ?? 1) as unknown as number);
  }
  /** emits n particles distributed in a circle of radius r */
  ring(kind: string, x: number, y: number, r: number, n: number, tint?: number) {
    const c = Math.max(1, Math.round(n * this.q));
    for (let i = 0; i < c; i++) {
      const a = (i / c) * Math.PI * 2 + Math.random() * 0.3;
      this.burst(kind, x + Math.cos(a) * r, y + Math.sin(a) * r, 1, { tint });
    }
  }

  // ------------------------------------------------------------ glow (additive, tinted)
  glow(x: number, y: number, color: number, size: number, ms: number, alpha = 0.7, depth = DEPTH.fxLow) {
    if (this.q < 1 && size < 40) return;
    // pooled, at most 24 at once: big additive glows are the most expensive thing to draw
    let g = this.glows.find((v) => !v.active);
    if (!g) {
      if (this.glows.length >= 24) return;
      g = this.scene.add.image(0, 0, "glow").setBlendMode(Phaser.BlendModes.ADD);
      this.glows.push(g);
    }
    const im = g;
    im.setActive(true).setVisible(true).setTexture(size > 48 ? "glow_big" : "glow").setPosition(x, y).setTint(color).setDepth(depth).setAlpha(alpha);
    im.setDisplaySize(size, size);
    this.scene.tweens.add({ targets: im, alpha: 0, scale: im.scale * 1.25, duration: ms, ease: "Quad.easeOut", onComplete: () => im.setActive(false).setVisible(false) });
  }

  /** brief arena illumination for big explosions (kept subtle; disabled by reduced motion) */
  illuminate(color: number, strength = 0.1, ms = 220) {
    if (this.reduced) strength *= 0.4;
    const r = this.flashRect;
    r.setFillStyle(color, 1).setAlpha(strength);
    this.scene.tweens.killTweensOf(r);
    this.scene.tweens.add({ targets: r, alpha: 0, duration: ms, ease: "Quad.easeOut" });
  }

  // ------------------------------------------------------------ damage numbers
  number(x: number, y: number, value: number | string, color: number, big = false) {
    const t = this.numbers.find((n) => !n.visible) ?? this.numbers[0];
    this.scene.tweens.killTweensOf(t);
    t.setText(String(value)).setPosition(Math.round(x + (Math.random() - 0.5) * 6), Math.round(y)).setTint(color).setVisible(true).setAlpha(1);
    t.setScale(big ? 1.6 : 1.1);
    this.scene.tweens.add({ targets: t, scale: big ? 1.25 : 1, duration: 120, ease: "Back.easeOut" });
    this.scene.tweens.add({
      targets: t, y: y - (big ? 18 : 13), duration: big ? 650 : 520, ease: "Cubic.easeOut",
      onComplete: () => this.scene.tweens.add({ targets: t, alpha: 0, duration: 140, onComplete: () => t.setVisible(false) }),
    });
  }
  floatText(x: number, y: number, s: string, color: number, scale = 1, ms = 900) {
    const t = this.scene.add.bitmapText(Math.round(x), Math.round(y), "pixel", s, 8).setOrigin(0.5).setTint(color).setDepth(DEPTH.numbers + 1).setScale(scale * 0.5);
    this.scene.tweens.add({ targets: t, scale, duration: 160, ease: "Back.easeOut" });
    this.scene.tweens.add({ targets: t, y: y - 14, alpha: 0, delay: ms * 0.5, duration: ms * 0.5, onComplete: () => t.destroy() });
    return t;
  }

  /** wordless hint: an icon pops up, bobs and fades (e.g. a triangle rune, a clock for cooldown) */
  floatIcon(key: string, x: number, y: number, scale = 1.5, ms = 900) {
    const im = this.scene.add.image(Math.round(x), Math.round(y), key).setDepth(DEPTH.numbers + 1).setScale(scale * 0.4);
    this.scene.tweens.add({ targets: im, scale, duration: 180, ease: "Back.easeOut" });
    this.scene.tweens.add({ targets: im, y: y - 8, alpha: 0, delay: ms * 0.55, duration: ms * 0.45, onComplete: () => im.destroy() });
    return im;
  }

  // ------------------------------------------------------------ decals
  decal(key: string, x: number, y: number, scale = 1, ms = 4000, alpha = 0.85) {
    if (this.q < 1 && this.decals.filter((d) => d.active).length > 10) return;
    let d = this.decals.find((v) => !v.active);
    if (!d) {
      if (this.decals.length >= 36) d = this.decals.reduce((a, b) => (a.life < b.life ? a : b));
      else {
        d = { img: this.scene.add.image(0, 0, key).setDepth(DEPTH.decal), life: 0, max: 0, active: false };
        this.decals.push(d);
      }
    }
    d.img.setTexture(key).setPosition(Math.round(x), Math.round(y)).setScale(scale).setAlpha(alpha).setVisible(true).setFlipX(Math.random() < 0.5);
    d.life = ms;
    d.max = ms;
    d.active = true;
  }

  // ------------------------------------------------------------ bouncing debris
  bit(tex: string, x: number, y: number, vx: number, vy: number, vz: number, life = 900, tint?: number) {
    let b = this.bits.find((v) => !v.active);
    if (!b) {
      if (this.bits.length >= 60) return;
      b = { img: this.scene.add.image(0, 0, tex), x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, life: 0, max: 0, active: false, bounce: 0 };
      this.bits.push(b);
    }
    Object.assign(b, { x, y, z: 4, vx, vy, vz, spin: (Math.random() - 0.5) * 900, life, max: life, active: true, bounce: 0 });
    b.img.setTexture(tex).setVisible(true).setAlpha(1).setAngle(Math.random() * 360);
    if (tint !== undefined) b.img.setTint(tint); else b.img.clearTint();
  }

  // ------------------------------------------------------------ lightning
  /** jagged bolt between two points: glow + body + white core; flickers then fades */
  bolt(x0: number, y0: number, x1: number, y1: number, o: { width?: number; color?: number; ms?: number } = {}) {
    let g = this.bolts.find((b) => !b.active);
    if (!g) {
      if (this.bolts.length >= 24) return; // enough lightning on screen already
      g = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fxHigh);
      this.bolts.push(g);
    }
    g.setActive(true).setVisible(true).setAlpha(1);
    const color = o.color ?? PAL.boltYellow;
    const draw = () => {
      g.clear();
      const pts = this.jag(x0, y0, x1, y1);
      const pass = (w: number, c: number, a: number) => strokeSegments(g, pts, w, c, a);
      pass(5, PAL.boltBlue, 0.25);
      pass(2.2, color, 0.9);
      pass(1, 0xffffff, 1);
      // tiny side branches
      for (let i = 2; i < pts.length - 2; i += 3) {
        if (Math.random() < 0.5) continue;
        const a = Math.atan2(y1 - y0, x1 - x0) + (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.6);
        const L = 4 + Math.random() * 7;
        g.lineStyle(1, color, 0.8);
        g.lineBetween(pts[i].x, pts[i].y, pts[i].x + Math.cos(a) * L, pts[i].y + Math.sin(a) * L);
      }
    };
    draw();
    const ms = o.ms ?? 200;
    this.scene.time.delayedCall(45, draw);
    this.scene.time.delayedCall(90, draw);
    this.scene.tweens.add({ targets: g, alpha: 0, delay: 70, duration: ms, ease: "Quad.easeIn", onComplete: () => { g.clear(); g.setActive(false).setVisible(false); } });
  }
  private jag(x0: number, y0: number, x1: number, y1: number) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(3, Math.round(d / 7));
    const nx = -(y1 - y0) / (d || 1), ny = (x1 - x0) / (d || 1);
    const pts: { x: number; y: number }[] = [{ x: x0, y: y0 }];
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const off = (Math.random() - 0.5) * Math.min(14, d * 0.25) * Math.sin(t * Math.PI);
      pts.push({ x: Math.round(x0 + (x1 - x0) * t + nx * off), y: Math.round(y0 + (y1 - y0) * t + ny * off) });
    }
    pts.push({ x: x1, y: y1 });
    return pts;
  }

  /** remember the camera's resting scroll (call after layout/centerOn) */
  setShakeBase() {
    const cam = this.scene.cameras.main;
    this.baseScroll = { x: cam.scrollX, y: cam.scrollY };
  }
  /** px: peak offset in art pixels (1 = subtle, 3 = huge); decays to zero over ms */
  shake(px: number, ms = 120) {
    const amp = px * (this.reduced ? 0.4 : 1);
    if (amp <= 0) return;
    if (!this.baseScroll) this.setShakeBase();
    // keep the stronger of the running and new shake
    if (amp * ms >= this.shakeAmp * this.shakeMs) {
      this.shakeAmp = amp;
      this.shakeMs = ms;
      this.shakeMax = ms;
    }
  }
  private updateShake(dtMs: number) {
    if (!this.baseScroll) return;
    const cam = this.scene.cameras.main;
    if (this.shakeMs <= 0) {
      cam.setScroll(this.baseScroll.x, this.baseScroll.y);
      return;
    }
    this.shakeMs -= dtMs;
    this.shakeTick -= dtMs;
    if (this.shakeTick > 0) return;
    this.shakeTick = 40;
    const a = this.shakeAmp * Math.max(0, this.shakeMs / this.shakeMax);
    const ox = Math.round((Math.random() * 2 - 1) * a), oy = Math.round((Math.random() * 2 - 1) * a);
    cam.setScroll(this.baseScroll.x + ox, this.baseScroll.y + oy);
  }

  update(dtMs: number) {
    this.updateShake(dtMs);
    let alive = 0;
    for (const e of this.emitters.values()) alive += e.getAliveParticleCount();
    this.aliveParticles = alive;
    // adaptive density: check the smoothed frame rate once a second
    this.fpsT += dtMs;
    if (this.fpsT >= 1000) {
      this.fpsT = 0;
      const fps = this.scene.game.loop.actualFps;
      if (fps < 45) this.autoQ = Math.max(0.35, this.autoQ - 0.15);
      else if (fps > 56) this.autoQ = Math.min(1, this.autoQ + 0.05);
      this.q = this.baseQ * this.autoQ;
    }
    const dt = dtMs / 1000;
    for (const b of this.bits) {
      if (!b.active) continue;
      b.life -= dtMs;
      b.vz -= 260 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      if (b.z <= 0) {
        b.z = 0;
        if (b.bounce < 2 && Math.abs(b.vz) > 20) { b.vz = -b.vz * 0.45; b.bounce++; } else b.vz = 0;
        b.vx *= 0.6;
        b.vy *= 0.6;
        b.spin *= 0.5;
      }
      b.img.setPosition(Math.round(b.x), Math.round(b.y - b.z)).setDepth(b.y);
      b.img.angle += b.spin * dt;
      if (b.life < 300) b.img.setAlpha(Math.max(0, b.life / 300) > 0.5 ? 1 : (Math.floor(b.life / 50) % 2 ? 1 : 0.2));
      if (b.life <= 0) { b.active = false; b.img.setVisible(false); }
    }
    for (const d of this.decals) {
      if (!d.active) continue;
      d.life -= dtMs;
      if (d.life < 800) d.img.setAlpha(Math.max(0, (d.life / 800) * 0.85));
      if (d.life <= 0) { d.active = false; d.img.setVisible(false); }
    }
  }
}
