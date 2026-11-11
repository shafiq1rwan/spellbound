// Enchanted ruined courtyard. Baked once into a 640x640 floor (layers 1-3); animated bits
// (glowing mushrooms, fading runes, grass tufts) are exported as positions for runtime overlays.
import { Img, rng, bayer, unpack, pack } from "./lib/px.mjs";
import { C } from "./palette.mjs";

export const FLOOR = 640;
const CX = 320, CY = 320, PLAZA = 136;

const PAL = {
  k: C.outline, m: C.mortar,
  0: C.floor[0], 1: C.floor[1], 2: C.floor[2], 3: C.floor[3], 4: C.floor[4],
  a: C.grass[0], b: C.grass[1], c: C.grass[2], d: C.grass[3],
  D: C.dirt[0], E: C.dirt[1], F: C.dirt[2],
  s: C.stone[0], t: C.stone[1], u: C.stone[2], v: C.stone[3], w: C.stone[4],
  M: C.moss[0], N: C.moss[1], O: C.moss[2],
  r: "#2A3866", R: "#3A4C88",
};

function darken(im, x, y, f) {
  const v = im.get(x, y);
  if (!(v >>> 24)) return;
  const [r, g, b, a] = unpack(v);
  // hue-shift shadows toward navy instead of pure black
  im.p[y * im.w + x] = pack(r * f + 23 * (1 - f) * 0.35, g * f + 27 * (1 - f) * 0.35, b * f + 53 * (1 - f) * 0.5, a);
}

function grassTuft(im, x, y, R) {
  const n = R.int(3, 5);
  for (let i = 0; i < n; i++) {
    const h = R.int(2, 4), dx = i - Math.floor(n / 2);
    const col = i % 2 ? "c" : "d";
    for (let j = 0; j < h; j++) im.px(x + dx + (j === h - 1 && dx !== 0 ? Math.sign(dx) : 0), y - j, j === h - 1 ? "d" : col);
  }
}

function pillarStump(im, x, y, R, broken = true) {
  // top-down 3/4: round top face + front cylinder face
  const r = R.int(9, 12), hgt = R.int(10, 16);
  // cast shadow to lower-right
  im.ellipse(x + 6, y + hgt + 3, r + 2, 4, "a");
  for (let j = 0; j <= hgt; j++)
    for (let i = -r; i <= r; i++) {
      const rel = (i + r) / (2 * r);
      const k = rel < 0.25 ? "v" : rel > 0.7 ? "t" : "u";
      im.px(x + i, y + j, (i + r) % 5 === 0 && j > 1 ? "t" : k);
    }
  im.ellipse(x - 0.5, y + hgt, r + 0.5, 3, "t", (px, py, nx, ny) => ny > 0);
  im.ellipse(x - 0.5, y, r + 0.5, 4, "v");
  im.ellipse(x - 0.5, y, r - 2, 2.6, "w");
  if (broken) {
    for (let i = 0; i < 6; i++) im.px(x - r + 3 + R.int(0, 2 * r - 6), y + R.int(-2, 1), "u");
    im.line(x - 3, y - 1, x + 2, y + 1, "t");
  }
  // moss creeping up
  for (let i = 0; i < r; i++) if (R() < 0.5) im.px(x - r + i * 2, y + hgt - R.int(0, 3), R() < 0.5 ? "N" : "M");
}

function rubble(im, x, y, R, n = 5) {
  for (let i = 0; i < n; i++) {
    const rx = x + R.int(-10, 10), ry = y + R.int(-6, 6), s = R.int(2, 4);
    im.ellipse(rx + 1, ry + 2, s, s * 0.6, "a");
    im.ellipse(rx, ry, s, s * 0.7, "u");
    im.px(rx - 1, ry - 1, "v");
    im.ellipse(rx + 0.5, ry + 1, s * 0.6, 0.6, "t");
  }
}

function wallSegment(im, x, y, w, R) {
  // low ruined wall: top face (lit) + front face with brick courses
  const hTop = 6, hFace = 12;
  im.rect(x + 3, y + hTop + hFace, w, 4, "a"); // shadow
  for (let i = 0; i < w; i++) {
    const crumble = Math.round(Math.sin(i * 0.35 + x) * 2 + (R() < 0.15 ? R.int(1, 4) : 0));
    const top = y + Math.max(0, crumble);
    for (let j = top; j < y + hTop; j++) im.px(x + i, j, j === top ? "w" : "v");
    for (let j = y + hTop; j < y + hTop + hFace; j++) {
      const row = Math.floor((j - y - hTop) / 4);
      const off = row % 2 ? 4 : 0;
      let k = "t";
      if ((j - y - hTop) % 4 === 3) k = "s";
      else if ((i + off) % 8 === 0) k = "s";
      else if ((j - y - hTop) % 4 === 0) k = "u";
      im.px(x + i, j, k);
    }
  }
  for (let i = 0; i < w; i += 3) if (R() < 0.6) im.px(x + i + R.int(0, 2), y + hTop + hFace - 1 - R.int(0, 2), R() < 0.5 ? "M" : "N");
}

