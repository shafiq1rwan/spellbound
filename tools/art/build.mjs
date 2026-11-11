// Bakes every game asset to public/assets/gfx + manifest.json, and QA previews to art-preview/.
//   node tools/art/build.mjs
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { Img, savePNG, encodePNG, strip, preview } from "./lib/px.mjs";
import { C } from "./palette.mjs";
import * as WZ from "./wizard.mjs";
import * as EN from "./enemies.mjs";
import * as FX from "./fx.mjs";
import * as ENV from "./env.mjs";
import * as UI from "./ui.mjs";

const OUT = "public/assets/gfx";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
mkdirSync("art-preview", { recursive: true });

const manifest = { sheets: {}, images: {}, fonts: {}, decor: {}, nineslice: {} };
let bytes = 0;
// every texture goes into ONE bundle (gfx.json, base64 PNGs) so the game makes 1 request instead of ~100
const bundle = {};
function png(name, img, { file = false } = {}) {
  bytes += img.w * img.h;
  if (file) {
    savePNG(`${OUT}/${name}.png`, img);
  } else {
    bundle[name] = encodePNG(img).toString("base64");
  }
  return `${name}.png`;
}

/**
 * sheet(key, { animName: [frames] }, { durations, repeat, origin, anchors })
 * frames are laid out in one grid; anims reference indices.
 */
function sheet(key, anims, { durations = {}, loops = {}, origin = [0.5, 0.5], anchors = null, cols } = {}) {
  const frames = [];
  const meta = {};
  for (const [name, list] of Object.entries(anims)) {
    const start = frames.length;
    frames.push(...list);
    const d = durations[name] ?? list.map(() => 100);
    meta[name] = { frames: list.map((_, i) => start + i), durations: d, repeat: loops[name] ?? -1 };
  }
  const c = cols ?? Math.min(frames.length, Math.max(1, Math.floor(1024 / frames[0].w)));
  const { img } = strip(frames, c);
  manifest.sheets[key] = { file: png(key, img), fw: frames[0].w, fh: frames[0].h, anims: meta, origin, ...(anchors ? { anchors } : {}) };
  savePNG(`art-preview/sheet_${key}.png`, preview(img, Math.max(1, Math.min(6, Math.floor(1400 / img.w)))));
  return frames;
}
function image(key, img) {
  manifest.images[key] = png(key, img);
}

// ======================================================== wizard
{
  const anims = {}, anchors = [];
  for (const [name, poses] of Object.entries(WZ.POSES)) {
    anims[name] = poses.map((p) => {
      const r = WZ.wizard(p);
      anchors.push(r.anchor);
      return r.img;
    });
  }
  sheet("wizard", anims, {
    durations: WZ.TIMING,
    loops: { cast: 0, hurt: 0, death: 0, cheer: 0, blink: 0 },
    origin: [24 / 48, 44.5 / 48],
    anchors: { crystal: anchors },
  });
  const cr = WZ.crystals();
  const canims = {};
  for (const [k, v] of Object.entries(cr)) canims[k] = v;
  sheet("crystal", canims, { durations: Object.fromEntries(Object.keys(cr).map((k) => [k, [220, 120, 160, 220]])), origin: [0.5, 0.5] });
}

