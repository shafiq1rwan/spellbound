// Enemy sprites: Forest Slime (32), Shadow Bat (32), Cursed Skeleton (48), Stone Golem (64),
// Ancient Arcane Guardian boss (96) + parts, and elite variants (palette swap + glow rim).
import { Img } from "./lib/px.mjs";
import { C } from "./palette.mjs";

const K = C.outline;

// =================================================================== SLIME
const SLIME_PAL = {
  K: C.slime[0], G: C.slime[1], g: C.slime[2], l: C.slime[3], w: C.slime[4],
  e: C.outline, p: C.blush, L: C.leaf[1], N: C.leaf[0], m: "#0F2A18",
};
/** w: half width, h: height, lift: px above ground, face: normal|hurt|dead */
export function slime({ w = 9, h = 13, lift = 0, face = "normal", leaf = 0, lean = 0 } = {}) {
  const im = new Img(32, 32).palette(SLIME_PAL);
  const cx = 16, ground = 28 - lift;
  const top = ground - h;
  for (let y = Math.floor(top) - 1; y <= ground; y++)
    for (let x = cx - Math.ceil(w) - 2; x <= cx + Math.ceil(w) + 2; x++) {
      const ny = (y + 0.5 - top) / h;                  // 0 top .. 1 bottom
      if (ny < 0 || ny > 1) continue;
      // dome: round top, slightly flared flat base
      const prof = ny < 0.62 ? Math.sqrt(1 - Math.pow((0.62 - ny) / 0.62, 2)) : 1 + (ny - 0.62) * 0.18;
      const hw = w * prof;
      const c = cx + lean * (1 - ny);
      const d = x + 0.5 - c;
      if (Math.abs(d) > hw || (ny > 0.92 && Math.abs(d) > hw - 1)) continue;
      const nx = d / Math.max(1, w);
      let k = "g";
      if (ny > 0.78 || nx > 0.55) k = "G";
      if (ny > 0.7 && nx > 0.3) k = "G";
      if (nx < -0.15 && ny < 0.45) k = "l";
      if (ny > 0.62 && ny < 0.78 && nx < 0.25 && nx > -0.6) k = "l";   // subsurface glow band
      im.px(x, y, k);
    }
  // shine
  const sx = Math.round(cx - w * 0.5 + lean * 0.6), sy = Math.round(top + h * 0.2);
  im.px(sx, sy, "w").px(sx + 1, sy, "w").px(sx, sy + 1, "w");
  // face
  const fy = Math.round(top + h * 0.48), fx = Math.round(cx + lean * 0.4 + 1);
  if (face === "normal") {
    im.rect(fx - 4, fy, 1, 2, "e").rect(fx + 1, fy, 1, 2, "e");
    im.px(fx - 2, fy + 2, "m").px(fx - 1, fy + 2, "m");
    im.px(fx - 6, fy + 2, "p").px(fx + 3, fy + 2, "p");
  } else if (face === "hurt") {
    im.px(fx - 5, fy, "e").px(fx - 4, fy + 1, "e").px(fx - 5, fy + 2, "e");
    im.px(fx + 2, fy, "e").px(fx + 1, fy + 1, "e").px(fx + 2, fy + 2, "e");
    im.rect(fx - 2, fy + 2, 2, 2, "m");
  } else if (face === "dead") {
    im.px(fx - 5, fy, "e").px(fx - 3, fy, "e").px(fx - 4, fy + 1, "e");
    im.px(fx + 1, fy, "e").px(fx + 3, fy, "e").px(fx + 2, fy + 1, "e");
  }
  // leaf sprout
  if (h > 6) {
    const lx = Math.round(cx + lean), ly = Math.round(top) - 1;
    im.px(lx, ly, "N").px(lx, ly - 1, "N");
    const s = leaf;
    im.px(lx + 1 + s, ly - 2, "L").px(lx + 2 + s, ly - 2, "L").px(lx + 1 + s, ly - 3, "L").px(lx + 2 + s, ly - 3, "N");
    im.px(lx + 3 + s, ly - 3, "L");
  }
  im.outline("K");
  return im;
}
export const SLIME = {
  idle: [{ w: 9, h: 13 }, { w: 9.5, h: 12.5, leaf: 0 }, { w: 10, h: 12, leaf: 1 }, { w: 9.5, h: 12.5, leaf: 0 }],
  hop: [
    { w: 11, h: 10, leaf: 1 }, { w: 7.5, h: 15, lift: 2, leaf: -1 }, { w: 8, h: 14, lift: 6, leaf: -1 },
    { w: 8.5, h: 13.5, lift: 4 }, { w: 11.5, h: 10, leaf: 1 }, { w: 9.5, h: 12.5 },
  ],
  hurt: [{ w: 12, h: 10, face: "hurt", leaf: 1 }, { w: 8, h: 14, face: "hurt", lean: -1, leaf: -1 }],
  death: [{ w: 13, h: 9, face: "dead", leaf: 1 }, { w: 14.5, h: 5, face: "dead" }, { w: 14, h: 3, face: "none" }],
};
export const SLIME_T = { idle: [160, 160, 160, 160], hop: [110, 80, 110, 90, 100, 120], hurt: [70, 90], death: [70, 80, 120] };

