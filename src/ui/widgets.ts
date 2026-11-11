import Phaser from "phaser";
import { Audio } from "../core/Audio";
import { M } from "../core/assets";

export function txt(
  scene: Phaser.Scene, x: number, y: number, s: string,
  o: { scale?: number; color?: number; ox?: number; oy?: number; align?: number; maxWidth?: number } = {},
) {
  const t = scene.add.bitmapText(Math.round(x), Math.round(y), "pixel", s, 8 * (o.scale ?? 1), o.align ?? 1);
  t.setOrigin(o.ox ?? 0.5, o.oy ?? 0.5);
  if (o.maxWidth) t.setMaxWidth(o.maxWidth);
  if (o.color !== undefined) t.setTint(o.color);
  return t;
}

export function slice(scene: Phaser.Scene, key: string, x: number, y: number, w: number, h: number) {
  const c = M().nineslice[key] ?? 6;
  const n = scene.add.nineslice(Math.round(x), Math.round(y), key, undefined, Math.round(w), Math.round(h), c, c, c, c);
  return n;
}

export class Button extends Phaser.GameObjects.Container {
  private up: Phaser.GameObjects.NineSlice;
  private over: Phaser.GameObjects.NineSlice;
  private down: Phaser.GameObjects.NineSlice;
  label: Phaser.GameObjects.BitmapText;
  icon?: Phaser.GameObjects.Image;
  private pressed = false;
  enabled = true;
  bw: number;
  bh: number;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, text: string, onClick: () => void, o: { icon?: string; scale?: number; color?: number } = {}) {
    super(scene, Math.round(x), Math.round(y));
    this.bw = w;
    this.bh = h;
    this.up = slice(scene, "btn_up", 0, 0, w, h);
    this.over = slice(scene, "btn_over", 0, 0, w, h).setVisible(false);
    this.down = slice(scene, "btn_down", 0, 0, w, h).setVisible(false);
    this.label = txt(scene, 0, -1, text, { scale: o.scale ?? 1, color: o.color ?? 0xfff8ec });
    this.add([this.up, this.over, this.down, this.label]);
    if (o.icon) {
      this.icon = scene.add.image(0, -1, o.icon);
      this.add(this.icon);
      if (text) {
        this.icon.x = Math.round(-this.label.width / 2 - 4);
        this.label.x = Math.round(this.icon.width / 2 + 2);
      }
    }
    this.setSize(w, h);
    this.up.setInteractive({ useHandCursor: true });
    const z = this.up;
    z.on("pointerover", () => {
      if (!this.enabled) return;
      this.show(this.pressed ? "down" : "over");
      Audio.play("ui_hover", { vol: 0.5 });
    });
    z.on("pointerout", () => { this.pressed = false; this.show("up"); });
    z.on("pointerdown", () => {
      if (!this.enabled) return;
      this.pressed = true;
      this.show("down");
    });
    z.on("pointerup", () => {
      if (!this.enabled || !this.pressed) return;
      this.pressed = false;
      this.show("over");
      Audio.play("ui_click");
      scene.tweens.add({ targets: this, scaleX: 1.06, scaleY: 0.94, duration: 60, yoyo: true });
      onClick();
    });
    scene.add.existing(this);
  }
  private show(s: "up" | "over" | "down") {
    this.up.setAlpha(s === "up" ? 1 : 0.001);
    this.over.setVisible(s === "over");
    this.down.setVisible(s === "down");
    const dy = s === "down" ? 1 : 0;
    this.label.y = -1 + dy;
    if (this.icon) this.icon.y = -1 + dy;
  }
  setEnabled(on: boolean) {
    this.enabled = on;
    this.setAlpha(on ? 1 : 0.5);
    return this;
  }
  /** test against screen-space art coords (for blocking rune input under buttons) */
  contains(x: number, y: number) {
    return this.visible && Math.abs(x - this.x) <= this.bw / 2 && Math.abs(y - this.y) <= this.bh / 2;
  }
}

/** dim full-screen backdrop that swallows input */
export function backdrop(scene: Phaser.Scene, w: number, h: number, alpha = 0.6) {
  const r = scene.add.rectangle(0, 0, w, h, 0x07061a, alpha).setOrigin(0).setInteractive();
  return r;
}