// ======================================================== enemies
const S = (fn, list) => list.map((p) => fn(p));
{
  const slime = { idle: S(EN.slime, EN.SLIME.idle), hop: S(EN.slime, EN.SLIME.hop), hurt: S(EN.slime, EN.SLIME.hurt), death: S(EN.slime, EN.SLIME.death) };
  const loops = { hurt: 0, death: 0, hop: 0, attack: 0 };
  const o32 = [16.5 / 32, 29 / 32];
  sheet("slime", slime, { durations: EN.SLIME_T, loops, origin: o32 });
  const slimeSwap = { [C.slime[0]]: "#4A1640", [C.slime[1]]: "#B03A8A", [C.slime[2]]: "#FF6AC1", [C.slime[3]]: "#FFB0E0", [C.leaf[1]]: C.fireYellow, [C.leaf[0]]: "#C7862F" };
  sheet("slime_elite", Object.fromEntries(Object.entries(slime).map(([k, v]) => [k, EN.elite(v, slimeSwap, C.fireYellow)])), { durations: EN.SLIME_T, loops, origin: o32 });

  const bat = { fly: S(EN.bat, EN.BAT.fly), hurt: S(EN.bat, EN.BAT.hurt) };
  sheet("bat", bat, { durations: EN.BAT_T, loops, origin: [0.5, 0.5] });
  const batSwap = { [C.bat[0]]: "#3A0F1E", [C.bat[1]]: "#6A1A32", [C.bat[2]]: "#A02C48", [C.bat[3]]: "#D8506A", [C.bat[4]]: "#FF9AAE", [C.batEye[0]]: C.fireYellow };
  sheet("bat_elite", Object.fromEntries(Object.entries(bat).map(([k, v]) => [k, EN.elite(v, batSwap, C.hpRed)])), { durations: EN.BAT_T, loops, origin: [0.5, 0.5] });

  const sk = { idle: S(EN.skeleton, EN.SKEL.idle), walk: S(EN.skeleton, EN.SKEL.walk), attack: S(EN.skeleton, EN.SKEL.attack), hurt: S(EN.skeleton, EN.SKEL.hurt) };
  const o48 = [24 / 48, 44.5 / 48];
  sheet("skeleton", sk, { durations: EN.SKEL_T, loops, origin: o48 });
  const skSwap = { [C.bone[1]]: "#3A3450", [C.bone[2]]: "#5A5278", [C.bone[3]]: "#8478A8", [C.cloth[1]]: C.uiGold[1], [C.cloth[2]]: C.uiGold[2], [C.cloth[0]]: C.uiGold[0], [C.ghostEye[0]]: C.iceCyan, [C.ghostEye[1]]: "#FFFFFF" };
  sheet("skeleton_elite", Object.fromEntries(Object.entries(sk).map(([k, v]) => [k, EN.elite(v, skSwap, C.iceCyan)])), { durations: EN.SKEL_T, loops, origin: o48 });

  const go = { idle: S(EN.golem, EN.GOLEM.idle), walk: S(EN.golem, EN.GOLEM.walk), attack: S(EN.golem, EN.GOLEM.attack), hurt: S(EN.golem, EN.GOLEM.hurt) };
  const o64 = [32 / 64, 60.5 / 64];
  sheet("golem", go, { durations: EN.GOLEM_T, loops, origin: o64 });
  const goSwap = { [C.stone[1]]: "#3A1E2A", [C.stone[2]]: "#5A2A36", [C.stone[3]]: "#7E3E46", [C.stone[4]]: "#A85A52", [C.rune[1]]: C.fireOrange, [C.rune[0]]: "#A8321E", [C.rune[2]]: C.fireYellow, [C.moss[1]]: "#C7862F", [C.moss[2]]: C.fireYellow };
  sheet("golem_elite", Object.fromEntries(Object.entries(go).map(([k, v]) => [k, EN.elite(v, goSwap, C.fireOrange)])), { durations: EN.GOLEM_T, loops, origin: o64 });

  sheet("boss", { idle: S(EN.boss, EN.BOSS.idle), charge: S(EN.boss, EN.BOSS.charge), hurt: S(EN.boss, EN.BOSS.hurt) },
    { durations: EN.BOSS_T, loops: { hurt: 0 }, origin: [0.5, 0.5] });
  const bp = EN.bossParts();
  image("boss_hand", bp.hand);
  bp.frags.forEach((f, i) => image(`boss_frag${i}`, f));
  sheet("boss_orb", { spin: bp.orb }, { durations: { spin: [90, 90, 90, 90] } });
  EN.boneBits().forEach((b, i) => image(`bone${i}`, b));
  EN.rockBits().forEach((b, i) => image(`rock${i}`, b));
}

