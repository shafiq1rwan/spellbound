// UI art: pixel font (BMFont), title logo, 9-slice panels/buttons/cards, hearts & icons.
import { Img, mix } from "./lib/px.mjs";
import { C } from "./palette.mjs";

// ------------------------------------------------------------------ font (5x7, variable width)
const G = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["###", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
  J: ["..###", "....#", "....#", "....#", "#...#", "#...#", ".###."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", ".#.#.", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  0: [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  1: [".#.", "##.", ".#.", ".#.", ".#.", ".#.", "###"],
  2: [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  3: ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  4: ["#...#", "#...#", "#...#", "#####", "....#", "....#", "....#"],
  5: ["#####", "#....", "#....", "####.", "....#", "....#", "####."],
  6: [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  7: ["#####", "....#", "...#.", "..#..", "..#..", "..#..", "..#.."],
  8: [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  9: [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  ".": [".", ".", ".", ".", ".", ".", "#"],
  ",": ["..", "..", "..", "..", "..", ".#", "#."],
  "!": ["#", "#", "#", "#", "#", ".", "#"],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  ":": [".", ".", "#", ".", ".", "#", "."],
  "-": ["...", "...", "...", "###", "...", "...", "..."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
  "%": ["##..#", "##.#.", "...#.", "..#..", ".#...", ".#.##", "#..##"],
  "'": ["#", "#", ".", ".", ".", ".", "."],
  x: [".....", ".....", "#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  "(": [".#", "#.", "#.", "#.", "#.", "#.", ".#"],
  ")": ["#.", ".#", ".#", ".#", ".#", ".#", "#."],
  "<": ["...#", "..#.", ".#..", "#...", ".#..", "..#.", "...#"],
  ">": ["#...", ".#..", "..#.", "...#", "..#.", ".#..", "#..."],
  "=": ["....", "....", "####", "....", "####", "....", "...."],
  "*": [".....", "#.#.#", ".###.", "#####", ".###.", "#.#.#", "....."],
  " ": ["...", "...", "...", "...", "...", "...", "..."],
  // symbols for wordless hints
  "✓": ["......#", ".....##", "#...##.", "##.##..", ".###...", "..#....", "......."], // check mark
  "✗": ["#...#", ".#.#.", "..#..", ".#.#.", "#...#", ".....", "....."],                 // cross
  "♥": [".##.##.", "#######", "#######", ".#####.", "..###..", "...#...", "......."], // heart
  "→": [".......", "....#..", ".....#.", "#######", ".....#.", "....#..", "......."], // arrow
};

/** bakes the font: white glyphs, 1px dark outline, 1px drop shadow. Returns {img, xml} */
export function buildFont(name = "pixel") {
  const chars = Object.keys(G);
  const cellH = 10;
  const cells = chars.map((ch) => {
    const g = G[ch];
    const w = g[0].length;
    const im = new Img(w + 2, cellH);
    g.forEach((row, y) => [...row].forEach((c, x) => c === "#" && im.px(x + 1, y + 1, "#FFFFFF")));
    const body = im.clone();
    // drop shadow (1px down), then outline
    body.p.forEach((v, i) => {
      if (!v) return;
      const x = i % im.w, y = Math.floor(i / im.w);
      if (y + 1 < cellH && !im.get(x, y + 1)) im.px(x, y + 1, "#120F26");
    });
    im.outline("#120F26");
    for (let i = 0; i < body.p.length; i++) if (body.p[i]) im.p[i] = body.p[i];
    return { ch, im, adv: w + 1 };
  });
  const totalW = cells.reduce((a, c) => a + c.im.w + 1, 0);
  const sheet = new Img(totalW, cellH);
  let x = 0;
  const lines = [];
  for (const c of cells) {
    sheet.stamp(c.im, x, 0);
    const id = c.ch.charCodeAt(0);
    lines.push(`<char id="${id}" x="${x}" y="0" width="${c.im.w}" height="${cellH}" xoffset="-1" yoffset="-1" xadvance="${c.adv}" page="0" chnl="15"/>`);
    // map lowercase letters to uppercase glyphs (x stays a multiply sign)
    if (/[A-Z]/.test(c.ch) && c.ch !== "X")
      lines.push(`<char id="${c.ch.toLowerCase().charCodeAt(0)}" x="${x}" y="0" width="${c.im.w}" height="${cellH}" xoffset="-1" yoffset="-1" xadvance="${c.adv}" page="0" chnl="15"/>`);
    x += c.im.w + 1;
  }
  const xml = `<?xml version="1.0"?>
<font>
  <info face="${name}" size="8" bold="0" italic="0" charset="" unicode="1" stretchH="100" smooth="0" aa="0" padding="0,0,0,0" spacing="1,1"/>
  <common lineHeight="9" base="7" scaleW="${totalW}" scaleH="${cellH}" pages="1" packed="0"/>
  <pages><page id="0" file="${name}.png"/></pages>
  <chars count="${lines.length}">
    ${lines.join("\n    ")}
  </chars>
</font>
`;
  return { img: sheet, xml };
}

/** chunky title logo: glyphs at 2x, gold->orange gradient, highlight, outline, deep shadow */
export function buildLogo(lines = ["SPELLBOUND", "ARENA"]) {
  const k = 2, gap = 1;
  const measure = (s) => [...s].reduce((a, ch) => a + (G[ch][0].length + gap) * k, 0) - gap * k;
  const W0 = Math.max(...lines.map(measure)) + 8, lh = 7 * k + 6;
  const im = new Img(W0, lh * lines.length + 6);
  const ramps = [
    [C.uiGold[2], "#FFD36B", "#FFB054", C.fireOrange, "#E2602E"],
    [C.lavender, "#C29CFF", C.violet, "#8456E0", "#6238C0"],
  ];
  lines.forEach((s, li) => {
    let x = Math.round((W0 - measure(s)) / 2);
    const y0 = 3 + li * lh;
    const ramp = ramps[li % 2];
    for (const ch of s) {
      const g = G[ch];
      g.forEach((row, gy) => [...row].forEach((c, gx) => {
        if (c !== "#") return;
        for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
          const yy = gy * k + j;
          const t = yy / (7 * k - 1);
          im.px(x + gx * k + i, y0 + yy, ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))]);
        }
      }));
      x += (g[0].length + gap) * k;
    }
  });
  // top-edge highlight
  const body = im.clone();
  body.map((x, y, v) => (v && !body.get(x, y - 1) ? im.col("#FFFBEA") : undefined));
  for (let i = 0; i < body.p.length; i++) if (body.p[i] && !im.p[i]) im.p[i] = body.p[i];
  im.map((x, y, v) => (v && !body.get(x, y - 1) && body.get(x, y) ? im.col("#FFFBEA") : undefined));
  // inner outline + 2px deep shadow
  im.outline(C.outline);
  const shadowed = new Img(im.w, im.h + 3);
  const sh = im.clone();
  sh.map((x, y, v) => (v ? sh.col("#2A1450") : undefined));
  shadowed.stamp(sh, 0, 3);
  shadowed.stamp(sh, 0, 2);
  shadowed.stamp(im, 0, 0);
  shadowed.outline(C.outline);
  return shadowed;
}

// ------------------------------------------------------------------ 9-slice frames
export function panel({ size = 24, bg = C.uiBg[1], bg2 = C.uiBg[0], border = C.uiBorder[0], hi = C.uiBorder[1], gem = C.uiGold[1], gemHi = C.uiGold[2] } = {}) {
  const im = new Img(size, size);
  im.rect(1, 1, size - 2, size - 2, C.outline);
  im.rect(2, 2, size - 4, size - 4, border);
  im.rect(3, 3, size - 6, size - 6, bg2);
  im.rect(4, 4, size - 8, size - 8, bg);
  im.hline(3, 2, size - 6, hi);
  im.vline(2, 3, size - 6, hi);
  // corner studs
  for (const [x, y] of [[2, 2], [size - 4, 2], [2, size - 4], [size - 4, size - 4]]) {
    im.rect(x - 1, y - 1, 4, 4, C.outline);
    im.rect(x, y, 2, 2, gem);
    im.px(x, y, gemHi);
  }
  return im;
}
/**
 * 24x24 9-slice button with EXACT geometry (the runtime centres labels on the face from this):
 *   up/over: row 0 outline | rows 1..H-5 face | rows H-4..H-2 lip (3) | row H-1 outline
 *   down:    rows 0-1 empty | row 2 outline | rows 3..H-3 face | row H-2 lip (1) | row H-1 outline
 * So the face is always H-5 rows tall and the pressed face sits exactly 2px lower.
 */
export function button(state = "up") {
  const im = new Img(24, 24);
  const fill = state === "down" ? ["#3A2470", "#4D3394"] : state === "over" ? ["#6A48C8", "#8463E0"] : ["#4E33A0", "#6446C0"];
  const down = state === "down";
  const top = down ? 2 : 0;          // outline row
  const f0 = top + 1, f1 = down ? 21 : 19; // face rows (inclusive)
  // silhouette: outline with clipped corners
  im.rect(1, top, 22, 24 - top, C.outline);
  im.rect(0, top + 1, 24, 22 - top, C.outline);
  // lip (3D depth)
  im.rect(1, f1 + 1, 22, 22 - f1, "#22163F");
  im.hline(2, f1 + 1, 20, "#30205A");
  // face: gold frame + two-tone fill + top highlight
  im.rect(1, f0, 22, f1 - f0 + 1, C.uiGold[0]);
  im.rect(2, f0 + 1, 20, f1 - f0 - 1, fill[0]);
  im.rect(2, f0 + 1, 20, Math.floor((f1 - f0) / 2), fill[1]);
  im.hline(2, f0 + 1, 20, state === "over" ? "#B9A0FF" : "#8E74E8");
  im.hline(1, f0, 22, C.uiGold[2]);
  im.vline(1, f0, f1 - f0 + 1, C.uiGold[1]);
  im.vline(22, f0, f1 - f0 + 1, C.uiGold[0]);
  im.hline(1, f1, 22, C.uiGold[0]);
  return im;
}
export function card(rarity = 0) {
  const rim = [["#6B5AA0", "#9C8BD0"], ["#3E86C8", "#8FD3FF"], [C.uiGold[1], C.uiGold[2]]][rarity];
  const im = new Img(32, 32);
  im.rect(1, 1, 30, 30, C.outline);
  im.rect(2, 2, 28, 28, rim[0]);
  im.rect(3, 3, 26, 26, "#120F26");
  im.rect(4, 4, 24, 24, "#231B45");
  im.hline(3, 2, 26, rim[1]);
  im.vline(2, 3, 26, rim[1]);
  for (const [x, y] of [[3, 3], [26, 3], [3, 26], [26, 26]]) {
    im.rect(x, y, 3, 3, rim[1]);
    im.px(x + 1, y + 1, "#FFFFFF");
  }
  return im;
}
export function barFrame() {
  const im = new Img(12, 8);
  im.rect(0, 0, 12, 8, C.outline);
  im.rect(1, 1, 10, 6, "#3A2F66");
  im.rect(2, 2, 8, 4, "#0C0A1A");
  im.hline(1, 1, 10, "#5A4A90");
  return im;
}

// ------------------------------------------------------------------ icons
const IC = {
  heart: { k: C.outline, r: C.hpRed, R: "#C23A5A", w: "#FFD0D8" },
};
export function hearts() {
  const full = `
    .kk.kk.
    krwkrrk
    krrrrRk
    kRrrrRk
    .kRrRk.
    ..kRk..
    ...k...`;
  const mk = (variant) => {
    const im = new Img(9, 9).palette({ ...IC.heart, e: "#2B2348", E: "#3E3466" });
    im.grid(1, 1, full);
    if (variant === "empty") im.swap({ r: "e", R: "e", w: "E" });
    if (variant === "half") im.map((x, y, v) => (x >= 4 && (v === im.col("r") || v === im.col("R") || v === im.col("w")) ? im.col("e") : undefined));
    return im;
  };
  return { full: mk("full"), half: mk("half"), empty: mk("empty") };
}

/** 16x16 icon set used on the HUD rune guide and upgrade cards */
export function icons() {
  const out = {};
  const mk = (name, pal, grid) => {
    const im = new Img(16, 16).palette({ k: C.outline, ...pal });
    im.grid(0, 0, grid);
    out[name] = im;
  };
  // round and radially symmetric icons are drawn with geometry (hand-typed grids came out oval/lopsided)
  const draw = (name, pal, fn) => {
    const im = new Img(16, 16).palette({ k: C.outline, ...pal });
    fn(im);
    im.outline("k");
    out[name] = im;
  };
  const fire = { r: "#A8321E", o: C.fireOrange, y: C.fireYellow, w: "#FFF6D0" };
  const ice = { b: "#3B8CD8", c: C.iceCyan, w: "#FFFFFF" };
  const bolt = { b: "#9BC4FF", y: C.boltYellow, w: "#FFFBE0", o: "#C79A1E" };
  const arc = { v: "#7A3CC8", p: C.violet, l: "#F0C8FF", w: "#FFFFFF" };
  // rune glyph icons (shape of the gesture)
  mk("rune_fire", fire, `
    ................
    .......kk.......
    ......kyyk......
    ......kyyk......
    .....kyoyyk.....
    .....kyk.kyk....
    ....kyk..kyk....
    ....kyk...kyk...
    ...kyk....kyk...
    ...kyk.....kyk..
    ..kyk......kyk..
    ..kyykkkkkkkyyk.
    .kyyyyyyyyyyyyk.
    ..kkkkkkkkkkkk..`);
  // circle rune: a true circle with a 1px line, like the other rune glyphs
  draw("rune_ice", ice, (im) => {
    im.ring(7, 7, 6, "c");
    for (const [x, y] of [[4, 2], [3, 3], [2, 4]]) im.px(x, y, "w"); // highlight, top-left
  });
  mk("rune_bolt", bolt, `
    ................
    .kkkkkkkkk......
    .kyyyyyyyyk.....
    ..kkkkkkyyk.....
    ......kyyk......
    .....kyyk.......
    ....kyyk........
    ...kyyyyyyyyyk..
    ...kkkkkkkkyyk..
    .........kyyk...
    ........kyyk....
    .......kyyk.....
    ......kyyyyyyyk.
    ......kkkkkkkkk.`);
  // V rune (Arcane Barrage)
  mk("rune_arcane", arc, `
    ................
    .kk..........kk.
    kppk........kppk
    kppk........kppk
    .kppk......kppk.
    .kppk......kppk.
    ..kppk....kppk..
    ..kppk....kppk..
    ...kppk..kppk...
    ...kppk..kppk...
    ....kppkkppk....
    ....kppppppk....
    .....kppppk.....
    ......kkkk......`);
  // upgrade icons
  mk("ic_fireball", fire, `
    ................
    .........kk.....
    ......kkkook....
    ....kkooook.k...
    ...koooyook.....
    ..koooyyyok.....
    ..kooyywyyok....
    .kroyywwyyok....
    .kroyywwyyok....
    .krooyyyyook....
    ..krroooooork...
    ..kkrrroorrk....
    ....kkrrrkk.....
    ......kkk.......`);
  mk("ic_meteor", fire, `
    ..k.............
    .kok..k.........
    ..kok.kok.......
    ...koookok......
    ....kooooook....
    ...k.kooyyyokk..
    ......koywwyok..
    .....koywwwwyok.
    .....kryyyyyyok.
    .....kroyyyyrok.
    ......kroooork..
    .......krrrrk...
    ........kkkk....`);
  mk("ic_nova", ice, `
    .......kk.......
    .......kwk......
    ...kk..kck..kk..
    ...kck.kck.kck..
    ....kckkckkck...
    .....kcccwck....
    .kkkkkcwwwckkkk.
    .kwccccwwwccccwk
    .kkkkkcwwwckkkk.
    .....kccccck....
    ....kckkckkck...
    ...kck.kck.kck..
    ...kk..kck..kk..
    .......kwk......
    .......kk.......`);
  mk("ic_bolt", bolt, `
    .........kkkk...
    ........kyyyk...
    .......kyyyk....
    ......kyyyk.....
    .....kyyyk......
    ....kyyyykkkk...
    ...kwwwwwyyyk...
    ...kkkkyyyyk....
    .....kyyyk......
    ....kyyyk.......
    ...kyyk.........
    ..kyyk..........
    ..kyk...........
    ..kk............`);
  // arcane focus: symmetric five-point star
  draw("ic_arcane", arc, (im) => {
    const cx = 7, cy = 7.6, ro = 6.6, ri = 2.8, pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? ri : ro;
      pts.push(cx + 0.5 + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    im.poly(pts, "p");
    im.map((x, y, v) => (v && x + y < 13 ? im.col("l") : undefined)); // lit top-left half
    im.map((x, y, v) => (v && x + y > 16 ? im.col("v") : undefined)); // shaded bottom-right
    im.px(7, 6, "w").px(7, 7, "w").px(6, 7, "l").px(8, 7, "l");
  });
  mk("ic_haste", { a: C.uiGold[1], A: C.uiGold[2], s: C.lavender, S: "#8E74E8" }, `
    ...kkkkkkkkkk...
    ...kAAAAAAAAk...
    ....kaaaaaak....
    ....ksssssSk....
    .....ksssSk.....
    ......ksSk......
    .......kk.......
    ......kSsk......
    .....kS.sSk.....
    ....kS.s.sSk....
    ....kSsssssk....
    ...kaaaaaaaak...
    ...kAAAAAAAAk...
    ...kkkkkkkkkk...`);
  mk("ic_heart", { r: C.hpRed, R: "#C23A5A", w: "#FFD0D8", g: C.uiGold[2] }, `
    ................
    ..kkk..kkk......
    .krrrkkrrrk.....
    .krwrrrrrRk.....
    .krrrrrrrRk.....
    .kRrrrrrRRk.....
    ..kRrrrRRk.kk...
    ...kRrRRk.kgk...
    ....kRRk.kkgkk..
    .....kk.kggggk..
    ........kkkgkk..
    ..........kgk...
    ..........kk....`);
  mk("ic_magnet", { r: C.hpRed, R: "#C23A5A", s: "#C9C4D8", S: "#8E89A6", m: C.xpMint }, `
    ................
    ...kkkk..kkkk...
    ...kssk..kssk...
    ...kSSk..kSSk...
    ...krrk..krrk...
    ...krRk..krRk...
    ...krRk..krRk...
    ...krrkkkkrrk...
    ...kRrrrrrrRk...
    ....kRRrrRRk....
    .....kkkkkk.....
    ..k.........k...
    .kmk.......kmk..
    ..k.........k...`);
  mk("ic_potion", { r: C.hpRed, R: "#C23A5A", w: "#FFD0D8", g: "#B9B4C4", c: "#7A4E32" }, `
    ......kkkk......
    ......kcck......
    ......kggk......
    .....kg..gk.....
    ....kg....gk....
    ...kgrrrrrRgk...
    ...kgrwrrrRgk...
    ...kgrrrrrRgk...
    ...kgRrrrRRgk...
    ....kgRRRRgk....
    .....kkkkkk.....`);
  mk("ic_xp", { a: "#1F6B54", b: "#3DBB86", c: C.xpMint, d: "#D8FFEC" }, `
    .......kk.......
    ......kddk......
    .....kdccbk.....
    ....kdccbbbk....
    ...kdccbbbbak...
    ...kccbbbbbak...
    ...kcbbbbbaak...
    ....kbbbbaak....
    .....kbbaak.....
    ......kaak......
    .......kk.......`);
  mk("ic_pause", { w: "#FFFFFF", g: C.lavender }, `
    ................
    ...kkkk..kkkk...
    ...kwwk..kwwk...
    ...kwgk..kwgk...
    ...kwgk..kwgk...
    ...kwgk..kwgk...
    ...kwgk..kwgk...
    ...kwgk..kwgk...
    ...kwgk..kwgk...
    ...kwgk..kwgk...
    ...kwwk..kwwk...
    ...kkkk..kkkk...`);
  // settings gear (menu corner button, same style as the pause icon)
  // settings gear: round body, 8 teeth placed in mirrored pairs around the centre (7,7), hole in the middle
  draw("ic_gear", { w: "#FFFFFF", g: C.lavender }, (im) => {
    im.circ(7, 7, 4, "w");
    im.rect(6, 1, 3, 2, "w"); im.rect(6, 12, 3, 2, "w");   // N, S
    im.rect(1, 6, 2, 3, "w"); im.rect(12, 6, 2, 3, "w");   // W, E
    for (const [x, y] of [[3, 3], [10, 3], [3, 10], [10, 10]]) im.rect(x, y, 2, 2, "w"); // diagonals
    im.map((x, y, v) => (v && x + y > 15 ? im.col("g") : undefined)); // shaded bottom-right
    im.circ(7, 7, 1.2, "_");
  });
  mk("ic_skull", { w: C.bone[3], s: C.bone[1] }, `
    ................
    ....kkkkkkk.....
    ...kwwwwwwwk....
    ..kwwwwwwwwsk...
    ..kwkkwwkkwsk...
    ..kwkkwwkkwsk...
    ..kwwwwkwwwsk...
    ...kswwwwwsk....
    ....kwkwkwk.....
    ....kkkkkkk.....`);
  // clock (recharging): round face, ticks at 12/3/6/9, hands at 12 and 3
  draw("ic_clock", { w: "#FFFFFF", g: C.lavender, y: C.uiGold[2] }, (im) => {
    im.circ(7, 7, 6, "g");
    im.circ(7, 7, 5, "w");
    for (const [x, y] of [[7, 3], [11, 7], [7, 11], [3, 7]]) im.px(x, y, "g");
    im.vline(7, 4, 4, "k");
    im.hline(7, 7, 3, "k");
  });
  // chain: "the wizard is bound to the circle" (can't move)
  mk("ic_chain", { g: C.uiGold[1], y: C.uiGold[2], d: C.uiGold[0] }, `
    ................
    ..kkkk..........
    .kyyyyk.........
    kyk..kyk........
    kgk..kgkkkk.....
    .kggkkyyyyyk....
    ..kkkyk...kyk...
    .....kgk...kgk..
    .....kgk...kgk..
    ......kggkkkdk..
    .......kkkyyyyk.
    ..........kgkkyk
    ..........kgk.kgk
    ...........kggdk.
    ............kkk..`);
  // rewarded-ad marker (clapperboard): every reward button carries it
  mk("ic_video", { w: "#FFF8EC", g: "#9C8BD0", y: C.uiGold[2] }, `
    ................
    .kkkkkkkkkkkkkk.
    .kwwkkwwkkwwkkk.
    .kkwwkkwwkkwwkk.
    .kkkkkkkkkkkkkk.
    .kggggggggggggk.
    .kgwwwwwwwwwwgk.
    .kgwwwykwwwwwgk.
    .kgwwwykkwwwwgk.
    .kgwwwykwwwwwgk.
    .kgwwwwwwwwwwgk.
    .kgwwwwwwwwwwgk.
    .kggggggggggggk.
    .kkkkkkkkkkkkkk.`);
  mk("hand", { w: "#FFF8EC", s: "#C9B8E8" }, `
    ....kk..........
    ...kwwk.........
    ...kwwk.........
    ...kwwkkkk......
    ...kwwkwwkkk....
    .kkkwwkwwkwwk...
    kwwkwwwwwwwwkk..
    kwwwwwwwwwwwwk..
    .kwwwwwwwwwwwk..
    ..kwwwwwwwwwsk..
    ...kwwwwwwwsk...
    ....kssssssk....
    ....kkkkkkkk....`);
  return out;
}
