import { useCallback, useEffect, useState } from "react";
import { Download, ListChecks, MessageSquare, RotateCcw, X as XIcon } from "lucide-react";
import { useStore } from "../store/useStore";
import { assignRemote } from "../lib/backend";
import { canAssign } from "../lib/roleUi";
import { resolveTaskRepo } from "../lib/metaAgent";
import { cn } from "../lib/utils";
import {
  addTaskComment,
  downloadAllTasks,
  downloadTask,
  fetchTaskDetail,
  fetchTasks,
  fmtWhen,
  groupByAttempt,
  pendingComments,
  statusLabel,
  useTaskSheet,
  type TaskDetail,
  type TaskEvent,
  type TaskRecord,
} from "../lib/tasks";

const LEVEL_TONE: Record<string, string> = {
  ERROR: "text-rose-300",
  WARN: "text-amber-200",
  SUCCESS: "text-emerald-300",
};

/** Ultimi task dell'agente, nella sua scheda: un clic apre la storia completa. */
export function RecentTasksBox({ agentId }: { agentId: string }) {
  const open = useTaskSheet((s) => s.open);
  // Si rilegge quando cambia il task corrente dell'agente.
  const taskKey = useStore((s) => {
    const a = s.agents.find((x) => x.id === agentId);
    return `${a?.task?.title ?? ""}|${a?.status ?? ""}`;
  });
  const [list, setList] = useState<TaskRecord[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    fetchTasks(agentId, 5)
      .then((l) => alive && setList(l))
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [agentId, taskKey]);

  return (
    <div className="mt-3" data-testid="recent-tasks">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-mut">
          <ListChecks size={12} /> Task recenti
        </span>
        <button
          onClick={() => void downloadAllTasks().catch((e: Error) => setErr(e.message))}
          className="text-[10px] text-mut underline-offset-2 hover:text-slate-200 hover:underline"
          title="Scarica la storia di tutti i task (si tiene 30 giorni, poi si cancella)"
        >
          Scarica tutto
        </button>
      </div>
      {list?.length === 0 && <p className="text-[11px] text-mut">Ancora nessun task registrato.</p>}
      <div className="space-y-1">
        {list?.map((t) => (
          <button
            key={t.id}
            onClick={() => open(t.id)}
            className="block w-full rounded-md border border-line bg-ink-850/60 px-2 py-1.5 text-left hover:border-brand/40"
          >
            <div className="truncate text-[12px] text-slate-200">{t.title}</div>
            <div className="text-[10px] text-mut">
              {statusLabel(t.status)} · {t.attempts === 1 ? "1 tentativo" : `${t.attempts} tentativi`} · {fmtWhen(t.updatedAt)}
            </div>
          </button>
        ))}
      </div>
      {err && <p className="mt-1 text-[11px] text-rose-400">{err}</p>}
    </div>
  );
}

