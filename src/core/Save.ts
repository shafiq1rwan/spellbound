// SaveManager: localStorage with graceful fallback (private mode / blocked storage).
export interface Settings {
  sfx: number;
  music: number;
  quality: "high" | "low";
  reducedMotion: boolean;
  debugRunes: boolean;
}
export interface SaveData {
  version: 2;
  bestTimeMs: number;
  bestWave: number;
  bestKills: number;
  bestScore: number;
  runs: number;
  tutorialDone: boolean;
  settings: Settings;
}

const KEY = "spellbound-arena.v2";
const DEFAULTS: SaveData = {
  version: 2, bestTimeMs: 0, bestWave: 0, bestKills: 0, bestScore: 0, runs: 0, tutorialDone: false,
  settings: { sfx: 0.8, music: 0.5, quality: "high", reducedMotion: false, debugRunes: false },
};

class SaveManager {
  data: SaveData = structuredClone(DEFAULTS);

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = { ...structuredClone(DEFAULTS), ...parsed, settings: { ...DEFAULTS.settings, ...(parsed.settings ?? {}) } };
      }
    } catch {
      this.data = structuredClone(DEFAULTS);
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches && !this.hasKey()) this.data.settings.reducedMotion = true;
    return this.data;
  }
  private hasKey() {
    try { return localStorage.getItem(KEY) !== null; } catch { return false; }
  }
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage unavailable: keep in memory */ }
  }
  get settings() {
    return this.data.settings;
  }
  /** returns which records were beaten */
  submitRun(r: { timeMs: number; wave: number; kills: number; score: number }) {
    const d = this.data;
    const beat = { time: r.timeMs > d.bestTimeMs, wave: r.wave > d.bestWave, score: r.score > d.bestScore };
    d.bestTimeMs = Math.max(d.bestTimeMs, r.timeMs);
    d.bestWave = Math.max(d.bestWave, r.wave);
    d.bestKills = Math.max(d.bestKills, r.kills);
    d.bestScore = Math.max(d.bestScore, r.score);
    d.runs++;
    this.save();
    return beat;
  }
}

export const Save = new SaveManager();

export function fmtTime(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
