// Waves: spawns in a band just inside the visible screen (clear of the HUD) behind a short portal,
// never too close to the wizard, from one to four directions at once (pincer, three-way, surround);
// honours spawn caps and eases off while the player is drawing.
import Phaser from "phaser";
import { GAME } from "../config/game";
import { Layout } from "../core/Layout";
import { waveDef, spawnIntervalMs, directionWeights, type WaveDef } from "../config/waves";
import { PAL } from "../config/palette";
import { SPELLS, SPELL_ORDER } from "../config/spells";
import type { EnemyKind } from "../config/enemies";
import { Audio } from "../core/Audio";
import { bus, EV } from "../core/bus";
import { Analytics, cap } from "../core/Analytics";
import { Enemy, ENEMY_HEIGHT } from "../entities/Enemy";
import { Boss } from "../entities/Boss";
import type { GameScene } from "../scenes/GameScene";

export class EnemySpawnManager {
  g: GameScene;
  wave = 0;
  def!: WaveDef;
  waveT = 0;
  private nextSpawn = 0;
  private elitesLeft = 0;
  inBreak = true;
  /** no automatic start before the first wave: GameScene schedules startWave(1) itself */
  private breakT = Number.POSITIVE_INFINITY;
  bossAlive = false;
  enabled = true;

  constructor(g: GameScene) {
    this.g = g;
  }

  startWave(n: number) {
    this.wave = n;
    this.g.wave = n;
    this.def = waveDef(n);
    this.waveT = 0;
    this.nextSpawn = 600;
    this.elitesLeft = this.def.elites;
    this.inBreak = false;
    Analytics.track("wave", cap(n, 21), "start");
    Audio.play("wave");
    bus.emit(EV.WAVE, n, !!this.def.boss);
    const unlock = SPELL_ORDER.find((s) => SPELLS[s].unlockWave === n && this.g.spells.levels[s] === 0);
    if (unlock) {
      this.g.spells.levels[unlock] = 1;
      Analytics.track("rune", SPELLS[unlock].rune, "visible", "run");
      bus.emit(EV.UNLOCK, unlock);
    } else {
      bus.emit(EV.WAVE_BANNER, `WAVE ${n}`, this.def.boss ? "A GUARDIAN STIRS..." : this.def.elites ? "ELITES APPROACH" : "", this.def.boss ? PAL.pink : PAL.gold);
    }
    if (this.def.boss) {
      this.g.time.delayedCall(1800, () => {
        if (this.g.over) return;
        this.bossAlive = true;
        this.g.boss = new Boss(this.g, this.def.hpMul);
      });
    }
  }

  /**
   * The area enemies may appear in: the visible screen minus the HUD (hearts/wave/timer/pause at the top,
   * XP bar and spell slots at the bottom in portrait, the slot column on the left in landscape), inset so
   * the whole body of an enemy of this kind is on screen. World coordinates.
   */
  private playArea(kind: Exclude<EnemyKind, "boss">) {
    const v = this.g.cameras.main.worldView, sf = Layout.safe;
    const bodyTop = 2 * ENEMY_HEIGHT[kind] + 6;                   // feet to the top of the sprite
    const top = sf.top + (this.bossAlive ? 54 : 42);
    const bottom = Layout.portrait ? sf.bottom + 46 : sf.bottom + 16;
    const left = Layout.portrait ? sf.left + 10 : sf.left + 38;
    return { x0: v.x + left, x1: v.right - sf.right - 10, y0: v.y + top + bodyTop, y1: v.bottom - bottom - 4 };
  }

  /** a random point in the band just inside one of the four edges of the play area */
  private bandPoint(a: { x0: number; x1: number; y0: number; y1: number }) {
    const side = Math.floor(Math.random() * 4), f = Math.random(), d = Math.random() * GAME.spawn.band;
    if (side === 0) return { x: a.x0 + f * (a.x1 - a.x0), y: a.y0 + d };
    if (side === 1) return { x: a.x0 + f * (a.x1 - a.x0), y: a.y1 - d };
    if (side === 2) return { x: a.x0 + d, y: a.y0 + f * (a.y1 - a.y0) };
    return { x: a.x1 - d, y: a.y0 + f * (a.y1 - a.y0) };
  }

