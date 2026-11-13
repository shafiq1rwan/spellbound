// Baked spell & impact VFX. Technique follows the pixelfx approach: hard colour-ramp steps for
// the body, dithered (Bayer) alpha for fades, seeded particles, white "hero" frame on impact.
import { Img, rng, bayer, withAlpha } from "./lib/px.mjs";
import { C } from "./palette.mjs";

const FIRE = ["#5A1A2A", "#A8321E", "#E8602A", C.fireOrange, C.fireYellow, "#FFF6D0"];
const SMOKE = ["#1C1830", "#2E2846", "#453B60"];
const ICE = ["#1F4FA0", "#3B8CD8", C.iceCyan, "#C2F2FF", "#FFFFFF"];
const ARC = ["#4A1F8A", "#7A3CC8", C.violet, "#E08CFF", "#FFD8FF", "#FFFFFF"];
const BOLT = ["#4A6BD8", "#9BC4FF", C.boltYellow, "#FFFBE0", "#FFFFFF"];

/** draw a disc whose colour comes from ramp by normalised radius (0 centre..1 edge) */
function rampDisc(im, cx, cy, r, ramp, { dither = 0, seed = 0, wobble = 0, squash = 1 } = {}) {
  const R = rng(seed + 7);
  const ph = R() * 6.28;
  for (let y = Math.floor(cy - r - 2); y <= Math.ceil(cy + r + 2); y++)
    for (let x = Math.floor(cx - r - 2); x <= Math.ceil(cx + r + 2); x++) {
      const dx = x + 0.5 - cx, dy = (y + 0.5 - cy) / squash;
      const a = Math.atan2(dy, dx);
      const rr = r * (1 + wobble * (Math.sin(a * 3 + ph) * 0.45 + Math.sin(a * 5 - ph * 2) * 0.25 + Math.sin(a * 8 + ph * 3) * 0.18));
      const d = Math.hypot(dx, dy) / rr;
      if (d > 1) continue;
      if (dither && d > 1 - dither && bayer(x, y) < (d - (1 - dither)) / dither) continue;
      const idx = Math.min(ramp.length - 1, Math.floor((1 - d) * ramp.length));
      im.px(x, y, ramp[idx]);
    }
}
function ringStroke(im, cx, cy, r, w, col, { squash = 1, fade = 0, x0 = 0 } = {}) {
  if (squash !== 1) {
    // parametric sampling: gap-free on squashed (perspective) ellipses
    const seen = new Set();
    for (let rr = r - w / 2 + 0.25; rr <= r + w / 2 - 0.25 + 1e-6; rr += 0.5) {
      const n = Math.ceil(rr * 8);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = Math.floor(cx + Math.cos(a) * rr), y = Math.floor(cy + Math.sin(a) * rr * squash);
        const key = x * 4096 + y;
        if (seen.has(key)) continue;
        seen.add(key);
        if (fade && bayer(x + x0, y) < fade) continue;
        im.px(x, y, col);
      }
      if (w < 1) break;
    }
    return;
  }
  for (let y = Math.floor(cy - r - w - 1); y <= Math.ceil(cy + r + w + 1); y++)
    for (let x = Math.floor(cx - r - w - 1); x <= Math.ceil(cx + r + w + 1); x++) {
      const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) / squash);
      if (Math.abs(d - r) > w / 2) continue;
      if (fade && bayer(x + x0, y) < fade) continue;
      im.px(x, y, col);
    }
}

// ------------------------------------------------------------ fire
export function fireball(size = 16, frames = 4, seed = 1) {
  return Array.from({ length: frames }, (_, f) => {
    const im = new Img(size, size);
    const c = size / 2, r = size * 0.27;
    const R = rng(seed * 31 + f);
    // trailing flame tongues to the left (projectile faces right)
    for (let t = 0; t < 4; t++) {
      const len = size * (0.32 + R() * 0.16), off = (R() - 0.5) * r * 1.3;
      rampDisc(im, c - len * 0.55, c + off, r * (0.55 - t * 0.06), FIRE.slice(0, 4), { seed: f * 9 + t, wobble: 0.3 });
    }
    rampDisc(im, c, c, r + 1, FIRE.slice(1), { seed: f, wobble: 0.15 });
    rampDisc(im, c + 1, c - 0.5, r * 0.55, [C.fireYellow, "#FFF6D0", "#FFFFFF"], { seed: f + 3 });
    // sparks
    for (let s = 0; s < 3; s++) im.px(R.int(1, Math.floor(c - 2)), R.int(Math.floor(c - r), Math.ceil(c + r)), R() < 0.5 ? FIRE[4] : FIRE[3]);
    return im;
  });
}

