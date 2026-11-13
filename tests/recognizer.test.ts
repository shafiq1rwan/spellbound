// Recognizer robustness tests: synthetic "human" strokes with rotation, aspect changes,
// jitter, random start points and directions, plus scribbles that must be rejected.
import { test } from "node:test";
import assert from "node:assert/strict";
import { RuneRecognizer, type Pt, type RuneName } from "../src/rune/RuneRecognizer.ts";

const rec = new RuneRecognizer({ threshold: 0.72, strongThreshold: 0.86 });

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function densify(vs: number[][], step = 0.04): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < vs.length - 1; i++) {
    const [ax, ay] = vs[i], [bx, by] = vs[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 0; k < n; k++) out.push({ x: ax + ((bx - ax) * k) / n, y: ay + ((by - ay) * k) / n });
  }
  out.push({ x: vs[vs.length - 1][0], y: vs[vs.length - 1][1] });
  return out;
}

function humanize(pts: Pt[], R: () => number, { rot = 0.45, jitter = 0.035, scale = 120 } = {}): Pt[] {
  const a = (R() - 0.5) * 2 * rot;
  const sx = scale * (0.8 + R() * 0.45), sy = scale * (0.8 + R() * 0.45);
  const c = Math.cos(a), s = Math.sin(a);
  let wob = 0;
  return pts.map((p) => {
    wob += (R() - 0.5) * jitter;
    wob *= 0.85;
    const x = p.x + wob + (R() - 0.5) * jitter * 0.5, y = p.y - wob + (R() - 0.5) * jitter * 0.5;
    return { x: (x * c - y * s) * sx + 200, y: (x * s + y * c) * sy + 300 };
  });
}

const makers: Record<RuneName, (R: () => number) => Pt[]> = {
  triangle(R) {
    const v = [[0, -1 + R() * 0.2], [0.8 + R() * 0.3, 0.5 + R() * 0.2], [-0.8 - R() * 0.3, 0.5 + R() * 0.2]];
    const start = Math.floor(R() * 3);
    let seq = [...v.slice(start), ...v.slice(0, start)];
    if (R() < 0.5) seq = [seq[0], seq[2], seq[1]];
    // humans often stop short of closing or overshoot slightly
    const end = R() < 0.5 ? seq[0] : [seq[0][0] * 0.9 + seq[2][0] * 0.1, seq[0][1] * 0.9 + seq[2][1] * 0.1];
    return densify([...seq, end]);
  },
  circle(R) {
    const s = R() * Math.PI * 2, dir = R() < 0.5 ? 1 : -1, sweep = Math.PI * 2 * (0.92 + R() * 0.15), asp = 0.75 + R() * 0.3;
    const pts: Pt[] = [];
    for (let i = 0; i <= 50; i++) { const a = s + dir * (i / 50) * sweep; pts.push({ x: Math.cos(a), y: Math.sin(a) * asp }); }
    return pts;
  },
  zigzag(R) {
    const n = 3 + Math.floor(R() * 2);
    const vs: number[][] = [];
    for (let i = 0; i <= n; i++) vs.push([i / n, i % 2 ? 0.7 + R() * 0.2 : R() * 0.2]);
    const pts = densify(vs);
    return R() < 0.5 ? pts.reverse() : pts;
  },
  // V and check marks as people actually draw them: narrow to wide, lopsided arms, bowed strokes,
  // rounded bottoms, little end-hooks, either direction
  vee(R) {
    const half = 0.18 + R() * 0.85;                       // ~10..60 degree half-angle
    const short = 0.45 + R() * 0.55, which = R() < 0.5;   // one arm may be shorter (check mark)
    const la = which ? short : 1, ra = which ? 1 : short;
    const bow = (R() - 0.5) * 0.25, round = R() < 0.3 ? 0.08 + R() * 0.1 : 0;
    const L = [-Math.sin(half) * la, -Math.cos(half) * la], Rr = [Math.sin(half) * ra, -Math.cos(half) * ra];
    const pts: Pt[] = [];
    const arm = (a: number[], b: number[], n: number) => {
      for (let k = 0; k <= n; k++) {
        const t = k / n, bowK = Math.sin(t * Math.PI) * bow;
        pts.push({ x: a[0] + (b[0] - a[0]) * t + bowK, y: a[1] + (b[1] - a[1]) * t });
      }
    };
    arm(L, [-round, -round * 0.5], 14);
    if (round) for (let k = 1; k < 6; k++) { const a = Math.PI + (k / 6) * Math.PI; pts.push({ x: Math.cos(a) * round, y: -Math.sin(a) * round * 0.5 - round * 0.5 }); }
    arm([round, -round * 0.5], Rr, 14);
    if (R() < 0.15) { const e = pts[pts.length - 1]; pts.push({ x: e.x + 0.06, y: e.y + 0.05 }); }
    return R() < 0.5 ? pts.reverse() : pts;
  },
};

