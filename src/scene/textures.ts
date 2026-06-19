import * as THREE from "three";

// ---------------------------------------------------------------------------
// Lightweight procedural canvas textures so the room reads as a real home
// (warm oak parquet + a woven area rug) without shipping any image assets.
// Each texture is built once and cached at module scope.
// ---------------------------------------------------------------------------

let _wood: THREE.Texture | null = null;
let _rug: THREE.Texture | null = null;
let _tile: THREE.Texture | null = null;

/** Classic Habbo-style checkerboard floor tiles with grout lines. */
export function tileFloorTexture(): THREE.Texture {
  if (_tile) return _tile;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;

  // 2x2 tiles → repeats into a checkerboard. Each tile = 128px = 1 world unit.
  const tile = 128;
  const tones = ["#e7d6ad", "#dfcb9d"]; // warm sand checker
  for (let gy = 0; gy < 2; gy++) {
    for (let gx = 0; gx < 2; gx++) {
      ctx.fillStyle = tones[(gx + gy) % 2];
      ctx.fillRect(gx * tile, gy * tile, tile, tile);
      // soft inner highlight (top-left) for a tiny bit of bevel
      ctx.fillStyle = "rgba(255,250,235,0.18)";
      ctx.fillRect(gx * tile + 5, gy * tile + 5, tile - 10, 4);
      ctx.fillRect(gx * tile + 5, gy * tile + 5, 4, tile - 10);
    }
  }

  // grout lines (left + top of every tile → seamless under RepeatWrapping)
  ctx.fillStyle = "#c7b181";
  for (const p of [0, tile]) {
    ctx.fillRect(p, 0, 5, 256); // vertical
    ctx.fillRect(0, p, 256, 5); // horizontal
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 6); // 18 x 12 world units → 18 x 12 tiles
  tex.magFilter = THREE.NearestFilter; // crisp pixel edges
  tex.minFilter = THREE.NearestMipmapNearestFilter;
  tex.anisotropy = 1;
  _tile = tex;
  return tex;
}

/** Warm oak parquet with staggered planks and soft grain. */
export function woodFloorTexture(): THREE.Texture {
  if (_wood) return _wood;
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "#b5895a";
  ctx.fillRect(0, 0, 1024, 1024);

  const tones = ["#bd9264", "#b0824f", "#c49a6b", "#a87a48", "#b88a59", "#c19062"];
  const rows = 9;
  const plankH = 1024 / rows;
  const plankW = 300;

  for (let row = 0; row < rows; row++) {
    const y = row * plankH;
    const offset = (row % 2) * (plankW / 2);
    for (let x = -offset; x < 1024; x += plankW) {
      ctx.fillStyle = tones[(row * 3 + Math.floor(x / plankW) + rows) % tones.length];
      ctx.fillRect(x, y, plankW - 3, plankH - 3);
      // grain
      ctx.strokeStyle = "rgba(86,56,32,0.13)";
      ctx.lineWidth = 1;
      for (let g = 0; g < 5; g++) {
        const gy = y + 5 + g * (plankH / 5) + Math.random() * 3;
        ctx.beginPath();
        ctx.moveTo(x, gy);
        ctx.bezierCurveTo(x + plankW * 0.33, gy + (Math.random() * 5 - 2.5), x + plankW * 0.66, gy + (Math.random() * 5 - 2.5), x + plankW, gy + (Math.random() * 4 - 2));
        ctx.stroke();
      }
      // subtle plank shading
      const grad = ctx.createLinearGradient(x, y, x, y + plankH);
      grad.addColorStop(0, "rgba(255,240,220,0.05)");
      grad.addColorStop(1, "rgba(60,40,24,0.08)");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, plankW - 3, plankH - 3);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 3);
  tex.anisotropy = 8;
  _wood = tex;
  return tex;
}

/** A soft woven area rug with a border and a simple diamond motif. */
export function rugTexture(): THREE.Texture {
  if (_rug) return _rug;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d")!;

  // field
  ctx.fillStyle = "#3f5d63";
  ctx.fillRect(0, 0, 512, 512);

  // inner panel
  ctx.fillStyle = "#34504f";
  ctx.fillRect(40, 40, 432, 432);

  // borders
  ctx.strokeStyle = "#c98a5a";
  ctx.lineWidth = 14;
  ctx.strokeRect(24, 24, 464, 464);
  ctx.strokeStyle = "#dcc3a0";
  ctx.lineWidth = 4;
  ctx.strokeRect(54, 54, 404, 404);

  // central diamond motif
  ctx.translate(256, 256);
  ctx.strokeStyle = "#d9a066";
  for (let i = 0; i < 4; i++) {
    const s = 150 - i * 34;
    ctx.lineWidth = 6 - i;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s, 0);
    ctx.closePath();
    ctx.stroke();
  }
  // little dots
  ctx.fillStyle = "#e7d3b0";
  for (const [dx, dy] of [[0, -150], [150, 0], [0, 150], [-150, 0]] as const) {
    ctx.beginPath();
    ctx.arc(dx, dy, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  _rug = tex;
  return tex;
}
