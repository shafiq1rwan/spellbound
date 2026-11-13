// Spellbound Arena — tiny pixel-art toolkit (build-time only).
//
// Written as the in-house fallback for claude-pxl / pixelfx (see docs/ART_PIPELINE.md).
// Concepts borrowed from those tools: one-char palette keys + grid strings, mirroring,
// automatic outlines, palette swaps, Bayer dithering, a separate additive "light" pass
// and seeded randomness so every build is byte-identical.

import { deflateSync, inflateSync } from "node:zlib";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

// ---------------------------------------------------------------- colour helpers
const cache = new Map();
/** "#rgb" | "#rrggbb" | "#rrggbbaa" -> packed little-endian 0xAABBGGRR (0 = transparent) */
export function rgba(c) {
  if (c === 0 || c == null) return 0;
  if (typeof c === "number") return c >>> 0;
  let v = cache.get(c);
  if (v !== undefined) return v;
  let h = c.replace("#", "");
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  if (h.length === 6) h += "ff";
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16), a = parseInt(h.slice(6, 8), 16);
  v = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  cache.set(c, v);
  return v;
}
export const unpack = (p) => [p & 255, (p >>> 8) & 255, (p >>> 16) & 255, (p >>> 24) & 255];
export const pack = (r, g, b, a = 255) =>
  (((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
export function mix(c1, c2, t) {
  const a = unpack(rgba(c1)), b = unpack(rgba(c2));
  return pack(...a.map((v, i) => Math.round(v + (b[i] - v) * t)));
}
export function withAlpha(c, a) {
  const [r, g, b] = unpack(rgba(c));
  return pack(r, g, b, Math.round(a * 255));
}

// 4x4 Bayer matrix, normalised to (0,1)
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

// mulberry32 — deterministic RNG
export function rng(seed = 1) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + f() * (hi - lo);
  f.int = (lo, hi) => Math.floor(lo + f() * (hi - lo + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}

// ---------------------------------------------------------------- image
export class Img {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.buf = new ArrayBuffer(w * h * 4);
    this.p = new Uint32Array(this.buf);
    this.pal = {};
  }
  static from(w, h, fn) {
    const im = new Img(w, h);
    fn?.(im);
    return im;
  }
  clone() {
    const im = new Img(this.w, this.h);
    im.p.set(this.p);
    im.pal = this.pal;
    return im;
  }
  palette(p) {
    this.pal = p;
    return this;
  }
  col(c) {
    if (typeof c === "string" && c.length === 1) {
      if (c === "." || c === " ") return null;
      if (c === "_") return 0;
      const v = this.pal[c];
      if (v === undefined) throw new Error(`unknown palette key '${c}'`);
      return rgba(v);
    }
    return rgba(c);
  }
  inb(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  get(x, y) {
    return this.inb(x, y) ? this.p[y * this.w + x] : 0;
  }
  alpha(x, y) {
    return this.get(x, y) >>> 24;
  }
  opaque(x, y) {
    return this.alpha(x, y) > 0;
  }
  /** set pixel; `c` may be a key, hex or packed. "_" erases. */
  px(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inb(x, y)) return this;
    const v = this.col(c);
    if (v === null) return this;
    this.p[y * this.w + x] = v;
    return this;
  }
  /** alpha-blend a colour over the existing pixel */
  blend(x, y, c, a = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inb(x, y)) return this;
    const src = unpack(this.col(c));
    const sa = (src[3] / 255) * a;
    if (sa <= 0) return this;
    const i = y * this.w + x;
    const dst = unpack(this.p[i]);
    const da = dst[3] / 255;
    const oa = sa + da * (1 - sa);
    const ch = (k) => (oa ? (src[k] * sa + dst[k] * da * (1 - sa)) / oa : 0);
    this.p[i] = pack(Math.round(ch(0)), Math.round(ch(1)), Math.round(ch(2)), Math.round(oa * 255));
    return this;
  }
  /** additive light (pixelfx-style "light buffer", applied directly) */
  add(x, y, c, k = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inb(x, y)) return this;
    const i = y * this.w + x;
    const s = unpack(this.col(c));
    const d = unpack(this.p[i]);
    if (d[3] === 0) {
      // light over transparency: becomes a translucent glow pixel
      const a = Math.min(255, Math.round(255 * k * (s[3] / 255)));
      this.p[i] = pack(s[0], s[1], s[2], a);
      return this;
    }
    this.p[i] = pack(
      Math.min(255, d[0] + s[0] * k),
      Math.min(255, d[1] + s[1] * k),
      Math.min(255, d[2] + s[2] * k),
      d[3]
    );
    return this;
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
    return this;
  }
  hline(x, y, len, c) {
    return this.rect(x, y, len, 1, c);
  }
  vline(x, y, len, c) {
    return this.rect(x, y, 1, len, c);
  }
  line(x0, y0, x1, y1, c, width = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (width <= 1) this.px(x0, y0, c);
      else this.circ(x0, y0, (width - 1) / 2, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  /** filled pixel circle with a nice pixel-art silhouette */
  circ(cx, cy, r, c) {
    const rr = r * r + r * 0.8;
    const R = Math.ceil(r);
    for (let y = -R; y <= R; y++)
      for (let x = -R; x <= R; x++) if (x * x + y * y <= rr) this.px(cx + x, cy + y, c);
    return this;
  }
  ring(cx, cy, r, c) {
    const outer = r * r + r * 0.8, inner = (r - 1) * (r - 1) + (r - 1) * 0.8;
    const R = Math.ceil(r);
    for (let y = -R; y <= R; y++)
      for (let x = -R; x <= R; x++) {
        const d = x * x + y * y;
        if (d <= outer && d > inner) this.px(cx + x, cy + y, c);
      }
    return this;
  }
  /** filled ellipse; centre may be fractional for even widths */
  ellipse(cx, cy, rx, ry, c, where) {
    if (rx <= 0 || ry <= 0) return this;
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const nx = (x + 0.5 - (cx + 0.5)) / rx, ny = (y + 0.5 - (cy + 0.5)) / ry;
        if (nx * nx + ny * ny <= 1.0 && (!where || where(x, y, nx, ny))) this.px(x, y, c);
      }
    return this;
  }
  /** scanline polygon fill, vertices on pixel corners */
  poly(pts, c) {
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < pts.length; i += 2) {
      minY = Math.min(minY, pts[i]);
      maxY = Math.max(maxY, pts[i]);
    }
    const n = pts.length / 2;
    for (let y = Math.floor(minY); y < Math.ceil(maxY); y++) {
      const sy = y + 0.5, xs = [];
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2], ay = pts[i * 2 + 1];
        const bx = pts[((i + 1) % n) * 2], by = pts[((i + 1) % n) * 2 + 1];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.px(x, y, c);
    }
    return this;
  }
  /** draw a grid string (one char per pixel) with this image's palette, or `pal` */
  grid(x, y, str, pal) {
    const saved = this.pal;
    if (pal) this.pal = { ...saved, ...pal };
    const rows = str.split("\n").map((r) => r.replace(/\s+$/, ""));
    while (rows.length && rows[0].trim() === "") rows.shift();
    while (rows.length && rows[rows.length - 1].trim() === "") rows.pop();
    const indent = Math.min(...rows.filter((r) => r.trim()).map((r) => r.match(/^ */)[0].length));
    rows.forEach((row, j) => {
      [...row.slice(indent)].forEach((ch, i) => {
        if (ch !== "." && ch !== " ") this.px(x + i, y + j, ch);
      });
    });
    this.pal = saved;
    return this;
  }
  /** apply fn(x,y,packed) -> packed|undefined to every pixel */
  map(fn) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        const v = fn(x, y, this.p[i]);
        if (v !== undefined) this.p[i] = v >>> 0;
      }
    return this;
  }
  /** recolour: { fromColour: toColour } (keys or hex) */
  swap(map) {
    const m = new Map();
    for (const [a, b] of Object.entries(map)) m.set(this.col(a), this.col(b));
    return this.map((x, y, v) => (m.has(v) ? m.get(v) : undefined));
  }
  /** mirror the left half onto the right (odd widths share the centre column) */
  mirrorX(center = Math.floor(this.w / 2)) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < center; x++) {
        const v = this.p[y * this.w + x];
        const tx = this.w - 1 - x;
        if (v) this.p[y * this.w + tx] = v;
      }
    return this;
  }
  flipX() {
    const out = new Uint32Array(this.p.length);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) out[y * this.w + (this.w - 1 - x)] = this.p[y * this.w + x];
    this.p.set(out);
    return this;
  }
  /**
   * 1px outline on transparent pixels touching opaque ones.
   * `skip`: colours that neither receive nor cause outline (e.g. glows).
   */
  outline(c, { diag = false, skip = [] } = {}) {
    const col = this.col(c);
    const skipSet = new Set(skip.map((s) => this.col(s)));
    const src = this.p.slice();
    const solid = (x, y) => {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
      const v = src[y * this.w + x];
      return (v >>> 24) > 200 && !skipSet.has(v);
    };
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if ((src[y * this.w + x] >>> 24) > 0) continue;
        let n = solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1);
        if (!n && diag) n = solid(x - 1, y - 1) || solid(x + 1, y - 1) || solid(x - 1, y + 1) || solid(x + 1, y + 1);
        if (n) this.p[y * this.w + x] = col;
      }
    return this;
  }
  /** stamp another image; transparent pixels are skipped. opts: {flip, alpha} */
  stamp(img, x, y, { flip = false, alpha = 1, onlyOpaque = false } = {}) {
    for (let j = 0; j < img.h; j++)
      for (let i = 0; i < img.w; i++) {
        const v = img.p[j * img.w + (flip ? img.w - 1 - i : i)];
        if (!(v >>> 24)) continue;
        const tx = x + i, ty = y + j;
        if (!this.inb(tx, ty)) continue;
        if (onlyOpaque && !this.opaque(tx, ty)) continue;
        if (alpha >= 1 && v >>> 24 === 255) this.p[ty * this.w + tx] = v;
        else this.blend(tx, ty, v, alpha);
      }
    return this;
  }
  /** copy a sub-rectangle into a new image */
  crop(x, y, w, h) {
    const im = new Img(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) im.p[j * w + i] = this.get(x + i, y + j);
    im.pal = this.pal;
    return im;
  }
  /** pixel-art rotation (nearest neighbour, about centre) — used for baked VFX frames */
  rotated(rad) {
    const im = new Img(this.w, this.h);
    const cx = (this.w - 1) / 2, cy = (this.h - 1) / 2;
    const c = Math.cos(-rad), s = Math.sin(-rad);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const dx = x - cx, dy = y - cy;
        const sx = Math.round(cx + dx * c - dy * s), sy = Math.round(cy + dx * s + dy * c);
        im.p[y * this.w + x] = this.get(sx, sy);
      }
    return im;
  }
  /** scale by integer factor (nearest) */
  scaled(k) {
    const im = new Img(this.w * k, this.h * k);
    for (let y = 0; y < im.h; y++)
      for (let x = 0; x < im.w; x++) im.p[y * im.w + x] = this.p[Math.floor(y / k) * this.w + Math.floor(x / k)];
    return im;
  }
  bounds() {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (this.p[y * this.w + x] >>> 24) {
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
}

// ---------------------------------------------------------------- PNG encoding
const CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function encodePNG(img) {
  const { w, h } = img;
  const bytes = new Uint8Array(img.buf);
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    // un-premultiplied RGBA; zero colour channels of fully transparent pixels for compression
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, d = y * (w * 4 + 1) + 1 + x * 4;
      if (bytes[s + 3] === 0) { raw[d] = raw[d + 1] = raw[d + 2] = raw[d + 3] = 0; continue; }
      raw[d] = bytes[s]; raw[d + 1] = bytes[s + 1]; raw[d + 2] = bytes[s + 2]; raw[d + 3] = bytes[s + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
/** read an 8-bit RGBA, non-interlaced PNG (what the PNG writers here and pixelfx's exporter produce) */
export function loadPNG(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${path}: not a PNG`);
  let pos = 8, w = 0, h = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString("ascii", pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error(`${path}: only 8-bit RGBA, non-interlaced PNGs are supported`);
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = w * 4, img = new Img(w, h), out = new Uint8Array(img.buf);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride, prev = dst - stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? out[dst + i - 4] : 0, b = y ? out[prev + i] : 0, c = y && i >= 4 ? out[prev + i - 4] : 0, v = raw[src + i];
      out[dst + i] = (f === 0 ? v : f === 1 ? v + a : f === 2 ? v + b : f === 3 ? v + ((a + b) >> 1) : v + paeth(a, b, c)) & 255;
    }
  }
  return img;
}

export function savePNG(path, img) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePNG(img));
}

// ---------------------------------------------------------------- sheets & previews
/** lay frames out in a grid; returns { img, cols } */
export function strip(frames, cols = frames.length) {
  const fw = frames[0].w, fh = frames[0].h;
  const rows = Math.ceil(frames.length / cols);
  const img = new Img(fw * cols, fh * rows);
  frames.forEach((f, i) => img.stamp(f, (i % cols) * fw, Math.floor(i / cols) * fh));
  return { img, cols };
}

/** upscaled preview with a checkerboard for transparency, optional background colour */
export function preview(img, k, bg) {
  const out = new Img(img.w * k, img.h * k);
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      const sx = Math.floor(x / k), sy = Math.floor(y / k);
      const base = bg ? rgba(bg) : ((sx + sy) & 1 ? rgba("#3a3a4a") : rgba("#2c2c38"));
      out.p[y * out.w + x] = base;
      const v = img.p[sy * img.w + sx];
      if (v >>> 24) {
        if (v >>> 24 === 255) out.p[y * out.w + x] = v;
        else out.blend(x, y, v);
      }
    }
  return out;
}
