// Offline rune recognizer: $1 Unistroke matching (Wobbrock et al. 2007) over procedurally
// generated templates, plus geometric feature gates (closure, net turning, corner count) that
// keep similar shapes (triangle vs circle, zigzag vs triangle) apart.
// Dependency-free and erasable-TS only, so the Node test runner can import it directly.

export type Pt = { x: number; y: number };
export type RuneName = "triangle" | "circle" | "zigzag" | "vee";

export interface Features {
  closure: number;   // start-end distance / bbox size (0 = closed)
  netTurn: number;   // |signed turning| in degrees
  totalTurn: number; // sum |turning| in degrees
  corners: number;   // sharp direction changes
  radial: number;    // inner/outer radius ratio around the centroid (circle ~0.8)
  dip: number;       // V-ness: shorter arm's climb / taller arm's climb (0..1); 0 if the low point isn't mid-stroke
  length: number;    // path length (input units)
  size: number;      // bbox max side (input units)
}

export interface RecognizeResult {
  rune: RuneName | null;
  score: number;
  best: RuneName;
  bestScore: number;
  gated: RuneName[];
  scores: Record<RuneName, number>;
  features: Features;
  reason?: string;
  /** how well the stroke matched a known NON-rune shape (e.g. a square), 0..1 */
  rejectScore?: number;
}

export interface RecognizerOptions {
  threshold: number;
  strongThreshold: number;
  enabled?: RuneName[];
}

const N = 64;
const SIZE = 250;
const HALF_DIAG = 0.5 * Math.sqrt(2 * SIZE * SIZE);
const ANGLE_RANGE = (45 * Math.PI) / 180;
const ANGLE_PREC = (2 * Math.PI) / 180;
const PHI = 0.5 * (-1 + Math.sqrt(5));
const RUNES: RuneName[] = ["triangle", "circle", "zigzag", "vee"];

// ------------------------------------------------------------------ geometry helpers
function pathLength(pts: Pt[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return d;
}
export function resample(points: Pt[], n: number = N): Pt[] {
  const pts = points.map((p) => ({ x: p.x, y: p.y }));
  const I = pathLength(pts) / (n - 1);
  if (I === 0) return Array.from({ length: n }, () => ({ ...pts[0] }));
  let D = 0;
  const out: Pt[] = [{ ...pts[0] }];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (D + d >= I && d > 0) {
      const t = (I - D) / d;
      const q = { x: pts[i - 1].x + t * (pts[i].x - pts[i - 1].x), y: pts[i - 1].y + t * (pts[i].y - pts[i - 1].y) };
      out.push(q);
      pts.splice(i, 0, q);
      D = 0;
    } else D += d;
  }
  while (out.length < n) out.push({ ...pts[pts.length - 1] });
  return out.slice(0, n);
}
function centroid(pts: Pt[]): Pt {
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
}
function bbox(pts: Pt[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function rotateBy(pts: Pt[], a: number): Pt[] {
  const c = centroid(pts), cos = Math.cos(a), sin = Math.sin(a);
  return pts.map((p) => ({
    x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
    y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y,
  }));
}
function scaleTo(pts: Pt[], size: number): Pt[] {
  const b = bbox(pts);
  // keep near-1D strokes from blowing up: never stretch an axis more than 3x the other
  const w = Math.max(b.w, b.h / 3, 1e-6), h = Math.max(b.h, b.w / 3, 1e-6);
  return pts.map((p) => ({ x: (p.x * size) / w, y: (p.y * size) / h }));
}
function translateToOrigin(pts: Pt[]): Pt[] {
  const c = centroid(pts);
  return pts.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
}
function pathDistance(a: Pt[], b: Pt[]): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return d / a.length;
}
function distanceAtAngle(pts: Pt[], tpl: Pt[], a: number) {
  return pathDistance(rotateBy(pts, a), tpl);
}
function distanceAtBestAngle(pts: Pt[], tpl: Pt[]): number {
  let a = -ANGLE_RANGE, b = ANGLE_RANGE;
  let x1 = PHI * a + (1 - PHI) * b, f1 = distanceAtAngle(pts, tpl, x1);
  let x2 = (1 - PHI) * a + PHI * b, f2 = distanceAtAngle(pts, tpl, x2);
  while (Math.abs(b - a) > ANGLE_PREC) {
    if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = PHI * a + (1 - PHI) * b; f1 = distanceAtAngle(pts, tpl, x1); }
    else { a = x1; x1 = x2; f1 = f2; x2 = (1 - PHI) * a + PHI * b; f2 = distanceAtAngle(pts, tpl, x2); }
  }
  return Math.min(f1, f2);
}
/** full $1 normalisation */
export function normalize(points: Pt[]): Pt[] {
  let pts = resample(points, N);
  const c = centroid(pts);
  const ang = Math.atan2(c.y - pts[0].y, c.x - pts[0].x);
  pts = rotateBy(pts, -ang);
  pts = scaleTo(pts, SIZE);
  return translateToOrigin(pts);
}

