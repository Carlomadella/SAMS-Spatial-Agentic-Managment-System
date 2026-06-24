import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, RefreshCw, Sprout } from "lucide-react";
import { useStore } from "../store/useStore";
import { GardenPlant } from "./GardenPlant";
import { getGarden, gardenProfileUrl, leaderboard, STAGE_LABEL, type GardenState } from "../lib/garden";

const STAGE_EMOJI: Record<string, string> = {
  seed: "🌰",
  sprout: "🌱",
  sapling: "🌿",
  bush: "🪴",
  tree: "🌳",
  blooming: "🌸",
};

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
    <div
      className="fixed inset-0 z-[60] overflow-y-auto"
      style={{ background: "radial-gradient(1200px 600px at 50% -10%, #d8f1e1, #eef8f1 55%, #e3f1e8)" }}
    >
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-5 py-6 text-[#16301f]">
        {/* top bar */}
        <div className="flex w-full items-center justify-between">
          <button
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/20 bg-white/70 px-3 py-1.5 text-[13px] font-medium text-emerald-800 transition-colors hover:bg-white"
          >
            <ArrowLeft size={15} /> Torna alla stanza
          </button>
          <div className="flex items-center gap-1.5 font-semibold">
            <Sprout size={18} className="text-emerald-600" /> Commit Garden
          </div>
        </div>

        <p className="text-center text-[13px] text-emerald-900/70">
          Ogni push su GitHub innaffia la tua pianta. Continua a committare e falla crescere.
        </p>

        {/* search */}
        <form
          className="flex w-full max-w-sm gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void load(user);
          }}
        >
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="username GitHub…"
            className="flex-1 rounded-lg border border-emerald-700/20 bg-white px-3 py-2 text-[14px] text-[#16301f] outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-[14px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {loading ? "Carico…" : "Coltiva"}
          </button>
        </form>

        {offline && (
          <div className="w-full max-w-sm rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-center text-[12.5px] text-amber-800">
            Commit Garden non è in esecuzione. Avvialo:
            <code className="mx-1 rounded bg-amber-100 px-1">cd commit-garden &amp;&amp; npm start</code>
            poi riprova.
          </div>
        )}
        {error && !offline && (
          <div className="w-full max-w-sm rounded-lg border border-rose-400/40 bg-rose-50 px-3 py-2 text-center text-[12.5px] text-rose-700">
            ⚠️ {error}
          </div>
        )}

        {garden && (
          <section className="w-full max-w-sm rounded-2xl border border-emerald-700/15 bg-white p-6 text-center shadow-[0_24px_60px_-30px_rgba(20,60,40,0.45)]">
            <div className="flex justify-center">
              <GardenPlant stage={garden.stage} />
            </div>
            <h2 className="mt-2 text-[18px] font-semibold">
              {garden.user} · <span className="text-emerald-600">{STAGE_LABEL[garden.stage]}</span>
            </h2>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-emerald-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-700 transition-all duration-700"
                style={{ width: `${garden.growth}%` }}
              />
            </div>
            <div className="mt-4 flex justify-center gap-6">
              {[
                [garden.waterings, "innaffiature"],
                [garden.streak, "streak"],
                [`${garden.growth}%`, "crescita"],
              ].map(([v, l]) => (
                <div key={l}>
                  <div className="text-[22px] font-bold">{v}</div>
                  <div className="text-[10px] uppercase tracking-wide text-emerald-900/50">{l}</div>
                </div>
              ))}
            </div>
            <p className={`mt-2 text-[13px] ${garden.thirsty ? "text-[#c2724a]" : "text-emerald-700"}`}>
              {garden.thirsty ? "Assetata — fai un push! 💧" : "Innaffiata di recente 🌿"}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => load(garden.user)}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-800"
              >
                <RefreshCw size={13} /> Aggiorna da GitHub
              </button>
              <a
                href={gardenProfileUrl(garden.user)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-[13px] font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                <ExternalLink size={13} /> Pagina pubblica
              </a>
            </div>
          </section>
        )}

        {board.length > 0 && (
          <section className="w-full max-w-sm">
            <h3 className="mb-1.5 text-[13px] font-medium text-emerald-900/60">Giardini più rigogliosi</h3>
            <ol className="flex flex-col gap-1">
              {board.map((g) => (
                <li
                  key={g.user}
                  className="flex items-center gap-2.5 rounded-lg border border-emerald-700/10 bg-white px-3 py-1.5 text-[14px]"
                >
                  <span>{STAGE_EMOJI[g.stage] ?? "🌱"}</span>
                  <button className="flex-1 text-left hover:underline" onClick={() => load(g.user)}>
                    {g.user}
                  </button>
                  <span className="text-[12px] text-emerald-900/50">{g.waterings}💧</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}
