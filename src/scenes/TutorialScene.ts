// Onboarding overlay (never blocks input), wordless so it works in any language.
// "intro": first-run guided fireball — pictogram [triangle] -> [fireball] + a ghost hand drawing it
// over a single harmless slime. "demo": pictogram + ghost drawing for any rune.
import Phaser from "phaser";
import { Layout } from "../core/Layout";
import { bus, EV } from "../core/bus";
import { SPELLS, type SpellId } from "../config/spells";
import { ELEMENT_COLORS, PAL } from "../config/palette";
import { idealGlyph, type Pt } from "../rune/RuneRecognizer";
import { txt } from "../ui/widgets";
import { strokeSegments } from "../ui/stroke";
import type { GameScene } from "./GameScene";

export class TutorialScene extends Phaser.Scene {
  private g!: GameScene;
  private mode: "intro" | "demo" = "intro";
  private spell: SpellId = "fireball";
  private ghost!: Phaser.GameObjects.Graphics;
  private hand!: Phaser.GameObjects.Image;
  private picto!: Phaser.GameObjects.Container;
  private mark!: Phaser.GameObjects.BitmapText;
  private path: Pt[] = [];
  private t = 0;
  private loops = 0;
  private step = 0;
  private handlers: [string, (...a: never[]) => void][] = [];
  private hidden = false;

  constructor() {
    super("Tutorial");
  }

  init(data: { mode?: "intro" | "demo"; spell?: SpellId }) {
    this.mode = data?.mode ?? "intro";
    this.spell = data?.spell ?? "fireball";
    this.t = 0;
    this.loops = 0;
    this.step = 0;
    this.hidden = false;
  }

  create() {
    this.g = this.scene.get("Game") as GameScene;
    this.cameras.main.setZoom(Layout.S).setOrigin(0, 0);
    this.scene.bringToTop();
    const def = SPELLS[this.spell];
    const col = ELEMENT_COLORS[def.element];
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
    // big check / cross for feedback
    this.mark = txt(this, 0, 0, "", { scale: 3, color: PAL.gold }).setAlpha(0);
    const size = Math.min(70, Layout.w * 0.32);
    this.path = idealGlyph(def.rune).map((p) => ({ x: p.x * size, y: p.y * size }));
    if (this.mode === "intro") {
      // a single harmless slime walks in
      this.g.time.delayedCall(400, () => this.g.spawner.spawnAt("slime", this.g.wizard.x + 30, this.g.wizard.y - Math.min(110, this.g.viewHalfH() - 40), false));
      this.listen(EV.CAST, () => this.onCast());
      this.listen(EV.FAIL, () => { if (this.step === 0) this.feedback(false); });
      this.listen(EV.STROKE, (on: boolean) => this.setHidden(on));
    }
    this.layout();
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
    } else {
      this.picto.setAlpha(0.35);
      this.tweens.add({ targets: this.picto, x: this.picto.x + 4, duration: 50, yoyo: true, repeat: 3 });
      this.tweens.add({ targets: this.mark, alpha: 0, delay: 500, duration: 250, onComplete: () => this.picto.setAlpha(1) });
    }
  }

  private onCast() {
    if (this.step !== 0) return;
    this.step = 1;
    this.ghost.clear();
    this.hand.setVisible(false);
    this.feedback(true);
    this.time.delayedCall(1600, () => {
      this.tweens.add({
        targets: [this.mark, this.picto], alpha: 0, duration: 300,
        onComplete: () => { this.g.tutorialDone(); this.scene.stop(); },
      });
    });
  }

  /** where the ghost rune is drawn (in UI px): the open space above the wizard */
  private anchor() {
    const v = this.g.cameras.main.worldView;
    const wx = this.g.wizard.x - v.x, wy = this.g.wizard.y - v.y;
    return { x: wx, y: Math.max(Layout.safe.top + 100, wy - 70) };
  }

  update(_t: number, dt: number) {
    if (this.mode === "intro" && this.step !== 0) return;
    this.t += dt;
    const dur = 1400, pause = 500;
    const k = Math.min(1, (this.t % (dur + pause)) / dur);
    if (this.t > (this.loops + 1) * (dur + pause)) {
      this.loops++;
      if (this.mode === "demo" && this.loops >= 2) {
        this.tweens.add({ targets: [this.ghost, this.hand, this.picto, this.mark], alpha: 0, duration: 250, onComplete: () => this.scene.stop() });
        this.mode = "intro";
        this.step = 2;
        return;
      }
    }
    const a = this.anchor();
    const n = Math.max(2, Math.floor(this.path.length * k));
    const col = ELEMENT_COLORS[SPELLS[this.spell].element];
    const g = this.ghost;
    g.clear();
    const pass = (w: number, c: number, al: number) => strokeSegments(g, this.path, w, c, al, a.x, a.y, n);
    const fade = k >= 1 ? 0.5 : 1;
    pass(5, col.main, 0.2 * fade);
    pass(2, col.main, 0.6 * fade);
    pass(1, 0xffffff, 0.8 * fade);
    const tip = this.path[Math.min(n, this.path.length) - 1];
    this.hand.setPosition(Math.round(a.x + tip.x), Math.round(a.y + tip.y)).setAlpha(this.hidden ? 0 : k >= 1 ? 0.5 : 1);
    // gentle pulse on the pictogram
    this.picto.setScale(1 + Math.sin(this.t / 180) * 0.04);
  }
}