// =================================================================== BAT
const BAT_PAL = {
  k: K, 0: C.bat[0], 1: C.bat[1], 2: C.bat[2], 3: C.bat[3], 4: C.bat[4],
  r: C.batEye[0], R: C.batEye[1], w: "#FFF8EC", m: "#140B24",
};
/** wing: -1 up, 0 mid, 1 down, 2 folded/tumble */
export function bat({ wing = 0, bob = 0, face = "normal" } = {}) {
  const im = new Img(32, 32).palette(BAT_PAL);
  const cx = 15.5, cy = 14 + bob;
  // wings (left half, mirrored)
  const half = new Img(32, 32).palette(BAT_PAL);
  const sh = [cx - 3, cy - 1];
  let pts;
  if (wing === -1) pts = [sh[0], sh[1] + 1, sh[0] - 6, cy - 9, sh[0] - 12, cy - 8, sh[0] - 11, cy - 4, sh[0] - 8, cy - 5, sh[0] - 7, cy - 1, sh[0] - 4, cy - 2, sh[0], sh[1] + 3];
  else if (wing === 0) pts = [sh[0], sh[1], sh[0] - 7, cy - 5, sh[0] - 13, cy - 2, sh[0] - 11, cy + 2, sh[0] - 8, cy + 1, sh[0] - 6, cy + 4, sh[0] - 3, cy + 2, sh[0], sh[1] + 4];
  else if (wing === 1) pts = [sh[0], sh[1], sh[0] - 6, cy - 1, sh[0] - 12, cy + 4, sh[0] - 9, cy + 6, sh[0] - 7, cy + 4, sh[0] - 5, cy + 8, sh[0] - 2, cy + 4, sh[0], sh[1] + 4];
  else pts = [sh[0], sh[1], sh[0] - 4, cy - 2, sh[0] - 6, cy + 3, sh[0] - 3, cy + 5, sh[0], sh[1] + 5];
  half.poly(pts, "2");
  // wing bones
  half.line(pts[0], pts[1], pts[2], pts[3], "4");
  if (wing !== 2) half.line(pts[2], pts[3], pts[8] ?? pts[4], pts[9] ?? pts[5], "3");
  half.map((x, y, v) => (v && half.get(x, y + 1) === 0 && half.get(x, y - 1) ? half.col("1") : undefined));
  // upper-edge light
  half.mirrorX(16);
  im.stamp(half, 0, 0);
  // body
  im.ellipse(cx, cy + 0.5, 4.6, 4.4, "2");
  im.ellipse(cx - 1, cy - 0.5, 2.6, 2.4, "3");
  im.ellipse(cx + 0.5, cy + 2.5, 2.6, 1.6, "1");
  im.ellipse(cx, cy + 2.5, 1.8, 1.3, "4");
  // big ears
  im.poly([cx - 5, cy - 1, cx - 6, cy - 10, cx - 0.5, cy - 3], "2");
  im.poly([cx + 6, cy - 1, cx + 7, cy - 10, cx + 1.5, cy - 3], "2");
  im.px(cx - 4.5, cy - 7, "r").px(cx - 4.5, cy - 6, "r").px(cx + 4.5, cy - 7, "0").px(cx + 4.5, cy - 6, "0");
  im.px(cx - 4.5, cy - 6, "4").px(cx - 4, cy - 5, "3").px(cx + 5, cy - 6, "1").px(cx + 4, cy - 5, "1");
  // face
  const ey = Math.round(cy - 1);
  if (face === "normal") {
    im.rect(Math.round(cx - 3), ey, 2, 2, "r").px(Math.round(cx - 3), ey, "R");
    im.rect(Math.round(cx + 1), ey, 2, 2, "r").px(Math.round(cx + 1), ey, "R");
    im.px(Math.round(cx - 1), ey + 3, "m").px(Math.round(cx), ey + 3, "m").px(Math.round(cx), ey + 4, "w");
  } else {
    im.px(Math.round(cx - 3), ey, "r").px(Math.round(cx - 2), ey + 1, "r");
    im.px(Math.round(cx + 2), ey, "r").px(Math.round(cx + 1), ey + 1, "r");
    im.rect(Math.round(cx - 1), ey + 3, 2, 2, "m");
  }
  // tiny feet
  im.px(Math.round(cx - 1), Math.round(cy + 5), "1").px(Math.round(cx + 1), Math.round(cy + 5), "1");
  im.outline("k");
  return im;
}
export const BAT = {
  fly: [{ wing: -1, bob: 1 }, { wing: 0, bob: 0 }, { wing: 1, bob: -1 }, { wing: 0, bob: 0 }],
  hurt: [{ wing: 2, bob: 0, face: "hurt" }, { wing: 1, bob: 1, face: "hurt" }],
};
export const BAT_T = { fly: [70, 60, 70, 60], hurt: [80, 100] };

