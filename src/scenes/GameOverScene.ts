import Phaser from "phaser";
import { Layout } from "../core/Layout";
import { Audio } from "../core/Audio";
import { Poki } from "../core/Poki";
import { Analytics } from "../core/Analytics";
import { Save, fmtTime } from "../core/Save";
import { PAL } from "../config/palette";
import { Button, UI, panelBox, txt } from "../ui/widgets";

interface Data { kills: number; score: number; timeMs: number; wave: number; casts: number; beat: { time: boolean; wave: boolean; score: boolean } }

export class GameOverScene extends Phaser.Scene {
  private busy = false;
  constructor() {
    super("GameOver");
  }
  create(d: Data) {
    this.busy = false;
    const W = Layout.w, H = Layout.h;
    this.scene.bringToTop();
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
    const cx = Math.round(W / 2);
    const rows: [string, string, boolean][] = [
      ["SURVIVED", fmtTime(d.timeMs), d.beat.time],
      ["WAVE", String(d.wave), d.beat.wave],
      ["DEFEATED", String(d.kills), false],
      ["SPELLS CAST", String(d.casts), false],
      ["SCORE", String(d.score), d.beat.score],
    ];
    const rowH = 13;
    const pw = Math.min(W - 20, 190);
    const btnW = pw - UI.panelPad * 2 - 12;
    // title (may wrap on narrow screens) sits above the panel; panel is a padded stack
    const title = txt(this, cx, 0, "YOUR LIGHT FADES", { scale: 2, color: PAL.lavender, oy: 0, maxWidth: W - 16 }).setAlpha(0);
    const titleH = title.ink().h;
    const ph = UI.panelPad * 2 + rows.length * rowH - (rowH - 7) + 10 + 7 + 12 + 2 * UI.btnH + UI.gap;
    const total = titleH + 10 + ph;
    const top = Math.max(4, Math.round(H / 2 - total / 2));
    title.setY(top);
    const box = panelBox(this, "panel", cx, top + titleH + 10, pw, ph);
    box.panel.setAlpha(0);
    const items: Phaser.GameObjects.GameObject[] = [];
    let y = box.inner.top;
    rows.forEach(([k, v, best]) => {
      items.push(txt(this, box.inner.left, y, k, { ox: 0, oy: 0, color: 0xb9a8e0 }).setAlpha(0));
      const val = txt(this, box.inner.right, y, v, { ox: 1, oy: 0, color: best ? PAL.gold : 0xfff8ec }).setAlpha(0);
      items.push(val);
      if (best) {
        const b = txt(this, box.inner.right - val.ink().w - 6, y + 3.5, "NEW!", { ox: 1, color: PAL.gold }).setAlpha(0);
        items.push(b);
        this.tweens.add({ targets: b, scale: 1.2, duration: 400, yoyo: true, repeat: -1, delay: 1200 });
      }
      y += rowH;
    });
    y += 10 - (rowH - 7);
    const sd = Save.data;
    items.push(txt(this, box.cx, y, `BEST: WAVE ${sd.bestWave}  ${fmtTime(sd.bestTimeMs)}  ${sd.bestScore}`, { oy: 0, color: 0x8e7cc3 }).setAlpha(0));
    y += 7 + 12;
    this.tweens.add({ targets: [box.panel, title], alpha: 1, delay: 400, duration: 400 });
    this.tweens.add({ targets: items, alpha: 1, delay: (_t: unknown, _k: unknown, _v: unknown, i: number) => 600 + i * 60, duration: 250 });
    const retry = new Button(this, box.cx, y + Math.floor(UI.btnH / 2), "TRY AGAIN", () => this.retry(), { minW: btnW });
    y += UI.btnH + UI.gap;
    const menu = new Button(this, box.cx, y + Math.floor(UI.btnH / 2), "MAIN MENU", () => this.menu(), { minW: btnW });
    [retry, menu].forEach((b) => { b.setAlpha(0); b.setEnabled(false); });
    this.time.delayedCall(1100, () => {
      [retry, menu].forEach((b) => { b.setEnabled(true); this.tweens.add({ targets: b, alpha: 1, duration: 250 }); });
      Analytics.track("gameover", "retry", "visible");
      Analytics.track("gameover", "menu", "visible");
    });
    this.input.keyboard?.on("keydown-ENTER", () => this.retry());
  }
  private async retry() {
    if (this.busy) return;
    this.busy = true;
    Analytics.track("gameover", "retry", "interact");
    Audio.play("ui_select");
    await Poki.commercialBreak();
    this.scene.stop("Game");
    this.scene.start("Game");
    this.scene.stop();
  }
  private menu() {
    if (this.busy) return;
    this.busy = true;
    Analytics.track("gameover", "menu", "interact");
    this.scene.stop("Game");
    this.scene.start("Menu");
  }
}
