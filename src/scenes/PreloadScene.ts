import Phaser from "phaser";
import { Layout } from "../core/Layout";
import { createAnims, decodeBundle, queueAssets, setManifest, type Manifest } from "../core/assets";
import { Audio } from "../core/Audio";
import { Poki } from "../core/Poki";

export class PreloadScene extends Phaser.Scene {
  private drawBar?: (p: number) => void;
  constructor() {
    super("Preload");
  }
  preload() {
    performance.mark("sb:preloadStart");
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
    this.drawBar = draw;
    // byte-accurate progress for the single texture bundle (90%), decoding fills the rest
    this.load.on("fileprogress", (file: Phaser.Loader.File, p: number) => { if (file.key === "gfx") draw(p * 0.9); });
    queueAssets(this.load, m);
    document.getElementById("boot")?.remove();
  }
  async create() {
    performance.mark("sb:assetsLoaded");
    const m = this.cache.json.get("manifest") as Manifest;
    await decodeBundle(this.textures, m, this.cache.json.get("gfx") as Record<string, string>, (f) => this.drawBar?.(0.9 + f * 0.1));
    this.cache.json.remove("gfx");
    performance.mark("sb:decoded");
    createAnims(this.anims, this.cache.json.get("manifest") as Manifest);
    performance.mark("sb:animsDone");
    Audio.init();
    performance.mark("sb:audioDone");
    await Poki.start();
    performance.mark("sb:pokiDone");
    Poki.loadingFinished();
    this.scene.start("Menu");
  }
}
