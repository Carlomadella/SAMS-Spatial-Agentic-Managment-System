import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, ExternalLink, GitCommit, GitMerge, MessageSquare, RefreshCw, ShieldCheck, X as XIcon } from "lucide-react";
import { useStore } from "../store/useStore";
import {
  approveChanges,
  assignRemote,
  fetchReview,
  fetchReviewList,
  rejectChanges,
  requestReviewChanges,
  type ReviewDetail,
  type ReviewItem,
} from "../lib/backend";
import { canAssign } from "../lib/roleUi";
import { cn } from "../lib/utils";
import { StagedFileDiff } from "./StagedFileDiff";

type Tab = "files" | "commits" | "comments" | "history";

const TABS: { id: Tab; label: string }[] = [
  { id: "files", label: "File" },
  { id: "commits", label: "Commit e CI" },
  { id: "comments", label: "Commenti" },
  { id: "history", label: "Storia del lavoro" },
];

const when = (iso: string | number) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
};

/** Diff unificato di GitHub (patch) con le righe colorate. */
function PatchView({ patch }: { patch: string }) {
  if (!patch) return <p className="px-2 py-1.5 text-[11px] text-mut">Diff non disponibile (file binario o troppo grande): aprilo su GitHub.</p>;
  return (
    <pre className="max-h-96 overflow-auto px-2 py-1.5 font-mono text-[11px] leading-relaxed">
      {patch.split("\n").map((l, i) => (
        <div
          key={i}
          className={cn(
            l.startsWith("+") ? "bg-emerald-500/10 text-emerald-300"
            : l.startsWith("-") ? "bg-rose-500/10 text-rose-300"
            : l.startsWith("@@") ? "text-mut"
            : "text-slate-300",
          )}
        >
          {l || " "}
        </div>
      ))}
    </pre>
  );
}

function checkTone(state: string): string {
  if (state === "success") return "text-emerald-300";
  if (state === "failure" || state === "error" || state === "cancelled" || state === "timed_out") return "text-rose-300";
  return "text-slate-300";
}

/**
 * Reparto revisioni (scelte dell'utente del 21/11): una persona rilegge tutto quello che
 * riguarda un push o un merge — file, commit, CI, commenti, storia del branch — e decide:
 * Conferma, Chiedi modifiche o Rifiuta. Gli agenti in attesa sono qui finché non decide.
 */
