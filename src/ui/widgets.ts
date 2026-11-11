import Phaser from "phaser";
import { Audio } from "../core/Audio";
import { M } from "../core/assets";

/**
 * Bitmap text anchored on its INK (the visible glyph pixels), not the font's line box.
 * The pixel font draws each glyph's 7px core from the top of the line box, with a 1px trailing
 * advance gap and 2px of descender/shadow room below, so plain origin 0.5 centring sits 1px high
 * and 0.5px left. Here ox/oy are fractions of the ink box, re-applied whenever the text changes.
 */
export class PixelText extends Phaser.GameObjects.BitmapText {
  declare ax: number;
  declare ay: number;
  constructor(scene: Phaser.Scene, x: number, y: number, s: string, size: number, align: number, ox: number, oy: number) {
    super(scene, x, y, "pixel", s, size, align);
    this.ax = ox;
    this.ay = oy;
    this.refreshOrigin();
  }
  get fontScale() {
    return this.fontSize / 8;
  }
  /** visible glyph box, in local (unscaled) pixels */
  ink() {
    const b = this.getTextBounds(false).local;
    const k = this.fontScale;
    return { w: Math.max(0, b.width - k), h: Math.max(0, b.height - 2 * k), boxW: b.width, boxH: b.height };
  }
  refreshOrigin() {
    if (this.ax === undefined) return this;
    const i = this.ink();
    if (!i.boxW || !i.boxH) return this;
    this.setOrigin((this.ax * i.w) / i.boxW, (this.ay * i.h) / i.boxH);
    return this;
  }
  setAnchor(ox: number, oy: number) {
    this.ax = ox;
    this.ay = oy;
    return this.refreshOrigin();
  }
  setText(value: string | string[]) {
    super.setText(value);
    this.refreshOrigin?.();
    return this;
  }
  setMaxWidth(value: number, wordWrapCharCode?: number) {
    super.setMaxWidth(value, wordWrapCharCode);
    this.refreshOrigin?.();
    return this;
  }
  setFontSize(size: number) {
    super.setFontSize(size);
    this.refreshOrigin?.();
    return this;
  }
}

export function txt(
  scene: Phaser.Scene, x: number, y: number, s: string,
  o: { scale?: number; color?: number; ox?: number; oy?: number; align?: number; maxWidth?: number } = {},
) {
  const t = new PixelText(scene, Math.round(x), Math.round(y), s, 8 * (o.scale ?? 1), o.align ?? 1, o.ox ?? 0.5, o.oy ?? 0.5);
  scene.add.existing(t);
  if (o.maxWidth) t.setMaxWidth(o.maxWidth);
  if (o.color !== undefined) t.setTint(o.color);
  return t;
}

export function slice(scene: Phaser.Scene, key: string, x: number, y: number, w: number, h: number) {
  const c = M().nineslice[key] ?? 6;
  return scene.add.nineslice(Math.round(x), Math.round(y), key, undefined, Math.round(w), Math.round(h), c, c, c, c);
}

/** spacing tokens shared by every menu (art pixels) */
export const UI = {
  panelPad: 10,     // inner padding of a panel (border is 4px of that)
  gap: 6,           // between stacked controls
  btnH: 22,         // 1x button: 17-row face = 5px + 7px text + 5px
  btnBigH: 33,      // 2x button: 28-row face = 7px + 14px text + 7px
  padX: 9,          // horizontal text padding inside a button face
};

type ButtonOpts = { icon?: string; iconScale?: number; scale?: number; color?: number; w?: number; h?: number; minW?: number };

/**
 * Pixel button with exact centring. Geometry comes from the button art (tools/art/ui.mjs):
 * the face is always H-5 rows starting 1px below the top (3px when pressed). Width/height are
 * nudged by 1px when needed so the label's and icon's ink land on whole pixels in the face centre.
 */
