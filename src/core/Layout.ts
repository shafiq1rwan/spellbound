// ResponsiveLayoutManager: one integer pixel scale S shared by the world camera and UI so every
// art pixel is S device pixels everywhere. UI scenes lay out in "art pixel" units (w x h).
import { GAME } from "../config/game";

export interface Insets { top: number; right: number; bottom: number; left: number }

class LayoutManager {
  dpr = 1;
  cssW = 390;
  cssH = 844;
  devW = 780;
  devH = 1688;
  /** device pixels per art pixel */
  S = 4;
  /** visible size in art pixels */
  w = 195;
  h = 422;
  safe: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  portrait = true;
  private listeners = new Set<() => void>();

  compute() {
    const host = document.getElementById("game");
    this.cssW = Math.max(200, host?.clientWidth || window.innerWidth);
    this.cssH = Math.max(200, host?.clientHeight || window.innerHeight);
    this.dpr = Math.min(GAME.maxDevicePixelRatio, Math.max(1, window.devicePixelRatio || 1));
    this.devW = Math.round(this.cssW * this.dpr);
    this.devH = Math.round(this.cssH * this.dpr);
    this.S = Math.max(2, Math.round(Math.min(this.devW, this.devH) / GAME.viewShortSide));
    this.w = this.devW / this.S;
    this.h = this.devH / this.S;
    this.portrait = this.cssH >= this.cssW;
    const el = document.getElementById("safe");
    if (el) {
      const cs = getComputedStyle(el);
      const k = this.dpr / this.S;
      this.safe = {
        top: Math.ceil(parseFloat(cs.paddingTop) * k) || 0,
        right: Math.ceil(parseFloat(cs.paddingRight) * k) || 0,
        bottom: Math.ceil(parseFloat(cs.paddingBottom) * k) || 0,
        left: Math.ceil(parseFloat(cs.paddingLeft) * k) || 0,
      };
    }
  }

  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit() {
    this.listeners.forEach((f) => f());
  }
  /** css client coords -> device canvas coords */
  toDevice(clientX: number, clientY: number, canvas: HTMLCanvasElement) {
    const r = canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * canvas.width, y: ((clientY - r.top) / r.height) * canvas.height };
  }
}

export const Layout = new LayoutManager();
