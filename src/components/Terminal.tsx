import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { assignRemote, backendEnabled, startSimMode, stopSimMode } from "../lib/backend";
import { resolveAgentByToken } from "../lib/agentMatch";
import { hasUnfilledPlaceholders } from "../lib/validation";
import type { EnvironmentName } from "../types";

// ---------------------------------------------------------------------------
// A real, scriptable console for driving the workspace. Not a shell — a thin
// command layer over the same store actions the GUI uses, so anything you can
// click you can also type (handy for demos and power users).
// ---------------------------------------------------------------------------

type LineKind = "cmd" | "out" | "err" | "info" | "ok";
interface Line { kind: LineKind; text: string; }

const LINE_CLS: Record<LineKind, string> = {
  cmd: "text-slate-200",
  out: "text-slate-400",
  err: "text-rose-300",
  info: "text-brand-soft",
  ok: "text-emerald-300",
};

const ENVS: EnvironmentName[] = ["dev", "staging", "prod"];

const HELP: string[] = [
  "Comandi disponibili:",
  "  help                       mostra questo aiuto",
  "  status | agents            elenca gli agenti e il loro stato",
  "  spawn [nome]               crea un nuovo agente (nome opzionale)",
  "  assign <agente> <task…>    assegna un task a un agente",
  "  select <agente>            seleziona un agente nell'inspector",
  "  clear-task <agente>        libera l'agente (torna idle)",
  "  env [dev|staging|prod]     mostra o cambia l'ambiente",
  "  sim <start|stop>           avvia/ferma la Live Simulation",
  "  tasks                      ultimi task registrati",
  "  clear                      pulisci il terminale",
];

