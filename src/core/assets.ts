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

export function queueAssets(load: Phaser.Loader.LoaderPlugin, m: Manifest) {
  for (const [key, s] of Object.entries(m.sheets)) load.spritesheet(key, BASE + s.file, { frameWidth: s.fw, frameHeight: s.fh });
  for (const [key, file] of Object.entries(m.images)) load.image(key, BASE + file);
  for (const [key, f] of Object.entries(m.fonts)) load.bitmapFont(key, BASE + f.png, BASE + f.xml);
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
