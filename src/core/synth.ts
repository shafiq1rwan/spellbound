// Tiny offline synth: renders every sound effect into a Float32Array once at load time.
// No audio files to download, no external requests, and playback is just buffer sources.

type Wave = "sine" | "tri" | "square" | "saw";

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

export class Synth {
  sr: number;
  constructor(sr: number) { this.sr = sr; }

  buf(sec: number) { return new Float32Array(Math.max(1, Math.ceil(sec * this.sr))); }

  /** envelope: attack -> exponential-ish decay */
  private env(t: number, dur: number, a: number, curve = 2) {
    if (t < a) return t / Math.max(a, 1e-4);
    const u = (t - a) / Math.max(dur - a, 1e-4);
    return u >= 1 ? 0 : Math.pow(1 - u, curve);
  }

  tone(out: Float32Array, at: number, dur: number, o: { f0: number; f1?: number; wave?: Wave; vol?: number; attack?: number; curve?: number; vib?: number; vibHz?: number; slide?: number }) {
    const { f0, f1 = f0, wave = "sine", vol = 0.5, attack = 0.005, curve = 2, vib = 0, vibHz = 6, slide = 1 } = o;
    const s0 = Math.floor(at * this.sr), n = Math.floor(dur * this.sr);
    let ph = 0;
    for (let i = 0; i < n && s0 + i < out.length; i++) {
      const t = i / this.sr, u = i / n;
      const f = (f0 + (f1 - f0) * Math.pow(u, slide)) * (1 + vib * Math.sin(2 * Math.PI * vibHz * t));
      ph += f / this.sr;
      const p = ph % 1;
      let v: number;
      switch (wave) {
        case "tri": v = 4 * Math.abs(p - 0.5) - 1; break;
        case "square": v = p < 0.5 ? 0.7 : -0.7; break;
        case "saw": v = (2 * p - 1) * 0.7; break;
        default: v = Math.sin(2 * Math.PI * p);
      }
      out[s0 + i] += v * vol * this.env(t, dur, attack, curve);
    }
  }

  /** filtered noise with sweeping one-pole low-pass (lp0->lp1 Hz) and optional high-pass */
  noise(out: Float32Array, at: number, dur: number, o: { lp0?: number; lp1?: number; hp?: number; vol?: number; attack?: number; curve?: number; seed?: number; crackle?: number }) {
    const { lp0 = 8000, lp1 = lp0, hp = 0, vol = 0.4, attack = 0.002, curve = 2, seed = 1, crackle = 0 } = o;
    const R = rng(seed);
    const s0 = Math.floor(at * this.sr), n = Math.floor(dur * this.sr);
    let lp = 0, hpState = 0, prev = 0;
    for (let i = 0; i < n && s0 + i < out.length; i++) {
      const t = i / this.sr, u = i / n;
      const fc = lp0 + (lp1 - lp0) * u;
      const a = 1 - Math.exp((-2 * Math.PI * fc) / this.sr);
      let x = R() * 2 - 1;
      if (crackle && R() < crackle) x *= 4;
      lp += a * (x - lp);
      let y = lp;
      if (hp) {
        const ah = Math.exp((-2 * Math.PI * hp) / this.sr);
        hpState = ah * (hpState + y - prev);
        prev = y;
        y = hpState;
      }
      out[s0 + i] += y * vol * this.env(t, dur, attack, curve);
    }
  }

  finish(out: Float32Array, gain = 1) {
    let peak = 0;
    for (const v of out) peak = Math.max(peak, Math.abs(v));
    const k = peak > 0 ? Math.min(gain / peak, 4) * 0.9 : 1;
    for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * k * 1.1) * 0.95;
    // 4ms fade-out to avoid clicks
    const f = Math.min(out.length, Math.floor(this.sr * 0.004));
    for (let i = 0; i < f; i++) out[out.length - 1 - i] *= i / f;
    return out;
  }
}

