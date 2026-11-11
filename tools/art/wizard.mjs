// Apprentice Wizard — 48x48 frames, feet at (23.5, 44), faces right (flip for left).
// Drawn from parametric parts (hat cone, brim, hood, mantle, robe, staff, sleeve) so every
// pose stays on-model and the hat can lag/sway as secondary motion.
import { Img } from "./lib/px.mjs";
import { C } from "./palette.mjs";

const PAL = {
  k: C.outline, s: C.void,
  H: C.hat[0], h: C.hat[1], i: C.hat[2], j: C.hat[3],
  R: C.robe[0], r: C.robe[1], q: C.robe[2], Q: C.robe[3],
  A: C.gold[0], Y: C.gold[1], y: C.gold[2], W: C.gold[3],
  O: C.wood[0], o: C.wood[1], p: C.wood[2], P: C.wood[3],
  N: C.skin[0], n: C.skin[1],
  f: C.boot[0], F: C.boot[1],
  e: "#4FC8F5", E: "#E6FFFF", D: "#2A5E7A", d: "#1C3550",
};
export const W = 48, H = 48, CX = 23, GROUND = 44;

function shadeRel(rel, lit, mid, dark, a = 0.3, b = 0.7) {
  return rel < a ? lit : rel > b ? dark : mid;
}

function drawStaff(im, top, bot) {
  const [tx, ty] = top, [bx, by] = bot;
  const steep = Math.abs(by - ty) >= Math.abs(bx - tx);
  im.line(tx, ty, bx, by, "o");
  if (steep) im.line(tx + 1, ty, bx + 1, by, "O");
  else im.line(tx, ty + 1, bx, by + 1, "O");
  // light catch on upper third
  const lx = tx + (bx - tx) * 0.15, ly = ty + (by - ty) * 0.15;
  const mx = tx + (bx - tx) * 0.4, my = ty + (by - ty) * 0.4;
  im.line(lx, ly, mx, my, "p");
  // claw head holding the floating crystal
  const len = Math.hypot(bx - tx, by - ty) || 1;
  const ux = (tx - bx) / len, uy = (ty - by) / len; // towards tip
  const pxv = -uy, pyv = ux;                         // perpendicular
  im.px(tx + ux * 1 + pxv * -1.2, ty + uy * 1 + pyv * -1.2, "p");
  im.px(tx + ux * 1 + pxv * 2.2, ty + uy * 1 + pyv * 2.2, "O");
  im.px(tx + ux * 2 + pxv * -1.4, ty + uy * 2 + pyv * -1.4, "P");
  im.px(tx + ux * 2 + pxv * 2.4, ty + uy * 2 + pyv * 2.4, "o");
  return [tx + 0.5 + ux * 5, ty + uy * 5];
}

