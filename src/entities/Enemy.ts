// Enemies: Forest Slime (hops), Shadow Bat (weaving flight), Cursed Skeleton (shuffle + telegraphed
// lunge), Stone Golem (stomp + telegraphed slam), boss orbs. v1.10.0: Big Slime (splits), Fire Imp (keeps
// its distance, throws a slow fireball, immune to Fire), Bomb Beetle (lights its fuse beside the wizard),
// Shield Knight (a skeleton whose shield blocks one hit). Shared: spawn-in, hit reactions, knockback,
// slow/freeze/stun, elite glow, unique deaths.
import Phaser from "phaser";
import { ENEMIES, ELITE, type EnemyDef, type EnemyKind } from "../config/enemies";
import { PAL } from "../config/palette";
import { origin } from "../core/assets";
import { Audio } from "../core/Audio";
import { DEPTH } from "../systems/VFXManager";
import type { GameScene } from "../scenes/GameScene";

export interface Target {
  x: number;
  y: number;
  /** visual centre height above (x,y) for VFX */
  height: number;
  radius: number;
  alive: boolean;
  isBoss?: boolean;
  frozen: boolean;
  hp: number;
  maxHp: number;
  damage(amount: number): boolean;
  react(dx: number, dy: number, force: number, heavy: boolean, stunMs?: number): void;
  slow(factor: number, ms: number): void;
  freeze(ms: number): void;
  thaw(): void;
  push(dx: number, dy: number, force: number): void;
  die(): void;
}

type State = "spawn" | "move" | "rest" | "windup" | "attack" | "recover" | "dead";

export class Enemy implements Target {
  g: GameScene;
  def: EnemyDef;
  kind: EnemyKind | "orb";
  elite: boolean;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  aura?: Phaser.GameObjects.Image;
  telegraph?: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  height: number;
  radius: number;
  hp: number;
  maxHp: number;
  alive = true;
  state: State = "spawn";
  private vx = 0;
  private vy = 0;
  private kbx = 0;
  private kby = 0;
  private stateT = 0;
  private slowUntil = 0;
  private slowFactor = 1;
  private frozenUntil = 0;
  private stunUntil = 0;
  private flashUntil = 0;
  private hurtUntil = 0;
  private attackCd = 0;
  private phase = Math.random() * 10;
  private scaleBase = 1;
  private sheet: string;
  speed: number;
  xp: number;
  private auraT = 0;
  private hover = 0;
  /** hits the Shield Knight's shield still blocks */
  shield = 0;
  private immuneTextAt = 0;
  /** what hurt the player, for orbs: the Guardian's or an imp's fireball */
  private orbTag = "boss-orb";