/** sound recipes: name -> (synth) => samples. `gain` sets loudness relative to peak. */
export const RECIPES: Record<string, (s: Synth) => Float32Array> = {
  ui_click: (s) => { const o = s.buf(0.07); s.tone(o, 0, 0.05, { f0: 900, f1: 1400, wave: "square", vol: 0.3 }); s.noise(o, 0, 0.02, { lp0: 5000, vol: 0.2 }); return s.finish(o, 0.5); },
  ui_hover: (s) => { const o = s.buf(0.05); s.tone(o, 0, 0.04, { f0: 1500, wave: "sine", vol: 0.3 }); return s.finish(o, 0.25); },
  ui_select: (s) => { const o = s.buf(0.35); [660, 880, 1320].forEach((f, i) => s.tone(o, i * 0.06, 0.18, { f0: f, wave: "tri", vol: 0.4 })); return s.finish(o, 0.6); },
  cast_charge: (s) => { const o = s.buf(0.16); s.tone(o, 0, 0.15, { f0: 300, f1: 950, wave: "tri", vol: 0.35, attack: 0.03, curve: 1 }); s.tone(o, 0.02, 0.13, { f0: 1800, f1: 2600, vol: 0.12, vib: 0.03, vibHz: 30 }); return s.finish(o, 0.45); },
  fizzle: (s) => { const o = s.buf(0.4); s.noise(o, 0, 0.35, { lp0: 1600, lp1: 300, vol: 0.4, crackle: 0.02, seed: 4 }); s.tone(o, 0, 0.25, { f0: 320, f1: 140, wave: "tri", vol: 0.25 }); return s.finish(o, 0.35); },

  fire_cast: (s) => { const o = s.buf(0.35); s.noise(o, 0, 0.32, { lp0: 600, lp1: 3500, hp: 200, vol: 0.6, attack: 0.04, curve: 1.5, seed: 2 }); s.tone(o, 0, 0.2, { f0: 220, f1: 110, wave: "saw", vol: 0.18 }); return s.finish(o, 0.6); },
  fire_boom: (s) => { const o = s.buf(0.6); s.tone(o, 0, 0.35, { f0: 140, f1: 38, vol: 0.8, curve: 2.5 }); s.noise(o, 0, 0.5, { lp0: 2500, lp1: 180, vol: 0.7, crackle: 0.03, seed: 3 }); s.noise(o, 0.05, 0.4, { lp0: 6000, hp: 2000, vol: 0.12, crackle: 0.08, seed: 9 }); return s.finish(o, 0.85); },
  big_boom: (s) => { const o = s.buf(1.1); s.tone(o, 0, 0.7, { f0: 110, f1: 28, vol: 0.9, curve: 2 }); s.noise(o, 0, 1.0, { lp0: 3000, lp1: 90, vol: 0.9, crackle: 0.03, seed: 5 }); s.noise(o, 0.08, 0.8, { lp0: 7000, hp: 2500, vol: 0.15, crackle: 0.1, seed: 6 }); return s.finish(o, 1); },

  ice_cast: (s) => { const o = s.buf(0.7); [1568, 2093, 2637, 3136].forEach((f, i) => s.tone(o, i * 0.035, 0.55, { f0: f, f1: f * 1.003, vol: 0.25, curve: 3 })); s.noise(o, 0.05, 0.5, { lp0: 9000, hp: 3500, vol: 0.18, curve: 1.5, seed: 7 }); return s.finish(o, 0.6); },
  ice_wave: (s) => { const o = s.buf(0.55); s.noise(o, 0, 0.5, { lp0: 1500, lp1: 7000, hp: 900, vol: 0.5, attack: 0.02, seed: 8 }); s.tone(o, 0, 0.45, { f0: 880, f1: 1760, vol: 0.12, vib: 0.02, vibHz: 18 }); return s.finish(o, 0.6); },
  ice_shatter: (s) => { const o = s.buf(0.45); const R = rng(11); for (let i = 0; i < 14; i++) s.tone(o, R() * 0.18, 0.12, { f0: 2200 + R() * 3000, vol: 0.25, curve: 4 }); s.noise(o, 0, 0.12, { lp0: 9000, hp: 3000, vol: 0.4, seed: 12 }); return s.finish(o, 0.6); },

  bolt_charge: (s) => { const o = s.buf(0.18); s.tone(o, 0, 0.17, { f0: 70, f1: 140, wave: "saw", vol: 0.35, vib: 0.4, vibHz: 40, attack: 0.05, curve: 0.8 }); s.noise(o, 0, 0.17, { lp0: 3000, hp: 1500, vol: 0.15, crackle: 0.05, attack: 0.1, seed: 13 }); return s.finish(o, 0.45); },
  bolt_crack: (s) => { const o = s.buf(0.4); s.noise(o, 0, 0.32, { lp0: 12000, lp1: 1500, hp: 400, vol: 0.9, curve: 3, crackle: 0.12, seed: 14 }); s.tone(o, 0, 0.25, { f0: 60, f1: 45, wave: "square", vol: 0.25, curve: 2 }); return s.finish(o, 0.8); },
  bolt_hit: (s) => { const o = s.buf(0.12); s.noise(o, 0, 0.1, { lp0: 9000, hp: 1200, vol: 0.6, crackle: 0.2, seed: 15 }); return s.finish(o, 0.45); },

  arcane_cast: (s) => { const o = s.buf(0.55); [220, 330, 440, 660].forEach((f, i) => s.tone(o, i * 0.02, 0.5, { f0: f, f1: f * 1.5, vol: 0.18, vib: 0.01, vibHz: 7, attack: 0.05, curve: 2 })); return s.finish(o, 0.55); },
  arcane_pulse: (s) => { const o = s.buf(0.08); s.tone(o, 0, 0.07, { f0: 700, f1: 1050, wave: "tri", vol: 0.4 }); return s.finish(o, 0.3); },
  arcane_hit: (s) => { const o = s.buf(0.2); s.tone(o, 0, 0.16, { f0: 1320, f1: 1760, wave: "tri", vol: 0.35, curve: 3 }); s.tone(o, 0.02, 0.12, { f0: 2640, vol: 0.12, curve: 3 }); return s.finish(o, 0.35); },

  hit: (s) => { const o = s.buf(0.1); s.noise(o, 0, 0.07, { lp0: 1800, lp1: 400, vol: 0.6, seed: 16 }); s.tone(o, 0, 0.08, { f0: 200, f1: 90, vol: 0.4 }); return s.finish(o, 0.45); },
  hit_heavy: (s) => { const o = s.buf(0.2); s.noise(o, 0, 0.15, { lp0: 2400, lp1: 250, vol: 0.7, seed: 17 }); s.tone(o, 0, 0.16, { f0: 160, f1: 55, vol: 0.6 }); return s.finish(o, 0.7); },
  slime_die: (s) => { const o = s.buf(0.3); s.tone(o, 0, 0.22, { f0: 520, f1: 110, vol: 0.5, vib: 0.08, vibHz: 22 }); s.noise(o, 0.03, 0.2, { lp0: 1200, lp1: 300, vol: 0.35, seed: 18 }); return s.finish(o, 0.5); },
  slime_hop: (s) => { const o = s.buf(0.06); s.tone(o, 0, 0.05, { f0: 180, f1: 320, vol: 0.4 }); return s.finish(o, 0.18); },
  bat_die: (s) => { const o = s.buf(0.3); s.tone(o, 0, 0.12, { f0: 1800, f1: 2600, wave: "tri", vol: 0.3, vib: 0.05, vibHz: 40 }); s.noise(o, 0.06, 0.22, { lp0: 1500, lp1: 400, vol: 0.4, seed: 19 }); return s.finish(o, 0.45); },
  skel_die: (s) => { const o = s.buf(0.5); const R = rng(20); for (let i = 0; i < 9; i++) { const at = R() * 0.38; s.noise(o, at, 0.04, { lp0: 2600, hp: 700, vol: 0.5, curve: 4, seed: 30 + i }); s.tone(o, at, 0.04, { f0: 600 + R() * 900, vol: 0.2, curve: 4 }); } return s.finish(o, 0.55); },
  skel_swing: (s) => { const o = s.buf(0.18); s.noise(o, 0, 0.16, { lp0: 800, lp1: 3500, hp: 500, vol: 0.5, attack: 0.05, curve: 1.5, seed: 21 }); return s.finish(o, 0.4); },
  golem_die: (s) => { const o = s.buf(1.0); s.noise(o, 0, 0.95, { lp0: 500, lp1: 80, vol: 0.9, crackle: 0.02, seed: 22 }); s.tone(o, 0, 0.6, { f0: 70, f1: 30, vol: 0.6 }); return s.finish(o, 0.9); },
  golem_slam: (s) => { const o = s.buf(0.5); s.tone(o, 0, 0.35, { f0: 95, f1: 30, vol: 0.9 }); s.noise(o, 0, 0.4, { lp0: 900, lp1: 120, vol: 0.6, seed: 23 }); return s.finish(o, 0.85); },
  spawn: (s) => { const o = s.buf(0.4); s.noise(o, 0, 0.38, { lp0: 200, lp1: 1600, vol: 0.35, attack: 0.25, curve: 1, seed: 24 }); s.tone(o, 0, 0.38, { f0: 180, f1: 360, vol: 0.15, vib: 0.06, vibHz: 9, attack: 0.2 }); return s.finish(o, 0.3); },
  hurt: (s) => { const o = s.buf(0.3); s.tone(o, 0, 0.2, { f0: 420, f1: 160, wave: "square", vol: 0.35 }); s.noise(o, 0, 0.12, { lp0: 3000, lp1: 500, vol: 0.4, seed: 25 }); return s.finish(o, 0.7); },
  levelup: (s) => { const o = s.buf(1.0); [523, 659, 784, 1047, 1319].forEach((f, i) => s.tone(o, i * 0.07, 0.6, { f0: f, wave: "tri", vol: 0.3, curve: 2.5 })); const R = rng(26); for (let i = 0; i < 10; i++) s.tone(o, 0.3 + R() * 0.5, 0.15, { f0: 2000 + R() * 2500, vol: 0.08, curve: 3 }); return s.finish(o, 0.75); },
  xp: (s) => { const o = s.buf(0.09); s.tone(o, 0, 0.08, { f0: 1400, f1: 1900, vol: 0.4, curve: 2.5 }); return s.finish(o, 0.25); },
  gameover: (s) => { const o = s.buf(1.4); [392, 330, 262, 196].forEach((f, i) => s.tone(o, i * 0.22, 0.7, { f0: f, f1: f * 0.98, wave: "tri", vol: 0.35, vib: 0.01, vibHz: 5, curve: 2 })); return s.finish(o, 0.65); },
  combo: (s) => { const o = s.buf(0.12); s.tone(o, 0, 0.1, { f0: 880, f1: 1100, wave: "tri", vol: 0.4 }); return s.finish(o, 0.3); },
  wave: (s) => { const o = s.buf(1.3); [220, 330, 440, 554].forEach((f, i) => s.tone(o, i * 0.01, 1.2, { f0: f, vol: 0.25, curve: 2.2, vib: 0.004, vibHz: 4 })); s.noise(o, 0, 0.3, { lp0: 4000, hp: 1500, vol: 0.08, seed: 27 }); return s.finish(o, 0.55); },
  boss_roar: (s) => { const o = s.buf(1.4); s.tone(o, 0, 1.3, { f0: 75, f1: 55, wave: "saw", vol: 0.5, vib: 0.05, vibHz: 7, attack: 0.15 }); s.noise(o, 0, 1.2, { lp0: 300, lp1: 1200, vol: 0.4, attack: 0.3, seed: 28 }); return s.finish(o, 0.85); },
  orb_fire: (s) => { const o = s.buf(0.2); s.tone(o, 0, 0.18, { f0: 520, f1: 260, wave: "tri", vol: 0.4, vib: 0.05, vibHz: 20 }); return s.finish(o, 0.4); },
  charge_beam: (s) => { const o = s.buf(1.6); s.tone(o, 0, 1.55, { f0: 90, f1: 420, wave: "saw", vol: 0.3, attack: 1.2, curve: 0.5, vib: 0.03, vibHz: 12 }); return s.finish(o, 0.5); },
  beam: (s) => { const o = s.buf(0.7); s.noise(o, 0, 0.65, { lp0: 5000, lp1: 800, vol: 0.6, seed: 29 }); s.tone(o, 0, 0.6, { f0: 220, f1: 110, wave: "saw", vol: 0.35 }); return s.finish(o, 0.75); },
  shatter: (s) => RECIPES.ice_shatter(s),
  stun: (s) => { const o = s.buf(0.25); s.tone(o, 0, 0.22, { f0: 1200, f1: 800, wave: "tri", vol: 0.3, vib: 0.08, vibHz: 25 }); return s.finish(o, 0.3); },
};