// =================================================================== SKELETON
const SK_PAL = {
  k: K, 0: C.bone[0], 1: C.bone[1], 2: C.bone[2], 3: C.bone[3],
  s: "#0B0C1E", g: C.ghostEye[0], G: C.ghostEye[1],
  a: C.rust[0], b: "#7E7A8C", c: "#B9B4C4", h: "#4A2E25", x: C.rust[1],
  u: C.cloth[0], U: C.cloth[1], v: C.cloth[2],
};
/** pose: { step: -1|0|1, bob, lean, swordA, tilt, lunge } */
export function skeleton({ step = 0, bob = 0, lean = 0, swordA = 0.5, tilt = 0, lunge = 0, eye = "g" } = {}) {
  const im = new Img(48, 48).palette(SK_PAL);
  const cx = 23 + lunge, g = 44;
  // legs (shuffle)
  const ly = 37 + bob;
  im.line(cx - 2, ly, cx - 3 - step, g - 1, "1", 2);
  im.line(cx + 2, ly, cx + 2 + step, g - 1, "1", 2);
  im.rect(cx - 5 - step, g - 1, 3, 1, "2").rect(cx + 2 + step, g - 1, 3, 1, "2");
  // pelvis + tattered purple loincloth
  im.rect(cx - 3, ly - 2, 7, 2, "2");
  im.poly([cx - 3, ly - 1, cx + 4, ly - 1, cx + 3, ly + 4, cx + 1, ly + 2, cx - 1, ly + 5, cx - 3, ly + 3], "U");
  im.px(cx + 2, ly, "v").px(cx - 2, ly + 2, "u").px(cx, ly + 1, "u");
  // spine + ribs (hunched forward)
  const by = 29 + bob, bx = cx + lean;
  im.line(cx, ly - 2, bx + 1, by, "1", 2);
  for (let i = 0; i < 3; i++) {
    const ry = by + 1 + i * 2;
    im.hline(bx - 3 + i * 0.3, ry, 8 - i, "2");
    im.px(bx - 3 + i * 0.3, ry, "3");
    im.px(bx + 4 - i * 0.7, ry, "1");
  }
  // back arm
  im.line(bx - 3, by + 1, bx - 5, by + 6, "1");
  // sword arm + rusty short sword
  const hx = bx + 6 + Math.round(lunge * 0.5), hy = by + 5;
  im.line(bx + 4, by + 1, hx, hy, "2");
  const dx = Math.sin(swordA), dy = -Math.cos(swordA);
  const tip = [hx + dx * 10, hy + dy * 10];
  im.line(hx + dx * 2, hy + dy * 2, tip[0], tip[1], "c", 2);
  im.line(hx + dx * 3, hy + dy * 3, tip[0] - dx, tip[1] - dy, "b");
  im.px(hx + dx * 6 + 1, hy + dy * 6, "x").px(hx + dx * 8, hy + dy * 8, "x");
  im.line(hx - dy * 2 + dx * 2, hy + dx * 2 + dy * 2, hx + dy * 2 + dx * 2, hy - dx * 2 + dy * 2, "a");
  im.rect(hx, hy, 2, 2, "3");
  // big square skull
  const sx = bx - 5 + Math.round(lean * 0.5), sy = 17 + bob + Math.round(tilt * 0.5);
  im.rect(sx + 1, sy, 11, 10, "2");
  im.rect(sx, sy + 1, 13, 7, "2");
  im.rect(sx + 1, sy + 1, 4, 4, "3");
  im.hline(sx + 2, sy, 7, "3");
  im.rect(sx + 9, sy + 1, 3, 7, "1");
  im.hline(sx + 1, sy + 9, 11, "1");
  // eye sockets (one empty, one glowing)
  im.rect(sx + 2, sy + 4, 3, 3, "s");
  im.rect(sx + 7, sy + 4, 3, 3, "s");
  if (eye === "g") im.rect(sx + 8, sy + 5, 2, 1, "g").px(sx + 8, sy + 5, "G");
  else im.px(sx + 8, sy + 5, "0");
  // nose + teeth (jaw)
  im.px(sx + 6, sy + 7, "s");
  im.rect(sx + 3, sy + 10, 8, 2, "2");
  im.hline(sx + 4, sy + 11, 6, "1");
  im.px(sx + 5, sy + 10, "s").px(sx + 7, sy + 10, "s").px(sx + 9, sy + 10, "s");
  // crack
  im.px(sx + 3, sy + 1, "1").px(sx + 4, sy + 2, "1").px(sx + 4, sy + 3, "0");
  im.outline("k");
  if (tilt) return im.rotated(tilt * 0.08);
  return im;
}
export const SKEL = {
  idle: [{ bob: 0 }, { bob: 1, swordA: 0.55 }],
  walk: [{ step: -1, bob: 0 }, { step: 0, bob: 1 }, { step: 1, bob: 0 }, { step: 0, bob: 1 }],
  attack: [
    { lean: -2, swordA: -0.6, bob: 1, step: 0 },
    { lean: 2, lunge: 3, swordA: 1.6, step: 1 },
    { lean: 1, lunge: 2, swordA: 1.2, step: 1 },
  ],
  hurt: [{ tilt: -3, lean: -1, eye: "x" }],
};
export const SKEL_T = { idle: [300, 300], walk: [130, 130, 130, 130], attack: [260, 90, 200], hurt: [140] };