for (const rune of Object.keys(makers) as RuneName[]) {
  test(`recognises sloppy ${rune}s (>= 90%)`, () => {
    const R = rng(rune.length * 977);
    let ok = 0;
    const wrong: Record<string, number> = {};
    const N = 150;
    for (let i = 0; i < N; i++) {
      // V's are drawn upright in practice; everything else may be tilted up to ~26 degrees
      const r = rec.recognize(humanize(makers[rune](R), R, { rot: rune === "vee" ? 0.3 : 0.45 }));
      if (r.rune === rune) ok++;
      else wrong[String(r.rune)] = (wrong[String(r.rune)] ?? 0) + 1;
    }
    console.log(rune, ok, N, JSON.stringify(wrong)); assert.ok(ok / N >= 0.9, `${rune}: ${ok}/${N} correct, misses: ${JSON.stringify(wrong)}`);
  });
}

test("accepts hard human circles: open gaps, overdrawn loops, eggs, wobble (>= 92%)", () => {
  const R = rng(4242);
  let ok = 0;
  const wrong: Record<string, number> = {};
  const N = 200;
  for (let i = 0; i < N; i++) {
    const s = R() * Math.PI * 2, dir = R() < 0.5 ? 1 : -1;
    const sweep = Math.PI * 2 * (0.78 + R() * 0.52);           // 0.78 .. 1.30 turns
    const asp = 0.6 + R() * 0.45;                             // ovals
    const egg = (R() - 0.5) * 0.35;                           // one end fatter
    const w1 = R() * 6.28, w2 = R() * 6.28, wob = 0.04 + R() * 0.08;
    const pts: Pt[] = [];
    for (let k = 0; k <= 60; k++) {
      const a = s + dir * (k / 60) * sweep;
      const r = 1 + wob * Math.sin(a * 2 + w1) + wob * 0.6 * Math.sin(a * 3 + w2) + egg * Math.cos(a);
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * asp });
    }
    const res = rec.recognize(humanize(pts, R, { rot: 0.6, jitter: 0.03 }));
    if (res.rune === "circle") ok++;
    else wrong[String(res.rune)] = (wrong[String(res.rune)] ?? 0) + 1;
  }
  console.log("hard circles", ok, N, JSON.stringify(wrong));
  assert.ok(ok / N >= 0.92, `hard circles: ${ok}/${N}, misses ${JSON.stringify(wrong)}`);
});

test("carets / half-drawn triangles do NOT cast the V spell (>= 95%)", () => {
  const R = rng(777);
  let asVee = 0;
  const N = 150;
  for (let i = 0; i < N; i++) {
    // upside-down V (the first two sides of a triangle, apex up), sometimes with a stub of the third side
    const half = 0.3 + R() * 0.6;
    const vs = [[-Math.sin(half), Math.cos(half)], [0, 0], [Math.sin(half), Math.cos(half)]];
    if (R() < 0.4) vs.push([Math.sin(half) - 0.3, Math.cos(half)]);
    const pts = densify(R() < 0.5 ? vs : [...vs].reverse());
    if (rec.recognize(humanize(pts, R, { rot: 0.3 })).rune === "vee") asVee++;
  }
  console.log("carets as vee", asVee, N);
  assert.ok(asVee / N <= 0.05, `${asVee}/${N} carets were read as V`);
});

test("squares and rectangles do NOT cast any spell (>= 92%)", () => {
  const R = rng(4444);
  let asTri = 0;
  const N = 200;
  for (let i = 0; i < N; i++) {
    // squares / rectangles / diamonds as people draw them: any start corner, either direction, sloppy closing
    const asp = 0.65 + R() * 0.7;
    let vs = [[-1, -asp], [1, -asp], [1, asp], [-1, asp]];
    const start = Math.floor(R() * 4);
    vs = [...vs.slice(start), ...vs.slice(0, start)];
    if (R() < 0.5) vs = [vs[0], vs[3], vs[2], vs[1]];
    const end = R() < 0.6 ? vs[0] : [vs[0][0] * 0.85 + vs[3][0] * 0.15, vs[0][1] * 0.85 + vs[3][1] * 0.15];
    let pts = densify([...vs, end]);
    if (R() < 0.25) { const c = Math.cos(0.785), s2 = Math.sin(0.785); pts = pts.map((q) => ({ x: q.x * c - q.y * s2, y: q.x * s2 + q.y * c })); } // diamond
    const got = rec.recognize(humanize(pts, i % 2 ? R : () => 0.5)).rune; // half the squares drawn neatly
    if (got) asTri++;
  }
  console.log("squares cast a spell", asTri, N);
  assert.ok(asTri / N <= 0.08, `${asTri}/${N} squares cast a spell`);
});