/** ~16s ambient loop: soft minor pads + a sparse pentatonic pluck line with a feedback echo */
export function renderMusic(s: Synth): Float32Array {
  const bpm = 72, beat = 60 / bpm, bars = 8, sec = bars * 4 * beat;
  const o = s.buf(sec);
  const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]]; // Am F C G
  for (let b = 0; b < bars; b++) {
    const ch = chords[b % 4];
    for (const f of ch) {
      s.tone(o, b * 4 * beat, 4 * beat + 0.4, { f0: f / 2, vol: 0.09, attack: 1.2, curve: 1.2, vib: 0.003, vibHz: 0.4 });
      s.tone(o, b * 4 * beat, 4 * beat + 0.4, { f0: f, wave: "tri", vol: 0.025, attack: 1.5, curve: 1.3 });
    }
  }
  const scale = [440, 523.3, 587.3, 659.3, 784, 880, 1046.5];
  const R = rng(77);
  for (let i = 0; i < bars * 8; i++) {
    if (R() < 0.45) continue;
    const f = scale[Math.floor(R() * scale.length)];
    s.tone(o, i * beat * 0.5, 0.9, { f0: f, wave: "tri", vol: 0.05, curve: 3.5 });
  }
  // feedback echo
  const d = Math.floor(beat * 0.75 * s.sr);
  for (let i = d; i < o.length; i++) o[i] += o[i - d] * 0.35;
  // crossfade tail into head for a seamless loop
  let peak = 0;
  for (const v of o) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < o.length; i++) o[i] = (o[i] / (peak || 1)) * 0.6;
  return o;
}
