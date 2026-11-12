// GameScene: the arena. Owns the world camera and all gameplay systems; the HUD, tutorial,
// upgrade, pause and game-over UIs are separate overlay scenes talking through the bus.
import Phaser from "phaser";
import { GAME } from "../config/game";
import { PAL, ELEMENT_COLORS } from "../config/palette";
import { RUNE_TO_SPELL, SPELLS } from "../config/spells";
import { Layout } from "../core/Layout";
import { Audio } from "../core/Audio";
import { Save } from "../core/Save";
import { Poki } from "../core/Poki";
import { bus, EV } from "../core/bus";
import { Analytics, cap } from "../core/Analytics";
import { Wizard } from "../entities/Wizard";
import { Enemy, type Target } from "../entities/Enemy";
import type { Boss } from "../entities/Boss";
import { VFXManager, DEPTH } from "../systems/VFXManager";
import { CombatSystem } from "../systems/CombatSystem";
import { SpellManager } from "../systems/SpellManager";
import { EnemySpawnManager } from "../systems/EnemySpawnManager";
import { XPSystem } from "../systems/XPSystem";
import { UpgradeManager } from "../systems/UpgradeManager";
import { Ambience } from "../systems/Ambience";
import { FamiliarSystem } from "../systems/FamiliarSystem";
import { RuneRecognizer, type Pt } from "../rune/RuneRecognizer";
import { RuneInput, type StrokePoint } from "../rune/RuneInput";
import { RuneDrawingRenderer } from "../rune/RuneDrawingRenderer";
import type { HUDScene } from "./HUDScene";

export class GameScene extends Phaser.Scene {
  now = 0;
  over = false;
  wave = 0;
  hp = GAME.player.maxHp;
  maxHp = GAME.player.maxHp;
  stats = { kills: 0, score: 0, timeMs: 0, casts: 0 };
  drawing = false;
  levelingUp = false;
  tutorial = false;
  // analytics state (per run)
  private lastHurtBy = "unknown";
  private misses = 0;
  private tutorialMisses = 0;
  private survivalMark = 0;

  wizard!: Wizard;
  enemies: Enemy[] = [];
  boss: Boss | null = null;
  vfx!: VFXManager;
  combat!: CombatSystem;
  spells!: SpellManager;
  spawner!: EnemySpawnManager;
  xp!: XPSystem;
  upgrades!: UpgradeManager;
  ambience!: Ambience;
  familiars!: FamiliarSystem;
  private renderer2!: RuneDrawingRenderer;
  private recognizer!: RuneRecognizer;
  private input2!: RuneInput;
  private stroke: Pt[] = [];
  private hitstopUntil = 0;
  private frozenTime = false;
  private slowmo = 1;
  private comboText!: Phaser.GameObjects.BitmapText;
  private offLayout?: () => void;
  private busHandlers: [string, (...a: unknown[]) => void][] = [];

  constructor() {
    super("Game");
  }

  init() {
    Object.assign(this, {
      now: 0, over: false, wave: 0, hp: GAME.player.maxHp, maxHp: GAME.player.maxHp,
      stats: { kills: 0, score: 0, timeMs: 0, casts: 0 }, drawing: false, levelingUp: false,
      enemies: [], boss: null, stroke: [], hitstopUntil: 0, frozenTime: false, slowmo: 1,
      lastHurtBy: "unknown", misses: 0, tutorialMisses: 0, survivalMark: 0,
    });
  }

