import Phaser from "phaser";
import { BASE } from "../core/assets";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }
  preload() {
    this.load.json("manifest", BASE + "manifest.json");
  }
  create() {
    // soft edge vignette used for low-HP warning and hurt flash (created once at boot)
    const size = 128;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    const gr = ctx.createRadialGradient(size / 2, size / 2, size * 0.28, size / 2, size / 2, size * 0.72);
    gr.addColorStop(0, "rgba(255,255,255,0)");
    gr.addColorStop(1, "rgba(255,255,255,1)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, size, size);
    this.textures.addCanvas("vignette", c);
    this.scene.start("Preload");
  }
}