// ======================================================== vfx
{
  const one = (k, frames, d, opts = {}) => sheet(k, { play: frames }, { durations: { play: frames.map(() => d) }, loops: { play: opts.loop ? -1 : 0 }, origin: opts.origin ?? [0.5, 0.5] });
  one("fireball", FX.fireball(16, 4, 1), 70, { loop: true, origin: [0.6, 0.5] });
  one("fireball_big", FX.fireball(26, 4, 3), 70, { loop: true, origin: [0.6, 0.5] });
  one("explosion", FX.explosion(48, 8, 2), 45);
  one("explosion_big", FX.explosion(84, 10, 9), 50);
  one("nova", FX.frostNova(128, 8), 45);
  one("missile", FX.arcaneMissile(4), 60, { loop: true });
  one("starburst", FX.starburst(24, 6), 45);
  one("vortex", FX.vortex(48, 6), 60, { loop: true });
  one("hitflash", FX.hitFlash(4), 35);
  one("zap", FX.zap(5), 40);
  one("smoke", FX.smokePuff(6), 70);
  one("portal", FX.spawnPortal(6), 90);
  one("shock", FX.shockRing(64, 5), 50);
  one("shock_ice", FX.shockRing(64, 5, "#FFFFFF", C.iceCyan), 50);
  one("xp", FX.xpOrb(6), 90, { loop: true });
  one("xp_big", FX.xpOrb(6, ["#1F4F8A", "#3D8CD8", C.iceCyan, "#E4FCFF"]), 90, { loop: true });
  for (const k of ["fire", "ice", "bolt", "arcane", "level"]) one(`sigil_${k}`, FX.sigil(k, 4), 90, { loop: true });
  for (const [k, v] of Object.entries(FX.particles())) image(`p_${k}`, v);
  for (const [k, v] of Object.entries(FX.decals())) image(`decal_${k}`, v);
  image("glow", FX.glow(32, 5, 0.9));
  image("glow_big", FX.glow(96, 7, 0.8));
  [[14, 5], [20, 6], [30, 8], [44, 12], [60, 16]].forEach(([w, h], i) => image(`shadow${i}`, FX.shadow(w, h)));
}

// ======================================================== environment
{
  const { img, decor } = ENV.buildFloor();
  image("floor", img);
  manifest.decor = { size: ENV.FLOOR, ...decor };
  const es = ENV.envSprites();
  image("tuft", es.tuft);
  es.glyphs.forEach((g, i) => image(`glyph${i}`, g));
  savePNG("art-preview/floor.png", img);
}

// ======================================================== ui
{
  const f = UI.buildFont("pixel");
  manifest.fonts.pixel = { png: png("pixel", f.img, { file: true }), xml: "pixel.xml" };
  writeFileSync(`${OUT}/pixel.xml`, f.xml);
  image("logo", UI.buildLogo());
  image("panel", UI.panel());
  image("panel_dark", UI.panel({ bg: "#0F0C20", bg2: "#0A0818", border: "#3A2F66", hi: "#5A4A90" }));
  for (const s of ["up", "over", "down"]) image(`btn_${s}`, UI.button(s));
  [0, 1, 2].forEach((r) => image(`card${r}`, UI.card(r)));
  image("bar", UI.barFrame());
  for (const [k, v] of Object.entries(UI.hearts())) image(`heart_${k}`, v);
  for (const [k, v] of Object.entries(UI.icons())) image(k, v);
  manifest.nineslice = { panel: 6, panel_dark: 6, btn_up: 6, btn_over: 6, btn_down: 6, card0: 8, card1: 8, card2: 8, bar: 3 };
  const ic = Object.values(UI.icons());
  savePNG("art-preview/ui_icons.png", preview(strip(ic, 8).img, 6, "#1E1838"));
  savePNG("art-preview/ui_font.png", preview(f.img, 4, "#3B436E"));
  savePNG("art-preview/ui_logo.png", preview(UI.buildLogo(), 4, "#171B35"));
  const kit = [UI.panel(), UI.button("up"), UI.button("over"), UI.button("down"), UI.card(0).crop(0, 0, 24, 24), ...Object.values(UI.hearts()).map((h) => { const i = new Img(24, 24); i.stamp(h, 7, 7); return i; })];
  savePNG("art-preview/ui_kit.png", preview(strip(kit).img, 6, "#171B35"));
}

writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 1));
writeFileSync(`${OUT}/gfx.json`, JSON.stringify(bundle));
console.log(`gfx.json: ${Object.keys(bundle).length} textures, ${(JSON.stringify(bundle).length / 1024).toFixed(0)} KB (base64)`);
console.log(`baked ${Object.keys(manifest.sheets).length} sheets, ${Object.keys(manifest.images).length} images, ${(bytes / 1e6).toFixed(2)} Mpx`);
