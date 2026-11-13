import Phaser from "phaser";
import { Layout } from "../core/Layout";
import { Audio } from "../core/Audio";
import { Save, fmtTime } from "../core/Save";
import { Poki } from "../core/Poki";
import { Analytics } from "../core/Analytics";
import { PAL, ELEMENT_COLORS, type Element } from "../config/palette";
import { VFXManager, DEPTH } from "../systems/VFXManager";
import { Ambience } from "../systems/Ambience";
import { Button, txt, rtxt, type RText } from "../ui/widgets";

export class MenuScene extends Phaser.Scene {
  private vfx!: VFXManager;
  private amb!: Ambience;
  private wiz!: Phaser.GameObjects.Sprite;
  private crystal!: Phaser.GameObjects.Image;
  private logo!: Phaser.GameObjects.Image;
  private play!: Button;
  private settings!: Button;
  private best!: RText;
  /** "what do I do?" in one line: pictogram + a short sentence (no panel) */
  private goal!: Phaser.GameObjects.Container;
  private goalH = 0;
  private floor!: Phaser.GameObjects.Image;
  private sigil!: Phaser.GameObjects.Sprite;
  private glow!: Phaser.GameObjects.Image;
  private offLayout?: () => void;
  private castT = 1800;
  private starting = false;

  constructor() {
    super("Menu");
  }

