import Phaser from "phaser";
import { Layout } from "../core/Layout";
import { createAnims, decodeBundle, queueAssets, setManifest, type Manifest } from "../core/assets";
import { Audio } from "../core/Audio";
import { Poki } from "../core/Poki";
import { idealGlyph, type RuneName } from "../rune/RuneRecognizer";
import { strokeSegments } from "../ui/stroke";
import { loadReadableFont } from "../ui/widgets";

// the loading screen traces each rune in its spell colour (fire, ice, lightning, arcane)
const LOAD_RUNES: [RuneName, number, number][] = [
  ["triangle", 0xff914d, 0xffd36b], ["circle", 0x6bddff, 0xe4fcff], ["zigzag", 0xffe17a, 0xfffbe0], ["vee", 0xa77bff, 0xe0a0ff],
];

export class PreloadScene extends Phaser.Scene {
  private drawBar?: (p: number) => void;
  private fontReady?: Promise<void>;
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
    this.runeAnim(H / 2 - bh / 2 - S * 2);
    this.fontReady = loadReadableFont();
    // byte-accurate progress for the single texture bundle (90%), decoding fills the rest
    this.load.on("fileprogress", (file: Phaser.Loader.File, p: number) => { if (file.key === "gfx") draw(p * 0.9); });
    queueAssets(this.load, m);
    document.getElementById("boot")?.remove();
  }
  /**
   * Animated rune above the bar, drawn with Graphics in device px (no textures exist yet):
   * each rune traces itself, flashes, fades, and the next one starts. Driven by the scene's UPDATE
   * event, which fires while the loader runs (scene.update() only starts after create()).
   */
  private runeAnim(barTop: number) {
    const S = Layout.S, W = this.scale.width;
    const size = 34 * S, cx = W / 2, cy = barTop - 14 * S - size / 2;
    const halo = this.add.image(cx, cy, "halo").setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(size * 2, size * 2);
    const g = this.add.graphics();
    const tip = this.add.graphics();
    const paths = LOAD_RUNES.map(([r]) => idealGlyph(r).map((p) => ({ x: p.x * size, y: p.y * size })));
    const TRACE = 650, HOLD = 260, FADE = 200, CYCLE = TRACE + HOLD + FADE;
    let t = 0;
    const step = (_time: number, dt: number) => {
      t += dt;
      const i = Math.floor(t / CYCLE) % LOAD_RUNES.length, u = t % CYCLE;
      const [, col, light] = LOAD_RUNES[i];
      const path = paths[i];
      const k = Math.min(1, u / TRACE);
      const n = Math.max(2, Math.ceil(path.length * k));
      const fade = u > TRACE + HOLD ? 1 - (u - TRACE - HOLD) / FADE : 1;
      const flash = u > TRACE && u < TRACE + 120 ? 1 : 0;
      g.clear();
      // opaque strokes (translucent ones bead where the joints overlap) over a soft coloured halo
      halo.setTint(col).setAlpha((0.22 + 0.25 * k + (flash ? 0.25 : 0)) * fade);
      strokeSegments(g, path, 3 * S, col, fade, cx, cy, n);
      strokeSegments(g, path, 1.4 * S, flash ? 0xffffff : light, fade, cx, cy, n);
      tip.clear();
      if (k < 1) {
        const p = path[Math.min(path.length - 1, n - 1)];
        tip.fillStyle(light, 0.35).fillRect(cx + p.x - 3 * S, cy + p.y - 3 * S, 6 * S, 6 * S);
        tip.fillStyle(0xffffff, 1).fillRect(cx + p.x - S, cy + p.y - S, 2 * S, 2 * S);
      }
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, step);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.UPDATE, step));
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
    await this.fontReady;
    Poki.loadingFinished();
    this.scene.start("Menu");
  }
}
