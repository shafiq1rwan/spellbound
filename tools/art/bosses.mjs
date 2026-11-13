// Chapter bosses (see ROADMAP.md, "Chapters"). Concept art for review: not wired into build.mjs yet.
//   Rime Queen  — Frozen Ruins (waves 11–20)
//   Cinder Maw  — Ember Wastes (waves 21–30)
//   Void Weaver — Astral Void  (waves 31–40)
// 96×96 frames like the Ancient Guardian, same outline colour, lit from the top-left.
// Every frame is a function of a few pose parameters, so animations are lists of poses.
import { Img, rng, mix, unpack, pack, rgba, bayer } from "./lib/px.mjs";
import { C } from "./palette.mjs";

const K = C.outline;
const W = 96, H = 96;
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ shared helpers
/** ellipse shaded with a dark→light ramp of palette keys, lit from the top-left */
function litEllipse(im, cx, cy, rx, ry, ramp, where) {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const nx = (x + 0.5 - (cx + 0.5)) / rx, ny = (y + 0.5 - (cy + 0.5)) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1 || (where && !where(x, y, nx, ny))) continue;
      const lit = -nx * 0.6 - ny * 0.8;
      let k = lit > 0.55 ? ramp.length - 1 : lit > 0.1 ? ramp.length - 2 : lit < -0.45 ? 0 : 1;
      if (d > 0.8 && lit < 0.15) k = 0;
      im.px(x, y, ramp[Math.max(0, Math.min(ramp.length - 1, k))]);
    }
}
/** soft additive light blob (also glows over transparent pixels) */
function glowDot(im, x, y, r, c, k) {
  for (let j = -Math.ceil(r); j <= Math.ceil(r); j++)
    for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) {
      const d = Math.hypot(i, j);
      if (d <= r) im.add(x + i, y + j, c, k * (1 - d / r));
    }
}
/** push every opaque pixel toward white (hit flash) */
export function flash(src, t) {
  const im = src.clone();
  const wh = rgba("#FFFFFF");
  return im.map((x, y, v) => {
    if (!(v >>> 24)) return undefined;
    const [r, g, b] = unpack(mix(v, wh, t));
    return pack(r, g, b, v >>> 24);
  });
}
/**
 * Break a frame into 3×3 chunks for death animations.
 * shatter: chunks fly outward and fall (ice); crumble: chunks drop top-first and turn to ash (stone);
 * implode: chunks are sucked into the centre (void).
 */
export function disintegrate(src, t, mode, seed = 7) {
  const out = new Img(src.w, src.h);
  out.pal = src.pal;
  const r = rng(seed);
  const B = 3, cx = src.w / 2, cy = src.h / 2 - 4;
  const tint = rgba(mode === "shatter" ? "#E4FCFF" : mode === "crumble" ? "#2A1E24" : "#E0A0FF");
  for (let by = 0; by < src.h; by += B)
    for (let bx = 0; bx < src.w; bx += B) {
      const rr = r(), ra = r(), rs = r();
      let any = false;
      for (let j = 0; j < B && !any; j++) for (let i = 0; i < B; i++) if (src.alpha(bx + i, by + j)) { any = true; break; }
      if (!any) continue;
      const delay = mode === "crumble" ? (by / src.h) * 0.3 + rr * 0.15 : rr * 0.3;
      const u = Math.max(0, Math.min(1, (t - delay) / (1 - delay)));
      if (u >= 0.92) continue;
      const ox = bx + B / 2 - cx, oy = by + B / 2 - cy, od = Math.hypot(ox, oy) || 1;
      let dx, dy;
      if (mode === "shatter") { const sp = 16 + rs * 26; dx = (ox / od) * sp * u + (ra - 0.5) * 8 * u; dy = (oy / od) * sp * u + 36 * u * u; }
      else if (mode === "crumble") { dx = (ra - 0.5) * 16 * u; dy = 44 * u * u * (0.6 + rs * 0.6); }
      else { const k = Math.min(1, u * u * 1.2); dx = -ox * k; dy = -oy * k; }
      const fade = u > 0.5 ? (u - 0.5) / 0.42 : 0;
      const tk = mode === "crumble" ? u * 0.85 : u * 0.6;
      for (let j = 0; j < B; j++)
        for (let i = 0; i < B; i++) {
          const v = src.get(bx + i, by + j);
          if (!(v >>> 24)) continue;
          const X = Math.round(bx + i + dx), Y = Math.round(by + j + dy);
          if (!out.inb(X, Y) || bayer(X, Y) < fade) continue;
          const [R, G, Bc] = unpack(mix(v, tint, tk));
          out.p[Y * out.w + X] = pack(R, G, Bc, v >>> 24);
        }
    }
  return out;
}
/** four-point star */
function star(im, x, y, s, core, arm) {
  im.px(x, y, core);
  for (let i = 1; i <= s; i++) { im.px(x + i, y, arm); im.px(x - i, y, arm); im.px(x, y + i, arm); im.px(x, y - i, arm); }
  if (s >= 2) { im.px(x + 1, y + 1, arm); im.px(x - 1, y - 1, arm); im.px(x + 1, y - 1, arm); im.px(x - 1, y + 1, arm); }
}

