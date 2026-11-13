// Waves: spawns in a band just inside the visible screen (clear of the HUD) behind a short portal,
// never too close to the wizard, honours spawn caps and eases off while the player is drawing.
import { GAME } from "../config/game";
import { Layout } from "../core/Layout";
import { waveDef, spawnIntervalMs, type WaveDef } from "../config/waves";
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

  /**
   * A random point in a band just inside the screen edge (not outside it): the enemy is visible from the
   * moment it exists, and its portal is a warning. Each side equally likely; never nearer than
   * minDistance to the wizard, which on a portrait phone keeps side spawns high or low (the side edges
   * are only ~95 art px from the wizard).
   */
  private edgePoint(kind: Exclude<EnemyKind, "boss">) {
    const a = this.playArea(kind), w = this.g.wizard, band = GAME.spawn.band;
    let best = { x: a.x0, y: a.y0 }, bestD = -1;
    for (let tries = 0; tries < 16; tries++) {
      const side = Math.floor(Math.random() * 4), f = Math.random(), d = Math.random() * band;
      let x: number, y: number;
      if (side === 0) { x = a.x0 + f * (a.x1 - a.x0); y = a.y0 + d; }
      else if (side === 1) { x = a.x0 + f * (a.x1 - a.x0); y = a.y1 - d; }
      else if (side === 2) { x = a.x0 + d; y = a.y0 + f * (a.y1 - a.y0); }
      else { x = a.x1 - d; y = a.y0 + f * (a.y1 - a.y0); }
      const dist = Math.hypot(x - w.x, y - w.y);
      if (dist >= GAME.spawn.minDistance) return { x, y };
      if (dist > bestD) { bestD = dist; best = { x, y }; }
    }
    // a small screen may have no spot that far: use the farthest one found (corners usually)
    return best;
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
    const p = this.edgePoint(kind);
    for (let i = 0; i < n; i++) {
      // elites are guaranteed: spread across the wave once the first 30% has passed
      const due = this.def.elites - this.elitesLeft < Math.floor((this.waveT / this.def.durationMs - 0.3) / 0.7 * this.def.elites) + 1;
      const elite = this.elitesLeft > 0 && this.waveT > this.def.durationMs * 0.3 && i === 0 && due;
      if (elite) this.elitesLeft--;
      const k = i === 0 ? kind : this.pickKind();
      const q = this.clampToArea(k, p.x + (Math.random() - 0.5) * 22, p.y + (Math.random() - 0.5) * 22);
      this.g.time.delayedCall(i * 140, () => !this.g.over && this.spawnAt(k, q.x, q.y, elite));
    }
  }
}