/** loose bone bits for the death scatter */
export function boneBits() {
  const pal = { k: K, 1: C.bone[1], 2: C.bone[2], 3: C.bone[3], s: "#0B0C1E", g: C.ghostEye[0] };
  const skull = new Img(14, 13).palette(pal).grid(0, 0, `
    .kkkkkkkkkk.
    k3322222221k
    k3222222221k
    k2ss222ss21k
    k2ss222sg21k
    k2222s22221k
    k1112222111k
    .k2s2s2s2k..
    ..kkkkkkk...`);
  const rib = new Img(10, 5).palette(pal).grid(0, 0, `
    .kkkkkkk.
    k3222221k
    .kkkkkkk.`);
  const bone = new Img(9, 5).palette(pal).grid(0, 0, `
    kk...kk.
    k3kkk21k
    kk...kk.`);
  const sword = new Img(12, 5).palette({ k: K, a: C.rust[0], b: C.rust[1], c: C.rust[2] }).grid(0, 0, `
    .k.kkkkkkk.
    kakcccccbbk
    .k.kkkkkkk.`);
  return [skull, rib, bone, sword];
}

// =================================================================== GOLEM
const GO_PAL = {
  k: K, 0: C.stone[0], 1: C.stone[1], 2: C.stone[2], 3: C.stone[3], 4: C.stone[4],
  r: C.rune[0], R: C.rune[1], W: C.rune[2], m: C.moss[0], M: C.moss[1], n: C.moss[2], s: "#0B0C1E",
};
function rock(im, cx, cy, rx, ry) {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      // chunky superellipse
      if (Math.pow(Math.abs(nx), 2.6) + Math.pow(Math.abs(ny), 2.6) > 1) continue;
      let k = "2";
      if (nx + ny < -0.7) k = "3";
      if (nx + ny < -1.15) k = "4";
      if (nx + ny > 0.6) k = "1";
      if (ny > 0.75) k = "1";
      im.px(x, y, k);
    }
}
/** pose: { bob, armY, armOut, step, eye, runeGlow } */
export function golem({ bob = 0, armY = 0, armOut = 0, step = 0, eye = "R", rune = 1, shake = 0 } = {}) {
  const im = new Img(64, 64).palette(GO_PAL);
  const cx = 31.5 + shake, g = 60;
  // legs
  rock(im, cx - 7 - step, g - 5, 5, 5);
  rock(im, cx + 7 + step, g - 5, 5, 5);
  // back arm (left) behind body
  const ay = 40 + armY + bob;
  const uy = (32 + bob + ay + 3) / 2;
  rock(im, cx - 16 - armOut * 0.5, uy, 4.5, Math.max(5, Math.abs(ay + 3 - 32 - bob) / 2 + 2));
  rock(im, cx - 18 - armOut, ay + 3, 6.5, 6);       // big fist
  // torso
  rock(im, cx, 38 + bob, 14, 12);
  // stone seams
  im.line(cx - 8, 30 + bob, cx - 3, 36 + bob, "1").line(cx - 3, 36 + bob, cx + 1, 35 + bob, "1");
  im.line(cx + 6, 42 + bob, cx + 10, 47 + bob, "1").line(cx - 11, 42 + bob, cx - 6, 44 + bob, "1");
  // head embedded on top
  rock(im, cx + 1, 25 + bob, 7, 5.5);
  im.rect(Math.round(cx - 3), 24 + bob, 9, 3, "s");
  if (eye === "R") {
    im.rect(Math.round(cx - 2), 25 + bob, 2, 1, "R").px(Math.round(cx - 2), 25 + bob, "W");
    im.rect(Math.round(cx + 3), 25 + bob, 2, 1, "R").px(Math.round(cx + 3), 25 + bob, "W");
  } else {
    im.rect(Math.round(cx - 2), 25 + bob, 2, 1, "r").rect(Math.round(cx + 3), 25 + bob, 2, 1, "r");
  }
  // chest rune
  const rx = Math.round(cx), ry = 37 + bob;
  const rc = rune > 0.5 ? "R" : "r";
  im.line(rx, ry - 4, rx + 3, ry, rc).line(rx + 3, ry, rx, ry + 4, rc).line(rx, ry + 4, rx - 3, ry, rc).line(rx - 3, ry, rx, ry - 4, rc);
  im.vline(rx, ry - 2, 5, rc);
  if (rune > 1) im.px(rx, ry, "W").px(rx, ry - 3, "W");
  // front arm (right)
  rock(im, cx + 16 + armOut * 0.5, uy, 4.5, Math.max(5, Math.abs(ay + 3 - 32 - bob) / 2 + 2));
  rock(im, cx + 18 + armOut, ay + 3, 6.5, 6);
  im.line(cx + 15 + armOut, ay + 2, cx + 21 + armOut, ay + 2, "1");
  im.line(cx + 15 + armOut, ay + 5, cx + 21 + armOut, ay + 5, "1");
  im.px(cx + 16 + armOut * 0.5, uy - 1, rc).px(cx + 16 + armOut * 0.5, uy + 1, rc);
  // moss on shoulders and head
  const moss = (x, y, n) => { for (let i = 0; i < n; i++) im.px(x + i, y + (i % 3 === 1 ? -1 : 0), i % 2 ? "M" : "n"); im.hline(x, y + 1, n, "m"); };
  moss(Math.round(cx - 12), 28 + bob, 5);
  moss(Math.round(cx + 6), 27 + bob, 4);
  moss(Math.round(cx - 2), 20 + bob, 5);
  moss(Math.round(cx - 22 - armOut), ay - 4, 3);
  im.outline("k");
  return im;
}
export const GOLEM = {
  idle: [{ bob: 0 }, { bob: 0, armY: 1 }, { bob: 1, armY: 1 }, { bob: 1 }],
  walk: [{ step: -1, bob: 1 }, { step: 0, bob: 0, armY: -1 }, { step: 1, bob: 1 }, { step: 0, bob: 0, armY: -1 }],
  attack: [
    { armY: -10, armOut: 2, bob: -1, rune: 2 }, { armY: -14, armOut: 1, bob: -2, rune: 2 },
    { armY: 4, armOut: -1, bob: 2, rune: 1 }, { armY: 2, bob: 1 },
  ],
  hurt: [{ shake: -1, eye: "r", rune: 0 }],
};
export const GOLEM_T = { idle: [260, 260, 260, 260], walk: [200, 200, 200, 200], attack: [300, 400, 90, 260], hurt: [120] };