export function mushroomSprite(R) {
  const im = new Img(7, 8).palette({
    k: C.outline, a: C.mushroom[0], b: C.mushroom[1], g: C.mushroom[2], G: C.mushroom[3], s: "#B8A9D9",
  });
  im.grid(0, 0, `
    .kkkkk.
    kgGgggk
    kgggGgk
    .kbbbk.
    ..kak..
    ..ksk..
    ..kak..`);
  return im;
}

function flower(im, x, y, kind) {
  const [d, l] = kind ? C.flowerC : C.flowerV;
  im.px(x, y + 1, C.grass[2]).px(x, y + 2, C.grass[2]);
  im.px(x - 1, y, d).px(x + 1, y, d).px(x, y - 1, d).px(x, y, l);
}

/** returns { img, decor: { mushrooms:[[x,y]], runes:[[x,y,i]], tufts:[[x,y]] } } (floor coords) */
export function buildFloor() {
  const R = rng(1337);
  const im = new Img(FLOOR, FLOOR).palette(PAL);
  const decor = { mushrooms: [], runes: [], tufts: [], flowers: [] };

  // ---- layer 1: dark ground with grass texture
  im.rect(0, 0, FLOOR, FLOOR, "b");
  for (let i = 0; i < 260; i++) {
    const x = R.int(0, FLOOR), y = R.int(0, FLOOR);
    im.ellipse(x, y, R.int(6, 22), R.int(3, 10), R() < 0.5 ? "a" : "E");
  }
  for (let i = 0; i < 2600; i++) {
    const x = R.int(0, FLOOR), y = R.int(0, FLOOR);
    if (Math.hypot(x - CX, y - CY) < PLAZA - 4) continue;
    grassTuft(im, x, y, R);
  }

  // ---- layer 2: paved plaza (staggered flagstones)
  const rowH = 12;
  for (let y0 = CY - PLAZA - rowH; y0 < CY + PLAZA + rowH; y0 += rowH) {
    const row = Math.round((y0 - CY) / rowH);
    let x0 = CX - PLAZA - 20 + ((row * 7) % 13);
    while (x0 < CX + PLAZA + 20) {
      const w = R.int(11, 20);
      const mx = x0 + w / 2, my = y0 + rowH / 2;
      const d = Math.hypot(mx - CX, (my - CY) * 1.0);
      const edge = PLAZA + Math.sin(Math.atan2(my - CY, mx - CX) * 5) * 8 + R.int(-6, 6);
      if (d < edge && !(d > PLAZA - 30 && R() < 0.04)) {
        const tone = R() < 0.4 ? 1 : R() < 0.1 ? 3 : 2;
        const base = String(tone), hi = String(Math.min(4, tone + 1)), lo = String(tone - 1);
        for (let j = 0; j < rowH - 1; j++)
          for (let i = 0; i < w - 1; i++) {
            let k = base;
            if (j === 0 && (x0 + y0) % 3 !== 0) k = hi;
            if (j === rowH - 2 || i === w - 2) k = lo;
            im.px(x0 + i, y0 + j, k);
          }
        // weathering: cracks from a corner, moss in joints toward the rim
        if (R() < 0.16) {
          let cx = x0 + R.int(1, w - 3), cy = y0 + 1;
          for (let s = 0; s < R.int(4, 9); s++) { im.px(cx, cy, "0"); cx += R.int(-1, 1); cy += 1; if (cy > y0 + rowH - 3) break; }
        }
        if (d > PLAZA - 50 && R() < 0.5) {
          for (let i = 0; i < w; i++) if (R() < 0.35) im.px(x0 + i, y0 + rowH - 1, R() < 0.5 ? "M" : "N");
        }
        // mortar lines
        im.hline(x0, y0 + rowH - 1, w, "m");
        im.vline(x0 + w - 1, y0, rowH, "m");
      } else if (d < edge + 26 && R() < 0.35) {
        // loose broken stones scattered beyond the edge
        const s = R.int(3, 6);
        im.rect(x0 + 2, y0 + 3, s + 1, s - 1, "m");
        im.rect(x0 + 1, y0 + 2, s, s - 1, R() < 0.5 ? "2" : "1");
        im.hline(x0 + 1, y0 + 2, s, "3");
      }
      x0 += w;
    }
  }

  // ---- inlaid rune circle under the wizard
  const ringAt = (r0, r1, k) => {
    for (let y = CY - r1 - 1; y <= CY + r1 + 1; y++)
      for (let x = CX - r1 - 1; x <= CX + r1 + 1; x++) {
        const d = Math.hypot(x + 0.5 - CX, y + 0.5 - CY);
        if (d >= r0 && d < r1) im.px(x, y, k);
      }
  };
  ringAt(0, 52, "1");
  ringAt(44, 52, "3");
  ringAt(45, 51, "2");
  ringAt(52, 53, "m");
  ringAt(43, 44, "m");
  ringAt(28, 29, "0");
  // inner disc: radial slabs
  for (let y = CY - 43; y <= CY + 43; y++)
    for (let x = CX - 43; x <= CX + 43; x++) {
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY, d = Math.hypot(dx, dy);
      if (d >= 43 || d < 29) continue;
      const a = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2);
      if (Math.abs(((a * 12) % 1) - 0.5) > 0.47) im.px(x, y, "m");
      else if (d < 31) im.px(x, y, "2");
    }
  // carved glyph sockets in the band (they glow at runtime)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const gx = Math.round(CX + Math.cos(a) * 48), gy = Math.round(CY + Math.sin(a) * 48);
    im.rect(gx - 2, gy - 2, 5, 5, "1");
    im.ring(gx, gy, 2, "0");
    decor.runes.push([gx, gy, i % 4]);
  }
  // star in the centre
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    im.line(CX, CY, CX + Math.cos(a) * 26, CY + Math.sin(a) * 26, "0");
  }
  im.ring(CX, CY, 6, "0");

  // ---- layer 3: ruins & props near the edges (keep the centre clear)
  const ringPos = (rMin, rMax) => {
    for (;;) {
      const a = R() * Math.PI * 2, r = R.range(rMin, rMax);
      const x = Math.round(CX + Math.cos(a) * r), y = Math.round(CY + Math.sin(a) * r);
      if (x > 20 && y > 20 && x < FLOOR - 30 && y < FLOOR - 30) return [x, y];
    }
  };
  // ruined wall arcs in the corners
  [[40, 54, 130], [470, 40, 120], [30, 560, 110], [480, 566, 130], [70, 300, 60], [530, 300, 70]].forEach(([x, y, w]) => wallSegment(im, x, y, w, R));
  // pillars around the plaza rim
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const r = PLAZA + 34 + (i % 2) * 18;
    pillarStump(im, Math.round(CX + Math.cos(a) * r), Math.round(CY + Math.sin(a) * r) - 8, R, true);
  }
  for (let i = 0; i < 22; i++) { const [x, y] = ringPos(PLAZA + 8, 300); rubble(im, x, y, R, R.int(2, 6)); }
  for (let i = 0; i < 5; i++) { const [x, y] = ringPos(PLAZA - 30, PLAZA - 4); rubble(im, x, y, R, R.int(1, 2)); }
  // mushrooms (glow added at runtime) in clusters
  const mush = mushroomSprite(R);
  for (let i = 0; i < 12; i++) {
    const [x, y] = ringPos(PLAZA + 10, 290);
    for (let j = 0; j < R.int(2, 4); j++) {
      const mx = x + R.int(-8, 8), my = y + R.int(-5, 5);
      im.stamp(mush, mx, my);
      decor.mushrooms.push([mx + 3, my + 2]);
    }
  }
  for (let i = 0; i < 70; i++) { const [x, y] = ringPos(PLAZA + 4, 310); flower(im, x, y, R() < 0.4 ? 1 : 0); }
  for (let i = 0; i < 40; i++) decor.tufts.push(ringPos(PLAZA - 8, 230));

  // ---- vignette: darken toward the outside, dithered steps (keeps pixel look)
  for (let y = 0; y < FLOOR; y++)
    for (let x = 0; x < FLOOR; x++) {
      const d = Math.hypot(x - CX, y - CY);
      const t = Math.min(1, Math.max(0, (d - 150) / 210));
      if (t <= 0) continue;
      const q = Math.floor(t * 4 + bayer(x, y)) / 4;
      if (q > 0) darken(im, x, y, 1 - q * 0.45);
    }
  return { img: im, decor };
}

// ---------------------------------------------------------------- small env sprites
export function envSprites() {
  const out = {};
  // grass tuft for shockwave sway (origin bottom-centre)
  const tuft = new Img(9, 8).palette({ c: C.grass[2], d: C.grass[3], e: "#4B6E62" });
  tuft.grid(0, 0, `
    ....e....
    .e..d..e.
    .d.cd.d..
    ..dcdcd..
    .ccdcdcc.
    ..cdcdc..`);
  out.tuft = tuft;
  // glowing rune glyphs (4 shapes)
  const glyphs = [
    `..x..\n.x.x.\nx...x\nxxxxx`,
    `.xxx.\nx...x\nx.x.x\n.xxx.`,
    `x..x.\n.x..x\nx..x.\n.x..x`,
    `xxxx.\n...x.\n.x.x.\n.xxx.`,
  ];
  out.glyphs = glyphs.map((g) => {
    const im = new Img(7, 7).palette({ x: C.rune[2] });
    im.grid(1, 1, g);
    return im;
  });
  out.mushroom = mushroomSprite();
  return out;
}
