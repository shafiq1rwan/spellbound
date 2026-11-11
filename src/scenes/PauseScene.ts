import Phaser from "phaser";
import { Layout } from "../core/Layout";
import { Poki } from "../core/Poki";
import { PAL } from "../config/palette";
import { SPELLS, SPELL_ORDER } from "../config/spells";
import { Button, backdrop, slice, txt } from "../ui/widgets";
import type { GameScene } from "./GameScene";

export class PauseScene extends Phaser.Scene {
  constructor() {
    super("Pause");
  }
  create() {
    const W = Layout.w, H = Layout.h;
    this.cameras.main.setZoom(Layout.S).setOrigin(0, 0);
    backdrop(this, W, H, 0.7);
    const g = this.scene.get("Game") as GameScene;
    const pw = Math.min(W - 24, 170), ph = 150;
    const cy = Math.round(H / 2);
    slice(this, "panel", W / 2, cy, pw, ph);
    txt(this, W / 2, cy - ph / 2 + 14, "PAUSED", { scale: 2, color: PAL.gold });
    // rune reference
    const known = SPELL_ORDER.filter((s) => g.spells.levels[s] > 0);
    known.forEach((s, i) => {
      const x = W / 2 + (i - (known.length - 1) / 2) * 38;
      this.add.image(x, cy - 30, SPELLS[s].runeIcon);
      txt(this, x, cy - 17, SPELLS[s].name.split(" ")[0].toUpperCase(), { color: 0xc8bce8 });
    });
    new Button(this, W / 2, cy + 6, 110, 18, "RESUME", () => this.resume());
    new Button(this, W / 2, cy + 28, 110, 18, "SETTINGS", () => { this.scene.pause(); this.scene.launch("Settings", { from: "Pause" }); });
    new Button(this, W / 2, cy + 50, 110, 18, "QUIT TO MENU", () => this.quit());
    this.input.keyboard?.on("keydown-ESC", () => this.resume());
    this.input.keyboard?.on("keydown-P", () => this.resume());
  }
  private resume() {
    this.scene.stop();
    this.scene.resume("Game");
    Poki.gameplayStart();
  }
  private quit() {
    ["HUD", "Tutorial", "Game"].forEach((k) => this.scene.stop(k));
    this.scene.start("Menu");
  }
}