export function explosion(size = 48, frames = 8, seed = 2, ramp = FIRE, smoke = SMOKE) {
  const R0 = rng(seed);
  const debris = Array.from({ length: 14 }, () => ({ a: R0() * 6.28, v: 0.5 + R0() * 0.5, s: R0() }));
  return Array.from({ length: frames }, (_, f) => {
    const im = new Img(size, size);
    const c = size / 2, t = f / (frames - 1), M = size / 2 - 2;
    if (f === 0) {
      rampDisc(im, c, c, M * 0.28, [ramp[4], ramp[5], "#FFFFFF"], { seed: f });
      return im;
    }
    // smoke ring behind (grows, dithers away)
    if (t > 0.2) {
      const sr = M * (0.55 + t * 0.45);
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * 6.28 + seed;
        rampDisc(im, c + Math.cos(a) * sr * 0.6, c + Math.sin(a) * sr * 0.6 - t * 3, M * 0.3 * (1 - t * 0.3), smoke,
          { dither: Math.min(1, t * 1.1), seed: k + f * 13, wobble: 0.3 });
      }
    }
    // fire body: hot core shrinks, ring of flame expands
    const body = M * (0.35 + 0.5 * Math.pow(t, 0.5));
    const heat = Math.max(0, 1 - t * 1.25);
    const shift = Math.round((1 - heat) * 3);
    const rmp = ramp.slice(0, ramp.length - shift);
    if (heat > 0) rampDisc(im, c, c - t * 2, body * (1 - t * 0.35), rmp, { dither: t * 0.8, seed: f, wobble: 0.25 });
    // white/yellow shock ring for the first frames
    if (f <= 2) ringStroke(im, c, c, M * (0.45 + f * 0.25), 2 - f * 0.5, f === 1 ? "#FFFFFF" : ramp[4]);
    // debris embers
    debris.forEach((d, i) => {
      const dist = M * d.v * Math.pow(t, 0.6) * 1.05;
      if (t > 0.85 && i % 2) return;
      const x = c + Math.cos(d.a) * dist, y = c + Math.sin(d.a) * dist + t * t * 6;
      im.px(x, y, t < 0.5 ? ramp[4] : ramp[3]);
      if (d.s > 0.6 && t < 0.6) im.px(x - Math.cos(d.a), y - Math.sin(d.a), ramp[2]);
    });
    return im;
  });
}

// ------------------------------------------------------------ ice
export function frostNova(size = 128, frames = 8) {
  const R0 = rng(5);
  const spikes = Array.from({ length: 22 }, (_, i) => ({ a: (i / 22) * 6.28 + R0() * 0.2, l: 3 + R0() * 5 }));
  return Array.from({ length: frames }, (_, f) => {
    const im = new Img(size, size);
    const c = size / 2, t = (f + 1) / frames, M = size / 2 - 4;
    const r = M * (0.18 + 0.82 * (1 - Math.pow(1 - t, 2.2)));
    const fade = Math.max(0, (t - 0.55) / 0.45);
    // frosted interior wash
    const RS = rng(77);
    if (f < frames - 1)
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
          const q = RS();
          if (d < r - 2 && d > r * 0.45 && q < 0.05 * (1 - fade) * Math.pow(d / r, 2)) im.px(x, y, q < 0.012 ? "#FFFFFF" : ICE[2]);
        }
    // main ring
    ringStroke(im, c, c, r, Math.max(1.5, 5 * (1 - t)), ICE[2], { fade: fade * 0.9 });
    ringStroke(im, c, c, r - 1, Math.max(1, 2.5 * (1 - t)), f < 2 ? "#FFFFFF" : ICE[3], { fade: fade });
    ringStroke(im, c, c, r + 2, 1, ICE[1], { fade: Math.min(1, fade + 0.3) });
    // crystal spikes on the ring
    spikes.forEach((s, i) => {
      if (fade > 0.6 && i % 2) return;
      const L = s.l * (1 - fade * 0.7);
      const bx = c + Math.cos(s.a) * r, by = c + Math.sin(s.a) * r;
      const ex = c + Math.cos(s.a) * (r + L), ey = c + Math.sin(s.a) * (r + L);
      im.line(bx, by, ex, ey, ICE[3]);
      im.px(ex, ey, "#FFFFFF");
      im.px(bx - Math.sin(s.a), by + Math.cos(s.a), ICE[1]);
    });
    // white flash in the centre first frame
    if (f === 0) rampDisc(im, c, c, 8, [ICE[3], "#FFFFFF"]);
    return im;
  });
}

