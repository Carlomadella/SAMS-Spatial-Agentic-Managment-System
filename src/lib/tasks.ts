// Il task come conversazione completa (idea 3 da Paperclip, scelta A del 25/11/2026).

import { create } from "zustand";
import { BASE, authHeaders, viewerName } from "./backend";

export interface TaskRecord {
  id: string;
  agentId: string;
  agentName: string;
  title: string;
  branch: string;
  status: string;
  attempts: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface TaskEvent {
  seq: number;
  attempt: number;
  ts: number;
  kind: "attempt" | "plan" | "log" | "status" | "result" | "end";
  level: string;
  message: string;
  data: Record<string, unknown> | null;
}

export interface TaskComment {
  id: string;
  author: string;
  text: string;
  ts: number;
  deliveredAttempt: number | null;
}

export interface TaskDetail {
  task: TaskRecord;
  events: TaskEvent[];
  comments: TaskComment[];
  expiresAt: number;
}

export interface AttemptGroup {
  attempt: number;
  events: TaskEvent[];
  /** commenti arrivati all'agente all'inizio di questo tentativo */
  comments: TaskComment[];
}

/** Cronologia divisa per tentativo; i commenti vanno sotto il tentativo che li ha ricevuti. */
export function groupByAttempt(d: Pick<TaskDetail, "events" | "comments">): AttemptGroup[] {
  const map = new Map<number, AttemptGroup>();
  const get = (n: number) => {
    let g = map.get(n);
    if (!g) map.set(n, (g = { attempt: n, events: [], comments: [] }));
    return g;
  };
  for (const e of d.events) get(e.attempt).events.push(e);
  for (const c of d.comments) if (c.deliveredAttempt != null) get(c.deliveredAttempt).comments.push(c);
  return [...map.values()].sort((a, b) => a.attempt - b.attempt);
}

/** Commenti scritti e non ancora arrivati all'agente (arriveranno al prossimo tentativo). */
export function pendingComments(d: Pick<TaskDetail, "comments">): TaskComment[] {
  return d.comments.filter((c) => c.deliveredAttempt == null);
}

export const STATUS_LABEL: Record<string, string> = {
  queued: "in coda",
  working: "al lavoro",
  review: "in revisione",
  blocked: "bloccato",
  done: "completato",
  idle: "fermato",
  awaiting_approval: "in attesa di approvazione",
};

export function statusLabel(s: string): string {
  return STATUS_LABEL[s] ?? s;
}

export function fmtWhen(ts: number): string {
  return new Date(ts).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Quale scheda è aperta (una alla volta). */
export const useTaskSheet = create<{ openId: string | null; open: (id: string) => void; close: () => void }>((set) => ({
  openId: null,
  open: (id) => set({ openId: id }),
  close: () => set({ openId: null }),
}));

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchTasks(agentId?: string, limit = 5): Promise<TaskRecord[]> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (agentId) q.set("agentId", agentId);
  return asJson(await fetch(`${BASE}/api/tasks?${q}`, { headers: authHeaders(false) }));
}

export async function fetchTaskDetail(id: string): Promise<TaskDetail> {
  return asJson(await fetch(`${BASE}/api/tasks/${encodeURIComponent(id)}`, { headers: authHeaders(false) }));
}

export async function addTaskComment(id: string, text: string): Promise<TaskComment> {
  return asJson(
    await fetch(`${BASE}/api/tasks/${encodeURIComponent(id)}/comments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ text, actor: viewerName() }),
    }),
  );
}

/** Scarica un file dal runtime (serve l'intestazione di accesso: niente link diretto). */
async function download(path: string, filename: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders(false) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = new Blob([JSON.stringify(await res.json(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadTask(id: string): Promise<void> {
  return download(`/api/tasks/${encodeURIComponent(id)}/download`, `task-${id.slice(2, 10)}.json`);
}

export function downloadAllTasks(): Promise<void> {
  return download(`/api/tasks-download`, `sams-task-${new Date().toISOString().slice(0, 10)}.json`);
}
