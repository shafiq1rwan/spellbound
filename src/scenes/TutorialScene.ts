// Onboarding overlay (never blocks input). "intro": first-run guided fireball with a ghost hand
// drawing the triangle over a single harmless slime. "demo": shows how to draw a given rune.
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
  private label!: Phaser.GameObjects.BitmapText;
  private sub!: Phaser.GameObjects.BitmapText;
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
    this.label = txt(this, 0, 0, "", { color: col.light, maxWidth: Layout.w - 24 });
    this.sub = txt(this, 0, 0, "", { color: 0xd8d0f0, maxWidth: Layout.w - 24 });
    const size = Math.min(70, Layout.w * 0.32);
    this.path = idealGlyph(def.rune).map((p) => ({ x: p.x * size, y: p.y * size }));
    if (this.mode === "intro") {
      this.label.setText("DRAW A TRIANGLE!");
      this.sub.setText("ONE STROKE ANYWHERE = FIREBALL");
      // a single harmless slime walks in
      this.g.time.delayedCall(400, () => this.g.spawner.spawnAt("slime", this.g.wizard.x + 30, this.g.wizard.y - Math.min(110, this.g.viewHalfH() - 40), false));
      this.listen(EV.CAST, () => this.onCast());
      this.listen(EV.FAIL, () => { if (this.step === 0) this.sub.setText("TRY AGAIN: 3 CORNERS, 1 STROKE").setTint(PAL.fireYellow); this.stack(); });
      this.listen(EV.STROKE, (on: boolean) => this.setHidden(on));
    } else {
      this.label.setText(`${def.runeName.toUpperCase()} = ${def.name.toUpperCase()}`);
      this.sub.setText("");
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
    const W = Layout.w, H = Layout.h;
    this.label.setPosition(Math.round(W / 2), Math.round(Layout.safe.top + (Layout.portrait ? 62 : 44)));
    void H;
    this.stack();
  }
  /** keep the subtitle directly under the (possibly wrapped) label */
  private stack() {
    this.sub.setPosition(Math.round(Layout.w / 2), Math.round(this.label.y + this.label.height / 2 + 7));
  }

  private onCast() {
    if (this.step !== 0) return;
    this.step = 1;
    this.ghost.clear();
    this.hand.setVisible(false);
    this.label.setText("GREAT! DRAW ON A FOE TO AIM").setTint(PAL.gold);
    this.sub.setText("SURVIVE. LEARN NEW RUNES.").clearTint();
    this.stack();
    this.time.delayedCall(2600, () => {
      this.tweens.add({
        targets: [this.label, this.sub], alpha: 0, duration: 300,
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
        this.tweens.add({ targets: [this.ghost, this.hand, this.label, this.sub], alpha: 0, duration: 250, onComplete: () => this.scene.stop() });
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
    // pulse the instruction text
    this.label.setScale(1 + Math.sin(this.t / 180) * 0.03);
  }
}
