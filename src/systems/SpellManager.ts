// SpellManager: spell levels/unlocks, cooldowns, combo, target picking, and the four spells.
// Each spell = anticipation (wizard + sigil, handled in Wizard.cast) -> immediate launch -> impact.
import Phaser from "phaser";
import { SPELLS, SPELL_ORDER, type SpellId, type SpellLevel } from "../config/spells";
import { ELEMENT_COLORS, PAL, type Element } from "../config/palette";
import { GAME } from "../config/game";
import { Audio } from "../core/Audio";
import { bus, EV } from "../core/bus";
import { Projectile } from "../entities/Projectile";
import type { Target } from "../entities/Enemy";
import { DEPTH } from "./VFXManager";
import type { GameScene } from "../scenes/GameScene";

interface Nova { x: number; y: number; maxR: number; t: number; dur: number; hit: Set<Target>; L: SpellLevel }
interface Vortex { x: number; y: number; t: number; dur: number; tick: number; sprite: Phaser.GameObjects.Sprite; L: SpellLevel }

export class SpellManager {
  g: GameScene;
  // every rune works from wave 1 (playtests: players expect to use the runes shown in the HUD)
  levels: Record<SpellId, number> = { fireball: 1, nova: 1, lightning: 1, arcane: 1 };
  readyAt: Record<SpellId, number> = { fireball: 0, nova: 0, lightning: 0, arcane: 0 };
  cdMult = 1;
  powerMult = 1;
  combo = 0;
  private lastCastAt = -1e9;
  private lastElement: Element | null = null;
  private projectiles: Projectile[] = [];
  private novas: Nova[] = [];
  private vortices: Vortex[] = [];

  constructor(g: GameScene) {
    this.g = g;
  }

  unlocked(): SpellId[] {
    return SPELL_ORDER.filter((s) => this.levels[s] > 0);
  }
  level(id: SpellId) {
    return SPELLS[id].levels[Math.max(0, this.levels[id] - 1)];
  }
  cooldownMs(id: SpellId) {
    return SPELLS[id].cooldown * this.cdMult;
  }
  /** 0 = ready, 1 = just cast */
  cooldownFrac(id: SpellId) {
    const left = this.readyAt[id] - this.g.now;
    return left <= 0 ? 0 : Math.min(1, left / this.cooldownMs(id));
  }
  damageMult() {
    return this.powerMult * (1 + Math.min(this.combo, GAME.combo.maxStacks) * GAME.combo.perStack);
  }
  resetCombo() {
    if (this.combo > 0) {
      this.combo = 0;
      bus.emit(EV.COMBO, 0);
    }
  }