// ------------------------------------------------------------------ features
export function features(points: Pt[]): Features {
  const length = pathLength(points);
  const b = bbox(points);
  const size = Math.max(b.w, b.h, 1e-6);
  const p = resample(points, 48);
  const closure = Math.hypot(p[0].x - p[p.length - 1].x, p[0].y - p[p.length - 1].y) / size;
  let net = 0, total = 0;
  const dirs: number[] = [];
  for (let i = 1; i < p.length; i++) dirs.push(Math.atan2(p[i].y - p[i - 1].y, p[i].x - p[i - 1].x));
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  for (let i = 1; i < dirs.length; i++) {
    const d = wrap(dirs[i] - dirs[i - 1]);
    net += d;
    total += Math.abs(d);
  }
  // corners: direction change across a +/-k window, local maxima above a threshold
  const k = 3, turn: number[] = [];
  for (let i = 0; i < p.length; i++) {
    if (i < k || i >= p.length - k) { turn.push(0); continue; }
    const a1 = Math.atan2(p[i].y - p[i - k].y, p[i].x - p[i - k].x);
    const a2 = Math.atan2(p[i + k].y - p[i].y, p[i + k].x - p[i].x);
    turn.push(Math.abs(wrap(a2 - a1)));
  }
  let corners = 0, last = -99;
  const T = (68 * Math.PI) / 180;
  for (let i = 1; i < turn.length - 1; i++) {
    if (turn[i] > T && turn[i] >= turn[i - 1] && turn[i] >= turn[i + 1] && i - last > 4) { corners++; last = i; }
  }
  // radial consistency: 15th / 85th percentile distance from the centroid (aspect-normalised)
  const c = centroid(p);
  const sx = Math.max(b.w, 1e-6), sy = Math.max(b.h, 1e-6);
  const radii = p.map((q) => Math.hypot((q.x - c.x) / sx, (q.y - c.y) / sy)).sort((u, v) => u - v);
  const radial = radii[Math.floor(radii.length * 0.15)] / Math.max(1e-6, radii[Math.floor(radii.length * 0.85)]);
  // V orientation: the lowest point (screen y grows downward) must be mid-stroke with both ends above it.
  // This is what tells a V apart from a caret (the first two sides of a triangle), which $1 alone can't.
  let lo = 0;
  for (let i = 1; i < p.length; i++) if (p[i].y > p[lo].y) lo = i;
  const loFrac = lo / (p.length - 1);
  const rise0 = p[lo].y - p[0].y, rise1 = p[lo].y - p[p.length - 1].y;
  // both arms must climb: the shorter climb as a share of the taller one, and the taller climb must be real
  const dip = loFrac > 0.12 && loFrac < 0.88 && Math.max(rise0, rise1) / size >= 0.22
    ? Math.min(rise0, rise1) / Math.max(rise0, rise1, 1e-6) : 0;
  const deg = 180 / Math.PI;
  return { closure, netTurn: Math.abs(net) * deg, totalTurn: total * deg, corners, radial, dip, length, size };
}

function gate(r: RuneName, f: Features): boolean {
  switch (r) {
    case "triangle": return f.closure < 0.5 && f.netTurn > 200 && f.netTurn < 480 && f.corners >= 2 && f.corners <= 4;
    // forgiving: open gaps, overdrawn loops, ovals and wobble are all fine as long as the radius stays roughly constant
    case "circle": return f.closure < 0.7 && f.netTurn > 220 && f.netTurn < 640 && f.corners <= 3 && f.radial > 0.45;
    case "zigzag": return f.closure > 0.3 && f.netTurn < 230 && f.corners >= 2 && f.totalTurn > 150;
    // V / check mark (or a gentle U): open, dips in the middle with both ends well above the low point,
    // bends 55-220 degrees overall. W has 3+ corners and a Z never dips, so neither passes.
    // (net turning is unreliable for sharp V's: a ~180deg reversal can sum as +170 or -190, so only U-shapes use it)
    case "vee": return f.closure > 0.25 && f.dip >= 0.25 &&
      ((f.corners >= 1 && f.corners <= 2) || (f.corners === 0 && f.netTurn >= 55 && f.netTurn <= 220));
  }
}

