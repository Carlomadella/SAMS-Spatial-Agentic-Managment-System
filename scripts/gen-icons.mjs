// Generates the PWA raster icons from the same little-robot geometry as
// public/favicon.svg — no external rasterizer needed. Shapes are sampled in a
// 32-unit logical grid (mirroring the SVG) with 4× supersampling for smooth
// edges, then written as 8-bit RGBA PNGs via Node's built-in zlib.
//
//   node scripts/gen-icons.mjs
//
// Outputs into public/: icon-192, icon-512 (rounded, transparent corners),
// maskable-192, maskable-512 (full-bleed, safe-zone friendly) and
// apple-touch-icon (180, opaque) for iOS home-screen.

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const lerp = (a, b, t) => a + (b - a) * t;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const C1 = hex("#4f8cff"); // gradient start
const C2 = hex("#4f46e5"); // gradient end
const FACE = [255, 255, 255];
const EYE = hex("#1b2230");

// Signed-distance test for a rounded rectangle (≤0 ⇒ inside).
function inRoundRect(px, py, x, y, w, h, r) {
  const qx = Math.abs(px - (x + w / 2)) - w / 2 + r;
  const qy = Math.abs(py - (y + h / 2)) - h / 2 + r;
  const sdf = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  return sdf <= 0;
}
const inCircle = (px, py, cx, cy, r) => (px - cx) ** 2 + (py - cy) ** 2 <= r * r;

// Colour of a single point in the 32-unit grid. Painter's order mirrors the SVG.
function sample(px, py, maskable) {
  let col = null;
  const inBg = maskable ? px >= 0 && px <= 32 && py >= 0 && py <= 32 : inRoundRect(px, py, 2, 2, 28, 28, 8);
  if (inBg) {
    const t = Math.min(1, Math.max(0, ((px - 2) / 28 + (py - 2) / 28) / 2));
    col = [lerp(C1[0], C2[0], t), lerp(C1[1], C2[1], t), lerp(C1[2], C2[2], t)];
  }
  if (inRoundRect(px, py, 9, 11, 14, 11, 3.5)) col = FACE;
  if (inCircle(px, py, 13, 16.5, 1.7) || inCircle(px, py, 19, 16.5, 1.7)) col = EYE;
  if (inRoundRect(px, py, 15, 6.5, 2, 4, 1)) col = FACE;
  if (inCircle(px, py, 16, 6, 1.6)) col = FACE;
  return col; // null ⇒ transparent
}

function render(size, maskable) {
  const ss = 4; // supersampling factor
  const buf = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let sr = 0, sg = 0, sb = 0, sa = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const gx = ((i + (sx + 0.5) / ss) / size) * 32;
          const gy = ((j + (sy + 0.5) / ss) / size) * 32;
          const c = sample(gx, gy, maskable);
          if (c) { sr += c[0]; sg += c[1]; sb += c[2]; sa += 1; }
        }
      }
      const n = ss * ss;
      const o = (j * size + i) * 4;
      const a = sa / n;
      if (a > 0) {
        buf[o] = Math.round(sr / sa);
        buf[o + 1] = Math.round(sg / sa);
        buf[o + 2] = Math.round(sb / sa);
        buf[o + 3] = Math.round(a * 255);
      }
    }
  }
  return buf;
}

// --- minimal PNG (8-bit RGBA) encoder --------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(size, rgba) {
  const rowLen = size * 4;
  const raw = Buffer.alloc((rowLen + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (rowLen + 1)] = 0; // filter: none
    rgba.copy(raw, y * (rowLen + 1) + 1, y * rowLen, y * rowLen + rowLen);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

function write(name, size, maskable) {
  writeFileSync(join(OUT, name), encodePng(size, render(size, maskable)));
  console.log("wrote", name, `(${size}×${size}${maskable ? ", maskable" : ""})`);
}

write("icon-192.png", 192, false);
write("icon-512.png", 512, false);
write("maskable-192.png", 192, true);
write("maskable-512.png", 512, true);
write("apple-touch-icon.png", 180, true);
