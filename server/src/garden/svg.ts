import { STAGE_LABEL, type GardenState, type Stage } from "./model";

const GREEN = "#3aa657";
const SOIL = "#6b4f3a";
const POT = "#c2724a";

export function plantSvg(stage: Stage, size = 240): string {
  const parts: string[] = [];
  parts.push(`<rect width="240" height="240" rx="16" fill="#eaf6ef"/>`);
  parts.push(`<path d="M86 196 L154 196 L146 224 L94 224 Z" fill="${POT}"/>`);
  parts.push(`<ellipse cx="120" cy="196" rx="34" ry="8" fill="${SOIL}"/>`);
  const canopy = (cx: number, cy: number, r: number) =>
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${GREEN}"/>`);

  switch (stage) {
    case "seed":
      parts.push(`<ellipse cx="120" cy="190" rx="9" ry="6" fill="${SOIL}"/><circle cx="120" cy="188" r="3" fill="#caa46a"/>`);
      break;
    case "sprout":
      parts.push(`<rect x="117" y="170" width="6" height="26" rx="3" fill="#2c7d43"/>`);
      canopy(110, 172, 9);
      canopy(130, 172, 9);
      break;
    case "sapling":
      parts.push(`<rect x="117" y="142" width="6" height="54" rx="3" fill="#2c7d43"/>`);
      canopy(106, 158, 13);
      canopy(134, 150, 13);
      canopy(120, 142, 12);
      break;
    case "bush":
      parts.push(`<rect x="117" y="156" width="6" height="40" rx="3" fill="#2c7d43"/>`);
      canopy(120, 150, 30);
      canopy(98, 162, 20);
      canopy(142, 162, 20);
      break;
    case "tree":
      parts.push(`<rect x="114" y="120" width="12" height="78" rx="5" fill="#7a5230"/>`);
      canopy(120, 110, 44);
      canopy(90, 128, 26);
      canopy(150, 128, 26);
      break;
    case "blooming":
      parts.push(`<rect x="114" y="120" width="12" height="78" rx="5" fill="#7a5230"/>`);
      canopy(120, 108, 46);
      canopy(88, 126, 28);
      canopy(152, 126, 28);
      for (const [fx, fy] of [[120, 92], [96, 116], [146, 116], [120, 130], [108, 104], [134, 104]])
        parts.push(`<circle cx="${fx}" cy="${fy}" r="6" fill="#ff7eb6"/><circle cx="${fx}" cy="${fy}" r="2.4" fill="#ffd34d"/>`);
      break;
  }
  return `<svg viewBox="0 0 240 240" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`;
}

export function profileHtml(state: GardenState, origin: string): string {
  const title = `${state.user}'s Commit Garden — ${STAGE_LABEL[state.stage]}`;
  const desc = `${state.user} ha innaffiato il giardino ${state.waterings} volte (streak ${state.streak} giorni). Pianta: ${STAGE_LABEL[state.stage]}.`;
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<meta name="description" content="${desc}"/>
<meta property="og:title" content="${title}"/>
<meta property="og:description" content="${desc}"/>
<meta property="og:type" content="profile"/>
<link rel="canonical" href="${origin}/u/${encodeURIComponent(state.user)}"/>
<style>
  body{margin:0;font-family:Inter,system-ui,sans-serif;background:#f3faf5;color:#16301f;display:flex;min-height:100vh;align-items:center;justify-content:center}
  .card{background:#fff;border:1px solid #d7e6dc;border-radius:20px;padding:28px 32px;box-shadow:0 18px 50px -24px rgba(20,60,40,.4);text-align:center;max-width:360px}
  h1{font-size:20px;margin:8px 0 2px}.stage{color:#3aa657;font-weight:600}
  .stats{display:flex;gap:18px;justify-content:center;margin-top:14px}
  .stat b{display:block;font-size:22px}.stat span{font-size:11px;color:#5b6b61;text-transform:uppercase;letter-spacing:.04em}
</style>
</head>
<body>
  <main class="card">
    ${plantSvg(state.stage, 260)}
    <h1>${state.user}</h1>
    <div class="stage">${STAGE_LABEL[state.stage]}</div>
    <div class="stats">
      <div class="stat"><b>${state.waterings}</b><span>innaffiature</span></div>
      <div class="stat"><b>${state.streak}</b><span>streak</span></div>
      <div class="stat"><b>${state.growth}%</b><span>crescita</span></div>
    </div>
    <p style="margin-top:18px;font-size:12px;color:#5b6b61">🌱 Commit Garden — parte di SAMS</p>
  </main>
</body>
</html>`;
}
