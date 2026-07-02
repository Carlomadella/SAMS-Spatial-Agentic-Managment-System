import type { GardenState, Stage } from "./garden";
import { STAGE_LABEL } from "./garden";

// Immagine OG condivisibile — trasforma lo stato del Commit Garden (o un
// riepilogo del workspace) in una "card" pronta da disegnare su <canvas> ed
// esportare come PNG per i social. Il modello della card (`buildGardenOgCard`,
// `buildWorkspaceOgCard`) è puro e testabile; `renderOgCard` disegna, e
// `downloadOgCard` gestisce il canvas del browser + il download.

/** Dimensioni OG standard (Open Graph / Twitter card). */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export interface OgStat {
  value: string;
  label: string;
}

export interface OgCard {
  width: number;
  height: number;
  /** Riga grande in alto (es. nome utente o "SAMS Workspace"). */
  title: string;
  /** Sottotitolo/kicker sopra il titolo. */
  kicker: string;
  /** Etichetta pillola in alto a destra (es. stadio della pianta). */
  badge: string;
  /** Emoji simbolica grande. */
  emoji: string;
  /** Fino a 3 statistiche mostrate in fondo. */
  stats: OgStat[];
  /** Colore d'accento (hex). */
  accent: string;
  /** Riga a piè di pagina. */
  footer: string;
}

const STAGE_EMOJI: Record<Stage, string> = {
  seed: "🌰",
  sprout: "🌱",
  sapling: "🌿",
  bush: "🪴",
  tree: "🌳",
  blooming: "🌸",
};

/** Verde più intenso man mano che la pianta cresce. */
const STAGE_ACCENT: Record<Stage, string> = {
  seed: "#a16207",
  sprout: "#65a30d",
  sapling: "#4d7c0f",
  bush: "#16a34a",
  tree: "#15803d",
  blooming: "#db2777",
};

/** Costruisce la card OG per un giardino. */
export function buildGardenOgCard(g: GardenState): OgCard {
  return {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    kicker: "COMMIT GARDEN",
    title: g.user,
    badge: STAGE_LABEL[g.stage],
    emoji: STAGE_EMOJI[g.stage],
    stats: [
      { value: String(g.waterings), label: "innaffiature" },
      { value: String(g.streak), label: "streak" },
      { value: `${Math.round(g.growth)}%`, label: "crescita" },
    ],
    accent: STAGE_ACCENT[g.stage],
    footer: g.thirsty ? "Assetata — fai un push! 💧" : "Coltivato su SAMS 🌿",
  };
}

export interface WorkspaceSummary {
  agents: number;
  tasksCompleted: number;
  prsOpened: number;
  tokensUsed: number;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** Costruisce la card OG per un riepilogo del workspace. */
export function buildWorkspaceOgCard(s: WorkspaceSummary): OgCard {
  return {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    kicker: "SAMS WORKSPACE",
    title: "Il mio ufficio di agenti",
    badge: `${s.agents} agenti`,
    emoji: "🏢",
    stats: [
      { value: String(s.tasksCompleted), label: "task completati" },
      { value: String(s.prsOpened), label: "PR aperte" },
      { value: fmtTokens(s.tokensUsed), label: "token" },
    ],
    accent: "#6366f1",
    footer: "Spatial Agentic Management System",
  };
}

/** Schiarisce/scurisce un hex di una quota (-1..1) per i gradienti. */
export function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp((num >> 16) + 255 * amount);
  const g = clamp(((num >> 8) & 0xff) + 255 * amount);
  const b = clamp((num & 0xff) + 255 * amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Disegna la card su un contesto 2D (dimensioni prese dalla card). */
export function renderOgCard(ctx: CanvasRenderingContext2D, card: OgCard): void {
  const { width: W, height: H, accent } = card;

  // sfondo scuro con vignetta d'accento
  ctx.fillStyle = "#0f0f1a";
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, shade(accent, -0.25));
  grad.addColorStop(1, "#0f0f1a");
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  // barra d'accento a sinistra
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 14, H);

  const padX = 80;

  // kicker
  ctx.fillStyle = accent;
  ctx.font = "600 30px -apple-system, 'Segoe UI', sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(card.kicker, padX, 130);

  // titolo
  ctx.fillStyle = "#f5f5fa";
  ctx.font = "800 84px -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText(truncateToWidth(ctx, card.title, W - padX - 260), padX, 230);

  // emoji grande a destra
  ctx.font = "200px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(card.emoji, W - 70, 250);
  ctx.textAlign = "left";

  // badge pillola in alto a destra
  ctx.font = "600 28px -apple-system, 'Segoe UI', sans-serif";
  const bw = ctx.measureText(card.badge).width + 44;
  const bx = W - 70 - bw;
  ctx.fillStyle = accent;
  roundRect(ctx, bx, 70, bw, 52, 26);
  ctx.fill();
  ctx.fillStyle = "#0f0f1a";
  ctx.fillText(card.badge, bx + 22, 105);

  // statistiche in fondo
  const statY = H - 150;
  const colW = (W - padX * 2) / Math.max(1, card.stats.length);
  card.stats.forEach((st, i) => {
    const x = padX + colW * i;
    ctx.fillStyle = "#f5f5fa";
    ctx.font = "800 66px -apple-system, 'Segoe UI', sans-serif";
    ctx.fillText(st.value, x, statY);
    ctx.fillStyle = "#8a8aa0";
    ctx.font = "500 26px -apple-system, 'Segoe UI', sans-serif";
    ctx.fillText(st.label.toUpperCase(), x, statY + 40);
  });

  // footer
  ctx.fillStyle = "#a0a0b8";
  ctx.font = "500 26px -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText(card.footer, padX, H - 45);
}

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Nome file suggerito per il download, "slugificato". */
export function ogFileName(card: OgCard): string {
  const slug = card.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "sams";
  return `sams-${slug}.png`;
}

/**
 * Renderizza la card su un canvas fuori schermo e scarica il PNG.
 * Solo lato browser (usa document/canvas). Ritorna il Blob prodotto.
 */
export async function downloadOgCard(card: OgCard): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = card.width;
  canvas.height = card.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  renderOgCard(ctx, card);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = ogFileName(card);
  a.click();
  URL.revokeObjectURL(url);
  return blob;
}