test("straight and gently curved swipes are read as swipes, not runes (>= 95%)", () => {
  const R = rng(9090);
  let swipes = 0;
  const N = 150;
  for (let i = 0; i < N; i++) {
    const bend = (R() - 0.5) * 0.35; // slight arc
    const pts: Pt[] = [];
    for (let k = 0; k <= 30; k++) { const t = k / 30; pts.push({ x: t, y: Math.sin(t * Math.PI) * bend + (R() - 0.5) * 0.01 }); }
    const a = R() * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); // any direction
    const r = rec.recognize(pts.map((q) => ({ x: (q.x * c - q.y * s) * 150 + 200, y: (q.x * s + q.y * c) * 150 + 300 })));
    if (r.rune === null && r.reason === "swipe") swipes++;
  }
  console.log("swipes", swipes, N);
  assert.ok(swipes / N >= 0.95, `${swipes}/${N} swipes detected`);
});

test("rejects straight lines, dots and random scribbles", () => {
  const R = rng(99);
  let accepted = 0;
  const N = 120;
  for (let i = 0; i < N; i++) {
    let pts: Pt[];
    if (i % 3 === 0) pts = densify([[0, 0], [1, (R() - 0.5) * 0.3]]);
    else if (i % 3 === 1) pts = densify([[0, 0], [0.5 + R() * 0.3, 0.1], [0.2, 0.15]]);
    else {
      const vs: number[][] = [];
      let x = 0, y = 0;
      for (let k = 0; k < 9; k++) { x += (R() - 0.5) * 1.6; y += (R() - 0.5) * 1.6; vs.push([x, y]); }
      pts = densify(vs);
    }
    if (rec.recognize(humanize(pts, R)).rune) accepted++;
  }
  console.log("junk accepted", accepted, N); assert.ok(accepted / N <= 0.25, `accepted ${accepted}/${N} junk strokes`);
});

test("respects the enabled rune list", () => {
  const only = new RuneRecognizer({ threshold: 0.72, strongThreshold: 0.86, enabled: ["triangle"] });
  const R = rng(5);
  const r = only.recognize(humanize(makers.circle(R), R));
  assert.notEqual(r.rune, "circle");
});

// Beginners' triangles: often left open (55-90% of the last side drawn), rounded, lopsided or tilted.
// Playtest v1.6.2 showed ~30% of these fizzling (read as a square, or as a still-locked rune).
function beginnerTriangle(R: () => number): Pt[] {
  const v = [[(R() - 0.5) * 0.5, -1 + R() * 0.3], [0.6 + R() * 0.5, 0.4 + R() * 0.35], [-0.6 - R() * 0.5, 0.4 + R() * 0.35]];
  const start = Math.floor(R() * 3);
  let seq = [...v.slice(start), ...v.slice(0, start)];
  if (R() < 0.5) seq = [seq[0], seq[2], seq[1]];
  const close = R() < 0.35 ? 1 : 0.55 + R() * 0.35;
  const end = [seq[2][0] + (seq[0][0] - seq[2][0]) * close, seq[2][1] + (seq[0][1] - seq[2][1]) * close];
  let pts = densify([...seq, end]);
  if (R() < 0.4) {
    const src = pts;
    pts = src.map((_, i) => {
      let x = 0, y = 0, n = 0;
      for (let j = -3; j <= 3; j++) { const q = src[Math.min(src.length - 1, Math.max(0, i + j))]; x += q.x; y += q.y; n++; }
      return { x: x / n, y: y / n };
    });
  }
  return pts;
}

test("wave 1 (triangle only): beginners' triangles cast Fireball (>= 95%)", () => {
  const wave1 = new RuneRecognizer({ threshold: 0.72, strongThreshold: 0.86, enabled: ["triangle"] });
  const R = rng(4242);
  let ok = 0;
  const N = 400;
  for (let i = 0; i < N; i++) if (wave1.recognize(humanize(beginnerTriangle(R), R, { rot: 0.5, jitter: 0.05 })).rune === "triangle") ok++;
  console.log("beginner triangles cast in wave 1", ok, N);
  assert.ok(ok / N >= 0.95, `${ok}/${N}`);
});

test("all runes unlocked: beginners' triangles still cast a spell (>= 95%), mostly Fireball (>= 80%)", () => {
  const R = rng(4243);
  let tri = 0, any = 0;
  const N = 400;
  for (let i = 0; i < N; i++) {
    const r = rec.recognize(humanize(beginnerTriangle(R), R, { rot: 0.5, jitter: 0.05 })).rune;
    if (r) any++;
    if (r === "triangle") tri++;
  }
  console.log("beginner triangles, all runes: fireball", tri, "any spell", any, N);
  assert.ok(any / N >= 0.95 && tri / N >= 0.8, `fireball ${tri}/${N}, any ${any}/${N}`);
});
