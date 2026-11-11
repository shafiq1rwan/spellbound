import Phaser from "phaser";
import { Layout } from "../core/Layout";
import { Audio } from "../core/Audio";
import { Poki } from "../core/Poki";
import { Save, fmtTime } from "../core/Save";
import { PAL } from "../config/palette";
import { Button, slice, txt } from "../ui/widgets";

interface Data { kills: number; score: number; timeMs: number; wave: number; casts: number; beat: { time: boolean; wave: boolean; score: boolean } }

export class GameOverScene extends Phaser.Scene {
  private busy = false;
  constructor() {
    super("GameOver");
  }
  create(d: Data) {
    this.busy = false;
    const W = Layout.w, H = Layout.h;
    this.cameras.main.setZoom(Layout.S).setOrigin(0, 0);
    this.scene.stop("HUD");
    this.scene.stop("Tutorial");
    // dramatic magical fade: purple veil + rising motes
    const veil = this.add.rectangle(0, 0, W, H, 0x0b0820, 0).setOrigin(0).setInteractive();
    this.tweens.add({ targets: veil, fillAlpha: 0.82, duration: 700 });
    const motes = this.add.particles(0, 0, "p_dot", {
      x: { min: 0, max: W }, y: H + 4, speedY: { min: -40, max: -15 }, lifespan: 4000, frequency: 90,
      tint: [PAL.violet, PAL.lavender, PAL.iceCyan], alpha: { start: 0.9, end: 0 }, blendMode: Phaser.BlendModes.ADD,
    });
    void motes;
    const cx = Math.round(W / 2), cy = Math.round(H / 2);
    const pw = Math.min(W - 20, 180), ph = 170;
    const panel = slice(this, "panel", cx, cy + 6, pw, ph).setAlpha(0);
    const title = txt(this, cx, cy - ph / 2 - 10, "YOUR LIGHT FADES", { scale: 2, color: PAL.lavender }).setAlpha(0);
    const rows: [string, string, boolean][] = [
      ["SURVIVED", fmtTime(d.timeMs), d.beat.time],
      ["WAVE", String(d.wave), d.beat.wave],
      ["DEFEATED", String(d.kills), false],
      ["SPELLS CAST", String(d.casts), false],
      ["SCORE", String(d.score), d.beat.score],
    ];
    const items: Phaser.GameObjects.GameObject[] = [];
    rows.forEach(([k, v, best], i) => {
      const y = cy - ph / 2 + 22 + i * 15;
      items.push(txt(this, cx - pw / 2 + 14, y, k, { ox: 0, color: 0xb9a8e0 }).setAlpha(0));
      items.push(txt(this, cx + pw / 2 - 14, y, v, { ox: 1, color: best ? PAL.gold : 0xfff8ec }).setAlpha(0));
      if (best) {
        const b = txt(this, cx + pw / 2 - 14 - v.length * 6 - 8, y, "NEW!", { ox: 1, color: PAL.gold }).setAlpha(0);
        items.push(b);
        this.tweens.add({ targets: b, scale: 1.2, duration: 400, yoyo: true, repeat: -1, delay: 1200 });
      }
    });
    const sd = Save.data;
    items.push(txt(this, cx, cy + 6 + ph / 2 - 62, `BEST: WAVE ${sd.bestWave}  ${fmtTime(sd.bestTimeMs)}  ${sd.bestScore}`, { color: 0x8e7cc3 }).setAlpha(0));
    this.tweens.add({ targets: [panel, title], alpha: 1, delay: 400, duration: 400 });
    this.tweens.add({ targets: items, alpha: 1, delay: (_t: unknown, _k: unknown, _v: unknown, i: number) => 600 + i * 60, duration: 250 });
    const retry = new Button(this, cx, cy + 6 + ph / 2 - 40, 110, 20, "TRY AGAIN", () => this.retry(), { scale: 1 });
    const menu = new Button(this, cx, cy + 6 + ph / 2 - 16, 110, 18, "MAIN MENU", () => this.menu());
    [retry, menu].forEach((b) => { b.setAlpha(0); b.setEnabled(false); });
    this.time.delayedCall(1100, () => {
      [retry, menu].forEach((b) => { b.setEnabled(true); this.tweens.add({ targets: b, alpha: 1, duration: 250 }); });
    });
    this.input.keyboard?.on("keydown-ENTER", () => this.retry());
  }
  private async retry() {
    if (this.busy) return;
    this.busy = true;
    Audio.play("ui_select");
    await Poki.commercialBreak();
    this.scene.stop("Game");
    this.scene.start("Game");
    this.scene.stop();
  }
  private menu() {
    if (this.busy) return;
    this.busy = true;
    this.scene.stop("Game");
    this.scene.start("Menu");
  }
}
