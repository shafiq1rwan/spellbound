import Phaser from "phaser";
import { Layout } from "../core/Layout";
import { Audio } from "../core/Audio";
import { Save } from "../core/Save";
import { PAL } from "../config/palette";
import { Button, backdrop, slice, txt } from "../ui/widgets";

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
    const pw = Math.min(W - 16, 190), ph = 188;
    const cy = Math.round(H / 2), cx = Math.round(W / 2);
    slice(this, "panel", cx, cy, pw, ph);
    txt(this, cx, cy - ph / 2 + 14, "SETTINGS", { scale: 2, color: PAL.gold });
    const s = Save.settings;
    let y = cy - ph / 2 + 38;
    const lx = cx - pw / 2 + 12, rx = cx + pw / 2 - 12;
    const row = (label: string, value: () => string, onDec: (() => void) | null, onInc: () => void) => {
      txt(this, lx, y, label, { ox: 0, color: 0xd8d0f0 });
      const v = txt(this, rx - 26, y, value(), { color: PAL.lavender });
      const upd = () => { v.setText(value()); Save.save(); Audio.setVolumes(s.sfx, s.music); };
      if (onDec) new Button(this, rx - 50, y, 14, 14, "-", () => { onDec(); upd(); });
      new Button(this, rx - 2, y, 14, 14, onDec ? "+" : ">", () => { onInc(); upd(); Audio.play("ui_click"); });
      y += 21;
    };
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const clamp = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 10) / 10;
    row("SOUND", () => pct(s.sfx), () => { s.sfx = clamp(s.sfx - 0.1); }, () => { s.sfx = clamp(s.sfx + 0.1); });
    row("MUSIC", () => pct(s.music), () => { s.music = clamp(s.music - 0.1); }, () => { s.music = clamp(s.music + 0.1); });
    row("EFFECTS", () => s.quality.toUpperCase(), null, () => { s.quality = s.quality === "high" ? "low" : "high"; });
    row("CALM MOTION", () => (s.reducedMotion ? "ON" : "OFF"), null, () => { s.reducedMotion = !s.reducedMotion; });
    row("RUNE DEBUG", () => (s.debugRunes ? "ON" : "OFF"), null, () => { s.debugRunes = !s.debugRunes; });
    new Button(this, cx, y + 2, 120, 16, "REPLAY TUTORIAL", () => { Save.data.tutorialDone = false; Save.save(); Audio.play("ui_select"); });
    new Button(this, cx, cy + ph / 2 - 16, 100, 18, "BACK", () => this.close());
    this.input.keyboard?.on("keydown-ESC", () => this.close());
  }
  private close() {
    this.scene.stop();
    this.scene.resume(this.from);
  }
}
