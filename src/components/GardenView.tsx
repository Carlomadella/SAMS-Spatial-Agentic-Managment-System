import { Suspense, lazy, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Loader2, RefreshCw, Sprout } from "lucide-react";
import { useStore } from "../store/useStore";
import { getGarden, gardenProfileUrl, leaderboard, STAGE_LABEL, type GardenState } from "../lib/garden";

interface Badge { emoji: string; label: string }

function computeBadges(g: GardenState): Badge[] {
  const badges: Badge[] = [];
  if (g.waterings >= 1)   badges.push({ emoji: "🌱", label: "Primo push" });
  if (g.waterings >= 10)  badges.push({ emoji: "💧", label: "Innaffiatore" });
  if (g.waterings >= 50)  badges.push({ emoji: "🌊", label: "Pioggia" });
  if (g.streak >= 7)      badges.push({ emoji: "🔥", label: "7gg streak" });
  if (g.streak >= 30)     badges.push({ emoji: "⚡", label: "30gg streak" });
  if (g.stage === "tree" || g.stage === "blooming") badges.push({ emoji: "🌳", label: "Grande albero" });
  if (g.stage === "blooming") badges.push({ emoji: "🌸", label: "In fiore" });
  if (g.growth >= 75 && g.stage !== "blooming") badges.push({ emoji: "🚀", label: "Quasi lì" });
  return badges;
}

// The garden is a full three.js scene — load it as its own chunk on demand.
const GardenScene = lazy(() => import("../scene/GardenScene").then((m) => ({ default: m.GardenScene })));

function isNetworkError(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return e instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(m);
}

export function GardenView() {
  const open = useStore((s) => s.gardenOpen);
  const setOpen = useStore((s) => s.setGardenOpen);

  const [user, setUser] = useState(() => localStorage.getItem("cg.user") ?? "");
  const [garden, setGarden] = useState<GardenState | null>(null);
  const [board, setBoard] = useState<GardenState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  async function refreshBoard() {
    try {
      setBoard(await leaderboard());
      setOffline(false);
    } catch (e) {
      if (isNetworkError(e)) setOffline(true);
    }
  }

  async function load(name: string) {
    const u = name.trim();
    if (!u) return;
    setUser(u);
    setLoading(true);
    setError(null);
    try {
      const g = await getGarden(u);
      setGarden(g);
      setOffline(false);
      localStorage.setItem("cg.user", u);
      void refreshBoard();
    } catch (e) {
      if (isNetworkError(e)) setOffline(true);
      else setError((e as Error).message);
      setGarden(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    void refreshBoard();
    if (user) void load(user);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* 3D garden fills the screen */}
      <div className="absolute inset-0">
        <Suspense
          fallback={
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#bfe3f2] text-emerald-900/70">
              <Loader2 size={22} className="animate-spin" />
              <span className="text-[12px]">Coltivo il giardino…</span>
            </div>
          }
        >
          <GardenScene garden={garden} board={board} onSelectUser={(u) => void load(u)} />
        </Suspense>
      </div>

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setOpen(false)}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/20 bg-white/85 px-3 py-1.5 text-[13px] font-medium text-emerald-800 shadow-sm backdrop-blur transition-colors hover:bg-white"
        >
          <ArrowLeft size={15} /> Torna alla stanza
        </button>
        <div className="pointer-events-none flex items-center gap-1.5 rounded-lg bg-white/70 px-3 py-1.5 font-semibold text-emerald-800 shadow-sm backdrop-blur">
          <Sprout size={18} className="text-emerald-600" /> Commit Garden
        </div>
      </div>

      {/* control card */}
      <div className="absolute left-4 top-16 w-[290px] max-w-[calc(100vw-2rem)]">
        <div className="rounded-2xl border border-emerald-700/15 bg-white/85 p-4 shadow-[0_24px_60px_-30px_rgba(20,60,40,0.5)] backdrop-blur">
          <p className="mb-2.5 text-[12px] leading-snug text-emerald-900/70">
            Ogni push su GitHub innaffia la tua pianta. Continua a committare e falla crescere fino alla fioritura. 🌸
          </p>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void load(user);
            }}
          >
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="username GitHub…"
              className="min-w-0 flex-1 rounded-lg border border-emerald-700/20 bg-white px-3 py-2 text-[14px] text-[#16301f] outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="shrink-0 rounded-lg bg-emerald-700 px-3 py-2 text-[14px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              {loading ? "…" : "Coltiva"}
            </button>
          </form>

          {offline && (
            <div className="mt-2.5 rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              Il runtime SAMS non è in esecuzione. Avvialo con
              <code className="mx-1 rounded bg-amber-100 px-1">npm start</code>.
            </div>
          )}
          {error && !offline && (
            <div className="mt-2.5 rounded-lg border border-rose-400/40 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">⚠️ {error}</div>
          )}

          {garden && (
            <>
              <div className="mt-3 flex items-baseline justify-between">
                <h2 className="text-[15px] font-bold text-[#16301f]">{garden.user}</h2>
                <span className="text-[13px] font-semibold text-emerald-600">{STAGE_LABEL[garden.stage]}</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-700 transition-all duration-700"
                  style={{ width: `${garden.growth}%` }}
                />
              </div>
              <div className="mt-3 flex justify-between">
                {[
                  [garden.waterings, "innaffiature"],
                  [garden.streak, "streak"],
                  [`${garden.growth}%`, "crescita"],
                ].map(([v, l]) => (
                  <div key={l} className="text-center">
                    <div className="text-[18px] font-bold text-[#16301f]">{v}</div>
                    <div className="text-[9px] uppercase tracking-wide text-emerald-900/50">{l}</div>
                  </div>
                ))}
              </div>
              <p className={`mt-2 text-[12.5px] ${garden.thirsty ? "text-[#c2724a]" : "text-emerald-700"}`}>
                {garden.thirsty ? "Assetata — fai un push! 💧" : "Innaffiata di recente 🌿"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => void load(garden.user)}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-emerald-800"
                >
                  <RefreshCw size={13} /> Aggiorna
                </button>
                <a
                  href={gardenProfileUrl(garden.user)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-[12.5px] font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  <ExternalLink size={13} /> Pagina
                </a>
              </div>
              {(() => {
                const badges = computeBadges(garden);
                if (badges.length === 0) return null;
                return (
                  <div className="mt-3">
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/50">Traguardi</div>
                    <div className="flex flex-wrap gap-1.5">
                      {badges.map((b) => (
                        <span key={b.label} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                          <span>{b.emoji}</span>
                          <span>{b.label}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>

        {board.length > 0 && (
          <p className="mt-2 px-1 text-[11px] text-emerald-900/60">
            🌳 I giardini più rigogliosi crescono sul prato — clicca un nome per visitarlo.
          </p>
        )}
      </div>
    </div>
  );
}