  create() {
    const cam = this.cameras.main;
    cam.setBackgroundColor(PAL.void);
    this.add.image(0, 0, "floor").setDepth(DEPTH.floor);
    this.vfx = new VFXManager(this);
    this.ambience = new Ambience(this, this.vfx, 0, 0);
    this.wizard = new Wizard(this, 0, 0, this.vfx);
    this.combat = new CombatSystem(this);
    this.spells = new SpellManager(this);
    this.familiars = new FamiliarSystem(this);
    this.spawner = new EnemySpawnManager(this);
    this.xp = new XPSystem(this);
    this.upgrades = new UpgradeManager(this);
    this.renderer2 = new RuneDrawingRenderer(this, this.vfx);
    this.recognizer = new RuneRecognizer({ threshold: GAME.rune.threshold, strongThreshold: GAME.rune.strongThreshold });
    this.comboText = this.add.bitmapText(0, -50, "pixel", "", 8).setOrigin(0.5).setDepth(DEPTH.numbers).setVisible(false);
    this.layout();
    this.offLayout = Layout.onChange(() => this.layout());

    this.input2 = new RuneInput(this.game.canvas, {
      canStart: (cx, cy) => this.canDraw(cx, cy),
      start: (p) => this.strokeStart(p),
      move: (ps) => this.strokeMove(ps),
      end: () => this.strokeEnd(),
      cancel: () => this.strokeCancel(),
    });

    this.on(EV.COMBO, (n) => this.showCombo(n as number));
    this.on(EV.PAUSE_REQ, () => this.pauseGame());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onHidden, this);