export function rockBits() {
  return [0, 1, 2].map((i) => {
    const im = new Img(12, 12).palette(GO_PAL);
    rock(im, 5.5, 5.5, 3.5 + i * 0.8, 3 + (i % 2));
    if (i === 1) im.hline(4, 6, 3, "m");
    if (i === 2) im.px(5, 5, "R");
    im.outline("k");
    return im;
  });
}

// =================================================================== BOSS
const BO_PAL = {
  k: K, 0: C.stone[0], 1: C.stone[1], 2: C.stone[2], 3: C.stone[3], 4: C.stone[4],
  v: "#5B2A9E", V: C.violet, l: C.lavender, w: "#FFF4FF", s: "#0B0C1E",
  r: C.rune[0], R: C.rune[1], W: C.rune[2], m: C.moss[1],
};
/** state: { eye: 0..2 brightness, runes: 0..1 phase, recoil, pupil } */
export function boss({ eye = 1, runes = 0, recoil = 0, charge = 0 } = {}) {
  const im = new Img(96, 96).palette(BO_PAL);
  const cx = 47.5 + recoil, cy = 44;
  // outer stone ring
  for (let y = 0; y < 96; y++)
    for (let x = 0; x < 96; x++) {
      const dx = x + 0.5 - cx, dy = (y + 0.5 - cy) * 1.05;
      const d = Math.hypot(dx, dy);
      if (d > 31 || d < 13) continue;
      let k = "2";
      const lit = (-dx - dy) / d;
      if (lit > 0.45) k = "3";
      if (lit > 0.8 && d > 26) k = "4";
      if (lit < -0.45) k = "1";
      if (d > 29.5) k = lit > 0.3 ? "2" : "0";
      if (d < 15) k = "0";
      // segment seams every 45°
      const a = Math.atan2(dy, dx);
      const seg = ((a / (Math.PI / 4)) % 1 + 1) % 1;
      if (seg < 0.03 && d > 16) k = "0";
      im.px(x, y, k);
    }
  // engraved runes on the ring, rotating with `runes`
  const glyphCol = charge ? "W" : "R";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + runes * (Math.PI / 6);
    const rx = cx + Math.cos(a) * 22.5, ry = cy + Math.sin(a) * 21.5;
    const t = i % 3;
    const c = i % 2 ? glyphCol : "r";
    if (t === 0) im.px(rx, ry - 1, c).px(rx, ry, c).px(rx, ry + 1, c).px(rx + 1, ry, c);
    else if (t === 1) im.px(rx - 1, ry, c).px(rx, ry, c).px(rx + 1, ry, c).px(rx, ry - 1, c);
    else im.px(rx - 1, ry - 1, c).px(rx, ry, c).px(rx + 1, ry + 1, c).px(rx - 1, ry + 1, c);
  }
  // moss on the top
  for (let i = 0; i < 9; i++) im.px(cx - 14 + i * 1.3, cy - 27 + Math.abs(i - 4) * 0.4 + (i % 2), "m");
  // central eye
  im.ellipse(cx - 0.5, cy - 0.5, 11, 10, "s");
  im.ellipse(cx - 0.5, cy - 0.5, 9, 8, "v");
  im.ellipse(cx - 0.5, cy - 0.5, 6.5 + eye * 0.5, 6 + eye * 0.5, "V");
  im.ellipse(cx - 0.5, cy - 0.5, 3.5 + eye * 0.5, 3.5 + eye * 0.5, eye >= 2 ? "w" : "l");
  im.rect(Math.round(cx - 1), Math.round(cy - 3), 2, 6, "s");                          // slit pupil
  if (eye >= 2) im.rect(Math.round(cx - 1), Math.round(cy - 2), 2, 4, "V");
  im.px(cx - 5, cy - 5, "w").px(cx - 4, cy - 5, "w").px(cx - 5, cy - 4, "w");
  // lid stones
  im.poly([cx - 13, cy - 9, cx - 2, cy - 14, cx + 11, cy - 10, cx + 7, cy - 12, cx - 3, cy - 13], "3");
  // under-hanging spikes (floating construct)
  im.poly([cx - 8, cy + 29, cx - 4, cy + 38, cx - 1, cy + 30], "1");
  im.poly([cx + 1, cy + 30, cx + 4, cy + 41, cx + 8, cy + 29], "2");
  im.outline("k");
  return im;
}
export const BOSS = {
  idle: [{ eye: 1, runes: 0 }, { eye: 1, runes: 0.25 }, { eye: 1.5, runes: 0.5 }, { eye: 1, runes: 0.75 }],
  charge: [{ eye: 2, runes: 0, charge: 1 }, { eye: 2, runes: 0.5, charge: 1 }],
  hurt: [{ eye: 0, recoil: -2 }],
};
export const BOSS_T = { idle: [180, 180, 180, 180], charge: [90, 90], hurt: [140] };

