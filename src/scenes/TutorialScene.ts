// Onboarding overlay, wordless so it works in any language.
//
// "intro" (first run) is a GUIDED sequence with the world paused (enemies hold still):
//   1. a slime appears above the wizard with a big dashed triangle over it to TRACE
//      (a ghost hand traces it in a loop); pictogram [triangle] -> [fireball]
//   2. a second slime somewhere else, dashed triangle over it: teaches "draw on a monster to aim"
//   3. "SURVIVE!" + the "you can't move" chain hint, then wave 1 starts
// Swipes don't count during the tutorial (GameScene) so the triangle can't be skipped by accident.
//
// "demo" shows how to draw a rune that was just unlocked (pictogram + ghost drawing above the wizard).
import Phaser from "phaser";
import { Layout } from "../core/Layout";
import { bus, EV } from "../core/bus";
import { Analytics } from "../core/Analytics";
import { SPELLS, type SpellId } from "../config/spells";
import { ELEMENT_COLORS, PAL } from "../config/palette";
import { idealGlyph, type Pt } from "../rune/RuneRecognizer";
import { txt, type PixelText } from "../ui/widgets";
import { strokeSegments } from "../ui/stroke";
import type { GameScene } from "./GameScene";
import type { Enemy } from "../entities/Enemy";

export class TutorialScene extends Phaser.Scene {
  private g!: GameScene;
  private mode: "intro" | "demo" = "intro";
  private spell: SpellId = "fireball";
  private ghost!: Phaser.GameObjects.Graphics;
  private guide!: Phaser.GameObjects.Graphics;
  private hand!: Phaser.GameObjects.Image;
  private picto!: Phaser.GameObjects.Container;
  private mark!: PixelText;
  private path: Pt[] = [];
  private t = 0;
  private loops = 0;
  /** intro: 0 = trace on slime 1, 1 = aim at slime 2, 2 = done */
  private step = 0;
  private target: Enemy | null = null;
  private handlers: [string, (...a: never[]) => void][] = [];
  private hidden = false;
  private busy = false;

  constructor() {
    super("Tutorial");
  }

  init(data: { mode?: "intro" | "demo"; spell?: SpellId }) {
    this.mode = data?.mode ?? "intro";
    this.spell = data?.spell ?? "fireball";
    this.t = 0;
    this.loops = 0;
    this.step = 0;
    this.target = null;
    this.hidden = false;
    this.busy = false;
  }

  create() {
    this.g = this.scene.get("Game") as GameScene;
    this.cameras.main.setZoom(Layout.S).setOrigin(0, 0);
    this.scene.bringToTop();
    const def = SPELLS[this.spell];
    const col = ELEMENT_COLORS[def.element];
    this.guide = this.add.graphics();
    this.ghost = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.hand = this.add.image(0, 0, "hand").setOrigin(0.25, 0.05);
    // pictogram: [rune shape] -> [spell]
    this.picto = this.add.container(0, 0);
    const runeIcon = this.add.image(0, 0, def.runeIcon).setScale(2);
    const arrow = txt(this, 0, 0, "→", { scale: 2, color: 0xd8d0f0 });
    const spellIcon = this.add.image(0, 0, def.icon).setScale(2);
    const glow = this.add.image(0, 0, "glow_big").setTint(col.main).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.25).setDisplaySize(130, 50);
    const gap = 8, wR = runeIcon.displayWidth, wA = arrow.ink().w, wS = spellIcon.displayWidth;
    const total = wR + gap + wA + gap + wS;
    runeIcon.setX(Math.round(-total / 2 + wR / 2));
    arrow.setX(Math.round(-total / 2 + wR + gap + wA / 2));
    spellIcon.setX(Math.round(total / 2 - wS / 2));
    this.picto.add([glow, runeIcon, arrow, spellIcon]);
    this.mark = txt(this, 0, 0, "", { scale: 3, color: PAL.gold }).setAlpha(0);
    this.layout();