    this.scene.launch("HUD");
    Audio.startMusic();
    bus.emit(EV.HP, this.hp, this.maxHp, 0);
    bus.emit(EV.XP, 0, this.xp.toNext, 1);
    Analytics.newRun();
    Analytics.track("rune", "triangle", "visible", "run");
    if (!Save.data.tutorialDone) {
      this.tutorial = true;
      Analytics.track("tutorial", "intro", "start", "run");
      this.scene.launch("Tutorial");
    } else this.time.delayedCall(700, () => this.spawner.startWave(1));
    Poki.gameplayStart();
    cam.fadeIn(400, 11, 12, 30);
  }

  private on(ev: string, fn: (...a: unknown[]) => void) {
    bus.on(ev, fn);
    this.busHandlers.push([ev, fn]);
  }
  private cleanup() {
    this.input2?.destroy();
    this.offLayout?.();
    this.busHandlers.forEach(([e, f]) => bus.off(e, f));
    this.busHandlers = [];
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    this.anims.globalTimeScale = 1;
  }

  layout() {
    const cam = this.cameras.main;
    cam.setZoom(Layout.S);
    // keep the wizard centred in the free space between top and bottom HUD bands
    const dy = Layout.portrait ? 12 : 4;
    const dx = Layout.portrait ? 0 : -10;
    cam.centerOn(dx, -dy);
    this.vfx?.setShakeBase();
  }
  viewHalfH() {
    return this.cameras.main.worldView.height / 2;
  }

  targets(): Target[] {
    const out: Target[] = [];
    for (const e of this.enemies) if (e.alive && e.state !== "spawn") out.push(e);
    if (this.boss && this.boss.alive) out.push(this.boss);
    return out;
  }

  // ---------------------------------------------------------------- input -> runes
  private canDraw(clientX: number, clientY: number) {
    if (this.over || this.levelingUp || !this.scene.isActive()) return false;
    const hud = this.scene.get("HUD") as HUDScene;
    if (hud?.hitUI?.(clientX, clientY)) return false;
    return true;
  }
  private toWorld(p: StrokePoint) {
    const d = Layout.toDevice(p.x, p.y, this.game.canvas);
    return this.cameras.main.getWorldPoint(d.x, d.y);
  }
  private strokeStart(p: StrokePoint) {
    Audio.unlock();
    this.drawing = true;
    this.stroke = [{ x: p.x, y: p.y }];
    const w = this.toWorld(p);
    this.renderer2.begin(w.x, w.y);
    bus.emit(EV.STROKE, true);
  }
  private strokeMove(ps: StrokePoint[]) {
    if (!this.drawing) return;
    for (const p of ps) {
      this.stroke.push({ x: p.x, y: p.y });
      const w = this.toWorld(p);
      this.renderer2.add(w.x, w.y);
    }
    if (this.stroke.length > GAME.rune.maxPoints) this.stroke.splice(1, this.stroke.length - GAME.rune.maxPoints);
  }
  private strokeEnd() {
    if (!this.drawing) return;
    this.drawing = false;
    bus.emit(EV.STROKE, false);
    let len = 0;
    for (let i = 1; i < this.stroke.length; i++) len += Math.hypot(this.stroke[i].x - this.stroke[i - 1].x, this.stroke[i].y - this.stroke[i - 1].y);
    if (len < GAME.rune.minLengthPx || this.over) { this.renderer2.cancel(); return; }
    const res = this.recognizer.recognize(this.stroke);
    if (Save.settings.debugRunes) bus.emit(EV.DEBUG, res);
    const b = this.renderer2.bounds();
    if (!res.rune) {
      if (res.reason === "square") {
        // a neat square looks a lot like a triangle to the matcher: explain instead of silently fizzling
        this.trackMiss("square");
        this.failCast("TRIANGLE = 3 CORNERS");
        return;
      }
      this.trackMiss(res.bestScore >= 0.6 ? res.best : "unclear");
      this.failCast("");
      return;
    }
    const id = RUNE_TO_SPELL[res.rune];
    const why = this.spells.cast(id, b.cx, b.cy);
    if (why === null) {
      Analytics.track("rune", res.rune, "interact", "run");
      this.stats.casts++;
      const c = ELEMENT_COLORS[SPELLS[id].element];
      this.renderer2.success(res.rune, c.main, c.light);
      this.ambience.flareRunes(c.main);
    } else {
      Analytics.track("drawing", why === "locked" ? "not-learned" : "recharging", "reached", "run");
      this.failCast(why === "locked" ? "NOT YET LEARNED" : "RECHARGING...");
    }
  }
  /** a stroke that wasn't recognised: how often, and which rune they were most likely attempting */
  private trackMiss(attempt: string) {
    this.misses++;
    if ([1, 3, 5, 10, 20].includes(this.misses)) Analytics.track("drawing", "misses", String(this.misses), "run");
    Analytics.track("drawing", `miss-${attempt}`, "reached", "run");
    if (this.tutorial) {
      this.tutorialMisses++;
      Analytics.track("tutorial", `fail-${cap(this.tutorialMisses, 5)}`, "reached", "run");
    }
  }
  private failCast(msg: string) {
    this.renderer2.fail();
    Audio.play("fizzle", { vol: 0.6 });
    this.spells.resetCombo();
    bus.emit(EV.FAIL);
    if (msg) this.vfx.floatText(this.wizard.x, this.wizard.y - 46, msg, 0xb9a8e0, 1, 800);
  }
  private strokeCancel() {
    this.drawing = false;
    this.renderer2.cancel();
    bus.emit(EV.STROKE, false);
  }

  // ---------------------------------------------------------------- feel
  hitstop(ms: number) {
    if (this.over) return;
    this.hitstopUntil = Math.max(this.hitstopUntil, performance.now() + ms);
    this.setTimeFrozen(true);
  }
  private setTimeFrozen(on: boolean) {
    if (on === this.frozenTime) return;
    this.frozenTime = on;
    const k = on ? 0 : this.slowmo;
    this.tweens.timeScale = k;
    this.time.timeScale = k;
    this.anims.globalTimeScale = k;
  }
  shockwaveGrass(x: number, y: number, r: number) {
    this.ambience.shockwave(x, y, r);
  }
  private showCombo(n: number) {
    const t = this.comboText;
    if (n < 3) { t.setVisible(false); return; }
    if (n >= 10) Analytics.track("combo", "x10", "reached", "run");
    if (n >= 20) Analytics.track("combo", "x20", "reached", "run");
    t.setText(`x${n} COMBO`).setVisible(true).setTint(n >= 15 ? PAL.pink : n >= 8 ? PAL.gold : PAL.lavender);
    this.tweens.killTweensOf(t);
    t.setScale(1.5);
    this.tweens.add({ targets: t, scale: 1, duration: 180, ease: "Back.easeOut" });
    Audio.play("combo", { rate: 1 + Math.min(n, 20) * 0.04, vol: 0.5 });
    if (n % 5 === 0) {
      this.vfx.glow(this.wizard.x, this.wizard.y - 20, PAL.gold, 60, 400, 0.5);
      this.vfx.burst("twinkle", this.wizard.x, this.wizard.y - 40, 6, { tint: PAL.gold });
    }
  }

  // ---------------------------------------------------------------- player health
  damagePlayer(n: number, sx: number, sy: number, ignoreInvuln = false, source = "unknown"): boolean {
    if (this.over || this.wizard.dead || this.tutorial) return false;
    if (!ignoreInvuln && this.wizard.isInvulnerable(this.now)) return false;
    this.hp = Math.max(0, this.hp - n);
    this.lastHurtBy = source;
    bus.emit(EV.HP, this.hp, this.maxHp, -n);
    Audio.play("hurt");
    this.wizard.hurt(this.now, GAME.player.invulnMs);
    this.wizard.face(sx);
    this.vfx.shake(GAME.feel.shakeHeavy, 160);
    this.vfx.play("hitflash", this.wizard.x, this.wizard.y - 16, { add: true, tint: PAL.hpRed, scale: 2 });
    this.vfx.burst("spark", this.wizard.x, this.wizard.y - 16, 6, { tint: PAL.hpRed });
    this.spells.resetCombo();
    // shove nearby monsters back: breathing room after a hit
    for (const e of this.enemies) {
      if (!e.alive || e.kind === "orb") continue;
      const dx = e.x - this.wizard.x, dy = e.y - this.wizard.y, d = Math.hypot(dx, dy);
      if (d < 40) e.push(dx, dy, 220);
    }
    this.wizard.lowHp = this.hp <= 1;
    bus.emit(EV.LOW_HP, this.wizard.lowHp);
    if (this.hp <= 0) this.gameOver();
    else this.hitstop(70);
    return true;
  }
  heal(n: number) {
    this.hp = Math.min(this.maxHp, this.hp + n);
    bus.emit(EV.HP, this.hp, this.maxHp, n);
    this.wizard.lowHp = this.hp <= 1;
    bus.emit(EV.LOW_HP, this.wizard.lowHp);
    this.vfx.burst("twinkle", this.wizard.x, this.wizard.y - 20, 6, { tint: PAL.hpRed });
  }

  onBossDefeated(b: Boss) {
    this.boss = null;
    Analytics.track("boss", "guardian", "complete");
    this.spawner.bossAlive = false;
    this.stats.kills++;
    this.stats.score += 600 * (1 + Math.floor(this.wave / 10));
    this.xp.drop(b.x, b.y, b.xp);
    this.xp.vacuum();
    this.heal(1);
    bus.emit(EV.WAVE_BANNER, "GUARDIAN DEFEATED!", "+1 HEART", PAL.gold);
    Audio.play("levelup");
  }

  // ---------------------------------------------------------------- flow
  tutorialDone() {
    this.tutorial = false;
    Analytics.track("tutorial", "intro", "complete", "run");
    Save.data.tutorialDone = true;
    Save.save();
    this.time.delayedCall(600, () => this.spawner.startWave(1));
  }

  /** pause + hide the tutorial/demo overlay while a menu is open, so it never draws over menus */
  suspendOverlays() {
    if (this.scene.isActive("Tutorial")) {
      this.scene.pause("Tutorial");
      this.scene.setVisible(false, "Tutorial");
    }
  }
  restoreOverlays() {
    if (this.scene.isPaused("Tutorial")) {
      this.scene.resume("Tutorial");
      this.scene.setVisible(true, "Tutorial");
    }
  }

  pauseGame() {
    if (this.over || this.levelingUp || !this.scene.isActive()) return;
    this.input2.abort();
    this.suspendOverlays();
    this.scene.pause();
    Poki.gameplayStop();
    this.scene.launch("Pause");
  }
  private onHidden() {
    Audio.mute("hidden", true);
    this.pauseGame();
    this.game.events.once(Phaser.Core.Events.VISIBLE, () => Audio.mute("hidden", false));
  }

  private openUpgrade() {
    this.levelingUp = true;
    Analytics.track("level", cap(this.xp.level - this.xp.pendingLevels + 1, 15), "reached", "run");
    this.input2.abort();
    this.wizard.levelUp();
    Audio.play("levelup");
    this.vfx.glow(this.wizard.x, this.wizard.y - 10, PAL.gold, 140, 700, 0.5);
    this.time.delayedCall(520, () => {
      if (this.over) { this.levelingUp = false; return; }
      Poki.gameplayStop();
      this.suspendOverlays();
      this.scene.pause();
      this.scene.launch("Upgrade", { choices: this.upgrades.choices(), level: this.xp.level - this.xp.pendingLevels + 1 });
    });
  }
  /** called by UpgradeScene */
  resumeFromUpgrade() {
    this.xp.pendingLevels = Math.max(0, this.xp.pendingLevels - 1);
    this.levelingUp = false;
    this.scene.resume();
    this.restoreOverlays();
    Poki.gameplayStart();
    bus.emit(EV.COOLDOWNS);
  }

  private gameOver() {
    this.over = true;
    if (this.wave > 0) Analytics.track("wave", cap(this.wave, 21), "fail");
    if (this.boss?.alive) Analytics.track("boss", "guardian", "fail");
    Analytics.track("death", this.lastHurtBy, "reached");
    this.input2.abort();
    Poki.gameplayStop();
    this.slowmo = 0.35;
    this.setTimeFrozen(false);
    this.tweens.timeScale = this.time.timeScale = this.anims.globalTimeScale = 0.35;
    this.vfx.illuminate(PAL.hpRed, 0.12, 600);
    Audio.stopMusic();
    // brief real-time slow-motion beat, then the death plays at normal speed
    window.setTimeout(() => {
      this.slowmo = 1;
      if (this.sys.isActive()) this.tweens.timeScale = this.time.timeScale = this.anims.globalTimeScale = 1;
    }, 650);
    this.wizard.die(() => {
      Audio.play("gameover");
      const beat = Save.submitRun({ timeMs: this.stats.timeMs, wave: this.wave, kills: this.stats.kills, score: this.stats.score });
      this.scene.launch("GameOver", { ...this.stats, wave: this.wave, beat });
    });
  }

  // ---------------------------------------------------------------- loop
  update(_t: number, deltaRaw: number) {
    const real = Math.min(deltaRaw, 50);
    if (this.frozenTime && performance.now() >= this.hitstopUntil) this.setTimeFrozen(false);
    this.renderer2.update(real);
    if (this.frozenTime) return;
    const dt = real * this.slowmo;
    this.now += dt;
    if (!this.over && !this.tutorial) {
      this.stats.timeMs += dt;
      const marks = [30, 60, 120, 180, 300, 600];
      if (this.survivalMark < marks.length && this.stats.timeMs >= marks[this.survivalMark] * 1000)
        Analytics.track("survival", `${marks[this.survivalMark++]}s`, "reached", "run");
    }
    this.wizard.update(dt, this.now);
    for (const e of this.enemies) e.update(dt);
    if (this.enemies.length > 64 || Math.random() < 0.02) this.enemies = this.enemies.filter((e) => e.alive);
    this.boss?.update(dt);
    this.spells.update(dt);
    this.familiars.update(dt);
    this.xp.update(dt);
    if (!this.tutorial) this.spawner.update(dt);
    this.vfx.update(dt);
    this.ambience.update(dt, this.cameras.main.worldView);
    this.comboText.setPosition(Math.round(this.wizard.x), Math.round(this.wizard.y - 50));
    if (this.xp.pendingLevels > 0 && !this.levelingUp && !this.drawing && !this.over) this.openUpgrade();
  }
}
