// Measures loading phases (navigation -> menu interactive) using performance marks.
//   QA_URL=http://localhost:5175/ node tools/qa/load-timing.mjs [cpuSlowdown]
import { chromium } from "playwright-core";
const URL = process.env.QA_URL ?? "http://localhost:5175/";
const slow = Number(process.argv[2] ?? 1);
const b = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
for (let run = 0; run < (process.env.QA_NET ? 1 : 2); run++) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  if (slow > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: slow });
  if (process.env.QA_NET === "4g") {
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (4 * 1024 * 1024) / 8, uploadThroughput: (1 * 1024 * 1024) / 8 });
  }
  await p.goto(URL);
  await p.waitForFunction(() => window.__game?.scene.isActive("Menu"), null, { timeout: 60000 });
  const t = await p.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const m = Object.fromEntries(performance.getEntriesByType("mark").filter((e) => e.name.startsWith("sb:")).map((e) => [e.name.slice(3), Math.round(e.startTime)]));
    const res = performance.getEntriesByType("resource");
    return { domContentLoaded: Math.round(nav.domContentLoadedEventEnd), ...m, menu: Math.round(performance.now()), requests: res.length, kb: Math.round(res.reduce((a, r) => a + (r.transferSize || 0), 0) / 1024) };
  });
  console.log(`${run ? "warm" : "cold"} cpu x${slow}:`, JSON.stringify(t));
  const t0 = Date.now();
  await p.waitForFunction(() => window.__audio?.buffers?.has("__music"), null, { timeout: 60000 }).catch(() => {});
  console.log(`   audio ready ${Date.now() - t0} ms after menu; sounds: ${await p.evaluate(() => window.__audio.buffers.size)}`);
  await ctx.close();
}
await b.close();