function EventRow({ e }: { e: TaskEvent }) {
  if (e.kind === "attempt") return null;
  if (e.kind === "plan") {
    const steps = Array.isArray(e.data?.steps) ? (e.data.steps as unknown[]).map(String) : [];
    return (
      <div className="rounded-md bg-ink-800/70 px-2 py-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-mut">Piano</div>
        <ol className="ml-4 list-decimal text-[11px] text-slate-300">
          {steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </div>
    );
  }
  if (e.kind === "result") {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">Risultato</div>
        <p className="whitespace-pre-wrap break-words text-[11px] text-slate-200">{String(e.data?.summary ?? e.message)}</p>
      </div>
    );
  }
  const detail = typeof e.data?.detail === "string" ? e.data.detail : "";
  return (
    <div className="flex gap-2 text-[11px] leading-snug">
      <span className="w-10 shrink-0 font-mono text-[10px] text-mut">{new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      <span className={cn("min-w-0 break-words", LEVEL_TONE[e.level] ?? "text-slate-300", e.kind === "end" && "italic text-mut")}>
        {e.kind === "status" ? `Stato: ${statusLabel(e.message)}` : e.message}
        {detail && (
          <details className="mt-0.5">
            <summary className="cursor-pointer text-[10px] text-mut">Dettagli</summary>
            <pre className="whitespace-pre-wrap break-words text-[10px] text-mut">{detail}</pre>
          </details>
        )}
      </span>
    </div>
  );
}

/** La scheda del task: cronologia per tentativo, commenti, download e «Riprova». */
export function TaskSheet() {
  const openId = useTaskSheet((s) => s.openId);
  const close = useTaskSheet((s) => s.close);
  const viewerRole = useStore((s) => s.viewerRole);
  const [data, setData] = useState<TaskDetail | null>(null);
  const agentId = data?.task.agentId;
  const agent = useStore((s) => (agentId ? s.agents.find((a) => a.id === agentId) : undefined));
  const [err, setErr] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!openId) return;
    fetchTaskDetail(openId)
      .then(setData)
      .catch((e: Error) => setErr(e.message));
  }, [openId]);

  useEffect(() => {
    setData(null);
    setErr("");
    setText("");
    if (!openId) return;
    load();
    // Mentre l'agente lavora la storia cresce: si rilegge ogni 5 secondi.
    const h = setInterval(load, 5000);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(h);
      window.removeEventListener("keydown", onKey);
    };
  }, [openId, load, close]);

  if (!openId) return null;
  const editable = canAssign(viewerRole);
  const groups = data ? groupByAttempt(data) : [];
  const waiting = data ? pendingComments(data) : [];
  const busyAgent = !!agent?.task;

  const send = () => {
    const t = text.trim();
    if (!t || !openId) return;
    setBusy(true);
    addTaskComment(openId, t)
      .then(() => {
        setText("");
        load();
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setBusy(false));
  };

  const retry = () => {
    if (!data || !agent) return;
    setBusy(true);
    useStore.getState().assignTask(agent.id, data.task.title, data.task.branch);
    assignRemote(agent.id, agent.name, data.task.title, data.task.branch, agent.role, agent.instructions, resolveTaskRepo(agent, undefined), undefined, data.task.id)
      .then(load)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setBusy(false));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 px-3 py-[6vh] backdrop-blur-sm" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Scheda del task"
        className="flex max-h-[88vh] w-full max-w-2xl animate-fade-in flex-col overflow-hidden rounded-xl border border-line bg-ink-850 shadow-panel"
        onClick={(e) => e.stopPropagation()}
        data-testid="task-sheet"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-mut">Scheda del task</p>
            <p className="break-words text-sm font-semibold text-white">{data?.task.title ?? "…"}</p>
            {data && (
              <p className="text-[11px] text-mut">
                {data.task.agentName} · {statusLabel(data.task.status)} · {data.task.attempts === 1 ? "1 tentativo" : `${data.task.attempts} tentativi`}
                {data.task.branch ? ` · ${data.task.branch}` : ""} · avviato da {data.task.createdBy || "?"}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {data && (
              <button className="btn px-2 py-1 text-[11px]" onClick={() => void downloadTask(data.task.id).catch((e: Error) => setErr(e.message))} title="Scarica la storia (JSON)">
                <Download size={12} /> Scarica
              </button>
            )}
            <button className="btn px-2 py-1" onClick={close} aria-label="Chiudi">
              <XIcon size={13} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {!data && !err && <p className="text-[12px] text-mut">Carico…</p>}
          {groups.map((g) => (
            <section key={g.attempt}>
              <h3 className="mb-1.5 text-[11px] font-semibold text-slate-200">
                Tentativo {g.attempt}
                {g.events[0] && <span className="ml-1 font-normal text-mut">· {fmtWhen(g.events[0].ts)}</span>}
              </h3>
              {g.comments.length > 0 && (
                <div className="mb-1.5 rounded-md border border-sky-400/30 bg-sky-400/5 px-2 py-1.5 text-[11px] text-sky-100">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-300">Commenti ricevuti dall'agente</div>
                  {g.comments.map((c) => (
                    <p key={c.id}>
                      <strong>{c.author}:</strong> {c.text}
                    </p>
                  ))}
                </div>
              )}
              <div className="space-y-1">
                {g.events.map((e) => (
                  <EventRow key={e.seq} e={e} />
                ))}
              </div>
            </section>
          ))}
          {data && groups.length === 0 && <p className="text-[12px] text-mut">Nessun evento registrato.</p>}
        </div>

        <div className="border-t border-line px-4 py-3">
          {waiting.length > 0 && (
            <div className="mb-2 text-[11px] text-slate-300">
              <span className="text-mut">In attesa del prossimo tentativo:</span>
              {waiting.map((c) => (
                <p key={c.id}>
                  <strong>{c.author}:</strong> {c.text}
                </p>
              ))}
            </div>
          )}
          {editable ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Commento per l'agente: lo riceve al prossimo tentativo…"
                className="min-w-0 flex-1 resize-none rounded-md border border-line bg-ink-800 px-2 py-1.5 text-[12px] text-slate-200 outline-none placeholder:text-mut focus:border-brand/50"
              />
              <div className="flex shrink-0 gap-2 sm:flex-col">
                <button disabled={busy || !text.trim()} onClick={send} className="btn text-[11px]">
                  <MessageSquare size={12} /> Commenta
                </button>
                <button
                  disabled={busy || !agent || busyAgent}
                  onClick={retry}
                  className="btn btn-primary text-[11px]"
                  title={busyAgent ? "L'agente sta già lavorando: aspetta che finisca" : "Nuovo tentativo dello stesso task, con i commenti"}
                >
                  <RotateCcw size={12} /> Riprova
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">👁 Sola lettura: commentano e riprovano un editor o l'owner.</p>
          )}
          {data && (
            <p className="mt-2 text-[10px] text-mut">
              La storia si tiene 30 giorni dall'ultima attività: si cancella il {new Date(data.expiresAt).toLocaleDateString()}. Scaricala se ti serve dopo.
            </p>
          )}
          {err && <p className="mt-1 text-[11px] text-rose-400">{err}</p>}
        </div>
      </div>
    </div>
  );
}