// ------------------------------------------------------------ arcane
function star(im, cx, cy, r, col, core) {
  for (let i = 0; i <= r; i++) {
    im.px(cx + i, cy, col).px(cx - i, cy, col).px(cx, cy + i, col).px(cx, cy - i, col);
  }
  const d = Math.floor(r * 0.5);
  for (let i = 1; i <= d; i++) im.px(cx + i, cy + i, col).px(cx - i, cy - i, col).px(cx + i, cy - i, col).px(cx - i, cy + i, col);
  if (core) im.px(cx, cy, core);
}
export function arcaneMissile(frames = 4) {
  return Array.from({ length: frames }, (_, f) => {
    const im = new Img(14, 14);
    rampDisc(im, 7, 7, 4.2, ARC.slice(1, 5), { seed: f, wobble: 0.1 });
    star(im, 7, 7, f % 2 ? 6 : 5, ARC[3], "#FFFFFF");
    im.px(7, 7, "#FFFFFF").px(8, 6, ARC[4]);
    return im;
  });
}
export function starburst(size = 24, frames = 6, ramp = ARC) {
  return Array.from({ length: frames }, (_, f) => {
    const im = new Img(size, size);
    const c = Math.floor(size / 2), t = f / (frames - 1), M = size / 2 - 1;
    if (f === 0) { rampDisc(im, c, c, 3.5, [ramp[3], ramp[4], "#FFFFFF"]); star(im, c, c, 6, "#FFFFFF"); return im; }
    const r = Math.round(M * (0.35 + 0.65 * Math.pow(t, 0.6)));
    const col = t < 0.4 ? ramp[4] : t < 0.75 ? ramp[3] : ramp[2];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.28 + (i % 2 ? 0.2 : 0);
      const len = i % 2 ? r * 0.6 : r;
      const r0 = len * t * 0.7;
      im.line(c + Math.cos(a) * r0, c + Math.sin(a) * r0, c + Math.cos(a) * len, c + Math.sin(a) * len, col);
    }
    if (t < 0.6) rampDisc(im, c, c, 3 * (1 - t), [ramp[3], ramp[4]], { dither: t });
    return im;
  });
}
export function vortex(size = 48, frames = 6) {
  return Array.from({ length: frames }, (_, f) => {
    const im = new Img(size, size);
    const c = size / 2;
    for (let arm = 0; arm < 3; arm++)
      for (let s = 0; s < 70; s++) {
        const u = s / 70;
        const a = arm * 2.094 + u * 7 + f * 0.7;
        const r = 2 + u * (size / 2 - 4);
        const col = u < 0.3 ? ARC[4] : u < 0.6 ? ARC[3] : u < 0.85 ? ARC[2] : ARC[1];
        im.px(c + Math.cos(a) * r, c + Math.sin(a) * r * 0.8, col);
        if (u < 0.6) im.px(c + Math.cos(a) * r + 1, c + Math.sin(a) * r * 0.8, col);
      }
    rampDisc(im, c, c, 3, [ARC[4], "#FFFFFF"]);
    return im;
  });
}