export function bossParts() {
  const hand = new Img(24, 24).palette(BO_PAL);
  // open stone palm, glowing core
  rock(hand, 11.5, 13, 7, 6.5);
  for (let i = 0; i < 4; i++) {
    const x = 6 + i * 3.3;
    rock(hand, x, 5.5 + Math.abs(i - 1.5), 1.6, 3.2);
  }
  rock(hand, 3.5, 14, 2, 3);
  hand.ellipse(11.5, 13, 3, 2.6, "V");
  hand.ellipse(11.5, 13, 1.4, 1.2, "w");
  hand.px(8, 17, "R").px(15, 17, "R").px(11, 18, "R");
  hand.outline("k");
  const frags = [0, 1, 2].map((i) => {
    const f = new Img(14, 14).palette(BO_PAL);
    rock(f, 6.5, 6.5, 3 + i, 2.5 + i * 0.7);
    f.px(6, 6, i === 1 ? "R" : "V");
    f.outline("k");
    return f;
  });
  const orb = [0, 1, 2, 3].map((i) => {
    const o = new Img(14, 14).palette(BO_PAL);
    o.circ(6.5, 6.5, 4.5, "v");
    o.circ(6.5, 6.5, 3.2, "V");
    o.circ(6 + (i % 2), 6 - (i > 1 ? 1 : 0), 1.5, "l");
    o.px(5, 5, "w");
    o.outline("k");
    return o;
  });
  return { hand, frags, orb };
}

// =================================================================== ELITES
/** recolour a frame set and add a 1px glowing rim outside the outline */
export function elite(frames, swap, rim) {
  return frames.map((f) => {
    const im = f.clone();
    if (swap) {
      const m = new Map(Object.entries(swap).map(([a, b]) => [im.col(a), im.col(b)]));
      im.map((x, y, v) => (m.has(v) ? m.get(v) : undefined));
    }
    im.outline(rim);
    return im;
  });
}
