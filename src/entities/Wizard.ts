// The Apprentice Wizard. Sprite animation is layered with code-driven squash/stretch, a separate
// floating crystal (follows per-frame staff anchors from the manifest, recolours per element),
// additive glows, a rune sigil under the feet and ambient motes.
import Phaser from "phaser";
import { M } from "../core/assets";
import { PAL, ELEMENT_COLORS, type Element } from "../config/palette";
import { DEPTH, type VFXManager } from "../systems/VFXManager";
import { GAME } from "../config/game";

const OX = 24, OY = 44.5;

export class Wizard {
  scene: Phaser.Scene;
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Sprite;
  crystal: Phaser.GameObjects.Sprite;
  crystalGlow: Phaser.GameObjects.Image;
  bodyGlow: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  sigil: Phaser.GameObjects.Sprite;
  /** always-on binding circle: the wizard is rooted ("spellbound") to this spot */
  bind: Phaser.GameObjects.Sprite;
  facing = 1;
  radius = GAME.player.radius;
  element: Element | "cyan" = "cyan";
  dead = false;
  lowHp = false;
  private anchors: ([number, number] | null)[];
  private frameBase: Record<string, number> = {};
  private busy = false;
  private nextBlink = 2500;
  private moteTimer = 0;
  private invulnUntil = 0;
  private elementTimer?: Phaser.Time.TimerEvent;
  private vfx: VFXManager;
  private t = 0;
  private sx = 1;
  private sy = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, vfx: VFXManager) {
    this.scene = scene;
    this.vfx = vfx;
    this.x = x;
    this.y = y;
    const meta = M().sheets.wizard;
    this.anchors = meta.anchors!.crystal;
    for (const [k, a] of Object.entries(meta.anims)) this.frameBase[k] = a.frames[0];
    this.shadow = scene.add.image(x, y, "shadow2").setDepth(DEPTH.shadow);
    this.sigil = scene.add.sprite(x, y, "sigil_level").setDepth(DEPTH.sigil).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
    this.bind = scene.add.sprite(x, y, "sigil_level").play("sigil_level:play").setDepth(DEPTH.sigil - 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setScale(1.15);
    this.bodyGlow = scene.add.image(x, y - 14, "glow_big").setTint(PAL.violet).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.16).setDisplaySize(70, 60).setDepth(DEPTH.sigil + 1);
    this.sprite = scene.add.sprite(x, y, "wizard").setOrigin(OX / 48, OY / 48);
    this.sprite.play("wizard:idle");
    this.crystal = scene.add.sprite(x, y, "crystal").play("crystal:cyan");
    this.crystalGlow = scene.add.image(x, y, "glow").setBlendMode(Phaser.BlendModes.ADD).setTint(PAL.iceCyan).setAlpha(0.55).setDisplaySize(22, 22);
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (a: Phaser.Animations.Animation) => {
      if (this.dead) return;
      if (a.key === "wizard:cast" || a.key === "wizard:hurt" || a.key === "wizard:blink" || a.key === "wizard:cheer") {
        this.busy = false;
        this.sprite.play("wizard:idle");
      }
    });
  }

  /** world position of the floating crystal (spell origin) */
  tip() {
    return { x: this.crystal.x, y: this.crystal.y };
  }

  face(tx: number) {
    if (Math.abs(tx - this.x) < 2) return;
    this.facing = tx < this.x ? -1 : 1;
    this.sprite.setFlipX(this.facing < 0);
  }

  setElement(e: Element | "cyan", holdMs = 900) {
    this.element = e;
    this.crystal.play(`crystal:${e}`, true);
    const col = e === "cyan" ? PAL.iceCyan : ELEMENT_COLORS[e].main;
    this.crystalGlow.setTint(col);
    this.elementTimer?.remove();
    if (e !== "cyan") this.elementTimer = this.scene.time.delayedCall(holdMs, () => this.setElement("cyan"));
  }

  /** cast anticipation + thrust. Returns immediately so the spell can launch on the same frame. */
  cast(e: Element, tx: number) {
    if (this.dead) return;
    this.face(tx);
    this.setElement(e);
    this.busy = true;
    this.sprite.play("wizard:cast");
    // code-driven squash -> stretch -> settle
    this.scene.tweens.killTweensOf(this);
    this.sx = 1.12; this.sy = 0.86;
    this.scene.tweens.add({
      targets: this, sx: 0.92, sy: 1.12, duration: 70, ease: "Quad.easeOut",
      onComplete: () => this.scene.tweens.add({ targets: this, sx: 1, sy: 1, duration: 180, ease: "Back.easeOut" }),
    });
    const col = ELEMENT_COLORS[e];
    this.sigil.setVisible(true).setAlpha(1).setScale(0.55).play(`sigil_${e}:play`);
    this.scene.tweens.killTweensOf(this.sigil);
    this.scene.tweens.add({ targets: this.sigil, scale: 1, duration: 160, ease: "Back.easeOut" });
    this.scene.tweens.add({ targets: this.sigil, alpha: 0, delay: 380, duration: 260, onComplete: () => this.sigil.setVisible(false) });
    this.vfx.glow(this.crystal.x, this.crystal.y, col.main, 34, 220, 0.9, DEPTH.fx);
    this.vfx.burst("twinkle", this.crystal.x, this.crystal.y, 4, { tint: col.light });
  }

  hurt(now: number, invulnMs: number) {
    if (this.dead) return;
    this.invulnUntil = now + invulnMs;
    this.busy = true;
    this.sprite.play("wizard:hurt");
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => !this.dead && this.sprite.setTintFill(PAL.hpRed));
    this.scene.time.delayedCall(140, () => !this.dead && this.sprite.clearTint());
    this.sx = 1.2; this.sy = 0.8;
    this.scene.tweens.add({ targets: this, sx: 1, sy: 1, duration: 260, ease: "Elastic.easeOut" });
    this.crystalGlow.setAlpha(0.1);
  }
  isInvulnerable(now: number) {
    return now < this.invulnUntil;
  }

  levelUp() {
    if (this.dead) return;
    this.busy = true;
    this.sprite.play("wizard:cheer");
    this.sigil.setVisible(true).setAlpha(1).setScale(0.4).play("sigil_level:play");
    this.scene.tweens.killTweensOf(this.sigil);
    this.scene.tweens.add({ targets: this.sigil, scale: 1.25, duration: 300, ease: "Back.easeOut" });
    this.scene.tweens.add({ targets: this.sigil, alpha: 0, delay: 700, duration: 300, onComplete: () => this.sigil.setVisible(false) });
    this.vfx.glow(this.x, this.y - 16, PAL.gold, 90, 600, 0.6);
    for (let i = 0; i < 14; i++) {
      this.scene.time.delayedCall(i * 35, () => {
        const a = i * 0.9;
        this.vfx.burst("twinkle", this.x + Math.cos(a) * 12, this.y - 4 - i * 2, 1, { tint: i % 2 ? PAL.gold : PAL.lavender });
      });
    }
    this.sy = 1.15; this.sx = 0.9;
    this.scene.tweens.add({ targets: this, sx: 1, sy: 1, duration: 400, ease: "Elastic.easeOut" });
  }

  die(onDone: () => void) {
    this.dead = true;
    this.sprite.play("wizard:death");
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(90, () => this.sprite.clearTint());
    this.sprite.setAlpha(1);
    this.crystal.stop();
    this.scene.tweens.add({ targets: [this.crystalGlow, this.bodyGlow, this.bind], alpha: 0, duration: 500 });
    // crystal drops to the ground and dims
    this.scene.tweens.add({ targets: this.crystal, y: this.y - 2, x: this.x + this.facing * 14, duration: 500, ease: "Bounce.easeOut" });
    this.scene.tweens.add({ targets: this.crystal, alpha: 0.4, duration: 900 });
    this.scene.time.delayedCall(650, () => {
      // dissolve into magical particles
      for (let i = 0; i < 26; i++) {
        this.scene.time.delayedCall(i * 22, () => {
          this.vfx.burst(i % 3 ? "dot" : "twinkle", this.x + (Math.random() - 0.5) * 18, this.y - Math.random() * 32, 1, { tint: i % 2 ? PAL.violet : PAL.lavender, speed: [8, 26] });
        });
      }
      this.scene.tweens.add({ targets: [this.sprite, this.crystal, this.shadow], alpha: 0, duration: 450, onComplete: onDone });
    });
  }

  /** flare the binding circle (used with the "you can't move" hint) */
  flashBind() {
    this.scene.tweens.killTweensOf(this.bind);
    this.bind.setAlpha(1).setScale(1.5);
    this.scene.tweens.add({ targets: this.bind, alpha: 0.3, scale: 1.15, duration: 900, ease: "Quad.easeOut" });
  }

  /** rewarded revive: undo the death, rise in a burst of light, brief invulnerability */
  revive(now: number, invulnMs: number) {
    this.scene.tweens.killTweensOf([this.sprite, this.crystal, this.shadow, this.crystalGlow, this.bodyGlow]);
    this.dead = false;
    this.busy = true;
    this.lowHp = false;
    this.sprite.setAlpha(1).clearTint().play("wizard:cheer");
    this.crystal.setAlpha(1).play("crystal:cyan");
    this.shadow.setAlpha(1);
    this.crystalGlow.setAlpha(0.55);
    this.bodyGlow.setAlpha(0.16);
    this.bind.setAlpha(0.3);
    this.element = "cyan";
    this.invulnUntil = now + invulnMs;
    this.sx = 0.6; this.sy = 1.4;
    this.scene.tweens.add({ targets: this, sx: 1, sy: 1, duration: 500, ease: "Elastic.easeOut" });
    this.vfx.glow(this.x, this.y - 16, PAL.gold, 140, 800, 0.9);
    for (let i = 0; i < 20; i++) {
      this.scene.time.delayedCall(i * 25, () => {
        const a = i * 0.8;
        this.vfx.burst("twinkle", this.x + Math.cos(a) * 14, this.y - 4 - i * 2.2, 1, { tint: i % 2 ? PAL.gold : PAL.lavender });
      });
    }
  }

  update(dtMs: number, now: number) {
    this.t += dtMs / 1000;
    const s = this.sprite;
    s.setScale(this.sx * this.facing < 0 ? this.sx : this.sx, this.sy);
    s.setPosition(this.x, this.y);
    s.setDepth(this.y);
    // crystal follows the staff anchor of the current frame
    const fi = Number(s.frame.name);
    const a = this.anchors[fi];
    if (a && !this.dead) {
      const bob = Math.sin(this.t * 3.2) * 0.8;
      const cx = this.x + (a[0] - OX) * this.facing * this.sx;
      const cy = this.y + (a[1] - OY) * this.sy + bob;
      this.crystal.setPosition(Math.round(cx * 2) / 2, Math.round(cy * 2) / 2).setVisible(true);
    } else if (!this.dead) this.crystal.setVisible(false);
    this.crystal.setDepth(this.y + 1);
    this.crystalGlow.setPosition(this.crystal.x, this.crystal.y).setDepth(this.y + 2).setVisible(this.crystal.visible);
    const pulse = 0.45 + Math.sin(this.t * 4) * 0.12;
    if (!this.dead) {
      let ga = pulse;
      if (this.lowHp) ga = Math.random() < 0.15 ? 0.05 : pulse * 0.7; // staff flickers near death
      this.crystalGlow.setAlpha(Math.min(this.crystalGlow.alpha + 0.05, ga));
    }
    this.shadow.setPosition(this.x, this.y);
    this.bodyGlow.setPosition(this.x, this.y - 12);
    this.sigil.setPosition(this.x, this.y);
    this.bind.setPosition(this.x, this.y);
    // invulnerability blink
    if (!this.dead) s.setAlpha(now < this.invulnUntil ? (Math.floor(now / 70) % 2 ? 0.35 : 1) : 1);
    // occasional blink while idle
    if (!this.busy && !this.dead) {
      this.nextBlink -= dtMs;
      if (this.nextBlink <= 0) {
        this.nextBlink = 2200 + Math.random() * 2600;
        this.busy = true;
        s.play("wizard:blink");
      }
    }
    // ambient motes
    this.moteTimer -= dtMs;
    if (this.moteTimer <= 0 && !this.dead) {
      this.moteTimer = 260;
      this.vfx.burst("mote", this.x + (Math.random() - 0.5) * 26, this.y - Math.random() * 30, 1, { tint: Math.random() < 0.5 ? PAL.lavender : PAL.iceCyan });
    }
  }
}