export function ReviewDepartment() {
  const open = useStore((s) => s.reviewOpen);
  const selected = useStore((s) => s.reviewAgentId);
  const openReview = useStore((s) => s.openReview);
  const close = useStore((s) => s.closeReview);
  const pushToast = useStore((s) => s.pushToast);
  const canDecide = canAssign(useStore((s) => s.viewerRole));

  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("files");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(() => {
    fetchReviewList()
      .then((list) => { setItems(list); setListError(null); })
      .catch((err: Error) => setListError(err.message));
  }, []);

  // elenco: all'apertura e ogni 10 s finché il reparto è aperto
  useEffect(() => {
    if (!open) return;
    loadList();
    const t = setInterval(loadList, 10_000);
    return () => clearInterval(t);
  }, [open, loadList]);

  // nessuna richiesta scelta → la prima (le attese sul principale stanno in cima)
  const current = selected ?? items?.[0]?.agentId ?? null;

  const loadDetail = useCallback((id: string) => {
    setLoading(true);
    setDetailError(null);
    fetchReview(id)
      .then((d) => setDetail(d))
      .catch((err: Error) => { setDetail(null); setDetailError(err.message); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open || !current || !canDecide) { setDetail(null); return; }
    setNote("");
    setTab("files");
    loadDetail(current);
  }, [open, current, canDecide, loadDetail]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  const done = (msg: string) => {
    pushToast("SUCCESS", msg);
    setDetail(null);
    openReview(null);
    loadList();
  };

  async function confirm() {
    if (!detail) return;
    setBusy(true);
    try {
      await approveChanges(detail.agentId);
      done(`Confermato: ${detail.merge ? `merge della PR #${detail.merge.prNumber}` : `${detail.files.length} file`} in corso`);
    } catch (err) {
      pushToast("ERROR", `Conferma: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!detail) return;
    setBusy(true);
    try {
      await rejectChanges(detail.agentId);
      done("Rifiutato: niente è cambiato");
    } finally {
      setBusy(false);
    }
  }

  async function askChanges() {
    if (!detail || !note.trim()) return;
    setBusy(true);
    try {
      const task = await requestReviewChanges(detail.agentId, note.trim());
      await assignRemote(detail.agentId, detail.agentName, task.title, task.branch);
      done(`${detail.agentName} torna al lavoro su ${task.branch} con le tue note`);
    } catch (err) {
      pushToast("ERROR", `Chiedi modifiche: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const pr = detail?.pr ?? null;
  const counts: Record<Tab, number> = {
    files: (detail?.files.length ?? 0) + (pr?.files.length ?? 0),
    commits: pr?.commits.length ?? 0,
    comments: pr?.comments.length ?? 0,
    history: detail?.history.length ?? 0,
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-[4vh] backdrop-blur-sm"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reparto revisioni"
        className="flex h-[92vh] w-full max-w-6xl animate-fade-in flex-col overflow-hidden rounded-xl border border-line bg-ink-850 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <ShieldCheck size={16} className="text-brand" />
          <h2 className="text-[14px] font-semibold text-white">Reparto revisioni</h2>
          <span className="hidden text-[11px] text-mut sm:inline">
            Gli agenti non toccano mai il branch principale: push e merge li confermi tu.
          </span>
          <button onClick={loadList} className="btn ml-auto" aria-label="Aggiorna l'elenco"><RefreshCw size={13} /></button>
          <button onClick={close} className="btn" aria-label="Chiudi il Reparto revisioni"><XIcon size={13} /></button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* elenco delle richieste */}
          <aside className="max-h-48 shrink-0 overflow-y-auto border-b border-line md:max-h-none md:w-72 md:border-b-0 md:border-r">
            {listError && <p className="p-3 text-[12px] text-rose-300">{listError}</p>}
            {items && items.length === 0 && (
              <p className="p-3 text-[12px] text-mut">Nessuna richiesta in attesa. Quando un agente chiede un push o un merge sul principale, arriva qui.</p>
            )}
            <ul>
              {items?.map((it) => (
                <li key={it.agentId}>
                  <button
                    onClick={() => openReview(it.agentId)}
                    className={cn(
                      "w-full border-b border-line/60 px-3 py-2 text-left hover:bg-white/5",
                      current === it.agentId && "bg-white/10",
                    )}
                  >
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-100">
                      {it.mainGate && <span className="rounded bg-rose-500/20 px-1 text-[10px] text-rose-200">principale</span>}
                      <span className="truncate">{it.agentName}</span>
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-300">{it.title}</div>
                    <div className="mt-0.5 text-[10px] text-mut">
                      {it.merge ? `Merge PR #${it.merge.prNumber}` : `${it.files} file`} · {it.branch} · {when(it.createdAt)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {/* dettaglio */}
          <section className="flex min-h-0 flex-1 flex-col">
            {!canDecide && (
              <p className="p-4 text-[12px] text-mut">Con il ruolo di sola lettura vedi l'elenco ma non i dettagli: rileggere e decidere spetta a chi può assegnare task.</p>
            )}
            {canDecide && !current && <p className="p-4 text-[12px] text-mut">Scegli una richiesta a sinistra.</p>}
            {canDecide && loading && !detail && <p className="p-4 text-[12px] text-mut">Carico la richiesta…</p>}
            {canDecide && detailError && <p className="p-4 text-[12px] text-rose-300">{detailError}</p>}

            {canDecide && detail && (
              <>
                <div className="border-b border-line px-4 py-3">
                  <div className="text-[13px] font-semibold text-white">{detail.agentName} · {detail.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-slate-300">
                    {detail.merge ? (
                      <>
                        <GitMerge size={12} /> PR #{detail.merge.prNumber}: {detail.merge.headRef} → {detail.merge.baseRef} @ {(detail.merge.headSha ?? "").slice(0, 7)} ({detail.merge.method})
                      </>
                    ) : (
                      <>
                        <GitCommit size={12} /> {detail.files.length} file per {detail.branch}
                      </>
                    )}
                    {pr && (
                      <a href={pr.url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 text-brand hover:underline">
                        GitHub <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                  {detail.mainGate && (
                    <p className="mt-1.5 text-[11px] text-rose-200">
                      {detail.agentName} è nel reparto e non riceve altri task finché non decidi.
                    </p>
                  )}
                  {detail.prMoved && (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-300">
                      <AlertTriangle size={12} /> La PR ha commit nuovi dopo la richiesta: la conferma vale solo per {(detail.merge?.headSha ?? "").slice(0, 7)} e GitHub la rifiuterà. Chiedi modifiche o rifiuta.
                    </p>
                  )}
                  {detail.prError && <p className="mt-1.5 text-[11px] text-rose-300">{detail.prError}</p>}
                </div>

                <nav className="flex gap-1 border-b border-line px-3" role="tablist">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      role="tab"
                      aria-selected={tab === t.id}
                      onClick={() => setTab(t.id)}
                      className={cn(
                        "border-b-2 px-2.5 py-2 text-[12px]",
                        tab === t.id ? "border-brand text-white" : "border-transparent text-mut hover:text-slate-200",
                      )}
                    >
                      {t.label} <span className="text-mut">({counts[t.id]})</span>
                    </button>
                  ))}
                </nav>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                  {tab === "files" && (
                    <>
                      {detail.files.map((f, i) => (
                        <StagedFileDiff key={`s${i}`} file={f} agentId={detail.agentId} />
                      ))}
                      {pr?.files.map((f) => (
                        <details key={f.path} className="rounded-md border border-line bg-ink-800">
                          <summary className="flex cursor-pointer items-center gap-2 px-2 py-1.5 font-mono text-[11px] text-slate-200">
                            <span className="min-w-0 flex-1 truncate">{f.path}</span>
                            <span className="text-mut">{f.status}</span>
                            <span className="text-emerald-300">+{f.additions}</span>
                            <span className="text-rose-300">-{f.deletions}</span>
                          </summary>
                          <PatchView patch={f.patch} />
                        </details>
                      ))}
                      {counts.files === 0 && <p className="text-[12px] text-mut">Nessun file.</p>}
                    </>
                  )}

                  {tab === "commits" && (
                    <>
                      {!pr && <p className="text-[12px] text-mut">Un push diretto non ha ancora commit né CI: i file vengono committati alla conferma.</p>}
                      {pr && (
                        <>
                          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-mut">Controlli sul commit {pr.headSha.slice(0, 7)}</h3>
                          {pr.checks.length === 0 ? (
                            <p className="text-[12px] text-amber-300">Nessun controllo né CI su questo commit: i test non sono stati eseguiti.</p>
                          ) : (
                            <ul className="space-y-0.5">
                              {pr.checks.map((c, i) => (
                                <li key={i} className={cn("text-[12px]", checkTone(c.state))}>{c.name}: {c.state}</li>
                              ))}
                            </ul>
                          )}
                          <p className="text-[11px] text-mut">Mergiabile: {pr.mergeable == null ? "in calcolo" : pr.mergeable ? "sì" : "no"} ({pr.mergeableState})</p>
                          <h3 className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-mut">Commit ({pr.commits.length})</h3>
                          <ul className="space-y-1">
                            {pr.commits.map((c) => (
                              <li key={c.sha} className="text-[12px] text-slate-200">
                                <span className="font-mono text-mut">{c.sha.slice(0, 7)}</span> {c.message.split("\n")[0]}
                                <span className="text-mut"> · {c.author} · {when(c.date)}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </>
                  )}

                  {tab === "comments" && (
                    <>
                      {!pr && <p className="text-[12px] text-mut">Un push diretto non ha una PR: niente descrizione né commenti.</p>}
                      {pr && (
                        <>
                          <div className="rounded-md border border-line bg-ink-800 p-2">
                            <div className="text-[11px] text-mut">Descrizione di {pr.author}</div>
                            <p className="mt-1 whitespace-pre-wrap text-[12px] text-slate-200">{pr.body || "(nessuna descrizione)"}</p>
                          </div>
                          {pr.comments.length === 0 && <p className="text-[12px] text-mut">Nessun commento.</p>}
                          {pr.comments.map((c, i) => (
                            <div key={i} className="rounded-md border border-line bg-ink-800 p-2">
                              <div className="flex items-center gap-1.5 text-[11px] text-mut">
                                <MessageSquare size={11} /> {c.author} · {c.kind}{c.path ? ` su ${c.path}` : ""} · {when(c.date)}
                                {!c.trusted && <span className="rounded bg-amber-500/20 px-1 text-amber-200">esterno al repository</span>}
                              </div>
                              <p className="mt-1 whitespace-pre-wrap text-[12px] text-slate-200">{c.body}</p>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )}

                  {tab === "history" && (
                    <>
                      {detail.history.length === 0 && <p className="text-[12px] text-mut">Nessun task registrato su questo branch.</p>}
                      {detail.history.map((h, i) => (
                        <div key={i} className="rounded-md border border-line bg-ink-800 p-2">
                          <div className="text-[11px] text-mut">{h.agentName} · {h.status} · {h.branch} · {when(h.ts)}</div>
                          <div className="mt-0.5 text-[12px] font-medium text-slate-100">{h.title}</div>
                          {h.summary && <p className="mt-1 whitespace-pre-wrap text-[12px] text-slate-300">{h.summary}</p>}
                        </div>
                      ))}
                    </>
                  )}
                </div>

                <footer className="border-t border-line p-3">
                  <label htmlFor="review-note" className="mb-1 block text-[11px] text-mut">
                    Note per {detail.agentName} (servono per «Chiedi modifiche»)
                  </label>
                  <textarea
                    id="review-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Cosa va cambiato prima di confermare…"
                    className="w-full resize-y rounded-md border border-line bg-ink-800 px-2 py-1.5 text-[12px] text-slate-200 outline-none focus:border-brand/50"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={confirm} disabled={busy || detail.prMoved} className="btn btn-primary">
                      <Check size={13} /> Conferma
                    </button>
                    <button onClick={askChanges} disabled={busy || !note.trim()} className="btn">
                      <MessageSquare size={13} /> Chiedi modifiche
                    </button>
                    <button onClick={reject} disabled={busy} className="btn border-rose-500/30 text-rose-300 hover:bg-rose-500/10">
                      <XIcon size={13} /> Rifiuta
                    </button>
                  </div>
                </footer>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