  /**
   * A spawn point just inside the screen edge (not outside it), so the enemy is visible from the moment
   * it exists and its portal is a warning. Never nearer than minDistance to the wizard, which on a portrait
   * phone keeps side spawns high or low (the side edges are only ~95 art px from the wizard). With `angle`,
   * the spot whose direction from the wizard is closest to it (for the pincer and surround patterns).
   */
  private edgePoint(kind: Exclude<EnemyKind, "boss">, angle?: number) {
    const a = this.playArea(kind), w = this.g.wizard;
    let best: { x: number; y: number } | null = null, bestScore = Infinity;
    let far = { x: a.x0, y: a.y0 }, farD = -1;
    for (let tries = 0; tries < (angle === undefined ? 16 : 28); tries++) {
      const p = this.bandPoint(a), dist = Math.hypot(p.x - w.x, p.y - w.y);
      if (dist > farD) { farD = dist; far = p; }
      if (dist < GAME.spawn.minDistance) continue;
      if (angle === undefined) return p;
      const da = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(p.y - w.y, p.x - w.x) - angle));
      if (da < bestScore) { bestScore = da; best = p; }
    }
    // a small screen may have no spot that far: use the farthest one found (corners usually)
    return best ?? far;
  }

  /** 1 to 4 spawn points round the wizard at the same moment: one spot, a pincer, three-way or surround */
  private patternPoints(kind: Exclude<EnemyKind, "boss">, n: number) {
    const ws = directionWeights(this.wave);
    let r = Math.random() * ws.reduce((t, x) => t + x, 0), dirs = 1;
    for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r <= 0) { dirs = i + 1; break; } }
    dirs = Math.min(dirs, n);
    if (dirs === 1) return [this.edgePoint(kind)];
    const base = Math.random() * Math.PI * 2;
    return Array.from({ length: dirs }, (_, j) => this.edgePoint(kind, base + (j * Math.PI * 2) / dirs));
  }
  /** keep a group member (spread round the group's point) inside the play area */
  private clampToArea(kind: Exclude<EnemyKind, "boss">, x: number, y: number) {
    const a = this.playArea(kind);
    return { x: Math.max(a.x0, Math.min(a.x1, x)), y: Math.max(a.y0, Math.min(a.y1, y)) };
  }

  spawnAt(kind: Exclude<EnemyKind, "boss">, x: number, y: number, elite: boolean, instant = false) {
    const e = new Enemy(this.g, kind, x, y, { elite, hpMul: this.def?.hpMul ?? 1 });
    if (instant) e.state = "move";
    this.g.enemies.push(e);
    return e;
  }

  private pickKind(): Exclude<EnemyKind, "boss"> {
    const ws = Object.entries(this.def.weights) as [Exclude<EnemyKind, "boss">, number][];
    const total = ws.reduce((a, [, w]) => a + w, 0);
    let r = Math.random() * total;
    for (const [k, w] of ws) { r -= w; if (r <= 0) return k; }
    return ws[0][0];
  }

  update(dtMs: number) {
    if (!this.enabled || this.g.over) return;
    if (this.inBreak) {
      this.breakT -= dtMs;
      if (this.breakT <= 0) this.startWave(this.wave + 1);
      return;
    }
    this.waveT += dtMs;
    const alive = this.g.enemies.filter((e) => e.alive && e.kind !== "orb").length;
    const waveOver = this.waveT >= this.def.durationMs && (!this.def.boss || !this.bossAlive);
    if (waveOver) {
      Analytics.track("wave", cap(this.wave, 21), "complete");
      this.inBreak = true;
      this.breakT = GAME.waveBreakMs;
      this.g.xp.vacuum();
      // breather: clearing a wave restores a heart
      if (GAME.healOnWaveClear > 0 && this.g.hp < this.g.maxHp) {
        this.g.heal(GAME.healOnWaveClear);
        bus.emit(EV.WAVE_BANNER, `WAVE ${this.wave} ✓`, `+${GAME.healOnWaveClear} ♥`, PAL.xpMint);
      } else bus.emit(EV.WAVE_BANNER, `WAVE ${this.wave} ✓`, "", PAL.xpMint);
      return;
    }
    if (this.waveT >= this.def.durationMs) return; // boss wave: wait for the boss
    this.nextSpawn -= dtMs * (this.g.drawing ? 0.5 : 1); // ease off while the player draws
    if (this.nextSpawn > 0 || alive >= this.def.maxAlive) return;
    // interval comes from the wave's pressure target (HP/s), with +/-25% jitter so it doesn't feel metronomic
    this.nextSpawn = spawnIntervalMs(this.def) * (0.75 + Math.random() * 0.5);
    const [g0, g1] = this.def.group;
    const n = Math.min(this.def.maxAlive - alive, g0 + Math.floor(Math.random() * (g1 - g0 + 1)));
    const kind = this.pickKind();
    const pts = this.patternPoints(kind, n);
    for (let i = 0; i < n; i++) {
      // elites are guaranteed: spread across the wave once the first 30% has passed
      const due = this.def.elites - this.elitesLeft < Math.floor((this.waveT / this.def.durationMs - 0.3) / 0.7 * this.def.elites) + 1;
      const elite = this.elitesLeft > 0 && this.waveT > this.def.durationMs * 0.3 && i === 0 && due;
      if (elite) this.elitesLeft--;
      const k = i === 0 ? kind : this.pickKind();
      // members are dealt round the points, so every direction opens at the same moment
      const p = pts[i % pts.length];
      const q = this.clampToArea(k, p.x + (Math.random() - 0.5) * 22, p.y + (Math.random() - 0.5) * 22);
      this.g.time.delayedCall(Math.floor(i / pts.length) * 140, () => !this.g.over && this.spawnAt(k, q.x, q.y, elite));
    }
  }
}
