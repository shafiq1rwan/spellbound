import Phaser from "phaser";
import { Layout } from "../core/Layout";
import { Audio } from "../core/Audio";
import { Save } from "../core/Save";
import { Analytics } from "../core/Analytics";
import { PAL } from "../config/palette";
import { Button, UI, backdrop, panelBox, txt, type PixelText } from "../ui/widgets";

export class SettingsScene extends Phaser.Scene {
  private from = "Menu";
  constructor() {
    super("Settings");
  }
  init(d: { from?: string }) {
    this.from = d?.from ?? "Menu";
  }
  create() {
    const W = Layout.w, H = Layout.h;
    this.scene.bringToTop();
    this.cameras.main.setZoom(Layout.S).setOrigin(0, 0);
    backdrop(this, W, H, 0.75);
    const s = Save.settings;
    const rowGap = H < 250 ? 2 : 5;
    const rows = 5;
    // stack: pad | title | gap | 5 rows | gap | [replay][back] | pad
    const ph = UI.panelPad * 2 + 14 + 10 + rows * UI.btnH + (rows - 1) * rowGap + 12 + UI.btnH;
    const pw = Math.min(W - 16, 200);
    const box = panelBox(this, "panel", W / 2, Math.max(4, Math.round(H / 2 - ph / 2)), pw, ph);
    let y = box.inner.top;
    txt(this, box.cx, y, "SETTINGS", { scale: 2, color: PAL.gold, oy: 0 });
    y += 14 + 10;

    const save = () => { Save.save(); Audio.setVolumes(s.sfx, s.music); };
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const clamp = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 10) / 10;
    // right-hand control column: [-] value [+]  (or one wide toggle button)
    const small = 22;
    const valW = 34;
    const ctrlW = small * 2 + valW;
    const ctrlCx = box.inner.right - ctrlW / 2;
    const cy = () => y + Math.floor(UI.btnH / 2);

    const stepper = (label: string, get: () => number, set: (v: number) => void) => {
      txt(this, box.inner.left, cy(), label, { ox: 0, color: 0xd8d0f0 });
      const v: PixelText = txt(this, ctrlCx, cy(), pct(get()), { color: PAL.lavender });
      const upd = (d: number) => { set(clamp(get() + d)); v.setText(pct(get())); save(); Analytics.track("settings", `${label}-${Math.round(get() * 100)}`, "selected"); };
      new Button(this, box.inner.right - ctrlW + small / 2, cy(), "-", () => upd(-0.1), { w: small, h: small });
      new Button(this, box.inner.right - small / 2, cy(), "+", () => upd(0.1), { w: small, h: small });
      y += UI.btnH + rowGap;
    };
    const toggle = (label: string, get: () => string, flip: () => void) => {
      txt(this, box.inner.left, cy(), label, { ox: 0, color: 0xd8d0f0 });
      const b = new Button(this, ctrlCx, cy(), get(), () => { flip(); b.setLabel(get()); save(); Analytics.track("settings", `${label}-${get()}`, "selected"); }, { w: ctrlW, color: PAL.lavender });
      y += UI.btnH + rowGap;
    };
    stepper("SOUND", () => s.sfx, (v) => { s.sfx = v; });
    stepper("MUSIC", () => s.music, (v) => { s.music = v; });
    toggle("EFFECTS", () => s.quality.toUpperCase(), () => { s.quality = s.quality === "high" ? "low" : "high"; });
    toggle("CALM MOTION", () => (s.reducedMotion ? "ON" : "OFF"), () => { s.reducedMotion = !s.reducedMotion; });
    toggle("RUNE DEBUG", () => (s.debugRunes ? "ON" : "OFF"), () => { s.debugRunes = !s.debugRunes; });
    y += 12 - rowGap;
    const half = (pw - UI.panelPad * 2 - UI.gap) / 2;
    new Button(this, box.inner.left + half / 2, cy(), "TUTORIAL", () => { Analytics.track("settings", "replay-tutorial", "selected"); Save.data.tutorialDone = false; Save.save(); Audio.play("ui_select"); }, { w: Math.floor(half) });
    new Button(this, box.inner.right - half / 2, cy(), "BACK", () => this.close(), { w: Math.floor(half) });
    this.input.keyboard?.on("keydown-ESC", () => this.close());
  }
  private close() {
    this.scene.stop();
    this.scene.resume(this.from);
  }
}
