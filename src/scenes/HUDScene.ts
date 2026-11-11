// HUD overlay: hearts, wave + timer, pause, boss bar, rune guide with cooldowns & levels, XP bar,
// banners, contextual hints, low-HP vignette, recognizer debug readout. Portrait and landscape layouts.
import Phaser from "phaser";
import { Layout } from "../core/Layout";
import { bus, EV } from "../core/bus";
import { Save, fmtTime } from "../core/Save";
import { PAL, ELEMENT_COLORS } from "../config/palette";
import { SPELLS, SPELL_ORDER, type SpellId } from "../config/spells";
import { Button, txt, slice } from "../ui/widgets";
import type { GameScene } from "./GameScene";
import type { RecognizeResult } from "../rune/RuneRecognizer";

interface Slot { id: SpellId; c: Phaser.GameObjects.Container; frame: Phaser.GameObjects.NineSlice; icon: Phaser.GameObjects.Image; cd: Phaser.GameObjects.Rectangle; pips: Phaser.GameObjects.Rectangle[]; glow: Phaser.GameObjects.Image; lock: Phaser.GameObjects.BitmapText; wasReady: boolean; x: number; y: number }

export class HUDScene extends Phaser.Scene {
  private g!: GameScene;
  private hearts: Phaser.GameObjects.Image[] = [];
  private heartRow!: Phaser.GameObjects.Container;
  private wavePanel!: Phaser.GameObjects.NineSlice;
  private waveText!: Phaser.GameObjects.BitmapText;
  private timeText!: Phaser.GameObjects.BitmapText;
  private pauseBtn!: Button;
  private slots: Slot[] = [];
  private xpFrame!: Phaser.GameObjects.NineSlice;
  private xpFill!: Phaser.GameObjects.Rectangle;
  private xpShine!: Phaser.GameObjects.Rectangle;
  private lvText!: Phaser.GameObjects.BitmapText;
  private xpFrac = 0;
  private xpShown = 0;
  private bossC!: Phaser.GameObjects.Container;
  private bossFill!: Phaser.GameObjects.Rectangle;
  private bossName!: Phaser.GameObjects.BitmapText;
  private bossW = 140;
  private banner!: Phaser.GameObjects.BitmapText;
  private bannerSub!: Phaser.GameObjects.BitmapText;
  private hint!: Phaser.GameObjects.BitmapText;
  private vignette!: Phaser.GameObjects.Image;
  private hurtFlash!: Phaser.GameObjects.Image;
  private debugText!: Phaser.GameObjects.BitmapText;
  private lowHp = false;
  private hp = 5;
  private maxHp = 5;
  private handlers: [string, (...a: never[]) => void][] = [];
  private offLayout?: () => void;
  private t = 0;
  private hintTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super("HUD");
  }

  create() {
    this.g = this.scene.get("Game") as GameScene;
    this.hearts = [];
    this.slots = [];
    this.cameras.main.setZoom(Layout.S).setOrigin(0, 0);
    this.vignette = this.add.image(0, 0, "vignette").setOrigin(0).setTint(PAL.hpRed).setAlpha(0).setDepth(-10);
    this.hurtFlash = this.add.image(0, 0, "vignette").setOrigin(0).setTint(PAL.hpRed).setAlpha(0).setDepth(-9);
    this.heartRow = this.add.container(0, 0);
    this.wavePanel = slice(this, "panel_dark", 0, 0, 58, 17);
    this.waveText = txt(this, 0, 0, "WAVE 1", { color: PAL.gold });
    this.timeText = txt(this, 0, 0, "0:00", { color: 0xd8d0f0 });
    this.pauseBtn = new Button(this, 0, 0, 20, 20, "", () => bus.emit(EV.PAUSE_REQ), { icon: "ic_pause" });
    this.pauseBtn.icon?.setScale(0.75);
    // boss bar
    this.bossC = this.add.container(0, 0).setVisible(false);
    const bf = slice(this, "bar", 0, 0, this.bossW + 4, 8);
    this.bossFill = this.add.rectangle(-this.bossW / 2, 0, this.bossW, 4, PAL.pink).setOrigin(0, 0.5);
    this.bossName = txt(this, 0, -9, "", { color: PAL.lavender });
    this.bossC.add([bf, this.bossFill, this.bossName]);
    // rune slots
    for (const id of SPELL_ORDER) {
      const c = this.add.container(0, 0);
      const glow = this.add.image(0, 0, "glow").setBlendMode(Phaser.BlendModes.ADD).setTint(ELEMENT_COLORS[SPELLS[id].element].main).setAlpha(0).setDisplaySize(40, 40);
      const frame = slice(this, "panel_dark", 0, 0, 24, 24);
      const icon = this.add.image(0, -1, SPELLS[id].runeIcon);
      const cd = this.add.rectangle(-9, -10, 18, 18, 0x07061a, 0.7).setOrigin(0, 0);
      const lock = txt(this, 0, -1, "?", { color: 0x6d5c98 });
      const pips = [0, 1, 2, 3, 4].map((i) => this.add.rectangle(-6 + i * 3, 9, 2, 1, 0x3a2f66).setOrigin(0, 0));
      c.add([glow, frame, icon, cd, lock, ...pips]);
      this.slots.push({ id, c, frame, icon, cd, pips, glow, lock, wasReady: true, x: 0, y: 0 });
    }
    this.xpFrame = slice(this, "bar", 0, 0, 120, 8);
    this.xpFill = this.add.rectangle(0, 0, 1, 4, PAL.xpMint).setOrigin(0, 0.5);
    this.xpShine = this.add.rectangle(0, 0, 1, 1, 0xd8ffec).setOrigin(0, 0.5);
    this.lvText = txt(this, 0, 0, "LV 1", { color: PAL.xpMint, ox: 1 });
    this.banner = txt(this, 0, 0, "", { scale: 2, color: PAL.gold }).setAlpha(0);
    this.bannerSub = txt(this, 0, 0, "", { color: PAL.lavender }).setAlpha(0);
    this.hint = txt(this, 0, 0, "", { color: 0xe8e0ff, maxWidth: 180 }).setAlpha(0);
    this.debugText = txt(this, 4, 0, "", { ox: 0, oy: 0, color: 0x9fe8ff, align: 0 }).setVisible(Save.settings.debugRunes);

    this.layout();
    this.offLayout = Layout.onChange(() => this.layout());
    this.listen(EV.HP, (hp: number, max: number, delta: number) => this.setHp(hp, max, delta));
    this.listen(EV.XP, (xp: number, need: number, lvl: number) => { this.xpFrac = xp / need; this.lvText.setText(`LV ${lvl}`); });
    this.listen(EV.WAVE, (n: number) => { this.waveText.setText(`WAVE ${n}`); this.pop(this.waveText); });
    this.listen(EV.WAVE_BANNER, (a: string, b: string, c: number) => this.showBanner(a, b, c));
    this.listen(EV.UNLOCK, (id: SpellId) => this.onUnlock(id));
    this.listen(EV.HINT, (s: string | null, ms: number) => this.showHint(s, ms));
    this.listen(EV.BOSS_HP, (f: number | null, name: string) => this.setBoss(f, name));
    this.listen(EV.LOW_HP, (on: boolean) => { this.lowHp = on; });
    this.listen(EV.CAST, (id: SpellId) => this.flashSlot(id));
    this.listen(EV.DEBUG, (r: RecognizeResult) => this.showDebug(r));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.handlers.forEach(([e, f]) => bus.off(e, f));
      this.handlers = [];
      this.offLayout?.();
    });
    this.setHp(this.g.hp, this.g.maxHp, 0);
    this.refreshSlots();
  }

  private listen<T extends unknown[]>(ev: string, fn: (...a: T) => void) {
    bus.on(ev, fn);
    this.handlers.push([ev, fn as unknown as (...a: never[]) => void]);
  }

  /** is this client point over an interactive HUD element? (blocks rune drawing) */
  hitUI(clientX: number, clientY: number) {
    if (!this.scene.isActive()) return false;
    const d = Layout.toDevice(clientX, clientY, this.game.canvas);
    const x = d.x / Layout.S, y = d.y / Layout.S;
    if (this.pauseBtn.contains(x, y)) return true;
    for (const s of this.slots) {
      if (Math.abs(x - s.x) <= 13 && Math.abs(y - s.y) <= 13) {
        // tapping a rune shows how to draw it
        if (this.g.spells.levels[s.id] > 0) this.scene.launch("Tutorial", { mode: "demo", spell: s.id });
        return true;
      }
    }
    return false;
  }

  layout() {
    const W = Layout.w, H = Layout.h, sf = Layout.safe;
    this.cameras.main.setZoom(Layout.S).setScroll(0, 0);
    this.vignette.setDisplaySize(W, H);
    this.hurtFlash.setDisplaySize(W, H);
    const top = sf.top + 4;
    this.heartRow.setPosition(Math.round(sf.left + 8), Math.round(top + 6));
    this.wavePanel.setPosition(Math.round(W / 2), Math.round(top + 8));
    this.waveText.setPosition(Math.round(W / 2), Math.round(top + 8));
    this.timeText.setPosition(Math.round(W / 2), Math.round(top + 22));
    this.pauseBtn.setPosition(Math.round(W - sf.right - 14), Math.round(top + 9));
    this.bossC.setPosition(Math.round(W / 2), Math.round(top + 42));
    this.debugText.setPosition(sf.left + 4, top + 30);
    const n = this.slots.length;
    if (Layout.portrait) {
      const by = Math.round(H - sf.bottom - 17);
      this.slots.forEach((s, i) => {
        s.x = Math.round(W / 2 + (i - (n - 1) / 2) * 28);
        s.y = by;
        s.c.setPosition(s.x, s.y);
      });
      const bw = Math.round(Math.min(W - 60, 150));
      this.placeXp(Math.round(W / 2 + 12), by - 21, bw);
      this.hint.setPosition(Math.round(W / 2), by - 36).setMaxWidth(W - 20);
      this.banner.setPosition(Math.round(W / 2), Math.round(H * 0.3));
    } else {
      const cx = Math.round(sf.left + 18);
      this.slots.forEach((s, i) => {
        s.x = cx;
        s.y = Math.round(H / 2 + (i - (n - 1) / 2) * 28 + 6);
        s.c.setPosition(s.x, s.y);
      });
      const bw = Math.round(Math.min(W * 0.45, 190));
      this.placeXp(Math.round(W / 2 + 12), Math.round(H - sf.bottom - 9), bw);
      this.hint.setPosition(Math.round(W / 2), Math.round(H - sf.bottom - 24)).setMaxWidth(W * 0.6);
      this.banner.setPosition(Math.round(W / 2), Math.round(H * 0.3));
    }
    this.bannerSub.setPosition(this.banner.x, this.banner.y + 16);
  }
  private placeXp(cx: number, y: number, w: number) {
    this.xpFrame.setPosition(cx, y).setSize(w + 4, 8);
    this.xpFrame.width = w + 4;
    this.xpFill.setPosition(cx - w / 2, y);
    this.xpShine.setPosition(cx - w / 2, y - 1);
    this.xpFill.setData("w", w);
    this.lvText.setPosition(cx - w / 2 - 6, y);
  }

  // ---------------------------------------------------------------- hearts
  private setHp(hp: number, max: number, delta: number) {
    this.hp = hp;
    this.maxHp = max;
    while (this.hearts.length < max) {
      const h = this.add.image(this.hearts.length * 10, 0, "heart_full");
      this.hearts.push(h);
      this.heartRow.add(h);
    }
    this.hearts.forEach((h, i) => {
      h.setVisible(i < max);
      h.setTexture(i < hp ? "heart_full" : "heart_empty");
    });
    if (delta < 0) {
      const h = this.hearts[Math.min(hp, max - 1)];
      if (h) {
        h.setTintFill(0xffffff);
        this.time.delayedCall(90, () => h.clearTint());
        this.tweens.add({ targets: h, scale: 1.6, duration: 80, yoyo: true });
      }
      this.tweens.add({ targets: this.heartRow, x: this.heartRow.x + 2, duration: 40, yoyo: true, repeat: 2 });
      this.hurtFlash.setAlpha(Save.settings.reducedMotion ? 0.15 : 0.35);
      this.tweens.add({ targets: this.hurtFlash, alpha: 0, duration: 400 });
    } else if (delta > 0) {
      for (let i = hp - delta; i < hp; i++) {
        const h = this.hearts[i];
        if (h) this.tweens.add({ targets: h, scale: 1.5, duration: 120, yoyo: true });
      }
    }
  }

  // ---------------------------------------------------------------- runes
  private refreshSlots() {
    for (const s of this.slots) {
      const lvl = this.g.spells.levels[s.id];
      const on = lvl > 0;
      s.icon.setAlpha(on ? 1 : 0.18);
      s.lock.setVisible(!on);
      s.pips.forEach((p, i) => p.setFillStyle(i < lvl ? ELEMENT_COLORS[SPELLS[s.id].element].main : 0x3a2f66));
    }
  }
  private flashSlot(id: SpellId) {
    const s = this.slots.find((q) => q.id === id);
    if (!s) return;
    s.glow.setAlpha(0.9);
    this.tweens.add({ targets: s.glow, alpha: 0, duration: 350 });
    this.pop(s.icon, 1.25);
  }
  private onUnlock(id: SpellId) {
    this.refreshSlots();
    const d = SPELLS[id];
    this.showBanner("NEW RUNE!", `${d.runeName.toUpperCase()} = ${d.name.toUpperCase()}`, ELEMENT_COLORS[d.element].main);
    const s = this.slots.find((q) => q.id === id)!;
    s.c.setScale(0.2);
    this.tweens.add({ targets: s.c, scale: 1, duration: 500, ease: "Back.easeOut" });
    this.tweens.add({ targets: s.glow, alpha: { from: 1, to: 0 }, duration: 500, repeat: 3 });
    this.time.delayedCall(500, () => this.scene.launch("Tutorial", { mode: "demo", spell: id }));
  }

  // ---------------------------------------------------------------- banners & hints
  private showBanner(a: string, b: string, color: number) {
    this.tweens.killTweensOf([this.banner, this.bannerSub]);
    this.banner.setText(a).setTint(color).setAlpha(1).setScale(0.4);
    this.bannerSub.setText(b).setAlpha(0);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 300, ease: "Back.easeOut" });
    this.tweens.add({ targets: this.bannerSub, alpha: 1, delay: 150, duration: 200 });
    this.tweens.add({ targets: [this.banner, this.bannerSub], alpha: 0, delay: 1900, duration: 400 });
  }
  private showHint(s: string | null, ms = 2500) {
    this.hintTimer?.remove();
    this.tweens.killTweensOf(this.hint);
    if (!s) { this.hint.setAlpha(0); return; }
    this.hint.setText(s).setAlpha(1);
    this.pop(this.hint, 1.15);
    if (ms > 0) this.hintTimer = this.time.delayedCall(ms, () => this.tweens.add({ targets: this.hint, alpha: 0, duration: 300 }));
  }
  private setBoss(f: number | null, name: string) {
    if (f === null) { this.bossC.setVisible(false); return; }
    this.bossC.setVisible(true);
    this.bossName.setText(name);
    this.bossFill.width = Math.max(0, this.bossW * f);
  }
  private showDebug(r: RecognizeResult) {
    this.debugText.setVisible(true);
    const f = r.features;
    const sc = Object.entries(r.scores).map(([k, v]) => `${k.slice(0, 3).toUpperCase()} ${v.toFixed(2)}`).join("\n");
    this.debugText.setText(`${r.rune ? r.rune.toUpperCase() : "NONE"} ${r.score.toFixed(2)}\n${sc}\nCLOSE ${f.closure.toFixed(2)}\nTURN ${Math.round(f.netTurn)}\nCORN ${f.corners}\nGATE ${r.gated.map((g) => g.slice(0, 3)).join(",") || "-"}`);
  }
  private pop(o: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, k = 1.3) {
    this.tweens.add({ targets: o, scale: k, duration: 90, yoyo: true, ease: "Quad.easeOut" });
  }

  update(_t: number, dt: number) {
    this.t += dt / 1000;
    const g = this.g;
    if (!g || !g.scene) return;
    this.timeText.setText(fmtTime(g.stats.timeMs));
    // xp bar eases toward its value
    this.xpShown += (this.xpFrac - this.xpShown) * Math.min(1, dt / 120);
    if (this.xpFrac < this.xpShown - 0.5) this.xpShown = 0;
    const w = Math.max(0, Math.round((this.xpFill.getData("w") as number) * Phaser.Math.Clamp(this.xpShown, 0, 1)));
    this.xpFill.width = w;
    this.xpShine.width = w;
    // cooldowns
    for (const s of this.slots) {
      const lvl = g.spells.levels[s.id];
      s.icon.setAlpha(lvl > 0 ? 1 : 0.18);
      s.lock.setVisible(lvl <= 0);
      if (lvl <= 0) { s.cd.setVisible(false); continue; }
      const f = g.spells.cooldownFrac(s.id);
      s.cd.setVisible(f > 0);
      s.cd.height = Math.round(18 * f);
      s.cd.y = -10 + (18 - s.cd.height);
      const ready = f === 0;
      if (ready && !s.wasReady) { s.glow.setAlpha(0.7); this.tweens.add({ targets: s.glow, alpha: 0, duration: 260 }); }
      s.wasReady = ready;
      s.pips.forEach((p, i) => p.setFillStyle(i < lvl ? ELEMENT_COLORS[SPELLS[s.id].element].main : 0x3a2f66));
    }
    // near-death warning: pulsing vignette + last heart pulse
    const k = Save.settings.reducedMotion ? 0.12 : 0.28;
    this.vignette.setAlpha(this.lowHp ? (0.5 + Math.sin(this.t * 5) * 0.5) * k : 0);
    if (this.lowHp && this.hearts[0]) this.hearts[0].setScale(1 + Math.max(0, Math.sin(this.t * 5)) * 0.25);
  }
}
