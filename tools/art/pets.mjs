// Familiars: tiny elemental pets (16x16, 4-frame idle loops) that orbit the wizard and auto-cast.
import { Img } from "./lib/px.mjs";
import { C } from "./palette.mjs";

const K = C.outline;

function eyes(im, x, y, col = "#141629") {
  im.px(x, y, col).px(x, y + 1, col).px(x + 3, y, col).px(x + 3, y + 1, col);
}

/** Ember Wisp: a little teardrop flame with a face */
function emberWisp(f) {
  const im = new Img(16, 16);
  const R = ["#A8321E", "#E8602A", C.fireOrange, C.fireYellow, "#FFF6D0"];
  const sway = [0, 1, 0, -1][f], tipH = [2, 1, 2, 3][f];
  // body (round bottom) + tapering flame top
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - 8, dy = y + 0.5 - 10;
      const inBody = dx * dx + dy * dy <= 4.6 * 4.6;
      const t = (10 - (y + 0.5)) / (10 - tipH); // 0 at body centre -> 1 at the tip
      const half = 4.6 * (1 - Math.pow(Math.max(0, t), 1.4));
      const cxl = 8 + sway * Math.max(0, t) * 1.5;
      const inTip = y + 0.5 < 10 && y >= tipH && Math.abs(x + 0.5 - cxl) <= half;
      if (!inBody && !inTip) continue;
      const d = Math.hypot(dx * 1.1, (y + 0.5 - 10.5) * 0.9);
      im.px(x, y, d < 1.6 ? R[4] : d < 2.8 ? R[3] : d < 4 ? R[2] : y < 8 ? R[2] : R[1]);
    }
  im.px(8 + sway, tipH, R[3]);
  eyes(im, 6, 9);
  im.px(7, 12, "#A8321E").px(8, 12, "#A8321E");
  im.outline(K);
  return im;
}

/** Frost Sprite: a crystal fairy with fluttering wings */
function frostSprite(f) {
  const im = new Img(16, 16);
  const wing = [0, 1, 2, 1][f];
  const W = "#C2F2FF";
  // wings (behind)
  im.poly([7, 8, 1, 4 - wing, 2, 10], W);
  im.poly([9, 8, 15, 4 - wing, 14, 10], W);
  im.px(3, 6 - wing, "#FFFFFF").px(12, 6 - wing, "#FFFFFF");
  // crystal body
  im.poly([8, 2, 12, 8, 8, 14, 4, 8], "#3B8CD8");
  im.poly([8, 2, 12, 8, 8, 8], C.iceCyan);
  im.poly([8, 2, 8, 8, 4, 8], "#E6FCFF");
  im.px(7, 4, "#FFFFFF");
  eyes(im, 6, 6, "#141629");
  im.outline(K);
  return im;
}

/** Spark Imp: a round little yellow imp with horns and a lightning tail */
function sparkImp(f) {
  const im = new Img(16, 16);
  const bob = [0, -1, 0, 1][f];
  const cy = 9 + bob;
  // zigzag tail
  const tail = [[3, cy + 1], [2, cy - 1], [1, cy + 1], [0, cy - 1]];
  for (let i = 0; i < tail.length - 1; i++) im.line(tail[i][0], tail[i][1], tail[i + 1][0], tail[i + 1][1], C.boltYellow);
  // body
  im.circ(8, cy, 4.2, "#E0B526");
  im.circ(7.5, cy - 0.5, 3.2, C.boltYellow);
  im.px(6, cy - 3, "#FFFBE0").px(7, cy - 3, "#FFFBE0");
  // horns
  im.px(5, cy - 5, "#8D6A10").px(5, cy - 4, "#8D6A10").px(11, cy - 5, "#8D6A10").px(11, cy - 4, "#8D6A10");
  eyes(im, 6, cy - 1);
  im.px(7, cy + 2, "#8D6A10").px(8, cy + 2, "#8D6A10");
  // crackle
  if (f % 2 === 0) im.px(13, cy - 4, "#FFFFFF").px(14, cy - 5, C.boltYellow);
  else im.px(13, cy + 3, "#FFFFFF").px(14, cy + 4, C.boltYellow);
  im.outline(K);
  return im;
}

/** Arcane Owl: a round purple owlet with big eyes */
function arcaneOwl(f) {
  const im = new Img(16, 16);
  const flap = [0, 1, 2, 1][f];
  const P = ["#4A1F8A", "#7A3CC8", C.violet, C.lavender];
  // wings
  im.ellipse(3, 9 + flap * 0.5, 2, 3 - flap * 0.5, P[0]);
  im.ellipse(12, 9 + flap * 0.5, 2, 3 - flap * 0.5, P[0]);
  // body + belly
  im.ellipse(7.5, 9, 4.6, 5, P[1]);
  im.ellipse(7.5, 11, 3, 2.6, P[2]);
  im.px(6, 11, P[3]).px(8, 12, P[3]);
  // ear tufts
  im.px(4, 3, P[1]).px(4, 4, P[1]).px(11, 3, P[1]).px(11, 4, P[1]);
  // big eyes
  im.rect(4, 6, 3, 3, "#FFF8EC").rect(9, 6, 3, 3, "#FFF8EC");
  const look = f === 2 ? 1 : 0;
  im.px(5 + look, 7, "#141629").px(10 + look, 7, "#141629");
  im.px(7, 9, C.fireYellow).px(8, 9, C.fireYellow);
  im.outline(K);
  return im;
}

export const PETS = {
  pet_fire: emberWisp,
  pet_ice: frostSprite,
  pet_bolt: sparkImp,
  pet_arcane: arcaneOwl,
};
