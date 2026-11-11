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
  spiral(R) {
    const turns = 1.7 + R() * 0.8, dir = R() < 0.5 ? 1 : -1, s = R() * 6.28;
    const pts: Pt[] = [];
    for (let i = 0; i <= 90; i++) { const u = i / 90, th = s + dir * u * turns * Math.PI * 2; const r = 0.1 + u; pts.push({ x: Math.cos(th) * r, y: Math.sin(th) * r }); }
    return R() < 0.35 ? pts.reverse() : pts;
  },
};

for (const rune of Object.keys(makers) as RuneName[]) {
  test(`recognises sloppy ${rune}s (>= 90%)`, () => {
    const R = rng(rune.length * 977);
    let ok = 0;
    const wrong: Record<string, number> = {};
    const N = 150;
    for (let i = 0; i < N; i++) {
      const r = rec.recognize(humanize(makers[rune](R), R));
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