// ------------------------------------------------------------ generic impacts
export function hitFlash(frames = 4) {
  return Array.from({ length: frames }, (_, f) => {
    const im = new Img(16, 16);
    const r = [3, 6, 7, 7][f];
    if (f < 2) rampDisc(im, 8, 8, [3, 2][f], ["#FFFFFF"]);
    const col = f < 2 ? "#FFFFFF" : f === 2 ? "#FFF1C2" : "#C8B8E8";
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * 6.28 + 0.78;
      const r0 = f * 1.6;
      im.line(8 + Math.cos(a) * r0, 8 + Math.sin(a) * r0, 8 + Math.cos(a) * r, 8 + Math.sin(a) * r, col);
    }
    return im;
  });
}
export function zap(frames = 5) {
  return Array.from({ length: frames }, (_, f) => {
    const im = new Img(24, 24);
    const R = rng(40 + f);
    if (f === 0) rampDisc(im, 12, 12, 5, [BOLT[1], BOLT[3], "#FFFFFF"]);
    const n = [6, 7, 5, 3, 2][f];
    for (let i = 0; i < n; i++) {
      let x = 12, y = 12, a = R() * 6.28;
      const L = [6, 10, 11, 11, 10][f];
      for (let s = 0; s < L; s++) {
        a += (R() - 0.5) * 1.3;
        x += Math.cos(a); y += Math.sin(a);
        if (s > f * 2) im.px(x, y, s < L * 0.5 ? BOLT[3] : f < 3 ? BOLT[2] : BOLT[1]);
      }
    }
    return im;
  });
}
export function smokePuff(frames = 6, ramp = ["#2A2244", "#4A3D6E", "#6D5C98"]) {
  return Array.from({ length: frames }, (_, f) => {
    const im = new Img(16, 16);
    const t = f / (frames - 1);
    for (let k = 0; k < 4; k++) {
      const a = k * 1.7;
      rampDisc(im, 8 + Math.cos(a) * 3 * t, 8 + Math.sin(a) * 2 * t - t * 2, 4 + t * 2.5 - k * 0.3, ramp, { dither: Math.min(1, t * 1.1), seed: k + f });
    }
    return im;
  });
}
// Enemy spawn: a bright rift opens on the floor (white pop, violet rim with orbiting lavender ticks, a
// swirling void), motes rise out of it, then it snaps shut. 12 frames = GAME.spawn.portalMs at 75 ms.
// The rift centre is at (20, 16); the space above is for the rising motes.
export const PORTAL_ORIGIN = [0.5, 16.5 / 24];
export function spawnPortal(frames = 12) {
  const R = rng(31);
  const motes = Array.from({ length: 9 }, () => ({ a: R() * 6.28, r: 0.3 + R() * 0.6, t0: 0.1 + R() * 0.45, sp: 0.9 + R() * 0.7 }));
  return Array.from({ length: frames }, (_, f) => {
    const im = new Img(40, 24);
    const cx = 20, cy = 16, t = f / (frames - 1);
    const s = [0.3, 0.75, 1.08, 1, 1, 1, 1, 1, 1, 0.92, 0.6, 0.28][f] ?? 1;
    const rx = 15 * s, ry = 6.5 * s;
    if (f === 0) {
      // the pop: a white spark with a lavender cross so even the first frame reads on a dark floor
      im.ellipse(cx, cy, 5, 2.2, C.lavender).ellipse(cx, cy, 3, 1.2, "#FFFFFF");
      im.hline(cx - 9, cy, 18, C.lavender).vline(cx, cy - 6, 9, C.lavender).px(cx, cy, "#FFFFFF");
      return im;
    }
    im.ellipse(cx, cy, rx, ry, "#21123E");
    im.ellipse(cx, cy, rx * 0.68, ry * 0.68, "#0C0718");
    // three spiral arms turning inward
    for (let k = 0; k < 3; k++)
      for (let j = 0; j < 9; j++) {
        const u = j / 9, a = k * 2.094 + f * 0.75 + u * 2.6;
        im.px(cx + Math.cos(a) * rx * (0.15 + u * 0.75), cy + Math.sin(a) * ry * (0.15 + u * 0.75), u > 0.55 ? C.violet : "#5B2FA8");
      }
    ringStroke(im, cx, cy, rx, 1, C.violet, { squash: ry / rx });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * 6.28 + f * 0.45;
      im.px(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, i % 4 === 0 ? "#FFFFFF" : C.lavender);
    }
    // opening flash: a white ring just outside the rim
    if (f <= 2) ringStroke(im, cx, cy, rx + 2 * f, 1, f === 1 ? "#FFFFFF" : C.lavender, { squash: ry / rx, fade: f === 2 ? 0.5 : 0 });
    // motes rising out of the rift
    for (const m of motes) {
      const u = (t - m.t0) * m.sp * 2.2;
      if (u < 0 || u > 1) continue;
      const x = cx + Math.cos(m.a) * rx * m.r, y = cy + Math.sin(m.a) * ry * m.r - u * 15;
      im.px(x, y, u < 0.45 ? "#FFFFFF" : C.lavender);
      if (u < 0.3) im.px(x, y + 1, C.violet);
    }
    return im;
  });
}
/** the light column the enemy rises through (drawn additively, origin at its foot) */
export const BEAM_ORIGIN = [0.5, 39.5 / 40];
export function portalBeam(frames = 6) {
  return Array.from({ length: frames }, (_, f) => {
    const im = new Img(16, 40);
    const half = [1.5, 3.5, 4, 3.5, 2.5, 1.5][f], top = [22, 6, 2, 2, 4, 8][f];
    const fade = [0, 0, 0, 0.2, 0.45, 0.7][f];
    for (let y = top; y < 40; y++) {
      const v = (y - top) / (40 - top); // 0 top .. 1 foot
      const tipFade = v < 0.35 ? (0.35 - v) / 0.35 : 0;
      for (let x = 0; x < 16; x++) {
        const d = Math.abs(x + 0.5 - 8) / half;
        if (d > 1 || bayer(x, y) < Math.max(fade, tipFade)) continue;
        im.px(x, y, d < 0.3 ? "#FFFFFF" : d < 0.65 ? C.lavender : C.violet);
      }
    }
    return im;
  });
}

