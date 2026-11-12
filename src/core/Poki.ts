// PokiAdapter — the only file that talks to the Poki SDK (https://sdk.poki.com).
// Documented API used: PokiSDK.init(), gameLoadingFinished(), gameplayStart(), gameplayStop(),
// commercialBreak(onStart).then(), setDebug(), measure(category, what, action). Everything degrades to no-ops when the SDK is
// absent (local dev, blocked script), so the game never depends on it to run.
import { Audio } from "./Audio";

type PokiSDKType = {
  init: () => Promise<void>;
  setDebug?: (on: boolean) => void;
  gameLoadingFinished: () => void;
  gameplayStart: () => void;
  gameplayStop: () => void;
  commercialBreak: (onStart?: () => void) => Promise<void>;
  measure?: (category: string, what: string, action: string) => void;
};
declare global {
  interface Window { PokiSDK?: PokiSDKType }
}

const SDK_URL = "https://game-cdn.poki.com/scripts/v2/poki-sdk.js";

class PokiAdapter {
  ready = false;
  private playing = false;
  private inBreak = false;
  /** loadingFinished() was requested before the SDK was ready: replay it once it is */
  private loadedPending = false;
  private initPromise: Promise<void> | null = null;
  /** analytics events sent before the SDK was ready (flushed once it is) */
  private measureQueue: [string, string, string][] = [];

  /** starts SDK init once; await it before gameLoadingFinished() */
  start() {
    this.initPromise ??= this.init();
    return this.initPromise;
  }

  private sdk(): PokiSDKType | null {
    return this.ready && window.PokiSDK ? window.PokiSDK : null;
  }

  /** never wait more than this for the SDK before showing the game */
  private static MAX_WAIT_MS = 3000;

  async init(): Promise<void> {
    if (import.meta.env.VITE_POKI === "off") return;
    await Promise.race([this.initInner(), new Promise<void>((r) => setTimeout(r, PokiAdapter.MAX_WAIT_MS))]);
  }

  private async initInner(): Promise<void> {
    try {
      if (!window.PokiSDK) await this.loadScript(SDK_URL, PokiAdapter.MAX_WAIT_MS);
      if (!window.PokiSDK) return;
      // never let a slow/blocked SDK hold the game hostage
      const ok = await Promise.race([
        window.PokiSDK.init().then(() => true, () => true),
        new Promise<boolean>((r) => setTimeout(() => r(false), PokiAdapter.MAX_WAIT_MS)),
      ]);
      this.ready = true;
      if (this.loadedPending) this.loadingFinished();
      this.flushMeasures();
      if (!ok) console.info("[poki] init timed out; continuing");
      const local = /^(localhost|127\.|192\.168\.|\[::1\])/.test(location.hostname);
      if (local) window.PokiSDK.setDebug?.(true);
    } catch (e) {
      // init rejects when an adblocker is active: continue without ads
      this.ready = !!window.PokiSDK;
      console.info("[poki] SDK unavailable, running standalone", e);
    }
  }

  private loadScript(src: string, timeoutMs: number) {
    return new Promise<void>((resolve) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      const t = window.setTimeout(resolve, timeoutMs);
      s.onload = () => { clearTimeout(t); resolve(); };
      s.onerror = () => { clearTimeout(t); resolve(); };
      document.head.appendChild(s);
    });
  }

  /** PokiSDK.measure — custom analytics event (see src/core/Analytics.ts) */
  measure(category: string, what: string, action: string) {
    const sdk = this.sdk();
    if (!sdk) {
      if (this.measureQueue.length < 100) this.measureQueue.push([category, what, action]);
      return;
    }
    try { sdk.measure?.(category, what, action); } catch { /* ignore */ }
  }
  private flushMeasures() {
    const q = this.measureQueue;
    this.measureQueue = [];
    for (const [c, w, a] of q) this.measure(c, w, a);
  }

  loadingFinished() {
    const sdk = this.sdk();
    this.loadedPending = !sdk;
    try { sdk?.gameLoadingFinished(); } catch { /* ignore */ }
  }
  gameplayStart() {
    if (this.playing || this.inBreak) return;
    this.playing = true;
    try { this.sdk()?.gameplayStart(); } catch { /* ignore */ }
  }
  gameplayStop() {
    if (!this.playing) return;
    this.playing = false;
    try { this.sdk()?.gameplayStop(); } catch { /* ignore */ }
  }
  /** natural break (e.g. before a retry). Always resolves; audio is muted during the ad. */
  async commercialBreak(): Promise<void> {
    const sdk = this.sdk();
    if (!sdk || this.inBreak) return;
    this.gameplayStop();
    this.inBreak = true;
    try {
      await sdk.commercialBreak(() => Audio.mute("ad", true));
    } catch { /* ignore */ }
    Audio.mute("ad", false);
    this.inBreak = false;
  }
}

export const Poki = new PokiAdapter();
