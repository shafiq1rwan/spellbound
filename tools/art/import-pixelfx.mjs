// Imports a sprite sheet exported by pixelfx (https://github.com/patch-gg/pixelfx, MIT) into the game.
//
// 1. Export it (run in your own terminal; this repo doesn't run pixelfx's code):
//      node <pixelfx>/tools/render.mjs ui/level-up --sheet --no-actor --fps 15 --bg none --out art-preview/pixelfx
// 2. node tools/art/import-pixelfx.mjs
//
// Writes public/assets/fx/levelup.png + levelup.json. The game loads it in the background after the menu
// appears (src/core/LateAssets.ts), so it doesn't add to the loading screen.
//
// Clean-up: even with --no-actor, ui/level-up leaves the demo hero in the frames: its shadow (dark,
// semi-transparent pixels) and, after the pillar, a gold rim round its silhouette. Over our wizard both read
// as another character, so they're removed in the hero's area (the title's outline and shadow are kept).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { loadPNG, savePNG, unpack, pack } from "./lib/px.mjs";

const SRC = "art-preview/pixelfx/ui/level-up/level-up";
const OUT = "public/assets/fx/levelup";

const meta = JSON.parse(readFileSync(`${SRC}.json`, "utf8")).meta.pixelfx;
const [fw, fh] = meta.frameSize, [px, py] = meta.pivot, cols = meta.columns;
const img = loadPNG(`${SRC}.png`);

// the hero's box relative to the pivot (feet): 22px either side, from 52px above the feet to 4px below
const box = { x0: px - 22, x1: px + 22, y0: py - 52, y1: py + 4 };
const isGhost = (v) => { const [r, g, b, a] = unpack(v); return a > 0 && a < 110 && (r + g + b) / 3 < 70; };
// The demo hero's exact silhouette: its shadow is all that's left in the last frames. Widened by 2px it
// also covers the gold rim pixelfx draws round the hero once the pillar fades, which would outline the
// wrong character round our wizard; that area is cleared from FADE_FRAME on (our wizard stands there).
const FADE_FRAME = Math.round(1.0 * meta.fps);
const mask = new Set();
for (let f = meta.frames - 9; f < meta.frames; f++) {
  const ox = (f % cols) * fw, oy = Math.floor(f / cols) * fh;
  for (let y = box.y0; y <= box.y1; y++)
    for (let x = box.x0; x <= box.x1; x++)
      if (isGhost(img.p[(oy + y) * img.w + ox + x])) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mask.add(`${x + dx},${y + dy}`);
}
let removed = 0, rim = 0;
for (let f = FADE_FRAME; f < meta.frames; f++) {
  const ox = (f % cols) * fw, oy = Math.floor(f / cols) * fh;
  for (const k of mask) {
    const [x, y] = k.split(",").map(Number), i = (oy + y) * img.w + ox + x;
    if (img.p[i] >>> 24) { img.p[i] = 0; rim++; }
  }
}
for (let f = 0; f < meta.frames; f++) {
  const ox = (f % cols) * fw, oy = Math.floor(f / cols) * fh;
  for (let y = box.y0; y <= box.y1; y++)
    for (let x = box.x0; x <= box.x1; x++) {
      const i = (oy + y) * img.w + ox + x;
      if (isGhost(img.p[i])) { img.p[i] = pack(0, 0, 0, 0); removed++; }
    }
}

mkdirSync("public/assets/fx", { recursive: true });
savePNG(`${OUT}.png`, img);
writeFileSync(`${OUT}.json`, JSON.stringify({
  source: `pixelfx ${meta.id} (MIT), exported at ${meta.fps} fps; demo-hero shadow removed`,
  frameWidth: fw, frameHeight: fh, frames: meta.frames, fps: meta.fps, pivot: [px, py], columns: cols,
}, null, 2) + "\n");
console.log(`${OUT}.png: ${meta.frames} frames of ${fw}x${fh}; hero mask ${mask.size} px; removed ${rim} rim + ${removed} shadow pixels`);