export function Terminal() {
  const environment = useStore((s) => s.environment);
  const [lines, setLines] = useState<Line[]>([
    { kind: "info", text: "SAMS runtime · spatial agentic shell" },
    { kind: "out", text: "Scrivi 'help' per i comandi. Tutto ciò che clicchi puoi anche digitarlo." },
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // keep the view pinned to the newest output
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  function push(...newLines: Line[]) {
    setLines((prev) => [...prev, ...newLines].slice(-200));
  }
  const out = (text: string): Line => ({ kind: "out", text });

  async function run(raw: string) {
    const cmd = raw.trim();
    if (!cmd) return;
    push({ kind: "cmd", text: `$ ${cmd}` });
    setHistory((h) => [...h, cmd].slice(-100));
    setHistIdx(null);

    const [name, ...rest] = cmd.split(/\s+/);
    const arg = rest.join(" ");
    const s = useStore.getState();

    switch (name.toLowerCase()) {
      case "help":
      case "?":
        push(...HELP.map(out));
        break;

      case "clear":
      case "cls":
        setLines([]);
        break;

      case "status":
      case "agents": {
        if (s.agents.length === 0) { push(out("Nessun agente.")); break; }
        push(
          ...s.agents.map((a): Line => ({
            kind: a.status === "blocked" ? "err" : a.status === "idle" ? "out" : "ok",
            text: `  ${a.name.padEnd(16)} ${a.status.padEnd(18)} ${a.task?.title ?? "—"}`,
          })),
        );
        break;
      }

      case "spawn": {
        const id = s.addAgent();
        if (arg) s.renameAgent(id, arg);
        const created = useStore.getState().agents.find((a) => a.id === id);
        push({ kind: "ok", text: `✓ creato ${created?.name ?? id}` });
        break;
      }

      case "select": {
        if (!arg) { push({ kind: "err", text: "uso: select <agente>" }); break; }
        const a = resolveAgentByToken(s.agents, arg);
        if (!a) { push({ kind: "err", text: `agente non trovato: ${arg}` }); break; }
        s.selectAgent(a.id);
        push({ kind: "ok", text: `✓ selezionato ${a.name}` });
        break;
      }

      case "clear-task":
      case "free": {
        if (!arg) { push({ kind: "err", text: "uso: clear-task <agente>" }); break; }
        const a = resolveAgentByToken(s.agents, arg);
        if (!a) { push({ kind: "err", text: `agente non trovato: ${arg}` }); break; }
        s.clearTask(a.id);
        push({ kind: "ok", text: `✓ ${a.name} è ora idle` });
        break;
      }

      case "assign": {
        const who = rest[0];
        const task = rest.slice(1).join(" ");
        if (!who || !task) { push({ kind: "err", text: "uso: assign <agente> <task…>" }); break; }
        if (hasUnfilledPlaceholders(task)) { push({ kind: "err", text: "il task contiene segnaposto non compilati ({…}) — sostituiscili prima di assegnare" }); break; }
        const a = resolveAgentByToken(s.agents, who);
        if (!a) { push({ kind: "err", text: `agente non trovato: ${who}` }); break; }
        s.assignTask(a.id, task, "");
        push({ kind: "ok", text: `✓ ${a.name} ← ${task}` });
        if (backendEnabled && s.backendOnline && s.runtimeReady) {
          assignRemote(a.id, a.name, task, undefined, a.role, a.instructions).catch((err: Error) =>
            push({ kind: "err", text: `runtime: ${err.message}` }),
          );
          push({ kind: "info", text: "  → inviato al runtime" });
        }
        break;
      }

      case "env": {
        if (!arg) { push({ kind: "info", text: `ambiente: ${environment}` }); break; }
        if (!ENVS.includes(arg as EnvironmentName)) {
          push({ kind: "err", text: `ambiente non valido: ${arg} (dev|staging|prod)` });
          break;
        }
        s.setEnvironment(arg as EnvironmentName);
        push({ kind: "ok", text: `✓ ambiente → ${arg}` });
        break;
      }

      case "sim": {
        const sub = (rest[0] ?? "").toLowerCase();
        if (sub === "start") {
          if (!s.backendOnline || !s.runtimeReady) { push({ kind: "err", text: "runtime non pronto" }); break; }
          await startSimMode(s.simLabel).catch(() => {});
          s.setSimMode(true);
          push({ kind: "ok", text: `✓ Live Sim avviata · label: ${s.simLabel}` });
        } else if (sub === "stop") {
          await stopSimMode().catch(() => {});
          s.setSimMode(false);
          push({ kind: "ok", text: "✓ Live Sim fermata" });
        } else {
          push({ kind: "info", text: `Live Sim: ${s.simMode ? "ATTIVA" : "ferma"} — uso: sim <start|stop>` });
        }
        break;
      }

      case "tasks": {
        const recent = [...s.tasks].slice(-8).reverse();
        if (recent.length === 0) { push(out("Nessun task ancora.")); break; }
        push(...recent.map((t): Line => ({
          kind: "out",
          text: `  [${t.status}] ${t.agentName} · ${t.title}`,
        })));
        break;
      }

      default:
        push({ kind: "err", text: `comando sconosciuto: ${name} (prova 'help')` });
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      void run(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const next = histIdx === null ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(next);
      setInput(history[next]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx === null) return;
      const next = histIdx + 1;
      if (next >= history.length) { setHistIdx(null); setInput(""); }
      else { setHistIdx(next); setInput(history[next]); }
    }
  }

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="flex h-full w-full cursor-text flex-col text-left font-mono text-[12px] leading-relaxed"
    >
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {lines.map((l, i) => (
          <div key={i} className={cnLine(l.kind)}>{l.text || " "}</div>
        ))}
      </div>
      {/* prompt */}
      <div className="flex shrink-0 items-center gap-1 border-t border-line/50 px-3 py-1.5">
        <span className="text-emerald-400">sams@workspace</span>
        <span className="text-mut">:</span>
        <span className="text-brand-soft">~/{environment}</span>
        <span className="text-mut">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
          aria-label="Terminale comandi SAMS"
          className="ml-1 min-w-0 flex-1 bg-transparent text-slate-200 caret-brand-soft outline-none placeholder:text-mut"
          placeholder="help"
        />
      </div>
    </div>
  );
}

function cnLine(kind: LineKind): string {
  return `whitespace-pre-wrap break-words ${LINE_CLS[kind]}`;
}
