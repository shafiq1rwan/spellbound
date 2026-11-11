// Dev helper: render named frame sets to art-preview/<name>.png (upscaled, on a floor-ish bg)
import { strip, preview, savePNG } from "./lib/px.mjs";
export function peek(name, frames, k = 6, bg = "#262C4E", cols) {
  const { img } = strip(frames, cols ?? frames.length);
  savePNG(`art-preview/${name}.png`, preview(img, k, bg));
}