// Level-up: a gold pillar of light bursts up behind the wizard from a ring that sweeps out across the
// floor, and gold, white and lavender sparkles drift up. The peak is in the first ~0.5 s (the cards open
// at 0.52 s and freeze it); the rest is a slow thin-out that plays after the pick.
// Canvas 72x104 with the wizard's feet at (36, 90).
export const LEVELUP_ORIGIN = [0.5, 90.5 / 104];
export function levelUp(frames = 16) {
  const W = 72, H = 104, cx = 36, gy = 90;
  const G = C.gold; // dark .. light
  const R = rng(77);
  const motes = Array.from({ length: 34 }, () => ({
    x: (R() - 0.5) * 40, t0: R() * 0.65, sp: 0.8 + R() * 0.9,
    c: [G[2], "#FFFFFF", G[3], C.lavender][Math.floor(R() * 4)], big: R() < 0.35,
  }));
  return Array.from({ length: frames }, (_, f) => {
    const im = new Img(W, H);
    const t = f / (frames - 1);
    // ground ring sweeping out (perspective ellipse), a second one trailing it
    for (const [lag, col] of [[0, G[2]], [2, G[1]]]) {
      const k = f - lag;
      if (k < 0) continue;
      const u = Math.min(1, k / 9);
      const r = 5 + 29 * (1 - Math.pow(1 - u, 2));
      ringStroke(im, cx, gy, r, k < 3 ? 2 : 1, col, { squash: 0.38, fade: u > 0.55 ? (u - 0.55) * 2.2 : 0 });
    }
    // warm pool of light at the feet
    if (f >= 1 && f <= 9) {
      const a = f <= 4 ? 0.55 : 0.55 * (1 - (f - 4) / 6);
      for (let y = gy - 5; y <= gy + 5; y++)
        for (let x = cx - 16; x <= cx + 16; x++) {
          const d = Math.hypot((x + 0.5 - cx) / 16, (y + 0.5 - gy) / 5);
          if (d <= 1 && bayer(x, y) < a * (1 - d)) im.px(x, y, G[2]);
        }
    }
    // the pillar: flared at the floor, tapering up, with bright bands rushing upward. From frame 9 its
    // foot lifts off the floor and the whole column rises away rather than thinning out.
    const grow = f < 3 ? (f + 1) / 3 : 1;
    const top = Math.round(gy - grow * 92 - (f >= 9 ? (f - 8) * 4 : 0));
    const foot = f < 9 ? gy : gy - Math.round(Math.pow(f - 8, 1.35) * 9);
    const half = [4, 10, 11, 10, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4, 3.5][f] ?? 3;
    const fade = f < 11 ? 0 : (f - 10) / 7;
    for (let y = Math.max(0, top); y <= foot; y++) {
      const v = (y - top) / (gy - top); // 0 top .. 1 floor
      const tipFade = v < 0.3 ? (0.3 - v) / 0.3 : 0;
      const footFade = f >= 9 && foot - y < 8 ? (8 - (foot - y)) / 8 : 0;
      const w = half * (0.55 + 0.45 * v) * (y > gy - 6 ? 1 + (y - (gy - 6)) * 0.12 : 1);
      const band = (y + f * 9) % 14 < 3;
      for (let x = Math.floor(cx - w - 1); x <= Math.ceil(cx + w + 1); x++) {
        const d = Math.abs(x + 0.5 - cx) / w;
        if (d > 1 || bayer(x, y) < Math.max(fade, tipFade, footFade)) continue;
        let i = f <= 1 ? (d < 0.6 ? 4 : 3) : d < 0.28 ? 4 : d < 0.55 ? 3 : d < 0.82 ? 2 : 1;
        if (band && i < 4 && f > 1) i++;
        im.px(x, y, i === 4 ? "#FFFFFF" : G[i]);
      }
    }
    // side rays: thin streaks shooting up beside the column during the burst
    if (f >= 1 && f <= 10)
      for (const [dx, ph] of [[-1, 0], [1, 5], [-1, 9], [1, 13]]) {
        const x = cx + dx * (half + 3 + (ph % 3));
        const y0 = gy - 10 - ((f * 11 + ph * 6) % 60);
        for (let k = 0; k < 9; k++) if (bayer(x, y0 + k) >= fade) im.px(x, y0 + k, k < 3 ? "#FFFFFF" : G[k < 6 ? 3 : 2]);
      }
    // white flare across the base on the burst frames
    if (f >= 1 && f <= 2) im.hline(cx - 20 + f * 4, gy - 1, 40 - f * 8, "#FFFFFF").hline(cx - 14, gy, 28, G[3]);
    // sparkles drifting up
    for (const m of motes) {
      const u = (t - m.t0) * m.sp * 1.7;
      if (u < 0 || u > 1) continue;
      const x = Math.round(cx + m.x * (1 - u * 0.35) + Math.sin(u * 9 + m.x) * 1.5), y = Math.round(gy - 4 - u * 82);
      if (u > 0.75 && bayer(x, y) < (u - 0.75) * 4) continue;
      im.px(x, y, m.c);
      if (m.big && u < 0.7) {
        // four-point twinkle, arms longer while it's fresh
        const L = u < 0.35 ? 2 : 1;
        for (let k = 1; k <= L; k++) im.px(x - k, y, m.c).px(x + k, y, m.c).px(x, y - k, m.c).px(x, y + k, m.c);
        im.px(x, y, "#FFFFFF");
      }
    }
    return im;
  });
}
export function shockRing(size = 64, frames = 5, col = "#FFFFFF", col2 = C.lavender) {
  return Array.from({ length: frames }, (_, f) => {
    const im = new Img(size, size);
    const t = (f + 1) / frames;
    const r = (size / 2 - 3) * Math.pow(t, 0.6);
    ringStroke(im, size / 2, size / 2, r, 3 * (1 - t) + 1, f < 2 ? col : col2, { squash: 0.55, fade: t > 0.6 ? (t - 0.6) * 2 : 0 });
    return im;
  });
}