// ================================================================== RIME QUEEN (frost)
const FR_PAL = {
  k: K, s: "#0B0C1E",
  0: "#141F45", 1: "#1F3468", 2: "#2F5294", 3: "#4A7BC0",          // robe, deep → light
  a: C.crystalIce[0], b: C.crystalIce[1], c: C.crystalIce[2], d: "#FFFFFF", e: C.iceCyan,
};
/**
 * ph 0..1 loop phase · raise 0..1 arms up (casting) · thrust 0..1 claws slam forward
 * eye 0..2 · glow 0..1 frost charge · recoil px
 */
export function rimeQueen({ ph = 0, raise = 0, thrust = 0, eye = 1, glow = 0, recoil = 0 } = {}) {
  const im = new Img(W, H).palette(FR_PAL);
  const bob = Math.round(Math.sin(ph * TAU) * 1.5);
  const cx = 48 + recoil, top = 12 + bob;
  const sh = top + 30, hemY = top + 66;

  // orbiting ice shards (the back half of the orbit is drawn behind her)
  const shard = (x, y, s) => {
    im.poly([x, y - 5 * s, x + 2.5 * s, y, x, y + 4 * s, x - 2.5 * s, y], "b");
    im.poly([x, y - 5 * s, x, y + 4 * s, x - 2.5 * s, y], "c");
    im.px(x - 1, y - 2 * s, "d");
  };
  const orbit = [0, 1, 2].map((i) => {
    const a = ph * TAU + (i * TAU) / 3;
    return { x: cx + Math.cos(a) * 31, y: top + 46 + Math.sin(a) * 8, front: Math.sin(a) > 0 };
  });
  orbit.filter((o) => !o.front).forEach((o) => shard(o.x, o.y, 1.15));

  // ghostly wisps trailing under the hem
  for (let i = 0; i < 4; i++) {
    const x0 = cx - 9 + i * 6;
    for (let t = 0; t < 14; t++) {
      const x = x0 + Math.sin(ph * TAU + i * 1.7 + t * 0.45) * (1 + t * 0.25);
      const a = 1 - t / 14;
      im.blend(x, hemY - 2 + t, t < 5 ? "2" : "1", a);
      if (t < 8) im.blend(x + 1, hemY - 2 + t, "1", a * 0.8);
    }
  }

  // robe: shoulders → flared jagged hem that ripples
  const hem = [];
  for (let i = 0; i <= 9; i++) hem.push(cx + 15 - (i * 30) / 9, hemY + (i % 2 ? 3 : 0) + Math.sin(ph * TAU + i) * 1.2);
  im.poly([cx - 18, sh, cx + 18, sh, cx + 16, sh + 18, ...hem, cx - 16, sh + 18], "1");
  im.line(cx - 16, sh + 3, cx - 14, hemY - 2, "2");
  im.line(cx - 15, sh + 6, cx - 13, hemY - 3, "2");
  im.line(cx - 6, sh + 8, cx - 8, hemY - 1, "0");
  im.line(cx + 6, sh + 8, cx + 8, hemY - 1, "0");
  im.line(cx + 13, sh + 4, cx + 14, hemY - 2, "0");
  im.line(cx - 2, sh + 10, cx - 3, hemY - 2, "2");
  for (let i = 0; i < hem.length; i += 2) im.px(hem[i], hem[i + 1] - 1, i % 4 ? "b" : "c");
  // crystal brooch
  im.poly([cx, sh + 4, cx + 3, sh + 8, cx, sh + 12, cx - 3, sh + 8], "b");
  im.poly([cx, sh + 4, cx, sh + 12, cx - 3, sh + 8], "c");
  im.px(cx - 1, sh + 7, "d");

  // icy mantle along the shoulders
  for (let i = -4; i <= 4; i++) {
    const x = cx + i * 4.4, y = sh + Math.abs(i) * 0.7;
    im.poly([x - 2.2, y + 2, x, y - 4 - (i % 2 ? 0 : 2), x + 2.2, y + 2], i < 0 ? "c" : "b");
  }

  // arms: hanging → raised overhead (cast) or slammed forward (attack)
  for (const side of [-1, 1]) {
    const sx = cx + side * 16, sy = sh + 3;
    const hx = cx + side * (22 + raise * 6 - thrust * 10), hy = sh + 24 - raise * 46 + thrust * 10;
    im.line(sx, sy, hx, hy, "1", 6);
    im.line(sx, sy - 1, hx, hy - 1, side < 0 ? "2" : "1", 2);
    im.circ(hx, hy, 3.2, "b");
    im.px(hx - 1, hy - 1, "c");
    const dir = Math.atan2(hy - sy, hx - sx);
    for (const off of [-0.55, 0, 0.55]) {
      const a = dir + off, L = off ? 5 : 7;
      im.line(hx + Math.cos(a) * 2, hy + Math.sin(a) * 2, hx + Math.cos(a) * L, hy + Math.sin(a) * L, "c", 2);
      im.px(hx + Math.cos(a) * (L + 1), hy + Math.sin(a) * (L + 1), "d");
    }
  }

  // hood with a void for a face
  litEllipse(im, cx, top + 17, 14, 16, ["1", "2", "3", "3"]);
  im.ellipse(cx, top + 19, 9.5, 10.5, "0");
  im.ellipse(cx, top + 20, 8.5, 9.5, "s");

  // crystal crown on the hood
  const hs = [6, 9, 13, 9, 6];
  [-10, -5, 0, 5, 10].forEach((dx, i) => {
    const x = cx + dx, base = top + 6 + Math.abs(dx) * 0.25, h = hs[i] * (1 + glow * 0.15);
    im.poly([x, base - h, x + 2.6, base - h * 0.4, x, base + 1, x - 2.6, base - h * 0.4], glow > 0.5 ? "c" : "b");
    im.poly([x, base - h, x, base + 1, x - 2.6, base - h * 0.4], glow > 0.5 ? "d" : "c");
    im.px(x, base - h + 1, "d");
  });

  // eyes in the void
  const ey = top + 20, ek = eye >= 2 ? "d" : "e";
  im.px(cx - 5, ey - 1, ek).px(cx - 4, ey, ek).px(cx - 3, ey, ek);
  im.px(cx + 2, ey, ek).px(cx + 3, ey, ek).px(cx + 4, ey - 1, ek);
  if (eye >= 1.5) im.px(cx - 4, ey - 1, ek).px(cx + 3, ey - 1, ek);

  orbit.filter((o) => o.front).forEach((o) => shard(o.x, o.y, 1.15));
  im.outline("k");

  // light pass (after the outline so glows stay soft)
  glowDot(im, cx - 4, ey, 4, "e", 0.25 + eye * 0.12);
  glowDot(im, cx + 3, ey, 4, "e", 0.25 + eye * 0.12);
  const sp = Math.floor(ph * 5) % 5;
  const sx = cx + [-10, -5, 0, 5, 10][sp], sy = top + 6 - hs[sp] + 1;
  star(im, sx, sy, 2, "d", "c");
  if (glow > 0)
    for (const side of [-1, 1]) {
      const hx = cx + side * (22 + raise * 6 - thrust * 10), hy = sh + 24 - raise * 46 + thrust * 10;
      glowDot(im, hx, hy, 6 + glow * 4, "e", 0.35 * glow);
    }
  return im;
}
export const RIME = {
  idle: [0, 1, 2, 3, 4, 5].map((i) => ({ ph: i / 6 })),
  cast: [0.3, 0.6, 0.9, 1].map((r, i) => ({ ph: i / 8, raise: r, glow: r, eye: 1 + r })),
  slam: [{ ph: 0.5, thrust: 0.6, glow: 1, eye: 2 }, { ph: 0.55, thrust: 1, glow: 0.7, eye: 2 }, { ph: 0.6, thrust: 1, glow: 0.3, eye: 1.5 }],
};
export const RIME_T = { idle: [150, 150, 150, 150, 150, 150], cast: [120, 120, 120, 300], slam: [80, 260, 200], hurt: [90, 120], death: [200, 110, 110, 110, 110, 130, 160] };
export function rimeAnims() {
  const f = (p) => rimeQueen(p);
  const base = f({ ph: 0 });
  return {
    idle: RIME.idle.map(f), cast: RIME.cast.map(f), slam: RIME.slam.map(f),
    hurt: [flash(f({ ph: 0, recoil: -2, eye: 0 }), 0.75), f({ ph: 0, recoil: -1, eye: 0 })],
    death: [flash(base, 0.5), ...[0.12, 0.28, 0.45, 0.62, 0.8, 0.95].map((t) => disintegrate(base, t, "shatter", 11))],
  };
}
/** signature projectile: a falling icicle with a travelling glint (16×16, 4 frames) */
export function icicle(i) {
  const im = new Img(16, 16).palette(FR_PAL);
  im.poly([8, 1, 11, 6, 8, 15, 5, 6], "b");
  im.poly([8, 1, 8, 15, 5, 6], "c");
  im.line(8, 3, 8, 13, "a");
  im.outline("k");
  im.px(7, 3 + i * 3, "d");
  glowDot(im, 8, 13, 3, "e", 0.4);
  return im;
}