  constructor(g: GameScene, kind: EnemyKind | "orb", x: number, y: number, o: { elite?: boolean; hpMul?: number; vx?: number; vy?: number; impShot?: boolean } = {}) {
    this.g = g;
    this.kind = kind;
    this.def = kind === "orb"
      ? { kind: "slime", hp: 1, speed: 34, radius: 5, contactDamage: 1, xp: 0, knockbackResist: 1, shadow: 0, shadowOffset: 14, scoreWeight: 0 }
      : ENEMIES[kind];
    this.elite = !!o.elite;
    this.x = x;
    this.y = y;
    const hpMul = (o.hpMul ?? 1) * (this.elite ? ELITE.hpMul : 1);
    this.maxHp = this.hp = Math.round(this.def.hp * hpMul);
    this.speed = this.def.speed * (this.elite ? ELITE.speedMul : 1);
    this.xp = Math.round(this.def.xp * (this.elite ? ELITE.xpMul : 1));
    this.radius = this.def.radius * (this.elite ? 1.15 : 1);
    this.scaleBase = this.elite ? ELITE.scale : 1;
    this.sheet = kind === "orb" ? (o.impShot ? "imp_shot" : "boss_orb") : this.elite ? `${kind}_elite` : kind;
    this.height = { slime: 7, bat: 14, skeleton: 14, golem: 22, bigslime: 10, imp: 12, beetle: 6, knight: 14, boss: 0, orb: 14 }[kind];
    this.hover = kind === "bat" ? 13 : kind === "imp" ? 12 : kind === "orb" ? 14 : 0;
    this.shield = this.def.shield ?? 0;
    if (kind === "imp") this.attackCd = 1500; // settle on screen before the first throw
    this.shadow = g.add.image(x, y, `shadow${this.def.shadow}`).setDepth(DEPTH.shadow).setAlpha(0);
    const [ox, oy] = origin(this.sheet);
    this.sprite = g.add.sprite(x, y, this.sheet).setOrigin(ox, oy).setDepth(y);
    if (kind === "orb") {
      this.vx = o.vx ?? 0;
      this.vy = o.vy ?? 0;
      this.sprite.play(`${this.sheet}:spin`);
      this.state = "move";
      this.shadow.setAlpha(0.6);
      this.aura = g.add.image(x, y, "glow").setTint(o.impShot ? PAL.fireOrange : PAL.violet).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6).setDisplaySize(26, 26);
      if (o.impShot) this.orbTag = "imp-fireball";
      return;
    }
    this.sprite.play(`${this.sheet}:${kind === "bat" || kind === "imp" ? "fly" : kind === "beetle" ? "walk" : "idle"}`);
    if (this.elite) {
      this.aura = g.add.image(x, y, "glow_big").setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.25)
        .setTint({ slime: PAL.fireYellow, bat: PAL.hpRed, skeleton: PAL.iceCyan, golem: PAL.fireOrange, bigslime: PAL.fireYellow, imp: PAL.iceCyan, beetle: PAL.fireYellow, knight: PAL.iceCyan, boss: PAL.violet }[kind]);
    }
    this.spawnIn();
  }

  private spawnIn() {
    const g = this.g;
    this.state = "spawn";
    const portal = g.vfx.play("portal", this.x, this.y, { depth: DEPTH.sigil });
    portal.setScale(this.kind === "golem" ? 1.6 : this.kind === "bigslime" ? 1.3 : 1);
    this.sprite.setAlpha(0).setScale(this.scaleBase * 0.6, this.scaleBase * 0.2);
    Audio.play("spawn", { vol: 0.35, rate: 0.9 + Math.random() * 0.2 });
    g.time.delayedCall(240, () => {
      if (!this.alive) return;
      g.vfx.burst("dot", this.x, this.y - 4, 6, { tint: PAL.violet });
      g.tweens.add({ targets: this.sprite, alpha: 1, scaleX: this.scaleBase, scaleY: this.scaleBase, duration: 260, ease: "Back.easeOut" });
      g.tweens.add({ targets: this.shadow, alpha: 1, duration: 260 });
    });
    g.time.delayedCall(520, () => {
      if (this.alive && this.state === "spawn") this.state = "move";
    });
  }

  /** analytics tag for what hurt the player, e.g. "skeleton" or "golem-elite" */
  tag() {
    return this.elite ? `${this.kind}-elite` : this.kind;
  }

  get frozen() {
    return this.g.now < this.frozenUntil;
  }

  // ---------------------------------------------------------------- combat hooks
  damage(amount: number) {
    if (!this.alive) return false;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      return true;
    }
    return false;
  }

  react(dx: number, dy: number, force: number, heavy: boolean, stunMs = 0) {
    if (!this.alive) return;
    const now = this.g.now;
    const k = (1 - this.def.knockbackResist) * force;
    const d = Math.hypot(dx, dy) || 1;
    this.kbx += (dx / d) * k * 5;
    this.kby += (dy / d) * k * 5;
    this.flashUntil = now + (heavy ? 110 : 70);
    if (stunMs) this.stunUntil = Math.max(this.stunUntil, now + stunMs);
    if (this.kind === "orb") return;
    // heavy hits interrupt skeleton wind-ups (stagger)
    if (heavy && this.state === "windup" && (this.kind === "skeleton" || this.kind === "knight")) this.endAttack();
    if (this.state !== "windup" && this.state !== "attack") {
      this.hurtUntil = now + (heavy ? 220 : 140);
      const hurt = `${this.sheet}:hurt`;
      if (this.sprite.anims.currentAnim?.key !== hurt) this.sprite.play(hurt);
    }
    // squash on impact
    this.g.tweens.killTweensOf(this.sprite);
    this.sprite.setScale(this.scaleBase * (heavy ? 1.25 : 1.15), this.scaleBase * (heavy ? 0.78 : 0.86));
    this.g.tweens.add({ targets: this.sprite, scaleX: this.scaleBase, scaleY: this.scaleBase, duration: heavy ? 260 : 180, ease: "Back.easeOut" });
    const hx = this.x, hy = this.y - this.height - this.hover;
    if (this.kind === "slime" || this.kind === "bigslime") this.g.vfx.burst("drop", hx, hy, heavy ? 5 : 2);
    else if (this.kind === "golem") this.g.vfx.burst("chip", hx, hy, heavy ? 6 : 3);
    else if (this.kind === "skeleton" || this.kind === "knight") this.g.vfx.burst("dot", hx, hy, 3, { tint: 0xf6f0dc });
    else if (this.kind === "bat") this.g.vfx.burst("feather", hx, hy, 3);
    else if (this.kind === "imp") this.g.vfx.burst("ember", hx, hy, heavy ? 4 : 2);
    else if (this.kind === "beetle") this.g.vfx.burst("dot", hx, hy, 3, { tint: 0x86e6d8 });
  }

  /** v1.10.0 Fire Imp: a hit of the element it ignores. A nudge and "IMMUNE", no damage */
  shrugOff(dx: number, dy: number) {
    if (!this.alive) return;
    const now = this.g.now;
    this.push(dx, dy, 40);
    this.flashUntil = now + 50;
    if (now >= this.immuneTextAt) {
      this.immuneTextAt = now + 700;
      this.g.vfx.floatText(this.x, this.y - this.height - this.hover - 14, "IMMUNE", 0xffb066, 1, 700);
      this.g.vfx.play("smoke", this.x, this.y - this.height - this.hover, { scale: 0.7 });
    }
  }

  /** v1.10.0 Shield Knight: the shield takes the whole hit and breaks off */
  breakShield(dx: number, dy: number) {
    if (!this.alive || this.shield <= 0) return;
    this.shield--;
    const g = this.g, hx = this.x, hy = this.y - this.height;
    if (this.shield <= 0) this.sheet = `${this.sheet}_bare`;
    this.react(dx, dy, 0.6, true); // stagger: ends a wind-up and shows the bare sprite's hurt frame
    if (!this.sprite.anims.currentAnim?.key.startsWith(`${this.sheet}:`)) this.sprite.play(`${this.sheet}:idle`);
    g.vfx.floatText(hx, hy - 16, "BLOCK!", 0xc8d2f0, 1, 700);
    g.vfx.burst("spark", hx - 3, hy, 7, { tint: 0xe2e8ff });
    const d = Math.hypot(dx, dy) || 1;
    g.vfx.bit("shield0", hx - 3, hy, (dx / d) * 45 - 10, (dy / d) * 25, 120, 900);
    g.vfx.bit("shield1", hx - 5, hy + 2, (dx / d) * 30 + 15, (dy / d) * 20, 90, 800);
    Audio.play("shatter", { vol: 0.7, rate: 1.5, maxConcurrent: 2 });
  }

  push(dx: number, dy: number, force: number) {
    const d = Math.hypot(dx, dy) || 1;
    const k = (1 - this.def.knockbackResist * 0.7) * force;
    this.kbx += (dx / d) * k;
    this.kby += (dy / d) * k;
  }
  thaw() {
    this.frozenUntil = 0;
    this.sprite.anims.resume();
  }

  slow(factor: number, ms: number) {
    if (!this.alive) return;
    this.slowUntil = Math.max(this.slowUntil, this.g.now + ms);
    this.slowFactor = Math.min(this.slowFactor, 1 - factor);
  }
  freeze(ms: number) {
    if (!this.alive) return;
    if (this.state === "windup") this.endAttack();
    this.frozenUntil = Math.max(this.frozenUntil, this.g.now + ms * (this.kind === "golem" ? 0.6 : 1));
    this.sprite.anims.pause();
  }

  die() {
    if (this.state === "dead") return;
    this.alive = false;
    this.state = "dead";
    const g = this.g, x = this.x, y = this.y, s = this.sprite;
    this.telegraph?.destroy();
    this.aura && g.tweens.add({ targets: this.aura, alpha: 0, duration: 200, onComplete: () => this.aura?.destroy() });
    g.tweens.killTweensOf(s);
    s.anims.resume();
    s.clearTint();
    const done = () => { s.destroy(); this.shadow.destroy(); };
    const hy = y - this.height - this.hover;
    if (this.elite) {
      g.vfx.play("starburst", x, hy, { scale: 1.6, add: true, tint: 0xffe59a });
      g.vfx.burst("twinkle", x, hy, 10, { tint: PAL.gold });
    }
    switch (this.kind) {
      case "slime": {
        Audio.play("slime_die", { rate: 0.9 + Math.random() * 0.25 });
        s.play(`${this.sheet}:death`);
        g.vfx.burst("drop", x, y - 6, 10, { speed: [40, 110] });
        g.vfx.burst("twinkle", x, y - 6, 4, { tint: PAL.slimeGreen });
        g.vfx.decal("decal_goo", x, y, this.scaleBase, 3500, 0.7);
        g.tweens.add({ targets: [s, this.shadow], alpha: 0, delay: 200, duration: 160, onComplete: done });
        break;
      }
      case "bigslime": {
        Audio.play("slime_die", { rate: 0.65 + Math.random() * 0.1 });
        s.play(`${this.sheet}:death`);
        g.vfx.burst("drop", x, y - 9, 16, { speed: [50, 130] });
        g.vfx.burst("twinkle", x, y - 9, 6, { tint: PAL.slimeGreen });
        g.vfx.decal("decal_goo", x, y, this.scaleBase * 1.6, 3500, 0.7);
        g.tweens.add({ targets: [s, this.shadow], alpha: 0, delay: 220, duration: 160, onComplete: done });
        break;
      }
      case "imp": {
        Audio.play("bat_die", { rate: 1.25 + Math.random() * 0.2 });
        s.play(`${this.sheet}:hurt`);
        g.tweens.add({ targets: s, angle: 360 * (Math.random() < 0.5 ? 1 : -1), scale: 0.3, y: s.y + 6, duration: 260, ease: "Quad.easeIn" });
        g.time.delayedCall(220, () => {
          g.vfx.play("smoke", x, s.y, { scale: 1.2 });
          g.vfx.burst("ember", x, s.y, 8, { speed: [30, 90] });
        });
        g.tweens.add({ targets: this.shadow, alpha: 0, duration: 240 });
        g.time.delayedCall(270, done);
        break;
      }
      case "beetle": {
        // the bomb goes off whether it reached the wizard or was popped (popped, CombatSystem also blasts its neighbours)
        Audio.play("fire_boom", { rate: 1.1 + Math.random() * 0.15, maxConcurrent: 3 });
        s.setVisible(false);
        g.vfx.play("explosion", x, y - 6, { scale: 1, depth: DEPTH.fx });
        g.vfx.glow(x, y - 6, PAL.fireOrange, 80, 300, 0.8);
        g.vfx.burst("ember", x, y - 6, 12, { speed: [40, 120] });
        g.vfx.decal("decal_scorch", x, y + 2, 1.1, 3500);
        g.vfx.shake(2, 140);
        g.tweens.add({ targets: this.shadow, alpha: 0, duration: 200, onComplete: done });
        break;
      }
      case "bat": {
        Audio.play("bat_die", { rate: 0.9 + Math.random() * 0.2 });
        s.play(`${this.sheet}:hurt`);
        g.tweens.add({ targets: s, angle: 540 * (Math.random() < 0.5 ? 1 : -1), scale: 0.3, y: s.y + 8, duration: 280, ease: "Quad.easeIn" });
        g.time.delayedCall(240, () => {
          g.vfx.play("smoke", x, s.y, { scale: 1.3 });
          g.vfx.play("smoke", x + 5, s.y - 4, { scale: 0.9 });
          g.vfx.burst("feather", x, s.y, 5);
        });
        g.tweens.add({ targets: this.shadow, alpha: 0, duration: 260 });
        g.time.delayedCall(290, done);
        break;
      }
      case "skeleton":
      case "knight": {
        Audio.play("skel_die", { rate: 0.95 + Math.random() * 0.1 });
        s.setVisible(false);
        const sk = this.elite ? 0x8478a8 : undefined;
        const out = (tex: string, vz: number) => {
          const a = Math.random() * Math.PI * 2, sp = 25 + Math.random() * 45;
          g.vfx.bit(tex, x, y - 4, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, vz, 900 + Math.random() * 400, sk);
        };
        out("bone0", 150); out("bone1", 110); out("bone1", 90); out("bone2", 120); out("bone2", 100); out("bone3", 130);
        g.vfx.burst("dot", x, y - 14, 8, { tint: PAL.lavender });
        g.vfx.glow(x, y - 16, PAL.violet, 30, 300, 0.6);
        g.tweens.add({ targets: this.shadow, alpha: 0, duration: 300, onComplete: done });
        break;
      }
      case "golem": {
        Audio.play("golem_die");
        g.hitstop(70);
        g.vfx.shake(2.5, 240);
        s.setTintFill(0xffffff);
        g.time.delayedCall(90, () => {
          s.setVisible(false);
          for (let i = 0; i < 7; i++) {
            const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 50;
            g.vfx.bit(`rock${i % 3}`, x + Math.cos(a) * 8, y - 10, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, 90 + Math.random() * 90, 1200, this.elite ? 0xb06060 : undefined);
          }
          g.vfx.play("starburst", x, y - 20, { scale: 2.2, add: true, tint: this.elite ? PAL.fireOrange : PAL.iceCyan });
          g.vfx.play("shock_ice", x, y, { scale: 1.4, depth: DEPTH.fxLow, add: true });
          g.vfx.glow(x, y - 20, this.elite ? PAL.fireOrange : PAL.iceCyan, 110, 500, 0.8);
          g.vfx.burst("chip", x, y - 18, 14, { speed: [50, 140] });
          g.vfx.illuminate(PAL.iceCyan, 0.06);
          g.tweens.add({ targets: this.shadow, alpha: 0, duration: 300, onComplete: done });
        });
        break;
      }
      case "orb": {
        g.vfx.play("starburst", x, y - this.hover, { scale: 0.9, add: true });
        this.aura?.destroy();
        done();
        break;
      }
      default:
        done();
    }
  }

  // ---------------------------------------------------------------- AI
  private endAttack() {
    this.state = "recover";
    this.stateT = 0;
    this.telegraph?.clear();
    this.sprite.clearTint();
  }

  update(dtMs: number) {
    if (!this.alive) return;
    const g = this.g, now = g.now, dt = dtMs / 1000;
    const w = g.wizard;
    const dx = w.x - this.x, dy = w.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;
    const frozen = now < this.frozenUntil;
    const stunned = now < this.stunUntil;
    const slowK = now < this.slowUntil ? this.slowFactor : 1;
    if (now >= this.slowUntil) this.slowFactor = 1;
    if (!frozen && this.sprite.anims.isPaused && !stunned) this.sprite.anims.resume();
    if (stunned && !frozen) this.sprite.anims.pause();
    this.stateT += dtMs;
    this.phase += dt;
    let mvx = 0, mvy = 0;

    if (this.kind === "orb") {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (dist < this.radius + 6) {
        g.damagePlayer(1, this.x, this.y, false, this.orbTag);
        this.die();
        return;
      }
      if (this.stateT > 9000) { this.die(); return; }
    } else if (this.state !== "spawn" && !frozen && !stunned) {
      const sp = this.speed * slowK;
      switch (this.kind) {
        case "slime":
        case "bigslime": {
          const anim = this.sprite.anims.currentAnim?.key ?? "";
          if (now < this.hurtUntil) break;
          if (this.state === "move") {
            if (!anim.endsWith(":hop")) {
              this.sprite.play(`${this.sheet}:hop`);
              if (dist < 140) Audio.play("slime_hop", { vol: 0.25, rate: (this.kind === "bigslime" ? 0.6 : 0.9) + Math.random() * 0.3, maxConcurrent: 2, minGapMs: 120 });
            }
            const fi = this.sprite.anims.currentFrame?.index ?? 1;
            if (fi >= 2 && fi <= 4) { mvx = ux * sp * 2.6; mvy = uy * sp * 2.6; }
            if (!this.sprite.anims.isPlaying) { this.state = "rest"; this.stateT = 0; this.sprite.play(`${this.sheet}:idle`); }
          } else if (this.state === "rest" && this.stateT > 260 + Math.random() * 400) {
            this.state = "move";
            this.stateT = 0;
          }
          break;
        }
        case "bat": {
          const weave = Math.sin(this.phase * 4.2) * 0.9;
          mvx = (ux - uy * weave) * sp;
          mvy = (uy + ux * weave) * sp;
          if (now >= this.hurtUntil && this.sprite.anims.currentAnim?.key !== `${this.sheet}:fly`) this.sprite.play(`${this.sheet}:fly`);
          break;
        }
        case "imp": {
          // hovers at about attackRange, drifting around the wizard, and throws when on screen
          const range = this.def.attackRange ?? 70;
          this.attackCd -= dtMs;
          if (this.state === "move" || this.state === "rest") {
            const along = dist > range ? 1 : dist < range * 0.7 ? -0.8 : 0;
            const side = along ? Math.sin(this.phase * 3.1) * 0.6 : Math.sin(this.phase * 0.7) >= 0 ? 0.5 : -0.5;
            mvx = (ux * along - uy * side) * sp;
            mvy = (uy * along + ux * side) * sp;
            const fly = `${this.sheet}:fly`;
            if (now >= this.hurtUntil && this.sprite.anims.currentAnim?.key !== fly) this.sprite.play(fly);
            if (dist <= range * 1.15 && this.attackCd <= 0 && g.inView(this, 10)) this.beginAttack();
          } else if (this.state === "windup") {
            this.drawTelegraph();
            if (this.stateT >= (this.def.attackWindupMs ?? 800) * (this.elite ? 0.8 : 1)) this.throwFire(ux, uy);
          } else if (this.state === "attack") {
            if (this.stateT > 260) this.endAttack();
          } else if (this.state === "recover") {
            if (this.stateT > 300) { this.state = "move"; this.stateT = 0; }
          }
          break;
        }
        case "beetle": {
          // scuttles straight in, then lights its fuse beside the wizard (ice puts the fuse out)
          const reach = this.radius + w.radius + (this.def.attackRange ?? 12);
          if (this.state === "move" || this.state === "rest") {
            if (dist <= reach) this.beginAttack();
            else {
              const wig = Math.sin(this.phase * 9) * 0.25;
              mvx = (ux - uy * wig) * sp;
              mvy = (uy + ux * wig) * sp;
              const walk = `${this.sheet}:walk`;
              if (now >= this.hurtUntil && this.sprite.anims.currentAnim?.key !== walk) this.sprite.play(walk);
            }
          } else if (this.state === "windup") {
            this.drawTelegraph();
            if (this.stateT >= (this.def.attackWindupMs ?? 600) * (this.elite ? 0.8 : 1)) {
              if (dist <= 30 + w.radius) g.damagePlayer(this.def.attackDamage ?? 2, this.x, this.y, false, this.tag());
              this.die();
              return;
            }
          } else if (this.state === "recover") {
            if (this.stateT > 200) { this.state = "move"; this.stateT = 0; }
          }
          break;
        }
        case "skeleton":
        case "knight":
        case "golem": {
          const range = (this.def.attackRange ?? 20) + w.radius;
          this.attackCd -= dtMs;
          if (this.state === "move" || this.state === "rest") {
            if (dist <= range && this.attackCd <= 0) this.beginAttack();
            else if (dist > range * 0.8) {
              mvx = ux * sp; mvy = uy * sp;
              const walk = `${this.sheet}:walk`;
              if (now >= this.hurtUntil && this.sprite.anims.currentAnim?.key !== walk) this.sprite.play(walk);
              if (this.kind === "golem" && this.sprite.anims.currentFrame && this.sprite.anims.currentFrame.index % 2 === 1 && this.stateT > 380) {
                this.stateT = 0;
                g.vfx.burst("chip", this.x + (Math.random() - 0.5) * 12, this.y, 2, { speed: [10, 30] });
              }
            } else if (this.sprite.anims.currentAnim?.key !== `${this.sheet}:idle` && now >= this.hurtUntil) this.sprite.play(`${this.sheet}:idle`);
          } else if (this.state === "windup") {
            this.drawTelegraph();
            const wu = (this.def.attackWindupMs ?? 400) * (this.elite ? 0.8 : 1);
            if (this.stateT >= wu) this.strike(dist, range);
          } else if (this.state === "attack") {
            if (this.stateT > 220) this.endAttack();
          } else if (this.state === "recover") {
            if (this.stateT > 300) { this.state = "move"; this.stateT = 0; }
          }
          break;
        }
      }
    }

    // separation from neighbours (cheap, enemies are capped)
    if (this.kind !== "orb")
      for (const o of g.enemies) {
        if (o === this || !o.alive || o.kind === "orb") continue;
        const ex = this.x - o.x, ey = this.y - o.y, d2 = ex * ex + ey * ey, min = this.radius + o.radius;
        if (d2 > 0 && d2 < min * min) {
          const d = Math.sqrt(d2), push = ((min - d) / min) * 40;
          mvx += (ex / d) * push;
          mvy += (ey / d) * push;
        }
      }

    // knockback decays fast
    this.x += (mvx + this.kbx) * dt;
    this.y += (mvy + this.kby) * dt;
    const decay = Math.pow(0.0008, dt);
    this.kbx *= decay;
    this.kby *= decay;

    // contact damage
    if (this.kind !== "orb" && this.state !== "spawn" && !frozen && dist < this.radius + w.radius && this.def.contactDamage > 0) {
      if (g.damagePlayer(this.def.contactDamage, this.x, this.y, false, this.tag())) {
        this.kbx -= ux * 140;
        this.kby -= uy * 140;
      }
    }

    // ---- presentation
    const s = this.sprite;
    const bob = this.kind === "bat" ? Math.sin(this.phase * 6) * 2 : this.kind === "orb" ? Math.sin(this.phase * 5) * 1.5 : 0;
    const jit = this.state === "windup" ? (Math.random() - 0.5) * (this.kind === "golem" ? 1.5 : 1) : 0;
    s.setPosition(this.x + jit, this.y - this.hover + bob);
    s.setDepth(this.y);
    if (Math.abs(dx) > 2 && this.kind !== "orb" && this.state !== "windup") s.setFlipX(dx < 0);
    this.shadow.setPosition(this.x, this.y + 1);
    if (now < this.flashUntil) s.setTintFill(0xffffff);
    else if (frozen) s.setTint(0x8fe8ff);
    else if (stunned) s.setTint(0xfff0a0);
    else if (now < this.slowUntil) s.setTint(0xa8d8ff);
    else if (this.state !== "windup") s.clearTint();
    if (frozen && Math.random() < 0.04) g.vfx.burst("snow", this.x, this.y - this.height, 1);
    if (stunned && Math.random() < 0.15) g.vfx.burst("spark", this.x + (Math.random() - 0.5) * 10, this.y - this.height * 2, 1, { tint: PAL.boltYellow });
    if (this.aura) {
      this.auraT += dt;
      const size = this.kind === "orb" ? 26 : this.radius * 5;
      this.aura.setPosition(this.x, s.y - this.height * 0.8).setDepth(this.y - 1).setDisplaySize(size, size);
      if (this.kind !== "orb") this.aura.setAlpha(0.18 + Math.sin(this.auraT * 5) * 0.08);
      if (this.elite && Math.random() < 0.08) g.vfx.burst("mote", this.x + (Math.random() - 0.5) * this.radius * 2, s.y - Math.random() * this.height * 2, 1, { tint: this.aura.tintTopLeft });
    }
  }

  private beginAttack() {
    this.state = "windup";
    this.stateT = 0;
    const s = this.sprite;
    s.setFlipX(this.g.wizard.x < this.x);
    if (this.kind === "beetle") {
      s.play(`${this.sheet}:fuse`);
      Audio.play("bolt_charge", { vol: 0.4, rate: 1.6, maxConcurrent: 2 });
    } else {
      s.play(`${this.sheet}:attack`);
      s.anims.pause(s.anims.currentAnim!.frames[this.kind === "golem" ? 1 : 0]);
    }
    if (!this.telegraph) this.telegraph = this.g.add.graphics().setDepth(DEPTH.sigil);
    if (this.kind === "skeleton" || this.kind === "knight") Audio.play("skel_swing", { vol: 0.4, rate: 0.7 });
    if (this.kind === "imp") Audio.play("cast_charge", { vol: 0.35, rate: 1.4, maxConcurrent: 2 });
    // unique elite cue: bright rim flash
    if (this.elite) this.g.vfx.glow(this.x, this.y - this.height, this.aura?.tintTopLeft ?? PAL.gold, 40, 300, 0.9);
  }
  private drawTelegraph() {
    const t = this.telegraph!;
    const wu = (this.def.attackWindupMs ?? 400) * (this.elite ? 0.8 : 1);
    const k = Math.min(1, this.stateT / wu);
    t.clear();
    const flash = Math.floor(this.stateT / 80) % 2 === 0;
    if (this.kind === "beetle") {
      // the blast radius, filling as the fuse burns down
      const r = 30;
      t.fillStyle(PAL.hpRed, 0.1 + 0.15 * k);
      t.fillCircle(this.x, this.y, r * k);
      t.lineStyle(1, PAL.hpRed, flash ? 0.9 : 0.5);
      t.strokeCircle(this.x, this.y, r);
    } else if (this.kind === "golem") {
      const r = ((this.def.attackRange ?? 30) + 8) * (this.elite ? 1.25 : 1);
      t.fillStyle(PAL.hpRed, 0.12 + 0.12 * k);
      t.fillEllipse(this.x, this.y, r * 2 * k, r * k);
      t.lineStyle(1, PAL.hpRed, flash ? 0.9 : 0.5);
      t.strokeEllipse(this.x, this.y, r * 2, r);
    } else {
      const w = this.g.wizard;
      t.lineStyle(1, PAL.hpRed, flash ? 0.8 : 0.4);
      const y0 = this.y - 6 - this.hover;
      t.lineBetween(this.x, y0, this.x + (w.x - this.x) * k, y0 + (w.y - 6 - y0) * k);
    }
    this.sprite.setTint(flash ? 0xff9aa8 : 0xffffff);
  }
  /** Fire Imp: a slow fireball (an orb the player can shoot down) toward where the wizard stands */
  private throwFire(ux: number, uy: number) {
    const g = this.g;
    this.state = "attack";
    this.stateT = 0;
    this.telegraph?.clear();
    this.sprite.clearTint();
    this.sprite.anims.resume();
    this.sprite.play({ key: `${this.sheet}:attack`, startFrame: 1 });
    this.attackCd = (this.def.attackCooldownMs ?? 3400) * (this.elite ? 0.75 : 1);
    const sp = this.elite ? 58 : 48;
    g.enemies.push(new Enemy(g, "orb", this.x + ux * 6, this.y + uy * 6, { vx: ux * sp, vy: uy * sp, impShot: true }));
    Audio.play("fire_cast", { vol: 0.5, rate: 1.3, maxConcurrent: 2 });
  }

  private strike(dist: number, range: number) {
    const g = this.g;
    this.state = "attack";
    this.stateT = 0;
    this.telegraph?.clear();
    this.sprite.clearTint();
    this.sprite.anims.resume();
    this.sprite.play({ key: `${this.sheet}:attack`, startFrame: this.kind === "golem" ? 2 : 1 });
    this.attackCd = (this.def.attackCooldownMs ?? 1500) * (this.elite ? 0.75 : 1);
    const dmg = this.def.attackDamage ?? 1;
    if (this.kind === "skeleton" || this.kind === "knight") {
      const w = g.wizard;
      const dx = w.x - this.x, dy = w.y - this.y, d = Math.hypot(dx, dy) || 1;
      this.kbx += (dx / d) * 160;
      this.kby += (dy / d) * 160;
      Audio.play("skel_swing", { vol: 0.7 });
      if (dist <= range + 6) g.damagePlayer(dmg, this.x, this.y, false, this.tag());
    } else {
      const r = ((this.def.attackRange ?? 30) + 8) * (this.elite ? 1.25 : 1);
      Audio.play("golem_slam");
      g.vfx.shake(2, 180);
      g.vfx.play("shock", this.x, this.y, { scale: r / 30, depth: DEPTH.fxLow, tint: 0xd8cfb6 });
      g.vfx.burst("chip", this.x, this.y - 2, 10, { speed: [40, 110] });
      g.vfx.decal("decal_scorch", this.x, this.y, 1.2, 2500, 0.5);
      g.shockwaveGrass(this.x, this.y, r * 1.5);
      if (dist <= r + g.wizard.radius) g.damagePlayer(dmg, this.x, this.y, false, this.tag());
    }
  }
}