/** returns { img, anchor:[x,y]|null } — anchor is where the floating crystal goes */
export function wizard(pose = {}) {
  const {
    b = 0, lean = 0, bend = 4, staffA = 0, grip = [8, 33], eyes = "normal",
    widen = 0, hatDrop = 0, staffLine = null, hand = true,
  } = pose;
  const im = new Img(W, H).palette(PAL);
  const cxf = CX + 0.5;

  // ---- staff geometry
  let top, bot;
  const gx = CX + grip[0] + lean, gy = grip[1] + b;
  if (staffLine) {
    top = [staffLine[0], staffLine[1]];
    bot = [staffLine[2], staffLine[3]];
  } else {
    const dx = Math.sin(staffA), dy = -Math.cos(staffA);
    top = [Math.round(gx + dx * 12), Math.round(gy + dy * 12)];
    bot = [Math.round(gx - dx * 11), Math.min(GROUND, Math.round(gy - dy * 11))];
  }
  const staffBehind = !staffLine && staffA < -0.2;
  let anchor = null;
  if (staffBehind) anchor = drawStaff(im, top, bot);

  // ---- feet
  im.rect(CX - 4, 43, 3, 2, "f").hline(CX - 4, 43, 3, "F");
  im.rect(CX + 2, 43, 3, 2, "f").hline(CX + 2, 43, 3, "F");

  // ---- robe (bell shape, lit from upper-left)
  const yT = 29 + b, yB = 42;
  for (let y = yT; y <= yB; y++) {
    const t = (y - yT) / Math.max(1, yB - yT);
    const hw = 4.6 + 4.6 * Math.pow(t, 0.8) + widen;
    const c = cxf + lean * (1 - t);
    for (let x = Math.floor(c - hw - 1); x <= Math.ceil(c + hw + 1); x++) {
      const d = x + 0.5 - c;
      if (Math.abs(d) > hw) continue;
      const rel = (d + hw) / (2 * hw);
      let k = shadeRel(rel, "q", "r", "R", 0.3, 0.72);
      if (y === yB) k = rel < 0.45 ? "y" : "Y";               // gold hem trim
      else if (y === yB - 1 && rel > 0.2) k = rel > 0.72 ? "R" : "r";
      if (y >= yT + 4 && y < yB - 1 && Math.abs(rel - 0.6) < 0.05) k = "R"; // fold
      if (rel < 0.12 && y > yT + 2 && y < yB) k = "Q";        // rim light
      im.px(x, y, k);
    }
  }
  // hem scallop: notch between the feet
  im.px(Math.round(cxf + 0.5), yB, "R");

  // ---- mantle (shoulder cape) with clasp
  for (let y = 27 + b; y <= 33 + b; y++)
    for (let x = CX - 9; x <= CX + 10; x++) {
      const nx = (x + 0.5 - (cxf + lean)) / (7.2 + widen * 0.5), ny = (y + 0.5 - (30.5 + b)) / 2.6;
      if (nx * nx + ny * ny > 1) continue;
      let k = nx < -0.45 ? "i" : nx > 0.5 ? "H" : "h";
      if (ny > 0.55) k = "H";
      im.px(x, y, k);
    }
  im.px(CX + 1 + lean, 31 + b, "y").px(CX + 1 + lean, 32 + b, "Y");

  // ---- hood / face shadow
  const fcx = cxf + lean + 1, fcy = 26 + b + Math.max(0, hatDrop - 1);
  im.ellipse(fcx, fcy, 5.6, 3.0, "s");

  // ---- hat brim (top surface lit, front rim dark)
  const bcy = 21.5 + b + hatDrop;
  for (let y = Math.floor(bcy - 3); y <= Math.ceil(bcy + 3); y++)
    for (let x = CX - 14; x <= CX + 15; x++) {
      const nx = (x + 0.5 - (cxf + lean)) / 12.6, ny = (y + 0.5 - (bcy + 0.5)) / 2.7;
      if (nx * nx + ny * ny > 1) continue;
      let k = ny < 0.1 ? (nx < -0.35 ? "i" : nx > 0.55 ? "H" : "h") : ny < 0.6 ? (nx > 0.4 ? "H" : "h") : "H";
      if (ny < -0.55 && nx < -0.1) k = "j";
      im.px(x, y, k);
    }

  // ---- hat cone (bent tip trails behind = secondary motion)
  const tipY = 8 + b + hatDrop + Math.max(0, -bend) * 0.3, baseY = 21 + b + hatDrop;
  let bandC = 0;
  for (let y = Math.round(tipY); y <= baseY; y++) {
    const t = (y - tipY) / (baseY - tipY);
    const hw = 0.55 + 7.0 * Math.pow(t, 0.95);
    const c = cxf + lean - bend * Math.pow(1 - t, 2.2);
    if (y === baseY - 2) bandC = c;
    for (let x = Math.floor(c - hw - 1); x <= Math.ceil(c + hw + 1); x++) {
      const d = x + 0.5 - c;
      if (Math.abs(d) > Math.max(hw, 0.5)) continue;
      const rel = (d + hw) / (2 * hw);
      let k = shadeRel(rel, "i", "h", "H", 0.32, 0.7);
      if (rel < 0.18 && t > 0.15 && t < 0.85) k = "j";
      if (y === baseY - 2 || y === baseY - 1) k = rel < 0.35 ? "y" : rel > 0.75 ? "A" : "Y"; // band
      im.px(x, y, k);
    }
  }
  // star ornament on the cone, front side
  const sx = Math.round(bandC + 1.5), sy = baseY - 6;
  im.px(sx, sy - 1, "y").px(sx - 1, sy, "y").px(sx + 1, sy, "y").px(sx, sy + 1, "Y").px(sx, sy, "W");

  // ---- eyes
  const ey = 25 + b + Math.max(0, hatDrop - 1);
  const e0 = CX + 1 + lean, e1 = CX + 4 + lean;
  const eye = (x) => {
    switch (eyes) {
      case "bright": im.rect(x, ey, 2, 2, "E"); break;
      case "blink": im.hline(x, ey + 1, 2, "e"); break;
      case "squint": im.px(x, ey, "e").px(x + 1, ey + 1, "e"); break;
      case "dim": im.hline(x, ey + 1, 2, "D"); break;
      case "off": im.hline(x, ey + 1, 2, "d"); break;
      default: im.px(x, ey, "E").px(x + 1, ey, "e").hline(x, ey + 1, 2, "e");
    }
  };
  eye(e0);
  if (eyes === "squint") { im.px(e1 + 1, ey, "e").px(e1, ey + 1, "e"); } else eye(e1);

  // ---- staff (in front) + sleeve + hand
  if (!staffBehind) anchor = drawStaff(im, top, bot);
  if (hand && !staffLine) {
    const shx = CX + 4 + lean, shy = 31 + b;
    im.line(shx, shy, gx - 1, gy, "r", 3);
    im.line(shx, shy - 1, gx - 2, gy - 1, "q");
    im.px(gx - 1, gy - 1, "Y").px(gx - 1, gy, "Y").px(gx - 1, gy + 1, "A");
    im.rect(gx, gy - 1, 2, 2, "n").px(gx + 1, gy, "N");
  } else if (!hand) {
    // sleeve resting at side
    im.line(CX + 4 + lean, 31 + b, CX + 6 + lean, 35 + b, "r", 3);
    im.rect(CX + 6 + lean, 36 + b, 2, 2, "n");
  }

  im.outline("k");
  if (staffLine) anchor = null;
  return { img: im, anchor: anchor && [Math.round(anchor[0] * 2) / 2, Math.round(anchor[1] * 2) / 2] };
}

