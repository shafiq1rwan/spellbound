import Phaser from "phaser";
import { Layout } from "../core/Layout";
import { Audio } from "../core/Audio";
import { Analytics } from "../core/Analytics";
import { PAL } from "../config/palette";
import { RARITY_COLORS } from "../config/upgrades";
import type { UpgradeChoice } from "../systems/UpgradeManager";
import { backdrop, slice, txt, rtxt } from "../ui/widgets";
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
    const n = this.choices.length;
    const portrait = Layout.portrait;
    const cw = portrait ? Math.min(W - 20, 204) : Math.min(Math.floor((W - 40) / n), 128);
    const ch = portrait ? 50 : Math.min(H - 70, 110);
    const cardsH = portrait ? n * ch + (n - 1) * 8 : ch;
    // stack: title (14) | 6 | subtitle (7) | 14 | cards — vertically centred in the safe area
    const stackH = 14 + 6 + 7 + 14 + cardsH;
    const top = Math.max(sf.top + 6, Math.round(sf.top + (H - sf.top - sf.bottom) / 2 - stackH / 2));
    const title = txt(this, W / 2, top + 7, "LEVEL UP!", { scale: 2, color: PAL.gold });
    const sub = rtxt(this, W / 2, top + 14 + 6, `Level ${this.level} · pick one`, { size: 9, weight: 500, color: PAL.lavender, oy: 0, maxWidth: W - 16 });
    const cardsTop = top + 14 + 6 + 7 + 14;
    title.setScale(0.3);
    this.tweens.add({ targets: title, scale: 1, duration: 350, ease: "Back.easeOut" });
    const glow = this.add.image(W / 2, title.y, "glow_big").setTint(PAL.gold).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDisplaySize(160, 50).setDepth(-0.5);
    this.tweens.add({ targets: glow, alpha: 0.15, duration: 700, yoyo: true, repeat: -1 });
    void sub;

    this.choices.forEach((c, i) => {
      const x = portrait ? W / 2 : W / 2 + (i - (n - 1) / 2) * (cw + 8);
      const y = portrait ? cardsTop + i * (ch + 8) + ch / 2 : cardsTop + ch / 2;
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
    const P = 8;
    const L = -w / 2 + P, R = w / 2 - P, T = -h / 2 + P, B = h / 2 - P;
    const addIcon = (cx: number, cy: number) => {
      items.push(this.add.image(cx, cy, "glow").setTint(rc).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDisplaySize(40, 40));
      const icon = this.add.image(0, 0, c.icon).setScale(2).setOrigin(0, 0);
      icon.setPosition(Math.round(cx - icon.displayWidth / 2), Math.round(cy - icon.displayHeight / 2));
      items.push(icon);
    };
    // readable font for the name and description (sentence case, high contrast); the rarity shows in
    // the frame colour, so there's no rarity word, and the 1/2/3 key hints only appear with a mouse
    if (portrait) {
      // [icon 32] | Name ............ LV 2
      //           | Description that may wrap
      const iconCx = L + 16;
      addIcon(iconCx, 0);
      const tx = L + 32 + 8;
      const lv = txt(this, R, 0, c.levelText || "NEW", { ox: 1, oy: 0, color: rc });
      const name = rtxt(this, tx, 0, c.name, { size: 11, weight: 700, ox: 0, oy: 0, color: 0xfff8ec, align: "left" });
      const desc = rtxt(this, tx, 0, c.desc, { size: 9, weight: 500, ox: 0, oy: 0, color: 0xece4ff, maxWidth: R - tx, align: "left" });
      // centre the name + description block vertically in the card
      const blockH = name.height + 2 + desc.height;
      const top = Math.round(-blockH / 2);
      name.setY(top);
      desc.setY(top + name.height + 2);
      lv.setY(Math.round(top + name.height / 2 - 3.5));
      items.push(name, lv, desc);
    } else {
      //     LV 2
      //    [icon]
      //     Name
      //  description
      items.push(txt(this, 0, T, c.levelText || "NEW", { oy: 0, color: rc }));
      addIcon(0, T + 7 + 8 + 16);
      const nameT = T + 7 + 8 + 32 + 8;
      const name = rtxt(this, 0, nameT, c.name, { size: 11, weight: 700, oy: 0, color: 0xfff8ec, maxWidth: w - 2 * P });
      items.push(name);
      items.push(rtxt(this, 0, nameT + name.height + 3, c.desc, { size: 9, weight: 500, oy: 0, color: 0xece4ff, maxWidth: w - 2 * P }));
    }
    if (window.matchMedia?.("(pointer: fine)").matches) items.push(txt(this, L, B, `${i + 1}`, { ox: 0, oy: 1, color: 0x6d5c98 }));
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
    Analytics.track("upgrade", c.id, "picked");
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
