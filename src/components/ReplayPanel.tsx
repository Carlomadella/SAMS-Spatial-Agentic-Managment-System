import { useEffect, useMemo, useRef, useState } from "react";
import { Clapperboard, Pause, Play, RotateCcw } from "lucide-react";
import { useStore } from "../store/useStore";
import { agentReplays, frameIndexAt, formatOffset } from "../lib/replay";
import { AGENT_HEX } from "../types";

/** Velocità di scorrimento della clip (tempo reale ÷ FACTOR). */
const SPEED = 400; // 400× → una clip di ~7 min scorre in ~1s
const TICK_MS = 100;

/**
 * Replay cinematografico — ricostruisce ciò che ha fatto un agente come una
 * timeline scrubbabile (`agentReplays`, puro): scegli l'agente, trascina il
 * cursore o premi play per rivedere la sequenza di azioni.
 */
export function ReplayPanel() {
  const events = useStore((s) => s.events);
  const replays = useMemo(() => agentReplays(events), [events]);

  const [agentId, setAgentId] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0); // ms dall'inizio
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  // La replay selezionata: quella scelta, o la più recente disponibile.
  const replay = useMemo(
    () => replays.find((r) => r.agentId === agentId) ?? replays[0] ?? null,
    [replays, agentId],
  );
  const duration = replay?.durationMs ?? 0;
  const idx = replay ? frameIndexAt(replay.frames, cursor) : -1;

  // Quando cambia clip riparto dall'inizio.
  useEffect(() => {
    setCursor(0);
    setPlaying(false);
  }, [replay?.agentId]);

  // Motore di riproduzione: avanza il cursore e si ferma a fine clip.
  useEffect(() => {
    if (!playing || !replay) return;
    timer.current = window.setInterval(() => {
      setCursor((c) => {
        const next = c + TICK_MS * SPEED;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
    }, TICK_MS);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [playing, replay, duration]);

  if (!replay) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-[12px] text-mut">
        Nessuna attività da rivedere. Assegna un task a un agente: le sue azioni
        compariranno qui come una clip navigabile.
      </div>
    );
  }

  const accent = replay.color ? AGENT_HEX[replay.color] : "#8a8aa0";
  const current = idx >= 0 ? replay.frames[idx] : null;

  function togglePlay() {
    if (cursor >= duration) setCursor(0); // replay da capo se a fine
    setPlaying((p) => !p);
  }

  return (
    <div className="flex h-full flex-col">
      {/* header + scelta agente */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line/40 px-3 py-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-mut">
          <Clapperboard size={12} /> Replay
        </div>
        <select
          value={replay.agentId ?? ""}
          onChange={(e) => setAgentId(e.target.value)}
          className="rounded border border-line bg-ink-800 px-1.5 py-0.5 text-[11px] text-slate-200 outline-none"
        >
          {replays.map((r) => (
            <option key={r.agentId} value={r.agentId ?? ""}>
              {r.agentName} · {r.frames.length} azioni
            </option>
          ))}
        </select>
      </div>

      {/* transport */}
      <div className="flex shrink-0 items-center gap-2 border-b border-line/40 px-3 py-2">
        <button
          onClick={togglePlay}
          className="flex h-7 w-7 items-center justify-center rounded-full text-ink-900"
          style={{ background: accent }}
          title={playing ? "Pausa" : "Riproduci"}
        >
          {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>
        <button
          onClick={() => { setCursor(0); setPlaying(false); }}
          className="flex h-6 w-6 items-center justify-center rounded text-mut hover:bg-ink-700 hover:text-slate-300"
          title="Riavvolgi"
        >
          <RotateCcw size={13} />
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(1, duration)}
          value={Math.min(cursor, duration)}
          onChange={(e) => { setPlaying(false); setCursor(Number(e.target.value)); }}
          className="min-w-0 flex-1 accent-current"
          style={{ color: accent }}
        />
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-mut">
          {formatOffset(Math.min(cursor, duration))} / {formatOffset(duration)}
        </span>
      </div>

      {/* fotogramma corrente */}
      <div className="shrink-0 border-b border-line/40 px-3 py-2">
        {current ? (
          <div className="flex items-start gap-2">
            <span className="text-lg leading-none">{current.emoji}</span>
            <div className="min-w-0">
              <p className="text-[12.5px] leading-snug text-slate-200">{current.message}</p>
              <p className="mt-0.5 text-[10px] text-mut">
                {formatOffset(current.tMs)} · fotogramma {idx + 1}/{replay.frames.length}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-mut">▶ Premi play per rivedere la sequenza.</p>
        )}
      </div>

      {/* elenco fotogrammi */}
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {replay.frames.map((f, i) => {
          const active = i === idx;
          const seen = i <= idx;
          return (
            <button
              key={f.id}
              onClick={() => { setPlaying(false); setCursor(f.tMs); }}
              className={`flex w-full items-center gap-2 px-3 py-1 text-left transition-colors ${
                active ? "bg-ink-700/60" : "hover:bg-ink-700/30"
              }`}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: seen ? accent : "#3a3a4a" }}
              />
              <span className="w-8 shrink-0 font-mono text-[10px] tabular-nums text-mut">{formatOffset(f.tMs)}</span>
              <span className="select-none text-[12px]">{f.emoji}</span>
              <span className={`min-w-0 flex-1 truncate text-[11.5px] ${active ? "text-slate-100" : seen ? "text-slate-300" : "text-mut"}`}>
                {f.message}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
