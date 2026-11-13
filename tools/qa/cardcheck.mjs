// QA: measures upgrade-card spacing from the rendered pixels. For every card it finds the inner edge of
// the frame and the visible ink of the icon, name, level tag and description, then prints the gaps (in
// art px) so left/right and top/bottom padding can be compared. Saves a zoomed shot of the cards.
//   QA_URL=http://localhost:5174/ node tools/qa/cardcheck.mjs [width height dpr]
import { chromium } from "playwright-core";
const URL = process.env.QA_URL ?? "http://localhost:5173/";
const [W = "390", H = "844", DPR = "2"] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const p = await (await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: +DPR, hasTouch: true, isMobile: true })).newPage();
p.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
await p.goto(URL);
await p.evaluate(() => localStorage.setItem("spellbound-arena.v2", JSON.stringify({ version: 2, tutorialDone: true, settings: {} })));
await p.reload();
await p.waitForFunction(() => window.__game?.scene.isActive("Menu"), null, { timeout: 30000 });
await p.keyboard.press("Enter");
await p.waitForFunction(() => window.__game?.scene.isActive("Game"), null, { timeout: 30000 });
await p.waitForTimeout(1200);
await p.evaluate(() => { const g = window.__game.scene.getScene("Game"); g.spells.levels.nova = 2; g.xp.add(g.xp.toNext); });
await p.waitForFunction(() => { const u = window.__game.scene.getScene("Upgrade"); return u.sys.isActive() && u.ready; }, null, { timeout: 10000 });
await p.waitForTimeout(700);
const res = await p.evaluate(() => {
  const u = window.__game.scene.getScene("Upgrade");
  const S = u.cameras.main.zoom;
  // ink box (art px, scene coords) of a game object, from its texture pixels
  const inkOf = (o) => {
    const m = o.getWorldTransformMatrix();
    let c, sx, sy, fw, fh, ox, oy;
    if (o.type === "Text") { c = o.canvas; fw = o.width; fh = o.height; sx = c.width / fw; sy = c.height / fh; }
    else {
      const f = o.frame, src = f.source.image;
      c = document.createElement("canvas"); c.width = f.cutWidth; c.height = f.cutHeight;
      c.getContext("2d").drawImage(src, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, f.cutWidth, f.cutHeight);
      fw = f.cutWidth; fh = f.cutHeight; sx = 1; sy = 1;
    }
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    // bright pixels only: the dark shadow/stroke and icon outlines barely show on the dark card
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4; if (d[i + 3] > 100 && d[i] + d[i + 1] + d[i + 2] > 150) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
    const lx = -o.displayOriginX / (o.scaleX || 1), ly = -o.displayOriginY / (o.scaleY || 1);
    const p0 = m.transformPoint(lx + x0 / sx, ly + y0 / sy), p1 = m.transformPoint(lx + (x1 + 1) / sx, ly + (y1 + 1) / sy);
    return { x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y };
  };
  return u.cards.map((ct) => {
    const items = ct.list;
    const bg = items[0];
    const bm = bg.getWorldTransformMatrix();
    const bx = bm.tx - bg.displayOriginX, by = bm.ty - bg.displayOriginY;
    const inner = { x0: bx + 4, y0: by + 4, x1: bx + bg.width - 4, y1: by + bg.height - 4 };
    const parts = items.slice(1).filter((o) => o.visible && (o.type === "Text" || o.type === "BitmapText" || o.type === "Rectangle" || (o.type === "Image" && o.blendMode === 0)));
    const named = parts.map((o) => ({ kind: o.type === "Image" ? `icon:${o.texture.key}` : o.type === "Rectangle" ? "slot" : `${o.type === "Text" ? "text" : "bmp"}:${(o.text || "").slice(0, 14)}`, ...(o.type === "Rectangle" ? (() => { const r = o.getBounds(); return { x0: r.x, y0: r.y, x1: r.right, y1: r.bottom }; })() : o.type === "BitmapText" ? (() => { const k = o.ink(), m = o.getWorldTransformMatrix(), sx = o.scaleX, sy = o.scaleY; const a = m.transformPoint(-o.ax * k.w * sx / sx, -o.ay * k.h), z = m.transformPoint((1 - o.ax) * k.w, (1 - o.ay) * k.h); return { x0: a.x, y0: a.y, x1: z.x, y1: z.y }; })() : inkOf(o)) }));
    const all = { x0: Math.min(...named.map((n) => n.x0)), y0: Math.min(...named.map((n) => n.y0)), x1: Math.max(...named.map((n) => n.x1)), y1: Math.max(...named.map((n) => n.y1)) };
    const r = (v) => Math.round(v * 10) / 10;
    return { card: `${r(bg.width)}x${r(bg.height)}`, pad: { left: r(all.x0 - inner.x0), right: r(inner.x1 - all.x1), top: r(all.y0 - inner.y0), bottom: r(inner.y1 - all.y1) },
      parts: named.map((n) => `${n.kind} [${r(n.x0 - inner.x0)}..${r(n.x1 - inner.x0)}] x [${r(n.y0 - inner.y0)}..${r(n.y1 - inner.y0)}]`) };
  });
});
for (const c of res) { console.log(`card ${c.card}  padding L ${c.pad.left}  R ${c.pad.right}  T ${c.pad.top}  B ${c.pad.bottom}`); for (const s of c.parts) console.log("   ", s); }
const box = await p.evaluate(() => { const u = window.__game.scene.getScene("Upgrade"), k = u.cameras.main.zoom / window.devicePixelRatio;
  const bs = u.cards.map((c) => c.getBounds()); const x0 = Math.min(...bs.map((r) => r.x)), y0 = Math.min(...bs.map((r) => r.y)), x1 = Math.max(...bs.map((r) => r.right)), y1 = Math.max(...bs.map((r) => r.bottom));
  return { x: x0 * k - 4, y: y0 * k - 4, width: (x1 - x0) * k + 8, height: (y1 - y0) * k + 8 }; });
await p.screenshot({ path: `qa-shots/cards_${W}x${H}.png`, clip: box });
await b.close();