// ================================================================== CINDER MAW (fire)
const EM_PAL = {
  k: K, s: "#0B0C1E",
  0: "#140E1C", 1: "#241A2E", 2: "#3A2A44", 3: "#56405E",          // obsidian
  a: C.crystalFire[0], b: C.crystalFire[1], c: C.crystalFire[2], d: C.crystalFire[3],
  h: "#2A1E24", i: "#5A3E36", j: "#8A6A52", t: "#B9A68C",          // horn, teeth
};
const FLAME = ["a", "b", "c", "d"];
/**
 * ph loop phase · jaw 0..1.2 mouth open · heat 0..1 charge (flames taller, cracks brighter)
 * breath 0|1 fire jet from the mouth · eye 0..2 · recoil px
 */
export function cinderMaw({ ph = 0, jaw = 0, heat = 0, breath = 0, eye = 1, recoil = 0 } = {}) {
  const im = new Img(W, H).palette(EM_PAL);
  const bob = Math.round(Math.sin(ph * TAU) * 1.5);
  const cx = 48 + recoil, cy = 44 + bob;
  const pulse = 0.5 + 0.5 * Math.sin(ph * TAU * 2);

  // crown of fire (behind the skull top)
  const hs = [14, 21, 29, 21, 14];
  [-12, -6, 0, 6, 12].forEach((dx, i) => {
    const x = cx + dx, base = cy - 15 + Math.abs(dx) * 0.2;
    const h = hs[i] * (0.8 + 0.25 * Math.sin(ph * TAU * 2 + i * 1.3)) * (1 + heat * 0.45);
    const sway = Math.sin(ph * TAU + i) * 2;
    const tongue = (k, s) => im.poly([x - 4 * s, base, x - 3 * s, base - h * 0.45 * s, x + sway * s, base - h * s, x + 3 * s, base - h * 0.45 * s, x + 4 * s, base], k);
    tongue("a", 1);
    tongue("b", 0.72);
    tongue("c", 0.45);
    if (i === 2 || heat > 0.5) tongue("d", 0.22);
  });

  // curled horns
  for (const side of [-1, 1]) {
    // cubic curve: out from the temple, sweeping up, tip hooking back in
    const P = [[cx + side * 14, cy - 8], [cx + side * 33, cy - 6], [cx + side * 37, cy - 27], [cx + side * 25, cy - 38]];
    const at = (t) => [0, 1].map((k) => (1 - t) ** 3 * P[0][k] + 3 * (1 - t) ** 2 * t * P[1][k] + 3 * (1 - t) * t * t * P[2][k] + t ** 3 * P[3][k]);
    for (let t = 0; t <= 1; t += 0.02) {
      const [x, y] = at(t), r = 5.2 * (1 - t) + 0.6;
      im.circ(x, y, r, t > 0.82 ? "t" : t > 0.6 ? "j" : "i");
    }
    // shading: dark outer edge, light inner edge, growth ridges
    for (let t = 0; t <= 0.8; t += 0.02) {
      const [x, y] = at(t), r = 5.2 * (1 - t) + 0.6;
      im.px(x + side * (r - 0.5), y + 0.5, "h");
      if (r > 1.6) im.px(x - side * (r - 1), y - 1, "j");
      if (Math.round(t * 100) % 14 === 0 && r > 2) im.line(x - r + 1, y, x + r - 1, y, "h");
    }
  }

  // skull
  litEllipse(im, cx, cy, 22, 19, ["0", "1", "2", "3"]);
  im.poly([cx - 16, cy + 8, cx + 16, cy + 8, cx + 12, cy + 17, cx - 12, cy + 17], "2");
  im.poly([cx + 2, cy + 8, cx + 16, cy + 8, cx + 12, cy + 17, cx + 2, cy + 17], "1");
  im.line(cx - 15, cy - 5, cx - 4, cy - 3, "3");
  im.line(cx + 4, cy - 3, cx + 15, cy - 5, "2");
  for (const side of [-1, 1]) im.ellipse(cx + side * 9, cy + 1, 6, 5, "s");
  im.poly([cx - 2.5, cy + 8, cx + 2.5, cy + 8, cx, cy + 12], "s");

  // magma cracks pulse with the heartbeat
  const ck = heat > 0.5 || pulse > 0.6 ? "c" : "b";
  for (const path of [[-4, -17, -2, -11, -6, -6], [10, -15, 12, -9, 17, -5], [-15, -11, -19, -4], [3, -18, 1, -12], [-12, 12, -9, 15]])
    for (let i = 2; i < path.length; i += 2) im.line(cx + path[i - 2], cy + path[i - 1], cx + path[i], cy + path[i + 1], ck);

  // burning eyes
  const er = 1.8 + eye * 0.6;
  for (const side of [-1, 1]) {
    im.ellipse(cx + side * 9, cy + 1, er, er, "b");
    im.ellipse(cx + side * 9, cy + 1, er * 0.55, er * 0.55, eye >= 2 ? "d" : "c");
  }

  // mouth: upper teeth, molten throat, hinged jaw
  const jy = cy + 19 + jaw * 10;
  if (jaw > 0)
    for (let y = cy + 17; y < jy; y++) {
      const k = (y - (cy + 17)) / Math.max(1, jy - cy - 17);
      im.hline(cx - 10, y, 21, k < 0.35 ? "d" : k < 0.7 ? "c" : "b");
    }
  for (let x = cx - 10; x <= cx + 9; x += 3) im.rect(x, cy + 16, 2, 3, "t");
  im.poly([cx - 13, jy, cx + 13, jy, cx + 9, jy + 9, cx - 9, jy + 9], "2");
  im.poly([cx + 1, jy, cx + 13, jy, cx + 9, jy + 9, cx + 1, jy + 9], "1");
  im.line(cx - 8, jy + 8, cx - 2, jy + 8, "3");
  for (let x = cx - 9; x <= cx + 8; x += 3) im.rect(x, jy - 2, 2, 3, "t");
  for (const side of [-1, 1]) im.circ(cx + side * 14, cy + 17 + jaw * 4, 1.6, "1");

  // lava drips from the jaw
  [-6, 5].forEach((dx, i) => {
    const len = 2 + Math.round(5 * ((ph * 2 + i * 0.5) % 1));
    im.vline(cx + dx, jy + 9, len, "b");
    im.px(cx + dx, jy + 9 + len, "c");
  });

  im.outline("k", { skip: FLAME });

  // light pass: embers, eye glow, throat glow, breath
  const r = rng(5);
  for (let i = 0; i < 7; i++) {
    const s = r(), s2 = r();
    const y = cy - 18 - ((ph + s) % 1) * 30, x = cx + (s2 - 0.5) * 46 + Math.sin(ph * TAU + i) * 2;
    im.px(x, y, i % 3 ? "c" : "d");
  }
  for (const side of [-1, 1]) glowDot(im, cx + side * 9, cy + 1, 5 + eye, "b", 0.25 + eye * 0.1);
  if (jaw > 0.2) glowDot(im, cx, cy + 18 + jaw * 5, 8 + jaw * 4, "c", 0.3 + heat * 0.2);
  if (breath) {
    const y0 = cy + 18 + jaw * 5;
    for (let y = y0; y < H; y++) {
      const d = y - y0;
      const w = 3 + d * 0.55 + Math.sin(d * 0.7 + ph * TAU * 3) * 1.5;
      [[1, "a"], [0.72, "b"], [0.45, "c"], [0.18, "d"]].forEach(([k, c]) => im.hline(Math.round(cx - w * k), y, Math.round(w * k * 2) + 1, c));
    }
  }
  return im;
}
export const MAW = {
  idle: [0, 1, 2, 3, 4, 5].map((i) => ({ ph: i / 6 })),
  charge: [0.25, 0.5, 0.75, 1].map((h, i) => ({ ph: i / 8, jaw: h * 0.5, heat: h, eye: 1 + h })),
  breath: [0, 1, 2, 3].map((i) => ({ ph: i / 4, jaw: 1.1, heat: 1, breath: 1, eye: 2 })),
};
export const MAW_T = { idle: [140, 140, 140, 140, 140, 140], charge: [150, 150, 150, 250], breath: [70, 70, 70, 70], hurt: [90, 120], death: [200, 110, 110, 110, 120, 140, 180] };
export function mawAnims() {
  const f = (p) => cinderMaw(p);
  const base = f({ ph: 0, heat: 0 });
  return {
    idle: MAW.idle.map(f), charge: MAW.charge.map(f), breath: MAW.breath.map(f),
    hurt: [flash(f({ ph: 0, recoil: -2, eye: 0, jaw: 0.2 }), 0.75), f({ ph: 0, recoil: -1, eye: 0 })],
    death: [flash(f({ ph: 0, jaw: 0.6, eye: 0 }), 0.5), ...[0.12, 0.28, 0.45, 0.62, 0.8, 0.95].map((t) => disintegrate(base, t, "crumble", 23))],
  };
}
/** signature projectile: a molten rock with a flame tail (16×16, 4 frames) */
export function magmaRock(i) {
  const im = new Img(16, 16).palette(EM_PAL);
  const fl = [[8, 2], [6, 3], [10, 3], [8, 4]];
  for (let k = 0; k < 4; k++) im.circ(fl[(k + i) % 4][0], fl[(k + i) % 4][1] + 1, 2 - k * 0.4, FLAME[3 - k]);
  litEllipse(im, 8, 10, 5, 4.5, ["0", "1", "2", "3"]);
  const a = (i / 4) * TAU;
  im.line(8 + Math.cos(a) * 3, 10 + Math.sin(a) * 3, 8 - Math.cos(a) * 2, 10 - Math.sin(a) * 2, "b");
  im.px(8, 10, "c");
  im.outline("k", { skip: FLAME });
  glowDot(im, 8, 9, 6, "b", 0.3);
  return im;
}

