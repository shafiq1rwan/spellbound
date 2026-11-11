// Environment life: glowing mushrooms pulse, ancient runes fade in/out (and flare when casting),
// floating dust, grass tufts that sway when shockwaves pass.
import Phaser from "phaser";
import { M } from "../core/assets";
import { PAL } from "../config/palette";
import { DEPTH, type VFXManager } from "./VFXManager";

export class Ambience {
  scene: Phaser.Scene;
  private mush: { g: Phaser.GameObjects.Image; ph: number; sp: number }[] = [];
  private runes: { s: Phaser.GameObjects.Image; g: Phaser.GameObjects.Image; ph: number; flare: number }[] = [];
  private tufts: { s: Phaser.GameObjects.Image; x: number; y: number; sway: number; v: number }[] = [];
  private dustT = 0;
  private t = 0;
  private vfx: VFXManager;

  constructor(scene: Phaser.Scene, vfx: VFXManager, cx: number, cy: number) {
    this.scene = scene;
    this.vfx = vfx;
    const d = M().decor;
    const ox = cx - d.size / 2, oy = cy - d.size / 2;
    const low = vfx.q < 1;
    for (const [x, y] of d.mushrooms) {
      const g = scene.add.image(ox + x, oy + y, "glow").setTint(0x5fe0d0).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.ambient).setDisplaySize(18, 18).setAlpha(0.3);
      this.mush.push({ g, ph: Math.random() * 10, sp: 0.6 + Math.random() * 0.8 });
    }
    for (const [x, y, i] of d.runes) {
      const s = scene.add.image(ox + x, oy + y, `glyph${i}`).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.ambient).setAlpha(0);
      const g = scene.add.image(ox + x, oy + y, "glow").setBlendMode(Phaser.BlendModes.ADD).setTint(PAL.iceCyan).setDepth(DEPTH.ambient).setDisplaySize(20, 20).setAlpha(0);
      this.runes.push({ s, g, ph: Math.random() * 10, flare: 0 });
    }
    if (!low)
      for (const [x, y] of d.tufts) {
        const s = scene.add.image(ox + x, oy + y, "tuft").setOrigin(0.5, 1).setDepth(oy + y - 600);
        this.tufts.push({ s, x: ox + x, y: oy + y, sway: 0, v: 0 });
      }
  }

  /** runes around the wizard flare in the element colour when a spell is cast */
  flareRunes(color: number) {
    for (const r of this.runes) {
      r.flare = 1;
      r.s.setTint(color);
      r.g.setTint(color);
    }
  }

  shockwave(x: number, y: number, radius: number) {
    for (const t of this.tufts) {
      const dx = t.x - x, dy = t.y - y, d = Math.hypot(dx, dy);
      if (d < radius) t.v += Math.sign(dx || 1) * (1 - d / radius) * 260;
    }
  }

  update(dtMs: number, view: Phaser.Geom.Rectangle) {
    const dt = dtMs / 1000;
    this.t += dt;
    for (const m of this.mush) {
      const p = Math.sin(this.t * m.sp + m.ph);
      m.g.setAlpha(0.18 + Math.max(0, p) * 0.32);
    }
    for (const r of this.runes) {
      const base = Math.max(0, Math.sin(this.t * 0.5 + r.ph)) * 0.55;
      r.flare = Math.max(0, r.flare - dt * 1.2);
      const a = Math.min(1, base + r.flare);
      r.s.setAlpha(a);
      r.g.setAlpha(a * 0.4);
      if (r.flare <= 0 && r.s.tintTopLeft !== 0xffffff) { r.s.clearTint(); r.g.setTint(PAL.iceCyan); }
    }
    for (const t of this.tufts) {
      t.v += -t.sway * 90 * dt - t.v * 6 * dt;
      t.sway += t.v * dt;
      t.s.setAngle(Phaser.Math.Clamp(t.sway, -35, 35) + Math.sin(this.t * 1.3 + t.x) * 2);
    }
    // floating magic dust within the view
    this.dustT -= dtMs;
    if (this.dustT <= 0) {
      this.dustT = this.vfx.q < 1 ? 360 : 140;
      const x = view.x + Math.random() * view.width, y = view.y + Math.random() * view.height;
      this.vfx.burst("mote", x, y, 1, { tint: Math.random() < 0.6 ? 0x8e7cc3 : 0x5fb4c8 });
    }
  }
}
