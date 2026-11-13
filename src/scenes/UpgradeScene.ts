import Phaser from "phaser";
import { Layout } from "../core/Layout";
import { Audio } from "../core/Audio";
import { Analytics } from "../core/Analytics";
import { PAL } from "../config/palette";
import { RARITY_COLORS } from "../config/upgrades";
import type { UpgradeChoice } from "../systems/UpgradeManager";
import { backdrop, slice, txt, rtxt, inkBox } from "../ui/widgets";

/** card frame art: 1px transparent edge + 3px border, so the inside starts 4px in on every side */
const FRAME = 4;
/** space between the inside of the frame and the visible content, the same on all four sides */
const PAD = 7;
/** icon slot: a dark tile with a 1px rim in the rarity colour. Icons differ in width, so the slot (not
 *  the icon) sets the left edge: equal padding on every card, and every name starts at the same x */
const SLOT = 34;
/** gap between a card's name and its description */
const GAP = 5;
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
    // even widths keep the card centre on a whole pixel, so left and right padding match exactly
    const even = (v: number) => Math.floor(v / 2) * 2;
    const cw = even(portrait ? Math.min(W - 20, 204) : Math.min(Math.floor((W - 40) / n), 128));
    // build every card first, then give all of them the height of the tallest content
    const built = this.choices.map((c, i) => this.buildCard(c, i, cw, portrait));
    const ch = Math.ceil(Math.max(...built.map((b) => b.contentH)) + 2 * (FRAME + PAD));
    const cardsH = portrait ? n * ch + (n - 1) * 8 : ch;
    // stack: title (14) | 6 | subtitle (7) | 14 | cards — vertically centred in the safe area
    const stackH = 14 + 6 + 7 + 14 + cardsH;
    const top = Math.max(sf.top + 6, Math.round(sf.top + (H - sf.top - sf.bottom) / 2 - stackH / 2));
    const title = txt(this, W / 2, top + 7, "LEVEL UP!", { scale: 2, color: PAL.gold });
    rtxt(this, W / 2, top + 14 + 6, `Level ${this.level} · pick one`, { size: 12, color: PAL.lavender, oy: 0, maxWidth: W - 16 });
    const cardsTop = top + 14 + 6 + 7 + 14;
    title.setScale(0.3);
    this.tweens.add({ targets: title, scale: 1, duration: 350, ease: "Back.easeOut" });
    const glow = this.add.image(W / 2, title.y, "glow_big").setTint(PAL.gold).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDisplaySize(160, 50).setDepth(-0.5);
    this.tweens.add({ targets: glow, alpha: 0.15, duration: 700, yoyo: true, repeat: -1 });

    built.forEach((b, i) => {
      b.place(ch);
      const x = portrait ? W / 2 : W / 2 + (i - (n - 1) / 2) * (cw + 8);
      const y = portrait ? cardsTop + i * (ch + 8) + ch / 2 : cardsTop + ch / 2;
      const card = b.ct.setPosition(Math.round(x), Math.round(y));
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

  /**
   * One card, laid out by visible pixels (inkBox) so the padding inside the frame is the same on all
   * four sides. Portrait: [icon column] Name ... LV / description. Landscape: LV, icon, name, description
   * stacked and centred. Returns the content height and a place(h) that positions everything for the
   * shared card height. The rarity shows in the frame colour; keys 1/2/3 still pick on desktop.
   */
  private buildCard(c: UpgradeChoice, i: number, w: number, portrait: boolean) {
    const ct = this.add.container(0, 0);
    const rc = RARITY_COLORS[c.rarity];
    const S = Layout.S;
    const snap = (v: number) => Math.round(v * S) / S; // whole device pixels
    const CL = -w / 2 + FRAME + PAD, CR = w / 2 - FRAME - PAD;
    const icon = this.add.image(0, 0, c.icon).setScale(2).setOrigin(0, 0);
    const halo = this.add.image(0, 0, "glow").setTint(rc).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDisplaySize(40, 40);
    const iInk = inkBox(icon);
    const iw = iInk.w * 2, ih = iInk.h * 2;
    const lv = txt(this, 0, 0, c.levelText || "NEW", { color: rc });
    const lvInk = lv.ink();
    let contentH: number;
    let place: (h: number) => void;
    const bg = slice(this, `card${c.rarity}`, 0, 0, w, 10);
    if (portrait) {
      const TX = CL + SLOT + 8;
      const rim = this.add.rectangle(0, 0, SLOT, SLOT, rc, 0.55).setOrigin(0, 0);
      const well = this.add.rectangle(0, 0, SLOT - 2, SLOT - 2, 0x120f26).setOrigin(0, 0);
      const name = rtxt(this, 0, 0, c.name, { size: 15, ox: 0, oy: 0, color: 0xfff8ec, align: "left", maxWidth: CR - TX - lvInk.w - 6 });
      const desc = rtxt(this, 0, 0, c.desc, { size: 12, ox: 0, oy: 0, color: 0xece4ff, align: "left", maxWidth: CR - TX, balance: true });
      const nInk = inkBox(name), dInk = inkBox(desc);
      const blockH = nInk.h + GAP + dInk.h;
      contentH = Math.max(SLOT, blockH);
      place = (h) => {
        bg.setSize(w, h).setInteractive({ useHandCursor: true }); // hit area follows the final size
        const sy = Math.round(-SLOT / 2);
        rim.setPosition(CL, sy);
        well.setPosition(CL + 1, sy + 1);
        const scx = CL + SLOT / 2, scy = sy + SLOT / 2;
        icon.setPosition(Math.round(scx - iw / 2 - iInk.l * 2), Math.round(scy - ih / 2 - iInk.t * 2));
        halo.setPosition(scx, scy).setDisplaySize(SLOT - 4, SLOT - 4);
        const top = -blockH / 2;
        name.setPosition(snap(TX - nInk.l), snap(top - nInk.t));
        desc.setPosition(snap(TX - dInk.l), snap(top + nInk.h + GAP - dInk.t));
        lv.setAnchor(1, 0.5).setPosition(Math.round(CR), Math.round(top + nInk.h / 2));
      };
      ct.add([bg, rim, well, halo, icon, name, lv, desc]);
    } else {
      const maxW = CR - CL;
      const name = rtxt(this, 0, 0, c.name, { size: 15, ox: 0, oy: 0, color: 0xfff8ec, maxWidth: maxW });
      const desc = rtxt(this, 0, 0, c.desc, { size: 12, ox: 0, oy: 0, color: 0xece4ff, maxWidth: maxW, balance: true });
      const nInk = inkBox(name), dInk = inkBox(desc);
      contentH = lvInk.h + 8 + ih + 8 + nInk.h + GAP + dInk.h;
      place = (h) => {
        bg.setSize(w, h).setInteractive({ useHandCursor: true }); // hit area follows the final size
        let y = -contentH / 2;
        lv.setAnchor(0.5, 0).setPosition(0, Math.round(y));
        y += lvInk.h + 8;
        icon.setPosition(snap(-iw / 2 - iInk.l * 2), snap(y - iInk.t * 2));
        halo.setPosition(0, y + ih / 2);
        y += ih + 8;
        name.setPosition(snap(-(nInk.l + nInk.r) / 2), snap(y - nInk.t));
        y += nInk.h + GAP;
        desc.setPosition(snap(-(dInk.l + dInk.r) / 2), snap(y - dInk.t));
      };
      ct.add([bg, halo, icon, lv, name, desc]);
    }
    bg.on("pointerover", () => { if (!this.picked) { this.tweens.add({ targets: ct, scale: 1.04, duration: 90 }); Audio.play("ui_hover", { vol: 0.5 }); } });
    bg.on("pointerout", () => !this.picked && this.tweens.add({ targets: ct, scale: 1, duration: 90 }));
    bg.on("pointerdown", () => { this.pressed = this.ready ? i : -1; });
    bg.on("pointerup", () => { if (this.pressed === i) this.pick(i); this.pressed = -1; });
    return { ct, contentH, place };
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
      // below the feet: the level-up effect's "LEVEL UP!" title drops in above the wizard right after the pick
      g.vfx.floatText(g.wizard.x, g.wizard.y + 22, c.name.toUpperCase(), RARITY_COLORS[c.rarity], 1, 1200);
      this.scene.stop();
      g.resumeFromUpgrade();
    });
  }
}
