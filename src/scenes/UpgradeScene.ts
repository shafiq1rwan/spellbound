import Phaser from "phaser";
import { Layout } from "../core/Layout";
import { Audio } from "../core/Audio";
import { PAL } from "../config/palette";
import { RARITY_COLORS, RARITY_NAMES } from "../config/upgrades";
import type { UpgradeChoice } from "../systems/UpgradeManager";
import { backdrop, slice, txt } from "../ui/widgets";
import type { GameScene } from "./GameScene";

export class UpgradeScene extends Phaser.Scene {
  private choices: UpgradeChoice[] = [];
  private level = 2;
  private picked = false;
  private ready = false;
  private cards: Phaser.GameObjects.Container[] = [];
  /** a card only picks when the press both starts and ends on it (no accidental picks mid-swipe) */
  private pressed = -1;

  constructor() {
    super("Upgrade");
  }
  init(data: { choices: UpgradeChoice[]; level: number }) {
    this.choices = data.choices;
    this.level = data.level;
    this.picked = false;
    this.ready = false;
    this.cards = [];
  }

  create() {
    const W = Layout.w, H = Layout.h, sf = Layout.safe;
    this.scene.bringToTop();
    this.cameras.main.setZoom(Layout.S).setOrigin(0, 0);
    const bd = backdrop(this, W, H, 0).setDepth(-1);
    this.tweens.add({ targets: bd, fillAlpha: 0.72, duration: 250 });
    const title = txt(this, W / 2, sf.top + (Layout.portrait ? 40 : 22), "LEVEL UP!", { scale: 2, color: PAL.gold });
    const sub = txt(this, W / 2, title.y + 15, `LEVEL ${this.level}  -  CHOOSE A BLESSING`, { color: PAL.lavender });
    title.setScale(0.3);
    this.tweens.add({ targets: title, scale: 1, duration: 350, ease: "Back.easeOut" });
    const glow = this.add.image(W / 2, title.y, "glow_big").setTint(PAL.gold).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDisplaySize(160, 50).setDepth(-0.5);
    this.tweens.add({ targets: glow, alpha: 0.15, duration: 700, yoyo: true, repeat: -1 });
    void sub;

    const n = this.choices.length;
    const portrait = Layout.portrait;
    const cw = portrait ? Math.min(W - 20, 200) : Math.min(Math.floor((W - 40) / n), 128);
    const ch = portrait ? 52 : Math.min(H - 80, 118);
    this.choices.forEach((c, i) => {
      const x = portrait ? W / 2 : W / 2 + (i - (n - 1) / 2) * (cw + 8);
      const y = portrait ? title.y + 46 + i * (ch + 8) + ch / 2 : H / 2 + 14;
      const card = this.makeCard(c, Math.round(x), Math.round(y), cw, ch, portrait, i);
      this.cards.push(card);
      card.setAlpha(0).setY(card.y + 20);
      this.tweens.add({ targets: card, alpha: 1, y: Math.round(y), delay: 120 + i * 110, duration: 320, ease: "Back.easeOut" });
    });
    // short input delay so a finger still drawing can't pick a card by accident
    this.time.delayedCall(450, () => { this.ready = true; });
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      const k = Number(e.key);
      if (k >= 1 && k <= this.choices.length) this.pick(k - 1);
    });
  }

  private makeCard(c: UpgradeChoice, x: number, y: number, w: number, h: number, portrait: boolean, i: number) {
    const ct = this.add.container(x, y);
    const bg = slice(this, `card${c.rarity}`, 0, 0, w, h);
    const rc = RARITY_COLORS[c.rarity];
    const items: Phaser.GameObjects.GameObject[] = [bg];
    if (portrait) {
      const ix = -w / 2 + 22;
      const iconBg = this.add.image(ix, 0, "glow").setTint(rc).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDisplaySize(40, 40);
      const icon = this.add.image(ix, 0, c.icon).setScale(2);
      const name = txt(this, ix + 22, -h / 2 + 11, c.name.toUpperCase(), { ox: 0, color: 0xfff8ec });
      const lv = txt(this, w / 2 - 8, -h / 2 + 11, c.levelText || "NEW", { ox: 1, color: rc });
      const desc = txt(this, ix + 22, -h / 2 + 23, c.desc.toUpperCase(), { ox: 0, oy: 0, color: 0xc8bce8, maxWidth: w - 54, align: 0 });
      const rar = txt(this, w / 2 - 8, h / 2 - 9, RARITY_NAMES[c.rarity], { ox: 1, color: rc });
      items.push(iconBg, icon, name, lv, desc, rar);
    } else {
      const iconBg = this.add.image(0, -h / 2 + 30, "glow").setTint(rc).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDisplaySize(44, 44);
      const icon = this.add.image(0, -h / 2 + 30, c.icon).setScale(2);
      const name = txt(this, 0, -h / 2 + 58, c.name.toUpperCase(), { color: 0xfff8ec, maxWidth: w - 10 });
      const lv = txt(this, 0, -h / 2 + 10, c.levelText || "NEW", { color: rc });
      const desc = txt(this, 0, -h / 2 + 68, c.desc.toUpperCase(), { oy: 0, color: 0xc8bce8, maxWidth: w - 14 });
      const rar = txt(this, 0, h / 2 - 9, RARITY_NAMES[c.rarity], { color: rc });
      items.push(iconBg, icon, name, lv, desc, rar);
    }
    const key = txt(this, -w / 2 + 8, h / 2 - 9, `${i + 1}`, { color: 0x6d5c98 });
    items.push(key);
    ct.add(items);
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerover", () => { if (!this.picked) { this.tweens.add({ targets: ct, scale: 1.04, duration: 90 }); Audio.play("ui_hover", { vol: 0.5 }); } });
    bg.on("pointerout", () => !this.picked && this.tweens.add({ targets: ct, scale: 1, duration: 90 }));
    bg.on("pointerdown", () => { this.pressed = this.ready ? i : -1; });
    bg.on("pointerup", () => { if (this.pressed === i) this.pick(i); this.pressed = -1; });
    return ct;
  }

  private pick(i: number) {
    if (this.picked || !this.ready) return;
    this.picked = true;
    const c = this.choices[i];
    const g = this.scene.get("Game") as GameScene;
    Audio.play("ui_select");
    const card = this.cards[i];
    this.cards.forEach((o, j) => j !== i && this.tweens.add({ targets: o, alpha: 0, scale: 0.9, duration: 200 }));
    this.tweens.add({ targets: card, scale: 1.12, duration: 120, yoyo: true, ease: "Quad.easeOut" });
    const flash = this.add.image(card.x, card.y, "glow_big").setBlendMode(Phaser.BlendModes.ADD).setTint(RARITY_COLORS[c.rarity]).setDisplaySize(card.getBounds().width * 1.4, card.getBounds().height * 2).setAlpha(0.8);
    this.tweens.add({ targets: flash, alpha: 0, duration: 400 });
    this.time.delayedCall(380, () => {
      g.upgrades.apply(c.id);
      g.vfx.floatText(g.wizard.x, g.wizard.y - 50, c.name.toUpperCase(), RARITY_COLORS[c.rarity], 1, 1200);
      this.scene.stop();
      g.resumeFromUpgrade();
    });
  }
}
