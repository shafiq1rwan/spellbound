// AudioManager: WebAudio playback of synthesized buffers, volume buses, autoplay unlock,
// per-sound throttling, and a mute-reason set (hidden tab, ads, pause) for Poki compliance.
import { RECIPES, Synth, renderMusic } from "./synth";

class AudioManager {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private lastPlayed = new Map<string, number>();
  private active = new Map<string, number>();
  private musicSrc: AudioBufferSourceNode | null = null;
  private muteReasons = new Set<string>();
  private vol = { sfx: 0.8, music: 0.5 };
  wantMusic = false;

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.sfxBus = c.createGain();
    this.musicBus = c.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(c.destination);
    this.applyVolumes();
    const synth = new Synth(c.sampleRate);
    for (const [name, fn] of Object.entries(RECIPES)) {
      const data = fn(synth);
      const b = c.createBuffer(1, data.length, c.sampleRate);
      b.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
      this.buffers.set(name, b);
    }
    const m = renderMusic(synth);
    const mb = c.createBuffer(1, m.length, c.sampleRate);
    mb.copyToChannel(m as Float32Array<ArrayBuffer>, 0);
    this.buffers.set("__music", mb);
  }

  /** must be called from a user gesture */
  unlock() {
    if (this.ctx && this.ctx.state === "suspended" && !this.muteReasons.has("hidden"))
      this.ctx.resume().then(() => { if (this.wantMusic) this.startMusic(); }).catch(() => {});
    else if (this.wantMusic) this.startMusic();
  }

  setVolumes(sfx: number, music: number) {
    this.vol = { sfx, music };
    this.applyVolumes();
  }
  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx * 0.9, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.35, t, 0.05);
    this.master.gain.setTargetAtTime(this.muteReasons.size ? 0 : 1, t, 0.03);
  }

  mute(reason: string, on: boolean) {
    if (on) this.muteReasons.add(reason);
    else this.muteReasons.delete(reason);
    this.applyVolumes();
    if (!this.ctx) return;
    if (reason === "hidden") {
      if (on) this.ctx.suspend().catch(() => {});
      else if (this.ctx.state === "suspended") this.ctx.resume().then(() => { if (this.wantMusic) this.startMusic(); }).catch(() => {});
    }
  }

  play(name: string, o: { vol?: number; rate?: number; detune?: number; maxConcurrent?: number; minGapMs?: number } = {}) {
    const c = this.ctx;
    if (!c || c.state !== "running") return;
    const b = this.buffers.get(name);
    if (!b) return;
    const now = performance.now();
    const gap = o.minGapMs ?? 28;
    if (now - (this.lastPlayed.get(name) ?? -1e9) < gap) return;
    const max = o.maxConcurrent ?? 5;
    if ((this.active.get(name) ?? 0) >= max) return;
    this.lastPlayed.set(name, now);
    this.active.set(name, (this.active.get(name) ?? 0) + 1);
    const src = c.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = o.rate ?? 1;
    if (o.detune) src.detune.value = o.detune;
    const g = c.createGain();
    g.gain.value = o.vol ?? 1;
    src.connect(g).connect(this.sfxBus);
    src.onended = () => {
      this.active.set(name, Math.max(0, (this.active.get(name) ?? 1) - 1));
      g.disconnect();
    };
    src.start();
  }

  startMusic() {
    this.wantMusic = true;
    const c = this.ctx;
    if (!c || this.musicSrc || c.state !== "running") return;
    const b = this.buffers.get("__music");
    if (!b) return;
    const src = c.createBufferSource();
    src.buffer = b;
    src.loop = true;
    src.connect(this.musicBus);
    src.start();
    this.musicSrc = src;
  }
  stopMusic() {
    this.wantMusic = false;
    try { this.musicSrc?.stop(); } catch { /* already stopped */ }
    this.musicSrc = null;
  }
}

export const Audio = new AudioManager();