// ================================================================== VOID WEAVER (arcane)
const AS_PAL = {
  k: K,
  0: "#0B0C1E", 1: "#1C1440", 2: "#2E1F66", 3: "#4A33A0",          // void
  a: C.crystalArcane[0], b: C.crystalArcane[1], c: C.crystalArcane[2], d: C.crystalArcane[3],
  w: C.white, g: C.gold[2], e: C.iceCyan,
};
/**
 * ph loop phase · open 0..1 eye · flare 0..1 tendrils spread wide (attack) · glow 0..1 charge · recoil px
 */
export function voidWeaver({ ph = 0, open = 0.6, flare = 0, glow = 0, recoil = 0 } = {}) {
  const im = new Img(W, H).palette(AS_PAL);
  const pulse = Math.sin(ph * TAU);
  const cx = 48 + recoil, cy = 30 + Math.round(pulse);
  const rx = 26 + pulse * 1.2, ry = 21 - pulse * 1.2;

  const orbit = [0, 1, 2].map((i) => {
    const a = ph * TAU + (i * TAU) / 3;
    return { x: cx + Math.cos(a) * 39, y: cy + 12 + Math.sin(a) * 9, front: Math.sin(a) > 0, big: i === 0 };
  });
  orbit.filter((o) => !o.front).forEach((o) => star(im, o.x, o.y, o.big ? 3 : 2, "w", "g"));

  // tendrils
  const tips = [];
  for (let i = 0; i < 7; i++) {
    const x0 = cx - 19 + i * 6.3, y0 = cy + 4, L = 48 - Math.abs(i - 3) * 4;
    let last = [x0, y0];
    for (let s = 0; s <= L; s++) {
      const t = s / L;
      const x = x0 + Math.sin(ph * TAU + i * 0.9 - t * 4) * (1.5 + t * 4) + (x0 - cx) * t * (0.25 + flare * 0.9);
      const y = y0 + s * (1 - flare * 0.25);
      const w = 3.2 * (1 - t) + 1;
      im.circ(x, y, (w - 1) / 2, "a");
      im.px(x, y, t < 0.7 ? "b" : "c");
      if (s % 7 === 3 && t < 0.8) im.px(x, y, "c");
      last = [x, y];
    }
    tips.push(last);
  }

  // the bell: starry dome
  const inDome = (x, y) => {
    const nx = (x + 0.5 - (cx + 0.5)) / rx, ny = (y + 0.5 - (cy + 0.5)) / ry;
    return nx * nx + ny * ny <= 1 && y <= cy + 3;
  };
  litEllipse(im, cx, cy, rx, ry, ["1", "2", "3", "3"], (x, y) => y <= cy + 3);
  for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
    for (const dy of [0, 1]) {
      const y = Math.round(cy - 5 + Math.sin(x * 0.16 + ph * TAU) * 3) + dy;
      if (inDome(x, y)) im.blend(x, y, dy ? "a" : "b", 0.45);
    }
  const sr = rng(11);
  for (let i = 0; i < 30; i++) {
    const x = cx + (sr() - 0.5) * rx * 2, y = cy - ry + sr() * (ry + 3), k = sr();
    if (!inDome(Math.round(x), Math.round(y))) continue;
    if ((i + Math.floor(ph * 6)) % 4 === 0) continue;
    im.px(x, y, k < 0.5 ? "w" : k < 0.8 ? "c" : "e");
  }

  // scalloped skirt with glowing beads
  for (let i = 0; i <= 8; i++) {
    const sx = cx - 24 + i * 6, sy = cy + 4 + Math.sin(ph * TAU + i) * 0.8;
    im.circ(sx, sy, 3.4, "b");
    im.circ(sx, sy - 1, 2.2, "c");
  }
  for (let i = 0; i <= 8; i++) im.px(cx - 24 + i * 6, cy + 8 + Math.sin(ph * TAU + i) * 0.8, "d");

  // the eye
  const ex = cx, ey = cy - 3;
  if (open < 0.15) {
    im.line(ex - 9, ey, ex + 9, ey, "c");
    for (const dx of [-6, -2, 2, 6]) im.px(ex + dx, ey + 1, "c");
  } else {
    im.ellipse(ex, ey, 10, 6 * open + 1, "1");
    im.ellipse(ex, ey, 9, 6 * open, "d");
    const ir = Math.min(4.4, 5 * open + 0.4);
    im.circ(ex, ey, ir, "a");
    im.circ(ex, ey, ir - 1, "b");
    im.rect(ex, Math.round(ey - ir + 1), 1, Math.max(1, Math.round(ir * 2 - 1)), "0");
    im.px(ex - 2, ey - 2, "w");
  }

  orbit.filter((o) => o.front).forEach((o) => star(im, o.x, o.y, o.big ? 3 : 2, "w", "g"));
  im.outline("k");

  // light pass
  for (const [x, y] of tips) glowDot(im, x, y, 3, "c", 0.5);
  glowDot(im, cx, cy + 6, 12, "b", 0.12 + glow * 0.25);
  if (glow > 0) glowDot(im, ex, ey, 8 + glow * 6, "c", 0.4 * glow);
  return im;
}
export const WEAVER = {
  idle: [0.6, 0.6, 0.6, 0.1, 0.6, 0.6].map((o, i) => ({ ph: i / 6, open: o })),
  charge: [0.25, 0.5, 0.75, 1].map((g, i) => ({ ph: i / 8, open: 0.6 + g * 0.4, glow: g, flare: g * 0.2 })),
  attack: [{ ph: 0.5, open: 1, glow: 1, flare: 0.6 }, { ph: 0.55, open: 1, glow: 1, flare: 1 }, { ph: 0.6, open: 1, glow: 0.5, flare: 0.6 }],
};
export const WEAVER_T = { idle: [160, 160, 160, 120, 160, 160], charge: [140, 140, 140, 260], attack: [80, 240, 160], blink: [80, 80, 80, 80, 120, 80, 80, 80], hurt: [90, 120], death: [200, 120, 120, 120, 140, 160, 200] };
export function weaverAnims() {
  const f = (p) => voidWeaver(p);
  const base = f({ ph: 0, open: 1 });
  const out = [0.3, 0.55, 0.8, 0.95].map((t) => disintegrate(base, t, "implode", 31));
  // death ends in a star that flares and goes out
  const death = [flash(base, 0.5), ...[0.15, 0.35, 0.55, 0.75].map((t) => disintegrate(base, t, "implode", 31))];
  for (const s of [5, 2]) {
    const im = new Img(W, H).palette(AS_PAL);
    star(im, 48, 42, s, "w", s > 3 ? "c" : "g");
    glowDot(im, 48, 42, s * 3, "c", 0.6);
    death.push(im);
  }
  return {
    idle: WEAVER.idle.map(f), charge: WEAVER.charge.map(f), attack: WEAVER.attack.map(f),
    blink: [...out, ...out.slice().reverse()],
    hurt: [flash(f({ ph: 0, recoil: -2, open: 0.1 }), 0.75), f({ ph: 0, recoil: -1, open: 0.3 })],
    death,
  };
}
/** signature projectile: a spinning star bolt (16×16, 4 frames) */
export function starBolt(i) {
  const im = new Img(16, 16).palette(AS_PAL);
  if (i % 2) { for (let k = -4; k <= 4; k++) { im.px(8 + k, 8 + k, Math.abs(k) < 2 ? "w" : "c"); im.px(8 + k, 8 - k, Math.abs(k) < 2 ? "w" : "c"); } }
  else star(im, 8, 8, 5, "w", "c");
  im.circ(8, 8, 1.5, "w");
  glowDot(im, 8, 8, 7, "b", 0.45 - (i % 2) * 0.1);
  return im;
}
