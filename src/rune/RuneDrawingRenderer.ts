// The magical drawing trail: soft glow + bright core, a glowing pen tip shedding sparkles, sparks
// at sharp corners. On success the rune snaps into its clean glyph in the element colour, then
// collapses into particles; on failure the trail greys out and fades to smoke.
import Phaser from "phaser";
import { PAL } from "../config/palette";
import { idealGlyph, type RuneName } from "./RuneRecognizer";
import { DEPTH, type VFXManager } from "../systems/VFXManager";
import { strokeSegments } from "../ui/stroke";

type P = { x: number; y: number };

export class RuneDrawingRenderer {
  scene: Phaser.Scene;
  vfx: VFXManager;
  private g: Phaser.GameObjects.Graphics;
  private tip: Phaser.GameObjects.Image;
  private pts: P[] = [];
  private dirty = false;
  private sparkT = 0;
  private color: number = PAL.lavender;
  private glow: number = PAL.violet;
  drawing = false;

  constructor(scene: Phaser.Scene, vfx: VFXManager) {
    this.scene = scene;
    this.vfx = vfx;
    this.g = scene.add.graphics().setDepth(DEPTH.fxHigh + 10).setBlendMode(Phaser.BlendModes.ADD);
    this.tip = scene.add.image(0, 0, "glow").setBlendMode(Phaser.BlendModes.ADD).setTint(PAL.lavender).setDepth(DEPTH.fxHigh + 11).setDisplaySize(16, 16).setVisible(false);
  }

  begin(x: number, y: number) {
    this.scene.tweens.killTweensOf(this.g);
    this.g.setAlpha(1).setPosition(0, 0).setScale(1);
    this.pts = [{ x, y }];
    this.color = PAL.lavender;
    this.glow = PAL.violet;
    this.drawing = true;
    this.dirty = true;
    this.tip.setPosition(x, y).setVisible(true).setAlpha(0.9);
    this.vfx.burst("twinkle", x, y, 2, { tint: PAL.lavender });
  }

  add(x: number, y: number) {
    if (!this.drawing) return;
    const last = this.pts[this.pts.length - 1];
    if (Math.hypot(x - last.x, y - last.y) < 1.2) return;
    this.pts.push({ x, y });
    if (this.pts.length > 400) this.pts.splice(1, 1);
    this.dirty = true;
    this.tip.setPosition(x, y);
    // sharp corner sparks
    const n = this.pts.length;
    if (n >= 7) {
      const a = this.pts[n - 7], b = this.pts[n - 4], c = this.pts[n - 1];
      const a1 = Math.atan2(b.y - a.y, b.x - a.x), a2 = Math.atan2(c.y - b.y, c.x - b.x);
      const turn = Math.abs(Phaser.Math.Angle.Wrap(a2 - a1));
      if (turn > 1.15 && Math.hypot(b.x - a.x, b.y - a.y) > 3) {
        this.vfx.burst("spark", b.x, b.y, 3, { tint: 0xffffff, speed: [30, 80] });
        this.vfx.glow(b.x, b.y, PAL.violet, 16, 160, 0.8, DEPTH.fxHigh);
      }
    }
  }

  private redraw() {
    const g = this.g, p = this.pts;
    g.clear();
    if (p.length < 2) {
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(p[0].x, p[0].y, 1.2);
      return;
    }
    const pass = (w: number, c: number, a: number) => strokeSegments(g, p, w, c, a);
    pass(6, this.glow, 0.14);
    pass(3.2, this.glow, 0.32);
    pass(1.8, this.color, 0.75);
    pass(0.9, 0xffffff, 0.95);
  }

  update(dtMs: number) {
    if (this.dirty) {
      this.redraw();
      this.dirty = false;
    }
    if (this.drawing) {
      this.sparkT -= dtMs;
      if (this.sparkT <= 0) {
        this.sparkT = 34;
        const t = this.pts[this.pts.length - 1];
        this.vfx.burst(Math.random() < 0.6 ? "dot" : "twinkle", t.x, t.y, 1, { tint: Math.random() < 0.5 ? PAL.lavender : 0xffffff, speed: [5, 20] });
      }
      this.tip.setAlpha(0.7 + Math.random() * 0.3);
    }
  }

  points() {
    return this.pts;
  }
  bounds() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of this.pts) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }

  /** recognised: flash, snap to clean glyph, collapse into particles */
  success(rune: RuneName, color: number, light: number) {
    this.drawing = false;
    this.tip.setVisible(false);
    const b = this.bounds();
    this.color = light;
    this.glow = color;
    this.redraw();
    this.scene.tweens.add({ targets: this.g, alpha: 0, duration: 160 });
    // clean glyph
    const size = Math.max(18, Math.max(b.w, b.h));
    const glyph = idealGlyph(rune).map((q) => ({ x: q.x * size, y: q.y * size }));
    const gg = this.scene.add.graphics().setDepth(DEPTH.fxHigh + 12).setBlendMode(Phaser.BlendModes.ADD).setPosition(b.cx, b.cy);
    const draw = (w: number, c: number, a: number) => strokeSegments(gg, glyph, w, c, a);
    draw(6, color, 0.25);
    draw(2.5, color, 0.85);
    draw(1, 0xffffff, 1);
    gg.setScale(1.15);
    this.vfx.glow(b.cx, b.cy, color, size * 1.6, 300, 0.6, DEPTH.fxHigh);
    this.scene.tweens.add({ targets: gg, scale: 1, duration: 90, ease: "Back.easeOut" });
    this.scene.tweens.add({
      targets: gg, scale: 0.15, alpha: 0, delay: 140, duration: 220, ease: "Cubic.easeIn",
      onComplete: () => gg.destroy(),
    });
    for (let i = 0; i < glyph.length; i += 3) {
      this.vfx.burst("twinkle", b.cx + glyph[i].x, b.cy + glyph[i].y, 1, { tint: i % 2 ? light : color, speed: [10, 40] });
    }
  }

  /** not recognised: grey out and fade into smoke */
  fail() {
    this.drawing = false;
    this.tip.setVisible(false);
    this.color = 0x8a7aa8;
    this.glow = 0x3a3060;
    this.redraw();
    this.g.setBlendMode(Phaser.BlendModes.NORMAL);
    this.scene.tweens.add({ targets: this.g, alpha: 0, y: -4, duration: 380, ease: "Quad.easeIn", onComplete: () => { this.g.setBlendMode(Phaser.BlendModes.ADD); this.g.clear(); } });
    const step = Math.max(1, Math.floor(this.pts.length / 4));
    for (let i = 0; i < this.pts.length; i += step) this.vfx.play("smoke", this.pts[i].x, this.pts[i].y, { scale: 0.7, alpha: 0.7, depth: DEPTH.fxHigh });
  }

  cancel() {
    this.drawing = false;
    this.tip.setVisible(false);
    this.scene.tweens.add({ targets: this.g, alpha: 0, duration: 150, onComplete: () => this.g.clear() });
  }
}
