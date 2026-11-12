import type Phaser from "phaser";

type P = { x: number; y: number };

/**
 * Stroke a polyline as independent segments with round joints. Phaser's WebGL strokePath uses
 * miter joins, which spike out at very sharp angles (spiral centres, triangle corners, lightning).
 */
export function strokeSegments(g: Phaser.GameObjects.Graphics, pts: P[], width: number, color: number, alpha: number, ox = 0, oy = 0, count = pts.length) {
  if (count < 2) return;
  g.lineStyle(width, color, alpha);
  for (let i = 1; i < count; i++) g.lineBetween(ox + pts[i - 1].x, oy + pts[i - 1].y, ox + pts[i].x, oy + pts[i].y);
  if (width >= 2) {
    g.fillStyle(color, alpha);
    const r = width / 2;
    // square caps on joints, thinned so translucent glow passes don't bead too much. At these
    // widths (≤ 6 art px) a square reads the same as a circle, and fillRect is a plain quad:
    // fillCircle is re-triangulated (earcut) every frame, which made bolts expensive.
    const step = width >= 4 ? 2 : 1;
    const cap = (x: number, y: number) => g.fillRect(x - r, y - r, width, width);
    for (let i = 0; i < count; i += step) cap(ox + pts[i].x, oy + pts[i].y);
    cap(ox + pts[count - 1].x, oy + pts[count - 1].y);
  }
}
