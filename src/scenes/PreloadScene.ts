import Phaser from "phaser";
import { Layout } from "../core/Layout";
import { createAnims, queueAssets, setManifest, type Manifest } from "../core/assets";
import { Audio } from "../core/Audio";
import { Poki } from "../core/Poki";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("Preload");
  }
  preload() {
    const m = this.cache.json.get("manifest") as Manifest;
    setManifest(m);
    this.cameras.main.setBackgroundColor(0x0b0c1e);
    // pixel-style progress bar (drawn in device px so it works before the font is ready)
    const S = Layout.S, W = this.scale.width, H = this.scale.height;
    const bw = Math.min(W * 0.6, 120 * S), bh = 4 * S;
    const g = this.add.graphics();
    const draw = (p: number) => {
      g.clear();
      g.fillStyle(0x141629).fillRect(W / 2 - bw / 2 - S * 2, H / 2 - bh / 2 - S * 2, bw + S * 4, bh + S * 4);
      g.fillStyle(0x5a3e9e).fillRect(W / 2 - bw / 2 - S, H / 2 - bh / 2 - S, bw + S * 2, bh + S * 2);
      g.fillStyle(0x0c0a1a).fillRect(W / 2 - bw / 2, H / 2 - bh / 2, bw, bh);
      const fw = Math.floor((bw * p) / S) * S;
      g.fillStyle(0xa77bff).fillRect(W / 2 - bw / 2, H / 2 - bh / 2, fw, bh);
      g.fillStyle(0xe2ccff).fillRect(W / 2 - bw / 2, H / 2 - bh / 2, fw, S);
    };
    draw(0);
    this.load.on("progress", draw);
    queueAssets(this.load, m);
    document.getElementById("boot")?.remove();
  }
  async create() {
    createAnims(this.anims, this.cache.json.get("manifest") as Manifest);
    Audio.init();
    await Poki.start();
    Poki.loadingFinished();
    this.scene.start("Menu");
  }
}