// ------------------------------------------------------------------ poses
export const POSES = {
  idle: [
    { b: 0, bend: 6 },
    { b: 0, bend: 7 },
    { b: 1, bend: 7.5, widen: 0.4 },
    { b: 1, bend: 6.5, widen: 0.4 },
  ],
  blink: [
    { b: 0, bend: 6 },
    { b: 0, bend: 7, eyes: "blink" },
    { b: 1, bend: 7.5, widen: 0.4, eyes: "blink" },
    { b: 1, bend: 6.5, widen: 0.4 },
  ],
  cast: [
    { b: 1, widen: 0.5, staffA: -0.3, grip: [7, 34], bend: 6.5 },
    { b: 1, widen: 0.6, staffA: -0.5, grip: [6, 33], bend: 7.5, eyes: "bright" },
    { b: -1, lean: 1, staffA: 0.65, grip: [11, 31], bend: 9.5, eyes: "bright" },
    { b: 0, lean: 1, staffA: 0.42, grip: [10, 32], bend: 8.5, eyes: "bright" },
    { b: 0, staffA: 0.14, grip: [9, 33], bend: 7 },
  ],
  hurt: [
    { b: 1, lean: -1, bend: -1, staffA: -0.4, grip: [7, 34], eyes: "squint", widen: 0.6 },
    { b: 0, lean: -1, bend: 3, staffA: -0.15, grip: [8, 33], eyes: "squint" },
  ],
  cheer: [
    { b: -1, staffA: 0.12, grip: [7, 26], eyes: "bright", bend: 8 },
    { b: -2, staffA: 0.05, grip: [7, 24], eyes: "bright", bend: 9.5 },
  ],
  death: [
    { b: 1, lean: -1, bend: -1, staffA: -0.4, grip: [7, 34], eyes: "squint", widen: 0.6 },
    { b: 2, widen: 1, bend: 0, staffA: 0.75, grip: [10, 35], eyes: "dim", hatDrop: 1 },
    { b: 3, widen: 1.5, bend: -3, eyes: "dim", hatDrop: 2, hand: false, staffLine: [CX + 20, 30, CX + 8, 44] },
    { b: 4, widen: 2, bend: -4, eyes: "off", hatDrop: 3, hand: false, staffLine: [CX + 22, 42, CX + 6, 44] },
  ],
};

export const TIMING = {
  idle: [150, 150, 150, 150],
  blink: [150, 90, 90, 150],
  cast: [45, 45, 70, 90, 110],
  hurt: [90, 140],
  cheer: [140, 200],
  death: [120, 160, 200, 600],
};

// Floating crystal (separate sprite so it can change element colour and glow).
const CRYSTAL = `
...k...
..kxk..
.kxyck.
kxyyc0k
kyyyc0k
.kyc0k.
..kc0k.
...kk..
`;
export function crystals() {
  const elems = {
    cyan: C.crystalCyan, fire: C.crystalFire, ice: C.crystalIce, bolt: C.crystalBolt, arcane: C.crystalArcane,
  };
  const out = {};
  for (const [name, r] of Object.entries(elems)) {
    out[name] = [0, 1, 2, 3].map((f) => {
      const im = new Img(9, 10).palette({ k: C.outline, 0: r[0], c: r[1], y: r[2], x: r[3] });
      im.grid(1, 1, CRYSTAL);
      if (f === 1) im.px(3, 4, "x");
      if (f === 2) im.px(3, 4, "x").px(4, 5, "x").px(2, 4, "x");
      if (f === 3) im.px(4, 4, "x");
      return im;
    });
  }
  return out;
}
