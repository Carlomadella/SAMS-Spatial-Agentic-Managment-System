import { useEffect, useState } from "react";
import { Plant } from "./Plant";
import { getGarden, leaderboard, waterGarden, STAGE_LABEL, type GardenState } from "./api";

const STAGE_EMOJI: Record<string, string> = {
  seed: "🌰",
  sprout: "🌱",
  sapling: "🌿",
  bush: "🪴",
  tree: "🌳",
  blooming: "🌸",
};

export default function App() {
  const [user, setUser] = useState(() => localStorage.getItem("cg.user") ?? "");
  const [garden, setGarden] = useState<GardenState | null>(null);
  const [board, setBoard] = useState<GardenState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshBoard() {
    try {
      setBoard(await leaderboard());
    } catch {
      /* ignore */
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
      localStorage.setItem("cg.user", u);
      void refreshBoard();
    } catch (e) {
      setError((e as Error).message);
      setGarden(null);
    } finally {
      setLoading(false);
    }
  }

  async function onWater() {
    if (!garden) return;
    try {
      setGarden(await waterGarden(garden.user));
      void refreshBoard();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void refreshBoard();
    if (user) void load(user);
    // run once on mount
  }, []);

  return (
    <div className="page">
      <header className="head">
        <h1>🌱 Commit Garden</h1>
        <p>Ogni push su GitHub innaffia la tua pianta. Continua a committare e falla crescere.</p>
      </header>

      <form
        className="search"
        onSubmit={(e) => {
          e.preventDefault();
          void load(user);
        }}
      >
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="username GitHub…"
          aria-label="username GitHub"
        />
        <button type="submit" disabled={loading}>
          {loading ? "Carico…" : "Coltiva"}
        </button>
      </form>

      {error && <div className="error">⚠️ {error}</div>}

      {garden && (
        <section className="card">
          <Plant stage={garden.stage} />
          <h2>
            {garden.user} · <span className="stage">{STAGE_LABEL[garden.stage]}</span>
          </h2>
          <div className="bar">
            <div className="fill" style={{ width: `${garden.growth}%` }} />
          </div>
          <div className="stats">
            <div>
              <b>{garden.waterings}</b>
              <span>innaffiature</span>
            </div>
            <div>
              <b>{garden.streak}</b>
              <span>streak</span>
            </div>
            <div>
              <b>{garden.growth}%</b>
              <span>crescita</span>
            </div>
          </div>
          <p className={garden.thirsty ? "thirsty" : "fresh"}>
            {garden.thirsty ? "Assetata — fai un push! 💧" : "Innaffiata di recente 🌿"}
          </p>
          {garden.note && <p className="note">nota: {garden.note}</p>}
          <div className="actions">
            <button onClick={onWater}>💧 Innaffia</button>
            <button onClick={() => load(garden.user)}>↻ Aggiorna da GitHub</button>
            <a href={`/u/${encodeURIComponent(garden.user)}`} target="_blank" rel="noreferrer">
              🔗 Pagina pubblica
            </a>
          </div>
        </section>
      )}

      {board.length > 0 && (
        <section className="board">
          <h3>Giardini più rigogliosi</h3>
          <ol>
            {board.map((g) => (
              <li key={g.user}>
                <span className="emoji">{STAGE_EMOJI[g.stage] ?? "🌱"}</span>
                <button className="link" onClick={() => load(g.user)}>
                  {g.user}
                </button>
                <span className="count">{g.waterings}💧</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer>Parte del workspace SAMS · open source</footer>
    </div>
  );
}