// ------------------------------------------------------------ pickups
export function xpOrb(frames = 6, ramp = ["#1F6B54", "#3DBB86", C.xpMint, "#D8FFEC"]) {
  return Array.from({ length: frames }, (_, f) => {
    const im = new Img(11, 11);
    // rotating gem: width oscillates
    const w = [3, 2.2, 1, 0.5, 1, 2.2][f % 6];
    const pts = [5.5, 1, 5.5 + w, 5.5, 5.5, 10, 5.5 - w, 5.5];
    im.poly(pts, ramp[1]);
    im.poly([5.5, 1, 5.5 + w, 5.5, 5.5, 5.5], ramp[2]);
    im.poly([5.5 - w, 5.5, 5.5, 5.5, 5.5, 10], ramp[0]);
    im.px(5, 3, ramp[3]);
    im.outline("#0E2A2A");
    return im;
  });
}

// ------------------------------------------------------------ magic circles (perspective ellipse)
const ELEM = {
  fire: [FIRE[2], C.fireOrange, C.fireYellow],
  ice: [ICE[1], C.iceCyan, "#E6FCFF"],
  bolt: [BOLT[1], C.boltYellow, "#FFFBE0"],
  arcane: [ARC[1], C.violet, "#F0D0FF"],
  level: [C.uiGold[0], C.uiGold[1], C.uiGold[2]],
};
function glyph(im, kind, cx, cy, s, col) {
  const pts = [];
  if (kind === "fire") for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i / 3) * 6.28; pts.push([cx + Math.cos(a) * s, cy + Math.sin(a) * s * 0.5]); }
  if (pts.length) { for (let i = 0; i < 3; i++) im.line(...pts[i], ...pts[(i + 1) % 3], col); return; }
  if (kind === "ice") {
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI; im.line(cx - Math.cos(a) * s, cy - Math.sin(a) * s * 0.5, cx + Math.cos(a) * s, cy + Math.sin(a) * s * 0.5, col); }
    return;
  }
  if (kind === "bolt") {
    const z = [[-s, -s * 0.4], [s * 0.2, -s * 0.4], [-s * 0.3, s * 0.05], [s, s * 0.05], [-s * 0.1, s * 0.45]];
    for (let i = 0; i < z.length - 1; i++) im.line(cx + z[i][0], cy + z[i][1], cx + z[i + 1][0], cy + z[i + 1][1], col);
    return;
  }
  if (kind === "arcane") {
    // V rune, seen in perspective on the ground
    im.line(cx - s * 0.8, cy - s * 0.42, cx, cy + s * 0.42, col);
    im.line(cx, cy + s * 0.42, cx + s * 0.8, cy - s * 0.42, col);
    return;
  }
  // level: star
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i / 5) * 6.28, b = -Math.PI / 2 + (((i + 2) % 5) / 5) * 6.28;
    im.line(cx + Math.cos(a) * s, cy + Math.sin(a) * s * 0.5, cx + Math.cos(b) * s, cy + Math.sin(b) * s * 0.5, col);
  }
}
export function sigil(kind, frames = 4, w = 56) {
  const [d, m, l] = ELEM[kind];
  const h = Math.round(w / 2);
  return Array.from({ length: frames }, (_, f) => {
    const im = new Img(w, h);
    const cx = w / 2, cy = h / 2;
    ringStroke(im, cx, cy, w / 2 - 2, 1.2, m, { squash: 0.5 });
    ringStroke(im, cx, cy, w / 2 - 6, 1, d, { squash: 0.5 });
    // orbiting rune ticks
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 6.28 + (f / frames) * (6.28 / 12);
      const r = w / 2 - 4;
      im.px(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.5, i % 3 === 0 ? l : m);
    }
    glyph(im, kind, cx, cy, w / 2 - 10, l);
    return im;
  });
}

