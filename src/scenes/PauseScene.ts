import Phaser from "phaser";
import { Layout } from "../core/Layout";
import { Poki } from "../core/Poki";
import { PAL } from "../config/palette";
import { SPELLS, SPELL_ORDER } from "../config/spells";
import { Button, UI, backdrop, panelBox, txt } from "../ui/widgets";
import type { GameScene } from "./GameScene";

export class PauseScene extends Phaser.Scene {
  constructor() {
    super("Pause");
  }
  create() {
    const W = Layout.w, H = Layout.h;
    this.scene.bringToTop();
    this.cameras.main.setZoom(Layout.S).setOrigin(0, 0);
    backdrop(this, W, H, 0.7);
    const g = this.scene.get("Game") as GameScene;
    const known = SPELL_ORDER.filter((s) => g.spells.levels[s] > 0);

    // vertical stack: pad | title | gap | rune guide | gap | 3 buttons | pad
    const pw = Math.min(W - 24, 176);
    const runeH = 16 + 4 + 7;
    const ph = UI.panelPad * 2 + 14 + 10 + runeH + 12 + 3 * UI.btnH + 2 * UI.gap;
    const box = panelBox(this, "panel", W / 2, Math.round(H / 2 - ph / 2), pw, ph);
    let y = box.inner.top;
    txt(this, box.cx, y, "PAUSED", { scale: 2, color: PAL.gold, oy: 0 });
    y += 14 + 10;
    // rune reference row: icon over name, evenly spaced across the panel
    const colW = Math.min(40, (pw - UI.panelPad * 2) / Math.max(1, known.length));
    known.forEach((s, i) => {
      const x = Math.round(box.cx + (i - (known.length - 1) / 2) * colW);
      const icon = this.add.image(x, y, SPELLS[s].runeIcon).setOrigin(0, 0);
      icon.x = x - Math.floor(icon.width / 2);
      icon.y = y + Math.floor((16 - icon.height) / 2);
      txt(this, x, y + 16 + 4, SPELLS[s].name.split(" ")[0].toUpperCase(), { color: 0xc8bce8, oy: 0 });
    });
    y += runeH + 12;
    const bw = pw - UI.panelPad * 2 - 12;
    const items: [string, () => void][] = [
      ["RESUME", () => this.resume()],
      ["SETTINGS", () => { this.scene.pause(); this.scene.launch("Settings", { from: "Pause" }); }],
      ["QUIT TO MENU", () => this.quit()],
    ];
    for (const [label, fn] of items) {
      new Button(this, box.cx, y + Math.floor(UI.btnH / 2), label, fn, { minW: bw });
      y += UI.btnH + UI.gap;
    }
    this.input.keyboard?.on("keydown-ESC", () => this.resume());
    this.input.keyboard?.on("keydown-P", () => this.resume());
  }
  private resume() {
    this.scene.stop();
    this.scene.resume("Game");
    (this.scene.get("Game") as GameScene).restoreOverlays();
    Poki.gameplayStart();
  }
  private quit() {
    ["HUD", "Tutorial", "Game"].forEach((k) => this.scene.stop(k));
    this.scene.start("Menu");
  }
}
