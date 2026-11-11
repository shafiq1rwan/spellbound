// Unified touch/mouse/pen stroke capture straight from DOM pointer events.
// - getCoalescedEvents() keeps every sample even when the game runs at low FPS
// - pointer capture keeps the stroke alive when the finger leaves the canvas
// - cancellation (pointercancel, blur, tab hidden, lost capture) never casts
export interface StrokePoint { x: number; y: number; t: number }

export interface RuneInputHandlers {
  canStart(clientX: number, clientY: number): boolean;
  start(p: StrokePoint): void;
  move(ps: StrokePoint[]): void;
  end(): void;
  cancel(): void;
}

export class RuneInput {
  private el: HTMLElement;
  private h: RuneInputHandlers;
  private id: number | null = null;
  private off: (() => void)[] = [];

  constructor(el: HTMLElement, h: RuneInputHandlers) {
    this.el = el;
    this.h = h;
    const on = <K extends keyof HTMLElementEventMap>(target: HTMLElement | Window | Document, type: K | string, fn: (e: never) => void, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn as EventListener, opts);
      this.off.push(() => target.removeEventListener(type, fn as EventListener, opts));
    };
    on(el, "pointerdown", (e: PointerEvent) => this.down(e), { passive: false });
    on(el, "pointermove", (e: PointerEvent) => this.moveEv(e), { passive: false });
    on(el, "pointerup", (e: PointerEvent) => this.up(e));
    on(el, "pointercancel", (e: PointerEvent) => this.abort(e.pointerId));
    on(el, "lostpointercapture", (e: PointerEvent) => { if (e.pointerId === this.id) this.finish(); });
    on(window, "blur", () => this.abort());
    on(document, "visibilitychange", () => { if (document.hidden) this.abort(); });
    // block page scroll / zoom gestures while playing
    on(el, "touchmove", (e: TouchEvent) => e.preventDefault(), { passive: false });
    on(el, "contextmenu", (e: Event) => e.preventDefault());
  }

  get active() {
    return this.id !== null;
  }

  private down(e: PointerEvent) {
    if (this.id !== null) return;             // single stroke at a time
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!this.h.canStart(e.clientX, e.clientY)) return;
    this.id = e.pointerId;
    try { this.el.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    this.h.start({ x: e.clientX, y: e.clientY, t: e.timeStamp });
  }
  private moveEv(e: PointerEvent) {
    if (e.pointerId !== this.id) return;
    const list = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
    const pts = (list.length ? list : [e]).map((c) => ({ x: c.clientX, y: c.clientY, t: c.timeStamp }));
    this.h.move(pts);
  }
  private up(e: PointerEvent) {
    if (e.pointerId !== this.id) return;
    this.finish();
  }
  private finish() {
    if (this.id === null) return;
    const id = this.id;
    this.id = null;
    try { this.el.releasePointerCapture(id); } catch { /* ignore */ }
    this.h.end();
  }
  /** cancel the current stroke without casting */
  abort(pointerId?: number) {
    if (this.id === null || (pointerId !== undefined && pointerId !== this.id)) return;
    const id = this.id;
    this.id = null;
    try { this.el.releasePointerCapture(id); } catch { /* ignore */ }
    this.h.cancel();
  }
  destroy() {
    this.abort();
    this.off.forEach((f) => f());
    this.off = [];
  }
}
