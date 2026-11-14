// Poki upload: zips dist/ (index.html at the zip root) to release/spellbound-arena-v<version>.zip.
// Run through `npm run release`, which builds first. No dependencies: a plain zip writer on node:zlib.
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { deflateRawSync, crc32 } from "node:zlib";

const root = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const dist = join(root, "dist");
const { name, version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir).sort()) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
})(dist);
if (!files.some((f) => relative(dist, f) === "index.html")) throw new Error("dist/index.html missing: run the build first");

const local = [], central = [];
let offset = 0;
const now = new Date();
const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
for (const f of files) {
  const data = readFileSync(f);
  const nameBuf = Buffer.from(relative(dist, f).split(sep).join("/"), "utf8");
  const packed = deflateRawSync(data, { level: 9 });
  const store = packed.length >= data.length; // PNGs etc. don't shrink: store them
  const body = store ? data : packed;
  const crc = crc32(data);
  const h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(store ? 0 : 8, 8);
  h.writeUInt16LE(dosTime, 10); h.writeUInt16LE(dosDate, 12); h.writeUInt32LE(crc, 14);
  h.writeUInt32LE(body.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nameBuf.length, 26); h.writeUInt16LE(0, 28);
  local.push(h, nameBuf, body);
  const c = Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(store ? 0 : 8, 10);
  c.writeUInt16LE(dosTime, 12); c.writeUInt16LE(dosDate, 14); c.writeUInt32LE(crc, 16);
  c.writeUInt32LE(body.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nameBuf.length, 28);
  c.writeUInt32LE(offset, 42);
  central.push(c, nameBuf);
  offset += h.length + nameBuf.length + body.length;
}
const cd = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
mkdirSync(join(root, "release"), { recursive: true });
const out = join(root, "release", `${name}-v${version}.zip`);
writeFileSync(out, Buffer.concat([...local, cd, end]));
console.log(`${relative(root, out)}: ${files.length} files, ${(statSync(out).size / 1024).toFixed(0)} KB`);