// ------------------------------------------------------------------ templates
function poly(vs: number[][], close: boolean, overshoot = 0): Pt[] {
  const pts: Pt[] = [];
  const seq = close ? [...vs, vs[0]] : vs;
  for (let i = 0; i < seq.length - 1; i++)
    for (let t = 0; t < 1; t += 0.1) pts.push({ x: seq[i][0] + (seq[i + 1][0] - seq[i][0]) * t, y: seq[i][1] + (seq[i + 1][1] - seq[i][1]) * t });
  const end = seq[seq.length - 1];
  pts.push({ x: end[0], y: end[1] });
  if (overshoot && close) {
    const n = seq[1];
    pts.push({ x: end[0] + (n[0] - end[0]) * overshoot, y: end[1] + (n[1] - end[1]) * overshoot });
  }
  return pts;
}
function rotations<T>(arr: T[], k: number): T[] {
  return [...arr.slice(k), ...arr.slice(0, k)];
}

/** raw (un-normalised) template paths, one list per rune */
export function templatePaths(): Record<RuneName, Pt[][]> {
  const out: Record<RuneName, Pt[][]> = { triangle: [], circle: [], zigzag: [], vee: [] };
  // triangles: equilateral / tall / wide, every start vertex, both directions
  const tris = [
    [[0, -1], [0.866, 0.5], [-0.866, 0.5]],
    [[0, -1], [0.6, 0.7], [-0.6, 0.7]],
    [[0, -0.7], [1, 0.5], [-1, 0.5]],
  ];
  for (const t of tris)
    for (let s = 0; s < 3; s++)
      for (const dir of [1, -1]) {
        const v = rotations(dir > 0 ? t : [...t].reverse(), s);
        out.triangle.push(poly(v, true, 0.08));
      }
  // circles: four start angles, both directions, two aspects, open / closed / overdrawn sweeps
  for (const aspect of [1, 0.72])
    for (const sweep of [0.85, 1.04, 1.25])
      for (let s = 0; s < 4; s++)
        for (const dir of [1, -1]) {
          const pts: Pt[] = [];
          for (let i = 0; i <= 48; i++) {
            const a = (s * Math.PI) / 2 + dir * (i / 48) * Math.PI * 2 * sweep;
            pts.push({ x: Math.cos(a), y: Math.sin(a) * aspect });
          }
          out.circle.push(pts);
        }
  // zigzags: Z, N, W/M, lightning bolt; each also reversed
  const zz = [
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 1], [0.33, 0], [0.66, 1], [1, 0]],
    [[0, 0], [0.25, 1], [0.5, 0], [0.75, 1], [1, 0]],
    [[0.6, 0], [0.15, 0.5], [0.85, 0.5], [0.35, 1]],
    [[0, 0.3], [0.33, 0], [0.33, 0.7], [0.66, 0.3], [0.66, 1], [1, 0.7]],
  ];
  for (const z of zz) {
    out.zigzag.push(poly(z, false));
    out.zigzag.push(poly([...z].reverse(), false));
  }
  // V / check marks: narrow to wide, symmetric and lopsided (check mark), both stroke directions, plus a rounded U
  for (const half of [0.25, 0.45, 0.7, 0.95])         // half-angle of the V (radians)
    for (const arm of [1, 0.55])                       // second arm length (0.55 = check mark)
      for (const dir of [1, -1]) {
        const l = [-Math.sin(half), -Math.cos(half)], r = [Math.sin(half) * arm, -Math.cos(half) * arm];
        const v = dir > 0 ? [l, [0, 0], r] : [r, [0, 0], l];
        out.vee.push(poly(v, false));
      }
  for (const dir of [1, -1]) {
    const pts: Pt[] = [];
    for (let i = 0; i <= 30; i++) { const a = Math.PI + (dir > 0 ? i : 30 - i) / 30 * Math.PI; pts.push({ x: Math.cos(a) * 0.6, y: -Math.sin(a) * 1 - 0.2 }); }
    out.vee.push(pts);
  }
  return out;
}

