// Renders the chapter-boss concept art (tools/art/bosses.mjs) to art-preview/bosses/ for review:
// one upscaled strip per animation, plus the signature projectiles.
//   node tools/art/boss-preview.mjs
import { strip, preview, savePNG } from "./lib/px.mjs";
import * as B from "./bosses.mjs";

const BG = { rime: "#1B2B4A", maw: "#2A1A24", weaver: "#120E2A" };
const sets = { rime: B.rimeAnims(), maw: B.mawAnims(), weaver: B.weaverAnims() };
for (const [boss, anims] of Object.entries(sets))
  for (const [name, frames] of Object.entries(anims)) {
    savePNG(`art-preview/bosses/${boss}_${name}.png`, preview(strip(frames).img, 3, BG[boss]));
    console.log(`${boss}_${name}: ${frames.length} frames`);
  }
const proj = { rime: B.icicle, maw: B.magmaRock, weaver: B.starBolt };
for (const [boss, fn] of Object.entries(proj)) savePNG(`art-preview/bosses/${boss}_projectile.png`, preview(strip([0, 1, 2, 3].map(fn)).img, 6, BG[boss]));

// ---------------------------------------------------------------- review page (art-preview/bosses/index.html)
import { encodePNG } from "./lib/px.mjs";
import { writeFileSync, readFileSync } from "node:fs";
import * as EN from "./enemies.mjs";

const T = { rime: B.RIME_T, maw: B.MAW_T, weaver: B.WEAVER_T };
const uri = (frames) => "data:image/png;base64," + encodePNG(strip(frames).img).toString("base64");
const pack = (frames, durations, once = false) => ({ src: uri(frames), n: frames.length, w: frames[0].w, h: frames[0].h, d: durations, once });
const data = {
  guardian: { idle: pack(EN.BOSS.idle.map((p) => EN.boss(p)), EN.BOSS_T.idle), charge: pack(EN.BOSS.charge.map((p) => EN.boss(p)), EN.BOSS_T.charge) },
};
for (const [boss, anims] of Object.entries(sets)) {
  data[boss] = {};
  for (const [name, frames] of Object.entries(anims)) data[boss][name] = pack(frames, T[boss][name], name === "death" || name === "hurt");
  data[boss].projectile = pack([0, 1, 2, 3].map(proj[boss]), [90, 90, 90, 90]);
}
const tpl = readFileSync(new URL("./boss-preview.html", import.meta.url), "utf8");
writeFileSync("art-preview/bosses/index.html", tpl.replace("/*DATA*/null", JSON.stringify(data)));
console.log("art-preview/bosses/index.html");
