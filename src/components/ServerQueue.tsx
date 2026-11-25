import { useEffect, useState } from "react";
import { ListOrdered, Play, X as XIcon } from "lucide-react";
import { useStore } from "../store/useStore";
import { canAssign } from "../lib/roleUi";
import { cn } from "../lib/utils";
import { queueOf, refreshQueue, removeQueuedRemote, startAnywayRemote, useServerQueue } from "../lib/serverQueue";
import { fetchTasks, statusLabel, useTaskSheet, type TaskRecord } from "../lib/tasks";

/** La coda dell'agente sul server (idea 4): attese, avvisi, «Avvia comunque» e rimuovi. */
export function ServerQueueList({ agentId, spaced }: { agentId: string; spaced: boolean }) {
  const list = useServerQueue((s) => s.list);
  const loaded = useServerQueue((s) => s.loaded);
  const viewerRole = useStore((s) => s.viewerRole);
  const openSheet = useTaskSheet((s) => s.open);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!loaded) void refreshQueue();
  }, [loaded]);
  const mine = queueOf(list, agentId);
  if (mine.length === 0 && !err) return null;
  const editable = canAssign(viewerRole);
  const act = (p: Promise<void>) => p.catch((e: Error) => setErr(e.message));

  return (
    <div className={cn("space-y-1", spaced && "mt-3 border-t border-line pt-2.5")} data-testid="server-queue">
      <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-mut">
        <ListOrdered size={11} /> In coda ({mine.length}) · parte da solo, anche a pagina chiusa
      </div>
      {mine.map((q) => (
        <div key={q.id} className="rounded-md bg-ink-800 px-2 py-1">
          <div className="flex items-center gap-1.5">
            {q.urgent && <span title="Task urgente — salta la coda" className="shrink-0 text-[11px] text-slate-300">⚡</span>}
            <button className="min-w-0 flex-1 truncate text-left text-[11px] text-slate-200 hover:underline" onClick={() => openSheet(q.id)} title="Apri la scheda del task">
              {q.title}
            </button>
            {editable && q.afterTaskId && (
              <button onClick={() => void act(startAnywayRemote(q.id))} title="Togli l'attesa: parte appena l'agente è libero" className="shrink-0 text-mut hover:text-emerald-300">
                <Play size={12} />
              </button>
            )}
            {editable && (
              <button onClick={() => void act(removeQueuedRemote(q.id))} title="Rimuovi dalla coda" className="shrink-0 text-mut hover:text-rose-300">
                <XIcon size={12} />
              </button>
            )}
          </div>
          {q.waitNote && <p className={cn("mt-0.5 text-[10px] leading-snug", /bloccato|fermato|non esiste|GitHub/.test(q.waitNote) ? "text-amber-300" : "text-mut")}>{q.waitNote}</p>}
        </div>
      ))}
      {err && <p className="text-[11px] text-rose-400">{err}</p>}
    </div>
  );
}

/** «Parte quando finisce…»: i task in corso o in attesa, di tutti gli agenti. */
export function AfterTaskSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [options, setOptions] = useState<TaskRecord[]>([]);
  const queue = useServerQueue((s) => s.list);
  useEffect(() => {
    let alive = true;
    fetchTasks(undefined, 30)
      .then((l) => alive && setOptions(l.filter((t) => t.status !== "done" && t.status !== "review")))
      .catch(() => alive && setOptions([]));
    return () => {
      alive = false;
    };
  }, [queue.length]);
  if (options.length === 0) return null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title="Il task parte da solo quando quello scelto finisce bene, e riceve il suo riassunto"
      className="w-full rounded-md border border-line bg-ink-800 px-2 py-1.5 text-[12px] text-slate-200 outline-none focus:border-brand/50"
    >
      <option value="">Parte subito (o appena l'agente è libero)</option>
      {options.map((t) => (
        <option key={t.id} value={t.id}>
          Dopo «{t.title.slice(0, 50)}» di {t.agentName} ({statusLabel(t.status)})
        </option>
      ))}
    </select>
  );
}
