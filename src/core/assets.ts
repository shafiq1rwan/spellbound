import Phaser from "phaser";

export interface AnimMeta { frames: number[]; durations: number[]; repeat: number }
export interface SheetMeta { file: string; fw: number; fh: number; anims: Record<string, AnimMeta>; origin: [number, number]; anchors?: Record<string, ([number, number] | null)[]> }
export interface Manifest {
  sheets: Record<string, SheetMeta>;
  images: Record<string, string>;
  fonts: Record<string, { png: string; xml: string }>;
  decor: { size: number; mushrooms: [number, number][]; runes: [number, number, number][]; tufts: [number, number][] };
  nineslice: Record<string, number>;
}

export const BASE = "assets/gfx/";
let manifest: Manifest;

export function setManifest(m: Manifest) { manifest = m; }
export function M(): Manifest { return manifest; }

/** everything is one request: gfx.json (all textures as base64 PNG) + the bitmap font */
export function queueAssets(load: Phaser.Loader.LoaderPlugin, m: Manifest) {
  load.json("gfx", BASE + "gfx.json");
  for (const [key, f] of Object.entries(m.fonts)) load.bitmapFont(key, BASE + f.png, BASE + f.xml);
}

/** decode the bundled PNGs into textures under their usual keys (one GPU texture each, as before) */
export async function decodeBundle(textures: Phaser.Textures.TextureManager, m: Manifest, bundle: Record<string, string>, onProgress?: (f: number) => void) {
  const keys = Object.keys(bundle);
  let done = 0;
  await Promise.all(keys.map(async (key) => {
    const img = new Image();
    img.src = "data:image/png;base64," + bundle[key];
    try { await img.decode(); } catch { await new Promise((r) => { img.onload = r; img.onerror = r; }); }
    const sheet = m.sheets[key];
    if (textures.exists(key)) textures.remove(key);
    if (sheet) textures.addSpriteSheet(key, img, { frameWidth: sheet.fw, frameHeight: sheet.fh });
    else textures.addImage(key, img);
    onProgress?.(++done / keys.length);
  }));
}

/** registers "<sheet>:<anim>" animations with exact per-frame durations */
export function createAnims(anims: Phaser.Animations.AnimationManager, m: Manifest) {
  for (const [key, s] of Object.entries(m.sheets)) {
    for (const [name, a] of Object.entries(s.anims)) {
      const k = `${key}:${name}`;
      if (anims.exists(k)) continue;
      anims.create({
        key: k,
        frames: a.frames.map((f, i) => ({ key, frame: f, duration: a.durations[i] })),
        repeat: a.repeat,
      });
    }
  }
}

export function origin(key: string): [number, number] {
  return manifest.sheets[key]?.origin ?? [0.5, 0.5];
}