  create() {
    this.starting = false;
    const cam = this.cameras.main;
    cam.setBackgroundColor(PAL.void).setZoom(Layout.S).setOrigin(0, 0);
    this.floor = this.add.image(0, 0, "floor").setDepth(DEPTH.floor);
    this.vfx = new VFXManager(this);
    this.amb = new Ambience(this, this.vfx, 0, 0);
    this.sigil = this.add.sprite(0, 0, "sigil_arcane").play("sigil_arcane:play").setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55).setScale(1.6).setDepth(DEPTH.sigil);
    this.glow = this.add.image(0, 0, "glow_big").setTint(PAL.violet).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.25).setDisplaySize(150, 120).setDepth(DEPTH.sigil);
    this.wiz = this.add.sprite(0, 0, "wizard").setOrigin(24 / 48, 44.5 / 48).setScale(2).play("wizard:idle");
    this.crystal = this.add.image(0, 0, "glow").setTint(PAL.iceCyan).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6).setDisplaySize(40, 40);
    this.wiz.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.wiz.play("wizard:idle"));
    this.logo = this.add.image(0, 0, "logo").setDepth(100);
    this.goal = this.buildGoalCard();
    this.play = new Button(this, 0, 0, "PLAY", () => this.startRun(), { scale: 2, minW: 120 });
    // settings is a small gear in the corner, like the in-game pause button: one big action on screen
    this.settings = new Button(this, 0, 0, "", () => { Analytics.track("menu", "settings", "interact"); this.scene.pause(); this.scene.launch("Settings", { from: "Menu" }); }, { icon: "ic_gear" });
    Analytics.track("menu", "play", "visible");
    Analytics.track("menu", "settings", "visible");
    this.play.setDepth(100);
    this.settings.setDepth(100);
    const d = Save.data;
    this.best = rtxt(this, 0, 0, d.bestWave ? `Best: wave ${d.bestWave} · ${fmtTime(d.bestTimeMs)}` : "", { size: 9, weight: 500, color: 0xc9b8f0 }).setDepth(100);
    this.layout();
    this.offLayout = Layout.onChange(() => this.layout());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.offLayout?.());
    // logo float + entrance
    this.logo.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: this.logo, scale: 1, alpha: 1, duration: 600, ease: "Back.easeOut" });
    this.tweens.add({ targets: this.play, scaleX: 1.04, scaleY: 1.04, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.input.keyboard?.on("keydown-ENTER", () => this.startRun());
    this.input.keyboard?.on("keydown-SPACE", () => this.startRun());
    Audio.startMusic();
    cam.fadeIn(250, 11, 12, 30);
  }

  /** pictogram [triangle] -> [fireball] -> [skull] over one short line; the tutorial teaches the rest */
  private buildGoalCard() {
    const c = this.add.container(0, 0).setDepth(100);
    const icons = ["rune_fire", "ic_fireball", "ic_skull"];
    const parts: { o: Phaser.GameObjects.Image | ReturnType<typeof txt>; w: number }[] = [];
    icons.forEach((k, i) => {
      const im = this.add.image(0, 0, k).setOrigin(0, 0.5);
      parts.push({ o: im, w: im.width });
      if (i < icons.length - 1) { const a = txt(this, 0, 0, "→", { color: 0xb9a8e0, ox: 0 }); parts.push({ o: a, w: a.ink().w }); }
    });
    const gap = 6, rowW = parts.reduce((s2, p) => s2 + p.w, 0) + gap * (parts.length - 1);
    let x = -Math.floor(rowW / 2);
    const rowY = 8;
    for (const p of parts) { p.o.setPosition(x, rowY); x += p.w + gap; c.add(p.o); }
    const line = rtxt(this, 0, rowY + 10, "Draw shapes to cast spells", { size: 10, weight: 600, oy: 0, color: 0xfff8ec });
    c.add(line);
    this.goalH = Math.round(line.y + line.height);
    return c;
  }

  private layout() {
    const W = Layout.w, H = Layout.h, sf = Layout.safe;
    this.cameras.main.setZoom(Layout.S).setScroll(0, 0);
    const cx = Math.round(W / 2);
    const portrait = Layout.portrait;
    const wy = Math.round(portrait ? H * 0.63 : H * 0.62);
    const wx = portrait ? cx : Math.round(W * 0.3);
    this.floor.setPosition(wx, wy);
    this.wiz.setPosition(wx, wy);
    this.sigil.setPosition(wx, wy);
    this.glow.setPosition(wx, wy - 30);
    const ux = portrait ? cx : Math.round(W * 0.68);
    // top-down stack: logo, goal line, (wizard), PLAY, best; settings gear in the corner
    const logoY = Math.round(portrait ? sf.top + H * 0.13 : sf.top + 6 + this.logo.height / 2);
    this.logo.setPosition(ux, logoY);
    const goalTop = Math.round(logoY + this.logo.height / 2 + 6);
    this.goal.setPosition(ux, goalTop);
    const py = Math.round(portrait ? Math.max(H * 0.8, wy + 34 + this.play.bh / 2) : goalTop + this.goalH + 14 + this.play.bh / 2);
    this.play.setPosition(ux, py);
    this.best.setPosition(ux, Math.round(py + Math.ceil(this.play.bh / 2) + 10));
    // gear in the top-right corner, inside the safe area
    this.settings.setPosition(Math.round(W - sf.right - 6 - this.settings.bw / 2), Math.round(sf.top + 6 + this.settings.bh / 2));
  }

  private async startRun() {
    if (this.starting) return;
    this.starting = true;
    Analytics.track("menu", "play", "interact");
    Audio.unlock();
    Audio.play("ui_select");
    if (Save.data.runs > 0) await Poki.commercialBreak();
    this.cameras.main.fadeOut(180, 11, 12, 30);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start("Game"));
  }

  update(_t: number, dt: number) {
    this.vfx.update(dt);
    this.amb.update(dt, this.cameras.main.worldView);
    const frame = Number(this.wiz.frame.name);
    const a = (this.cache.json.get("manifest").sheets.wizard.anchors.crystal as ([number, number] | null)[])[frame];
    if (a) this.crystal.setPosition(this.wiz.x + (a[0] - 24) * 2, this.wiz.y + (a[1] - 44.5) * 2).setVisible(true);
    this.crystal.setAlpha(0.45 + Math.sin(this.time.now / 300) * 0.15);
    if (Math.random() < 0.15) this.vfx.burst("mote", this.wiz.x + (Math.random() - 0.5) * 60, this.wiz.y - Math.random() * 70, 1, { tint: Math.random() < 0.5 ? PAL.lavender : PAL.iceCyan });
    // showcase: the wizard periodically casts a random element
    this.castT -= dt;
    if (this.castT <= 0) {
      this.castT = 2600 + Math.random() * 1500;
      const els: Element[] = ["fire", "ice", "bolt", "arcane"];
      const e = els[Math.floor(Math.random() * els.length)];
      const c = ELEMENT_COLORS[e];
      this.wiz.play("wizard:cast");
      this.crystal.setTint(c.main);
      this.time.delayedCall(700, () => this.crystal.setTint(PAL.iceCyan));
      const s = this.add.sprite(this.wiz.x, this.wiz.y, `sigil_${e}`).play(`sigil_${e}:play`).setBlendMode(Phaser.BlendModes.ADD).setScale(1).setDepth(DEPTH.sigil + 1);
      this.tweens.add({ targets: s, scale: 2.2, alpha: 0, duration: 900, ease: "Cubic.easeOut", onComplete: () => s.destroy() });
      this.time.delayedCall(140, () => {
        this.vfx.burst("twinkle", this.crystal.x, this.crystal.y, 10, { tint: c.light, speed: [30, 90] });
        this.vfx.glow(this.crystal.x, this.crystal.y, c.main, 70, 400, 0.8);
      });
    }
  }
}
