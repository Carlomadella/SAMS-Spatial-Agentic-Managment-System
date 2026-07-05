import { Clock, Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  createRoutine,
  deleteRoutine as deleteRoutineApi,
  fetchRoutines,
  toggleRoutine,
  type RoutineDraft,
  type RoutineRemote,
} from "../lib/backend";
import { useStore } from "../store/useStore";
import { cn } from "../lib/utils";

/**
 * Editor dei "Trigger temporali / routine": task ricorrenti guidati dal runtime.
 * Le routine vivono lato server (persistite in SQLite); qui le si crea/elenca/
 * rimuove via API. Vive nel pannello Live Sim.
 */
export function Routines() {
  const backendOnline = useStore((s) => s.backendOnline);
  const [routines, setRoutines] = useState<RoutineRemote[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [branch, setBranch] = useState("");
  const [kind, setKind] = useState<"interval" | "daily">("daily");
  const [intervalMin, setIntervalMin] = useState(60);
  const [atHour, setAtHour] = useState(9);
  const [atMin, setAtMin] = useState(0);

  const load = useCallback(() => {
    void fetchRoutines().then(setRoutines);
  }, []);

  useEffect(() => {
    if (backendOnline) load();
    else setRoutines([]);
  }, [backendOnline, load]);

  const canAdd = name.trim() !== "" && title.trim() !== "";

  async function submit() {
    if (!canAdd) return;
    const draft: RoutineDraft = { name: name.trim(), title: title.trim(), branch: branch.trim(), kind };
    if (kind === "interval") draft.intervalMin = intervalMin;
    else { draft.atHour = atHour; draft.atMin = atMin; }
    try {
      setError(null);
      await createRoutine(draft);
      setName(""); setTitle(""); setBranch("");
      setAdding(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onToggle(r: RoutineRemote) {
    await toggleRoutine(r.id, !r.enabled);
    load();
  }

  async function onDelete(id: string) {
    await deleteRoutineApi(id);
    load();
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
          <Clock size={12} /> Trigger temporali
          {routines.length > 0 && <span className="text-mut">· {routines.length}</span>}
        </span>
        <button
          onClick={() => setAdding((v) => !v)}
          disabled={!backendOnline}
          className="btn h-6 gap-1 px-1.5 text-[10px]"
          title="Aggiungi routine"
        >
          <Plus size={11} /> Routine
        </button>
      </div>
      <p className="mt-0.5 text-[10px] text-mut">
        Task ricorrenti: a ogni scadenza vengono assegnati a un agente libero.
      </p>

      {!backendOnline && (
        <p className="mt-2 text-[10px] text-amber-300">Runtime offline — le routine sono gestite dal server.</p>
      )}

      {/* Elenco routine */}
      {routines.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {routines.map((r) => (
            <li
              key={r.id}
              className={cn(
                "flex items-start gap-2 rounded-md border border-line px-2 py-1.5",
                r.enabled ? "bg-white/[0.02]" : "opacity-50",
              )}
            >
              <input
                type="checkbox"
                checked={r.enabled}
                onChange={() => void onToggle(r)}
                className="mt-0.5 accent-amber-500"
                aria-label={r.enabled ? "Disattiva routine" : "Attiva routine"}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] text-slate-200">
                  {r.name} <span className="text-mut">· {r.schedule}</span>
                </div>
                <div className="truncate text-[10px] text-mut">↳ {r.title}</div>
              </div>
              <button
                onClick={() => void onDelete(r.id)}
                className="mt-0.5 shrink-0 text-mut transition-colors hover:text-rose-400"
                title="Rimuovi routine"
                aria-label="Rimuovi routine"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Form */}
      {adding && (
        <div className="mt-2 flex flex-col gap-1.5 rounded-md border border-line bg-white/[0.02] p-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome, es. Riepilogo PR"
            className="settings-input w-full text-[11px]"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task da assegnare, es. Riepiloga le PR aperte su Notion"
            className="settings-input w-full text-[11px]"
          />
          <div className="flex gap-1.5">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as "interval" | "daily")}
              className="settings-input text-[11px]"
            >
              <option value="daily">Ogni giorno</option>
              <option value="interval">A intervalli</option>
            </select>
            {kind === "daily" ? (
              <div className="flex items-center gap-1 text-[11px] text-mut">
                alle
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={atHour}
                  onChange={(e) => setAtHour(Number(e.target.value))}
                  className="settings-input w-12 text-[11px]"
                  aria-label="Ora"
                />
                :
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={atMin}
                  onChange={(e) => setAtMin(Number(e.target.value))}
                  className="settings-input w-12 text-[11px]"
                  aria-label="Minuti"
                />
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[11px] text-mut">
                ogni
                <input
                  type="number"
                  min={1}
                  value={intervalMin}
                  onChange={(e) => setIntervalMin(Number(e.target.value))}
                  className="settings-input w-16 text-[11px]"
                  aria-label="Minuti fra le esecuzioni"
                />
                min
              </div>
            )}
          </div>
          <input
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="Branch (facoltativo, default main)"
            className="settings-input w-full text-[11px]"
          />
          {error && <p className="text-[10px] text-rose-400">{error}</p>}
          <div className="flex justify-end gap-1.5">
            <button onClick={() => setAdding(false)} className="btn h-6 px-2 text-[10px]">
              Annulla
            </button>
            <button
              onClick={() => void submit()}
              disabled={!canAdd}
              className="btn btn-primary h-6 px-2 text-[10px]"
            >
              Aggiungi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
