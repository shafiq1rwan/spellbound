// Gameplay analytics -> PokiSDK.measure(category, what, action). See docs/ANALYTICS.md for the
// full event list. Rules from Poki's docs: no "/" or "^" in any value; keep values stable across
// versions; "start"/"complete"/"fail" form progress funnels, "visible"/"interact" form interaction
// funnels, any other action reports the % of gameplays that reached it.
// Milestones are de-duplicated per run (or per session) so those percentages stay meaningful.
import { Poki } from "./Poki";

export type Once = "run" | "session" | false;
export interface TrackedEvent { t: number; category: string; what: string; action: string }

const clean = (v: string | number) =>
  String(v).toLowerCase().trim().replace(/[\/^\s]+/g, "-").replace(/[^a-z0-9:._+-]/g, "").slice(0, 40) || "none";

class AnalyticsManager {
  /** last events, for QA (window.__analytics.log) */
  log: TrackedEvent[] = [];
  private runKeys = new Set<string>();
  private sessionKeys = new Set<string>();
  private runCount = 0;

  /** call at the start of every run */
  newRun() {
    this.runKeys.clear();
    this.runCount++;
    const bucket = this.runCount >= 5 ? "5+" : String(this.runCount);
    this.track("run", bucket, "start");
  }

  track(category: string, what: string | number, action: string, once: Once = false) {
    const c = clean(category), w = clean(what), a = clean(action);
    const key = `${c}|${w}|${a}`;
    if (once === "run") {
      if (this.runKeys.has(key)) return;
      this.runKeys.add(key);
    } else if (once === "session") {
      if (this.sessionKeys.has(key)) return;
      this.sessionKeys.add(key);
    }
    this.log.push({ t: Math.round(performance.now()), category: c, what: w, action: a });
    if (this.log.length > 300) this.log.shift();
    if (import.meta.env.DEV) console.debug("[analytics]", c, w, a);
    Poki.measure(c, w, a);
  }

  /** helpers for capped numeric "what" values (keeps the value set small and stable) */
  static cap(n: number, max: number) {
    return n >= max ? `${max}+` : String(n);
  }
}

export const Analytics = new AnalyticsManager();
export const cap = AnalyticsManager.cap;