  // ---------------------------------------------------------------- target picking
  /** prefer the enemy nearest the rune's centre (draw ON a monster to aim), else nearest the wizard */
  pickTarget(cx: number, cy: number): Target | null {
    const ts = this.g.targets();
    let best: Target | null = null, bd = GAME.rune.targetPickRadius;
    for (const t of ts) {
      const d = Math.hypot(t.x - cx, t.y - t.height - cy);
      if (d < bd) { bd = d; best = t; }
    }
    if (best) return best;
    return this.nearest(this.g.wizard.x, this.g.wizard.y, 1e9);
  }
  nearest(x: number, y: number, maxD: number, exclude?: Set<Target>): Target | null {
    let best: Target | null = null, bd = maxD;
    for (const t of this.g.targets()) {
      if (exclude?.has(t)) continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  // ---------------------------------------------------------------- casting
  /** returns null on success or a reason string */
  cast(id: SpellId, cx: number, cy: number): string | null {
    const now = this.g.now;
    if (this.levels[id] <= 0) return "locked";
    if (now < this.readyAt[id]) return "recharging";
    this.readyAt[id] = now + this.cooldownMs(id);
    const el = SPELLS[id].element;
    // combo: consecutive successful casts; switching element gives a variety bonus
    if (now - this.lastCastAt > GAME.combo.windowMs) this.combo = 0;
    this.combo = Math.min(GAME.combo.maxStacks, this.combo + 1 + (this.lastElement && el !== this.lastElement ? GAME.combo.varietyBonus : 0));
    this.lastCastAt = now;
    this.lastElement = el;
    bus.emit(EV.COMBO, this.combo);
    bus.emit(EV.CAST, id);
    const L = this.level(id);
    const target = id === "nova" ? null : this.pickTarget(cx, cy);
    const aimX = target ? target.x : cx, aimY = target ? target.y - target.height : cy;
    this.g.wizard.cast(el, aimX);
    Audio.play("cast_charge", { vol: 0.5, rate: 0.9 + Math.random() * 0.2 });
    switch (id) {
      case "fireball": this.fireball(L, target, aimX, aimY); break;
      case "nova": this.nova(L); break;
      case "lightning": this.lightning(L, target, cx, cy); break;
      case "arcane": this.arcane(L, target, cx, cy); break;
    }
    return null;
  }

  private proj(): Projectile {
    let p = this.projectiles.find((q) => !q.active);
    if (!p) {
      p = new Projectile(this.g);
      this.projectiles.push(p);
    }
    return p;
  }

  // ---------------------------------------------------------------- FIREBALL
  private fireball(L: SpellLevel, target: Target | null, ax: number, ay: number) {
    const tip = this.g.wizard.tip();
    const base = Math.atan2(ay - tip.y, ax - tip.x);
    const n = L.count ?? 1;
    const meteor = !!L.meteor;
    Audio.play("fire_cast", { rate: meteor ? 0.75 : 1 });
    this.g.vfx.glow(tip.x, tip.y, PAL.fireOrange, meteor ? 60 : 36, 260, 0.9, DEPTH.fx);
    this.g.vfx.burst("ember", tip.x, tip.y, 6);
    for (let i = 0; i < n; i++) {
      const a = base + (n > 1 ? (i - (n - 1) / 2) * 0.24 : 0);
      const p = this.proj();
      const sc = meteor ? 1 : L.scale ?? 1;
      p.launch("fireball", tip.x, tip.y, a, meteor ? 190 : 240, {
        damage: L.damage, radius: meteor ? 9 : 5 * sc, life: 1600, tex: meteor ? "fireball_big" : "fireball",
        anim: meteor ? "fireball_big:play" : "fireball:play", scale: sc, glow: PAL.fireOrange, glowSize: meteor ? 46 : 26 * sc,
        target: i === Math.floor(n / 2) ? target : null, turn: 2.2,
        data: { splash: L.splash ?? 0, kb: L.knockback ?? 20, meteor, lvl: this.levels.fireball },
      });
    }
  }
  private explodeFireball(p: Projectile, direct: Target | null) {
    const g = this.g, x = p.x, y = p.y;
    const meteor = !!p.data.meteor, splash = Number(p.data.splash), kb = Number(p.data.kb), lvl = Number(p.data.lvl);
    p.kill();
    if (p.data.pet) {
      g.vfx.play("explosion", x, y, { scale: 0.55, depth: DEPTH.fx });
      g.vfx.burst("ember", x, y, 4, { speed: [20, 60] });
      Audio.play("fire_boom", { vol: 0.35, rate: 1.3, maxConcurrent: 2, minGapMs: 80 });
      for (const t of g.targets()) {
        const d = Math.hypot(t.x - x, t.y - t.height * 0.5 - y);
        if (t === direct || d <= splash + t.radius) g.combat.damage(t, t === direct ? p.damage : p.damage * 0.5, { element: "fire", dx: t.x - x, dy: t.y - y, kb, heavy: false, quiet: t !== direct });
      }
      return;
    }
    g.vfx.play(meteor ? "explosion_big" : "explosion", x, y, { scale: meteor ? 1.1 : Math.max(0.8, splash / 26), depth: DEPTH.fx });
    g.vfx.glow(x, y, PAL.fireOrange, meteor ? 160 : 60 + splash, meteor ? 500 : 280, 0.8);
    g.vfx.burst("ember", x, y, meteor ? 26 : 10, { speed: [30, meteor ? 140 : 90] });
    g.vfx.burst("spark", x, y, meteor ? 10 : 4, { tint: PAL.fireYellow });
    g.vfx.decal("decal_scorch", x, y + 4, meteor ? 2.4 : 0.8 + splash / 40, meteor ? 6000 : 4000);
    Audio.play(meteor ? "big_boom" : "fire_boom", { rate: 0.9 + Math.random() * 0.2, maxConcurrent: 4 });
    if (meteor) { g.vfx.shake(3, 260); g.vfx.illuminate(PAL.fireOrange, 0.12, 320); g.hitstop(60); }
    else if (lvl >= 4) g.vfx.shake(1.5, 110);
    else g.vfx.shake(1, 60);
    g.shockwaveGrass(x, y, splash * 2 + 20);
    const heavy = meteor || lvl >= 4;
    if (direct && direct.alive) g.combat.damage(direct, p.damage, { element: "fire", dx: p.vx, dy: p.vy, kb: kb, heavy });
    for (const t of g.targets()) {
      if (t === direct) continue;
      const d = Math.hypot(t.x - x, t.y - t.height * 0.5 - y);
      if (d <= splash + t.radius) {
        const k = lvl >= 4 ? 0.8 : 0.5;
        g.combat.damage(t, p.damage * k, { element: "fire", dx: t.x - x, dy: t.y - y, kb: kb * 0.8, heavy: false });
      }
    }
  }

  // ---------------------------------------------------------------- ICE NOVA
  private nova(L: SpellLevel) {
    const w = this.g.wizard;
    const pulses = L.pulses ?? 1;
    for (let k = 0; k < pulses; k++) {
      this.g.time.delayedCall(k * 300, () => {
        const maxR = (L.radius ?? 54) * (k ? 0.75 : 1);
        this.novas.push({ x: w.x, y: w.y - 4, maxR, t: 0, dur: 380, hit: new Set(), L });
        this.g.vfx.play("nova", w.x, w.y - 4, { scale: maxR / 58, depth: DEPTH.fxLow });
        this.g.vfx.play("shock_ice", w.x, w.y, { scale: maxR / 30, depth: DEPTH.fxLow, add: true });
        this.g.vfx.glow(w.x, w.y - 10, PAL.iceCyan, maxR * 1.6, 420, 0.5);
        this.g.vfx.decal("decal_frost", w.x, w.y, maxR / 56, 3500, 0.9);
        this.g.vfx.burst("shard", w.tip().x, w.tip().y, 6);
        Audio.play(k ? "ice_wave" : "ice_cast");
        if (!k) Audio.play("ice_wave", { vol: 0.8 });
        this.g.vfx.shake(1, 100);
        this.g.shockwaveGrass(w.x, w.y, maxR + 30);
        // shards fly outward
        const shards = L.shards ?? 0;
        for (let i = 0; i < shards; i++) {
          const a = (i / shards) * Math.PI * 2 + k * 0.2;
          this.proj().launch("shard", w.x, w.y - 8, a, 180, { damage: 14, radius: 4, life: 800, tex: "p_shard", glow: PAL.iceCyan, glowSize: 14, pierce: 2 });
        }
      });
    }
  }
  private updateNovas(dt: number) {
    for (const n of this.novas) {
      n.t += dt;
      const k = Math.min(1, n.t / n.dur);
      const r = n.maxR * (1 - Math.pow(1 - k, 2.2));
      for (const t of this.g.targets()) {
        if (n.hit.has(t)) continue;
        const d = Math.hypot(t.x - n.x, t.y - n.y);
        if (d <= r + t.radius) {
          n.hit.add(t);
          const L = n.L;
          if (L.freezeMs) t.freeze(L.freezeMs);
          else t.slow(L.slow ?? 0.5, L.slowMs ?? 2000);
          if (L.freezeMs) t.slow(L.slow ?? 0.5, (L.slowMs ?? 2000) + L.freezeMs);
          this.g.combat.damage(t, L.damage, { element: "ice", dx: t.x - n.x, dy: t.y - n.y, kb: L.knockback ?? 30, heavy: false, noShatter: true });
          this.g.vfx.burst("snow", t.x, t.y - t.height, 4);
        }
      }
      if (k < 1 && Math.random() < 0.6) this.g.vfx.ring("snow", n.x, n.y, r, 2);
    }
    this.novas = this.novas.filter((n) => n.t < n.dur);
  }

  // ---------------------------------------------------------------- LIGHTNING
  private lightning(L: SpellLevel, first: Target | null, cx: number, cy: number) {
    const g = this.g, tip = g.wizard.tip();
    Audio.play("bolt_charge", { vol: 0.6 });
    g.vfx.glow(tip.x, tip.y, 0xffffff, 40, 160, 1, DEPTH.fx);
    g.vfx.burst("spark", tip.x, tip.y, 6, { tint: PAL.boltYellow });
    if (!first) {
      g.vfx.bolt(tip.x, tip.y, cx, cy);
      g.vfx.play("zap", cx, cy, { add: true });
      Audio.play("bolt_crack");
      return;
    }
    const chain: Target[] = [first];
    const hitSet = new Set<Target>([first]);
    while (chain.length < 1 + (L.chains ?? 2)) {
      const last = chain[chain.length - 1];
      const nx = this.nearest(last.x, last.y, L.chainRange ?? 60, hitSet);
      if (!nx) break;
      chain.push(nx);
      hitSet.add(nx);
    }
    Audio.play("bolt_crack");
    g.vfx.illuminate(0xfff8d0, 0.05, 120);
    let px = tip.x, py = tip.y;
    chain.forEach((t, i) => {
      const fromX = px, fromY = py;
      const tx = t.x, ty = t.y - t.height;
      g.time.delayedCall(i * 55, () => {
        g.vfx.bolt(fromX, fromY, t.x, t.y - t.height, { ms: 220 });
        g.vfx.play("zap", t.x, t.y - t.height, { add: true, scale: i === 0 ? 1.3 : 1 });
        g.vfx.burst("spark", t.x, t.y - t.height, 5, { tint: i % 2 ? PAL.boltBlue : PAL.boltYellow });
        if (i > 0) Audio.play("bolt_hit", { rate: 1 + i * 0.08, maxConcurrent: 4, minGapMs: 20 });
        const dmg = (L.damage ?? 20) * Math.pow(0.88, i);
        if (t.alive) g.combat.damage(t, dmg, { element: "bolt", dx: t.x - fromX, dy: t.y - fromY, kb: 8, heavy: i === 0, stunMs: L.stunMs });
        if (L.fork && t.alive !== undefined) {
          const f = this.nearest(t.x, t.y, (L.chainRange ?? 60) * 0.8, hitSet);
          if (f) {
            hitSet.add(f);
            g.time.delayedCall(40, () => {
              g.vfx.bolt(t.x, t.y - t.height, f.x, f.y - f.height, { ms: 180, color: PAL.boltBlue });
              if (f.alive) g.combat.damage(f, dmg * 0.6, { element: "bolt", dx: f.x - t.x, dy: f.y - t.y, kb: 6, heavy: false, stunMs: L.stunMs });
            });
          }
        }
      });
      px = tx;
      py = ty;
    });
  }

  // ---------------------------------------------------------------- ARCANE BARRAGE
  private arcane(L: SpellLevel, main: Target | null, cx: number, cy: number) {
    const g = this.g, w = g.wizard, tip = w.tip();
    Audio.play("arcane_cast");
    const n = L.missiles ?? 4;
    // choose targets: nearest few, cycling
    const pool = g.targets().slice().sort((a, b) => Math.hypot(a.x - w.x, a.y - w.y) - Math.hypot(b.x - w.x, b.y - w.y)).slice(0, n); // spread: one missile per nearby foe, cycling if there are fewer
    if (main && !pool.includes(main)) pool.unshift(main);
    // rotating arcane circles around the wizard
    for (let i = 0; i < 3; i++) g.vfx.play("sigil_arcane", w.x, w.y - 2 - i * 6, { scale: 0.5 + i * 0.25, alpha: 0.8 - i * 0.2, add: true, depth: DEPTH.sigil, anim: "sigil_arcane:play", loop: false });
    for (let i = 0; i < n; i++) {
      g.time.delayedCall(i * 45, () => {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2 + Math.random() * 0.3;
        const t = pool.length ? pool[i % pool.length] : null;
        this.proj().launch("missile", tip.x + Math.cos(a) * 6, tip.y + Math.sin(a) * 6, a, 70, {
          damage: L.damage, radius: 4, life: 2600, tex: "missile", anim: "missile:play", glow: PAL.violet, glowSize: 18,
          target: t, pierce: L.pierce ?? 1, maxSpeed: 250, accel: 420, turn: 5, data: { kb: L.knockback ?? 14 },
        });
        Audio.play("arcane_pulse", { rate: 0.9 + i * 0.05, maxConcurrent: 3, minGapMs: 30 });
        g.vfx.burst("twinkle", tip.x, tip.y, 1, { tint: PAL.arcanePink });
      });
    }
    if (L.vortex) {
      const vx = main ? main.x : cx, vy = main ? main.y : cy;
      g.time.delayedCall(250, () => {
        const sprite = g.vfx.play("vortex", vx, vy - 4, { scale: 1.5, add: true, depth: DEPTH.fxLow, loop: true });
        sprite.setAlpha(0);
        g.tweens.add({ targets: sprite, alpha: 0.95, duration: 150 });
        this.vortices.push({ x: vx, y: vy, t: 0, dur: 1800, tick: 0, sprite, L });
      });
    }
  }
  private updateVortices(dt: number) {
    for (const v of this.vortices) {
      v.t += dt;
      v.tick -= dt;
      v.sprite.angle += dt * 0.2;
      for (const t of this.g.targets()) {
        if (t.isBoss) continue;
        const dx = v.x - t.x, dy = v.y - t.y, d = Math.hypot(dx, dy);
        if (d < 50 && d > 3) t.push(dx, dy, 55 * (dt / 1000) * 60);
      }
      if (v.tick <= 0) {
        v.tick = 300;
        for (const t of this.g.targets()) if (Math.hypot(v.x - t.x, v.y - t.y) < 36) this.g.combat.damage(t, 7, { element: "arcane", dx: 0, dy: 0, kb: 0, heavy: false, quiet: true });
        this.g.vfx.ring("twinkle", v.x, v.y - 4, 22, 3, PAL.arcanePink);
      }
      if (v.t >= v.dur) {
        this.g.tweens.add({ targets: v.sprite, alpha: 0, scale: 0.4, duration: 220, onComplete: () => this.g.vfx.release(v.sprite) });
        this.g.vfx.play("starburst", v.x, v.y - 4, { scale: 2, add: true });
      }
    }
    this.vortices = this.vortices.filter((v) => v.t < v.dur);
  }

  // ---------------------------------------------------------------- familiar casts (weaker, quieter)
  petFireball(x: number, y: number, target: Target, damage: number) {
    const a = Math.atan2(target.y - target.height - y, target.x - x);
    this.proj().launch("fireball", x, y, a, 200, {
      damage, radius: 4, life: 1400, tex: "fireball", anim: "fireball:play", scale: 0.6, glow: PAL.fireOrange, glowSize: 14,
      target, turn: 3, data: { splash: 12, kb: 10, lvl: 1, pet: true },
    });
    Audio.play("fire_cast", { vol: 0.25, rate: 1.4, maxConcurrent: 2, minGapMs: 80 });
  }
  petPulse(x: number, y: number, radius: number, damage: number, slow: number, freezeMs: number) {
    const g = this.g;
    g.vfx.play("shock_ice", x, y + 4, { scale: radius / 30, depth: DEPTH.fxLow, add: true, alpha: 0.7 });
    g.vfx.ring("snow", x, y, radius * 0.8, 6);
    Audio.play("ice_wave", { vol: 0.3, rate: 1.3, maxConcurrent: 2, minGapMs: 120 });
    for (const t of g.targets()) {
      if (Math.hypot(t.x - x, t.y - y) > radius + t.radius) continue;
      if (freezeMs) t.freeze(freezeMs);
      t.slow(slow, 1800);
      g.combat.damage(t, damage, { element: "ice", dx: t.x - x, dy: t.y - y, kb: 10, heavy: false, noShatter: true, quiet: true });
    }
  }
  petZap(x: number, y: number, target: Target, damage: number, chains: number) {
    const g = this.g;
    let fx = x, fy = y, cur: Target | null = target;
    const hit = new Set<Target>();
    for (let i = 0; i <= chains && cur; i++) {
      hit.add(cur);
      g.vfx.bolt(fx, fy, cur.x, cur.y - cur.height, { width: 1, ms: 140 });
      g.vfx.play("zap", cur.x, cur.y - cur.height, { add: true, scale: 0.7 });
      g.combat.damage(cur, damage * Math.pow(0.8, i), { element: "bolt", dx: cur.x - fx, dy: cur.y - fy, kb: 4, heavy: false });
      fx = cur.x; fy = cur.y - cur.height;
      cur = this.nearest(cur.x, cur.y, 60, hit);
    }
    Audio.play("bolt_hit", { vol: 0.4, rate: 1.2, maxConcurrent: 2, minGapMs: 80 });
  }
  petMissile(x: number, y: number, target: Target, damage: number) {
    const a = -Math.PI / 2 + (Math.random() - 0.5);
    this.proj().launch("missile", x, y, a, 60, {
      damage, radius: 4, life: 2400, tex: "missile", anim: "missile:play", scale: 0.8, glow: PAL.violet, glowSize: 14,
      target, pierce: 1, maxSpeed: 230, accel: 400, turn: 5, data: { kb: 10 },
    });
    Audio.play("arcane_pulse", { vol: 0.35, rate: 1.2, maxConcurrent: 2, minGapMs: 80 });
  }

  // ---------------------------------------------------------------- update
  update(dtMs: number) {
    const dt = dtMs / 1000;
    const g = this.g;
    this.updateNovas(dtMs);
    this.updateVortices(dtMs);
    if (this.combo > 0 && g.now - this.lastCastAt > GAME.combo.windowMs) this.resetCombo();
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.age += dtMs;
      // homing
      if (p.target && !p.target.alive) p.target = p.kind === "missile" ? this.nearest(p.x, p.y, 200, p.hit) : null;
      if (p.target && p.turn) {
        const want = Math.atan2(p.target.y - p.target.height - p.y, p.target.x - p.x);
        const cur = Math.atan2(p.vy, p.vx);
        let da = Phaser.Math.Angle.Wrap(want - cur);
        const maxTurn = p.turn * dt * (p.kind === "missile" ? Math.min(3, 0.6 + p.age / 250) : 1);
        da = Phaser.Math.Clamp(da, -maxTurn, maxTurn);
        const na = cur + da;
        p.vx = Math.cos(na) * p.speed;
        p.vy = Math.sin(na) * p.speed;
      }
      if (p.accel && p.speed < p.maxSpeed) {
        p.speed = Math.min(p.maxSpeed, p.speed + p.accel * dt);
        const a = Math.atan2(p.vy, p.vx);
        p.vx = Math.cos(a) * p.speed;
        p.vy = Math.sin(a) * p.speed;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const ang = Math.atan2(p.vy, p.vx);
      p.sprite.setPosition(p.x, p.y).setRotation(ang).setDepth(DEPTH.fx + (p.y > g.wizard.y ? 1 : 0));
      p.glow.setPosition(p.x, p.y).setDepth(DEPTH.fxLow);
      // trails
      p.trailT -= dtMs;
      if (p.trailT <= 0) {
        if (p.kind === "fireball") {
          const big = !!p.data.meteor || Number(p.data.lvl) >= 2;
          p.trailT = big ? 16 : 30;
          g.vfx.burst("ember", p.x - Math.cos(ang) * 4, p.y - Math.sin(ang) * 4, big ? 2 : 1, { speed: [5, 25] });
          if (p.data.meteor && Math.random() < 0.5) g.vfx.play("smoke", p.x - Math.cos(ang) * 8, p.y - Math.sin(ang) * 8, { scale: 0.8, depth: DEPTH.fxLow, alpha: 0.7 });
        } else if (p.kind === "missile") {
          p.trailT = 22;
          g.vfx.burst("dot", p.x, p.y, 1, { tint: Math.random() < 0.5 ? PAL.violet : PAL.arcanePink, speed: [2, 10], life: [180, 320] });
        } else {
          p.trailT = 40;
          g.vfx.burst("dot", p.x, p.y, 1, { tint: PAL.iceCyan, speed: [2, 8], life: [150, 250] });
        }
      }
      // collisions
      let consumed = false;
      for (const t of g.targets()) {
        if (p.hit.has(t)) continue;
        const d = Math.hypot(t.x - p.x, t.y - t.height - p.y);
        if (d > p.radius + t.radius) continue;
        p.hit.add(t);
        if (p.kind === "fireball") { this.explodeFireball(p, t); consumed = true; break; }
        const el: Element = p.kind === "missile" ? "arcane" : "ice";
        g.combat.damage(t, p.damage, { element: el, dx: p.vx, dy: p.vy, kb: Number(p.data.kb ?? 10), heavy: false });
        if (p.kind === "missile") {
          g.vfx.play("starburst", p.x, p.y, { add: true, scale: 0.8 });
          g.vfx.burst("twinkle", p.x, p.y, 2, { tint: PAL.arcanePink });
          Audio.play("arcane_hit", { rate: 0.9 + Math.random() * 0.3, maxConcurrent: 4, minGapMs: 25 });
        } else {
          g.vfx.burst("snow", p.x, p.y, 3);
          if (p.kind === "shard" && t.alive) t.slow(0.4, 1200);
        }
        p.pierce--;
        if (p.pierce <= 0) { p.kill(); consumed = true; break; }
        if (p.kind === "missile") p.target = this.nearest(p.x, p.y, 160, p.hit);
      }
      if (consumed) continue;
      if (p.age >= p.life) {
        if (p.kind === "fireball") this.explodeFireball(p, null);
        else {
          if (p.kind === "missile") g.vfx.play("starburst", p.x, p.y, { add: true, scale: 0.5 });
          p.kill();
        }
      }
    }
  }

  /** colour of the element for UI */
  static color(id: SpellId) {
    return ELEMENT_COLORS[SPELLS[id].element];
  }
}