/** non-rune shapes that would otherwise be read as a rune */
export function rejectPaths(): Pt[][] {
  const out: Pt[][] = [];
  for (const asp of [1, 0.7, 1.4]) {
    const box = [[-1, -asp], [1, -asp], [1, asp], [-1, asp]];
    for (let st = 0; st < 4; st++)
      for (const dir of [1, -1]) {
        const v = rotations(dir > 0 ? box : [...box].reverse(), st);
        out.push(poly(v, true, 0.06));
      }
    // starting in the middle of the top edge
    out.push(poly([[0, -asp], [1, -asp], [1, asp], [-1, asp], [-1, -asp], [0, -asp]], false));
    out.push(poly([[0, -asp], [-1, -asp], [-1, asp], [1, asp], [1, -asp], [0, -asp]], false));
  }
  return out;
}

export class RuneRecognizer {
  private templates: { rune: RuneName; pts: Pt[] }[] = [];
  /** shapes that look rune-like to the gates but must NOT cast (squares/rectangles look like triangles) */
  private rejects: Pt[][] = [];
  opts: RecognizerOptions;
  constructor(opts: RecognizerOptions) {
    this.opts = opts;
    const paths = templatePaths();
    for (const r of RUNES) for (const p of paths[r]) this.templates.push({ rune: r, pts: normalize(p) });
    for (const p of rejectPaths()) this.rejects.push(normalize(p));
  }

  recognize(points: Pt[]): RecognizeResult {
    const f = features(points);
    const enabled = this.opts.enabled ?? RUNES;
    const scores = { triangle: 0, circle: 0, zigzag: 0, vee: 0 } as Record<RuneName, number>;
    const empty = (reason: string): RecognizeResult => ({ rune: null, score: 0, best: "triangle", bestScore: 0, gated: [], scores, features: f, reason });
    if (points.length < 5) return empty("too few points");
    const cand = normalize(points);
    for (const t of this.templates) {
      const s = 1 - distanceAtBestAngle(cand, t.pts) / HALF_DIAG;
      if (s > scores[t.rune]) scores[t.rune] = s;
    }
    const gated = RUNES.filter((r) => gate(r, f));
    let best: RuneName = "triangle";
    for (const r of RUNES) if (scores[r] > scores[best]) best = r;

    // pick among gated, enabled runes first
    let pick: RuneName | null = null;
    for (const r of gated) if (enabled.includes(r) && (pick === null || scores[r] > scores[pick])) pick = r;
    // a square matches the square templates better than any rune: fizzle instead of casting Fireball
    // squares slip into the triangle gate (2-4 corners) and, when neat, the circle gate (the start/end
    // corner isn't counted, and the radius is fairly constant). Real circles rarely have 3+ sharp corners.
    const squareRisk = pick === "triangle" || (pick === "circle" && f.corners >= 3);
    let rejectScore = 0;
    if (squareRisk) for (const t of this.rejects) rejectScore = Math.max(rejectScore, 1 - distanceAtBestAngle(cand, t) / HALF_DIAG);
    if (pick && squareRisk && rejectScore > scores[pick] && f.closure < 0.5)
      return { rune: null, score: scores[pick], best, bestScore: scores[best], gated, scores, features: f, reason: "square", rejectScore };
    if (pick && scores[pick] >= this.opts.threshold) return { rune: pick, score: scores[pick], best, bestScore: scores[best], gated, scores, features: f };
    // no gate agreed: allow a very confident template match
    // (never for the V: without its orientation gate a caret / half-drawn triangle would cast it)
    if (best !== "vee" && enabled.includes(best) && scores[best] >= this.opts.strongThreshold && gated.length === 0)
      return { rune: best, score: scores[best], best, bestScore: scores[best], gated, scores, features: f };
    return { rune: null, score: pick ? scores[pick] : scores[best], best, bestScore: scores[best], gated, scores, features: f, reason: pick ? "low score" : "no shape match" };
  }
}

/** idealised glyph (unit box, centred) used for the "rune snaps clean" flash and ghost demos */
export function idealGlyph(r: RuneName): Pt[] {
  switch (r) {
    case "triangle": return poly([[0, -0.5], [0.45, 0.4], [-0.45, 0.4]], true);
    case "circle": {
      const p: Pt[] = [];
      for (let i = 0; i <= 40; i++) { const a = -Math.PI / 2 + (i / 40) * Math.PI * 2; p.push({ x: Math.cos(a) * 0.48, y: Math.sin(a) * 0.48 }); }
      return p;
    }
    case "zigzag": return poly([[-0.45, -0.4], [0.45, -0.4], [-0.45, 0.4], [0.45, 0.4]], false);
    case "vee": return poly([[-0.38, -0.42], [0, 0.42], [0.38, -0.42]], false);
  }
}
