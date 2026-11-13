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
    // soft round halo for the loading-screen rune (the art bundle isn't loaded yet)
    const h = document.createElement("canvas");
    h.width = h.height = 64;
    const hx = h.getContext("2d")!;
    const hg = hx.createRadialGradient(32, 32, 0, 32, 32, 32);
    hg.addColorStop(0, "rgba(255,255,255,0.9)");
    hg.addColorStop(0.45, "rgba(255,255,255,0.3)");
    hg.addColorStop(1, "rgba(255,255,255,0)");
    hx.fillStyle = hg;
    hx.fillRect(0, 0, 64, 64);
    this.textures.addCanvas("halo", h);
    this.scene.start("Preload");
  }
}