export class Button extends Phaser.GameObjects.Container {
  private up: Phaser.GameObjects.NineSlice;
  private over: Phaser.GameObjects.NineSlice;
  private down: Phaser.GameObjects.NineSlice;
  label: PixelText;
  icon?: Phaser.GameObjects.Image;
  private pressed = false;
  enabled = true;
  bw: number;
  bh: number;
  private top: number;
  private faceCx = 0;
  private faceCy = 0;
  private labelDx = 0;
  private iconDx = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, onClick: () => void, o: ButtonOpts = {}) {
    super(scene, Math.round(x), Math.round(y));
    const s = o.scale ?? 1;
    this.label = txt(scene, 0, 0, text, { scale: s, color: o.color ?? 0xfff8ec });
    const textW = text ? this.label.ink().w : 0;
    const textH = text ? 7 * s : 0;
    let iconW = 0, iconH = 0;
    if (o.icon) {
      this.icon = scene.add.image(0, 0, o.icon).setScale(o.iconScale ?? 1);
      iconW = Math.round(this.icon.displayWidth);
      iconH = Math.round(this.icon.displayHeight);
    }
    const gap = text && o.icon ? 4 : 0;
    const contentW = textW + gap + iconW;
    const contentH = Math.max(textH, iconH);
    // height: default sizes for text, or icon + 4px padding each side
    let h = o.h ?? (text ? (s >= 2 ? UI.btnBigH : UI.btnH) : iconH + 8 + 5);
    if ((h - 5 - contentH) % 2 !== 0) h += 1;
    // width: content + padding (+2 face frame), at least minW / w
    let w = Math.max(o.w ?? 0, o.minW ?? 0, contentW + 2 * (text ? UI.padX * s : 4) + 2);
    if ((w - 2 - contentW) % 2 !== 0) w += 1;
    this.bw = w;
    this.bh = h;
    this.top = -Math.floor(h / 2);
    const left = -Math.floor(w / 2);
    const mk = (key: string) => slice(scene, key, left, this.top, w, h).setOrigin(0, 0);
    this.up = mk("btn_up");
    this.over = mk("btn_over").setVisible(false);
    this.down = mk("btn_down").setVisible(false);
    this.add([this.up, this.over, this.down]);
    // face centre (continuous coords): columns 1..w-2, rows 1..h-5 (unpressed)
    this.faceCx = left + w / 2;
    this.faceCy = this.top + 1 + (h - 5) / 2;
    const contentLeft = this.faceCx - contentW / 2;
    if (this.icon) {
      this.icon.setOrigin(0, 0);
      this.iconDx = contentLeft;
      this.add(this.icon);
    }
    this.labelDx = contentLeft + iconW + gap;
    this.label.setAnchor(0, 0.5);
    this.add(this.label);
    this.placeContent(0);
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
      scene.tweens.add({ targets: this, scaleX: 1.04, scaleY: 0.96, duration: 60, yoyo: true });
      onClick();
    });
    scene.add.existing(this);
  }

  /** dy = 0 normally, 2 when the face is pressed down */
  private placeContent(dy: number) {
    if (this.icon) this.icon.setPosition(this.iconDx, Math.round(this.faceCy - this.icon.displayHeight / 2) + dy);
    this.label.setPosition(this.labelDx, this.faceCy + dy);
  }
  private show(st: "up" | "over" | "down") {
    this.up.setAlpha(st === "up" ? 1 : 0.001);
    this.over.setVisible(st === "over");
    this.down.setVisible(st === "down");
    this.placeContent(st === "down" ? 2 : 0);
  }
  /** change the label and keep it centred on the face */
  setLabel(s: string) {
    this.label.setText(s);
    const iconW = this.icon ? Math.round(this.icon.displayWidth) : 0;
    const gap = s && this.icon ? 4 : 0;
    const contentW = this.label.ink().w + gap + iconW;
    const contentLeft = Math.floor(this.faceCx - contentW / 2);
    this.iconDx = contentLeft;
    this.labelDx = contentLeft + iconW + gap;
    this.placeContent(this.down.visible ? 2 : 0);
    return this;
  }
  setEnabled(on: boolean) {
    this.enabled = on;
    this.setAlpha(on ? 1 : 0.5);
    return this;
  }
  /** test against screen-space art coords (for blocking rune input under buttons) */
  contains(x: number, y: number) {
    return this.visible && x >= this.x - this.bw / 2 && x <= this.x + this.bw / 2 && y >= this.y + this.top && y <= this.y + this.top + this.bh;
  }
}

/** a 9-slice panel positioned by its top-left corner, returning its inner content box */
export function panelBox(scene: Phaser.Scene, key: string, cx: number, top: number, w: number, h: number) {
  const left = Math.round(cx - w / 2);
  const p = slice(scene, key, left, Math.round(top), Math.round(w), Math.round(h)).setOrigin(0, 0);
  return { panel: p, left, top: Math.round(top), w, h, cx: left + w / 2, inner: { left: left + UI.panelPad, right: left + w - UI.panelPad, top: Math.round(top) + UI.panelPad, bottom: Math.round(top) + h - UI.panelPad } };
}

/** dim full-screen backdrop that swallows input */
export function backdrop(scene: Phaser.Scene, w: number, h: number, alpha = 0.6) {
  return scene.add.rectangle(0, 0, w, h, 0x07061a, alpha).setOrigin(0).setInteractive();
}