    if (this.mode === "intro") {
      const size = 62;
      this.path = idealGlyph("triangle").map((p) => ({ x: p.x * size, y: p.y * size }));
      this.g.worldPaused = true;
      const w = this.g.wizard;
      this.g.time.delayedCall(250, () => {
        this.target = this.g.spawner.spawnAt("slime", w.x + 4, w.y - Math.min(78, this.g.viewHalfH() - 50), false);
      });
      this.listen(EV.CAST, () => this.onCast());
      this.listen(EV.FAIL, () => { if (this.step < 2) this.feedback(false); });
      this.listen(EV.STROKE, (on: boolean) => this.setHidden(on));
      Analytics.track("tutorial", "step-trace", "start", "run");
    } else {
      const size = Math.min(70, Layout.w * 0.32);
      this.path = idealGlyph(def.rune).map((p) => ({ x: p.x * size, y: p.y * size }));
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.handlers.forEach(([e, f]) => bus.off(e, f));
      this.handlers = [];
    });
  }

  private listen<T extends unknown[]>(ev: string, fn: (...a: T) => void) {
    bus.on(ev, fn);
    this.handlers.push([ev, fn as unknown as (...a: never[]) => void]);
  }
  private setHidden(on: boolean) {
    this.hidden = on;
    this.tweens.add({ targets: [this.ghost, this.hand], alpha: on ? 0 : 1, duration: 120 });
  }
  private layout() {
    const y = Math.round(Layout.safe.top + (Layout.portrait ? 66 : 48));
    this.picto.setPosition(Math.round(Layout.w / 2), y);
    this.mark.setPosition(Math.round(Layout.w / 2), y);
  }

  /** wordless feedback: red cross + shake on a miss, gold check on success */
  private feedback(ok: boolean) {
    this.tweens.killTweensOf(this.mark);
    this.mark.setText(ok ? "✓" : "✗").setTint(ok ? PAL.gold : PAL.hpRed).setAlpha(1).setScale(ok ? 0.5 : 1);
    if (ok) {
      this.picto.setAlpha(0);
      this.tweens.add({ targets: this.mark, scale: 1, duration: 260, ease: "Back.easeOut" });
      this.tweens.add({ targets: this.mark, alpha: 0, delay: 700, duration: 250, onComplete: () => { if (this.step < 2) this.picto.setAlpha(1); } });
    } else {
      this.picto.setAlpha(0.35);
      this.tweens.add({ targets: this.picto, x: this.picto.x + 4, duration: 50, yoyo: true, repeat: 3 });
      this.tweens.add({ targets: this.mark, alpha: 0, delay: 500, duration: 250, onComplete: () => this.picto.setAlpha(1) });
    }
  }

  private onCast() {
    if (this.busy || this.step >= 2) return;
    this.busy = true;
    this.feedback(true);
    this.guide.clear();
    this.ghost.clear();
    const g = this.g, w = g.wizard;
    if (this.step === 0) {
      Analytics.track("tutorial", "step-trace", "complete", "run");
      this.time.delayedCall(1100, () => {
        // step 2: a slime somewhere else, aim by drawing on it
        this.step = 1;
        this.busy = false;
        this.target = g.spawner.spawnAt("slime", w.x - 62, w.y + 34, false);
        Analytics.track("tutorial", "step-aim", "start", "run");
      });
    } else {
      Analytics.track("tutorial", "step-aim", "complete", "run");
      this.step = 2;
      this.hand.setVisible(false);
      this.time.delayedCall(900, () => {
        bus.emit(EV.WAVE_BANNER, "SURVIVE!", "", PAL.gold);
        g.worldPaused = false;
        g.wizard.flashBind();
        g.vfx.floatIcon("ic_chain", w.x, w.y - 52, 1.5, 2200);
        bus.emit(EV.HINT, "You can't move! Draw spells to defend yourself.", 3500);
        this.tweens.add({ targets: [this.picto, this.mark], alpha: 0, duration: 300 });
        this.time.delayedCall(400, () => { g.tutorialDone(); this.scene.stop(); });
      });
    }
  }

  /** screen (UI px) centre of the current target: the dashed rune is drawn right on top of it */
  private targetPos() {
    const v = this.g.cameras.main.worldView;
    const e = this.target;
    if (e && e.alive) return { x: e.x - v.x, y: e.y - e.height - v.y };
    const w = this.g.wizard;
    return { x: w.x - v.x, y: Math.max(Layout.safe.top + 100, w.y - v.y - 70) };
  }

  /** dashed outline of the rune to trace */
  private drawGuide(cx: number, cy: number, color: number, alpha: number) {
    const g = this.guide;
    g.clear();
    const p = this.path;
    const dash = 4, gapLen = 3;
    g.lineStyle(2, color, alpha);
    for (let i = 1; i < p.length; i++) {
      const ax = cx + p[i - 1].x, ay = cy + p[i - 1].y, bx = cx + p[i].x, by = cy + p[i].y;
      const L = Math.hypot(bx - ax, by - ay);
      for (let d = 0; d < L; d += dash + gapLen) {
        const t0 = d / L, t1 = Math.min(1, (d + dash) / L);
        g.lineBetween(ax + (bx - ax) * t0, ay + (by - ay) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1);
      }
    }
  }

  update(_t: number, dt: number) {
    this.t += dt;
    const col = ELEMENT_COLORS[SPELLS[this.spell].element];
    this.picto.setScale(1 + Math.sin(this.t / 180) * 0.04);
    if (this.mode === "intro") {
      if (this.step >= 2 || this.busy || !this.target) { this.guide.clear(); this.ghost.clear(); this.hand.setVisible(false); return; }
      const a = this.targetPos();
      // the dashed triangle sits on the slime and breathes
      this.drawGuide(a.x, a.y, col.light, this.hidden ? 0.35 : 0.65 + Math.sin(this.t / 160) * 0.3);
      // step 1: a hand traces it in a loop; step 2: only the dashed outline (they know how now)
      if (this.step === 0) this.traceDemo(a, col.main);
      else { this.ghost.clear(); this.hand.setVisible(false); }
      return;
    }
    // demo mode: two loops of the ghost drawing above the wizard, then fade out
    const dur = 1400, pause = 500;
    if (this.t > (this.loops + 1) * (dur + pause)) {
      this.loops++;
      if (this.loops >= 2) {
        this.tweens.add({ targets: [this.ghost, this.hand, this.picto, this.mark], alpha: 0, duration: 250, onComplete: () => this.scene.stop() });
        this.mode = "intro";
        this.step = 2;
        return;
      }
    }
    this.traceDemo(this.targetPos(), col.main);
  }

  private traceDemo(a: { x: number; y: number }, color: number) {
    const dur = 1400, pause = 600;
    const k = Math.min(1, (this.t % (dur + pause)) / dur);
    const n = Math.max(2, Math.floor(this.path.length * k));
    const g = this.ghost;
    g.clear();
    const pass = (w: number, c: number, al: number) => strokeSegments(g, this.path, w, c, al, a.x, a.y, n);
    const fade = k >= 1 ? 0.4 : 1;
    pass(5, color, 0.2 * fade);
    pass(2, color, 0.6 * fade);
    pass(1, 0xffffff, 0.8 * fade);
    const tip = this.path[Math.min(n, this.path.length) - 1];
    this.hand.setVisible(true).setPosition(Math.round(a.x + tip.x), Math.round(a.y + tip.y)).setAlpha(this.hidden ? 0 : k >= 1 ? 0.4 : 1);
  }
}