// ------------------------------------------------------------ particles, decals, glows
export function particles() {
  const P = {};
  const mk = (w, h, g, pal) => new Img(w, h).palette(pal).grid(0, 0, g);
  P.ember = mk(3, 3, `.y.\nyWy\n.y.`, { y: C.fireOrange, W: C.fireYellow });
  P.spark = mk(2, 2, `WW\nWW`, { W: "#FFFFFF" });
  P.dot = mk(1, 1, `W`, { W: "#FFFFFF" });
  P.twinkle = mk(5, 5, `..W..\n..W..\nWWWWW\n..W..\n..W..`, { W: "#FFFFFF" });
  P.snow = mk(3, 3, `.W.\nWcW\n.W.`, { W: "#FFFFFF", c: C.iceCyan });
  P.shard = mk(7, 3, `.ccWW..\ncCCCCWW\n.ccWW..`, { c: ICE[1], C: ICE[2], W: "#FFFFFF" });
  P.drop = mk(3, 3, `.l.\nlgg\n.G.`, { l: C.slime[3], g: C.slime[2], G: C.slime[1] });
  P.chip = mk(3, 3, `vu.\nutu\n.t.`, { v: C.stone[3], u: C.stone[2], t: C.stone[1] });
  P.feather = mk(3, 3, `.p.\npPp\n.p.`, { p: C.violet, P: C.lavender });
  return P;
}
export function decals() {
  const D = {};
  const scorch = new Img(28, 14);
  for (let y = 0; y < 14; y++)
    for (let x = 0; x < 28; x++) {
      const d = Math.hypot((x + 0.5 - 14) / 13, (y + 0.5 - 7) / 6.5);
      if (d > 1) continue;
      if (d > 0.55 && bayer(x, y) < (d - 0.55) * 2.1) continue;
      scorch.px(x, y, d < 0.35 ? "#0C0A16" : "#1A1222");
    }
  for (let i = 0; i < 6; i++) scorch.px(6 + i * 3, 5 + (i % 3), "#5A2A22");
  D.scorch = scorch;
  // frosted ground: translucent icy sheen + scattered crystal glints + cracked rim (no dither screen)
  const frost = new Img(120, 60);
  const RF = rng(31);
  for (let y = 0; y < 60; y++)
    for (let x = 0; x < 120; x++) {
      const d = Math.hypot((x + 0.5 - 60) / 59, (y + 0.5 - 30) / 29.5);
      if (d > 1) continue;
      frost.px(x, y, withAlpha("#8FD8FF", 0.16 + 0.14 * (1 - d)));
    }
  for (let i = 0; i < 70; i++) {
    const a = RF() * 6.28, r = Math.sqrt(RF());
    const x = 60 + Math.cos(a) * r * 56, y = 30 + Math.sin(a) * r * 27;
    const c = RF() < 0.3 ? "#FFFFFF" : "#BFF0FF";
    frost.px(x, y, c);
    if (RF() < 0.4) frost.px(x + 1, y, "#8FD8FF").px(x - 1, y, "#8FD8FF");
  }
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * 6.28 + RF() * 0.2;
    const x0 = 60 + Math.cos(a) * 50, y0 = 30 + Math.sin(a) * 24, x1 = 60 + Math.cos(a) * 58, y1 = 30 + Math.sin(a) * 28;
    frost.line(x0, y0, x1, y1, "#CFF4FF");
  }
  D.frost = frost;
  const goo = new Img(20, 8);
  goo.ellipse(10, 4, 9, 3, C.slime[1]);
  goo.ellipse(9, 3.5, 6, 1.6, C.slime[2]);
  goo.px(6, 3, C.slime[3]);
  D.goo = goo;
  return D;
}
/** soft round glow with stepped (banded) alpha — tinted & added at runtime */
export function glow(size = 32, bands = 5, maxA = 0.9) {
  const im = new Img(size, size);
  const c = size / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / c;
      if (d >= 1) continue;
      const q = Math.ceil((1 - d) * bands) / bands;
      im.px(x, y, withAlpha("#FFFFFF", Math.pow(q, 1.8) * maxA));
    }
  return im;
}
export function shadow(w, h) {
  const im = new Img(w, h);
  im.ellipse(w / 2 - 0.5, h / 2 - 0.5, w / 2, h / 2, withAlpha("#06071A", 0.45));
  im.ellipse(w / 2 - 0.5, h / 2 - 0.5, w / 2 - 2, h / 2 - 1, withAlpha("#06071A", 0.6));
  return im;
}
