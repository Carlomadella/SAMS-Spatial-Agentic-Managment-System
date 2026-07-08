import { useEffect, useRef, useState } from "react";
import { Eye, Send, Zap } from "lucide-react";
import { useStore } from "../store/useStore";
import { announcePresence, assignRemote, backendEnabled, sendChat } from "../lib/backend";
import { watchingLabel } from "../lib/presence";
import { parseTaskCommand, type TaskCommand } from "../lib/chatCommands";
import { metaRepo } from "../lib/metaAgent";
import { canAssign } from "../lib/roleUi";
import { clock } from "../lib/utils";

/**
 * Chat di workspace (mondo condiviso, Roadmap 4 #2): un canale umano-umano
 * accanto alla scena. I messaggi vivono sul server e arrivano via SSE, quindi
 * più viste connesse li vedono live. Richiede il runtime connesso.
 */
export function ChatPanel() {
  const messages = useStore((s) => s.chatMessages);
  const chatName = useStore((s) => s.chatName);
  const setChatName = useStore((s) => s.setChatName);
  const backendOnline = useStore((s) => s.backendOnline);
  const observers = useStore((s) => s.observers);
  const people = useStore((s) => s.people);
  const markChatRead = useStore((s) => s.markChatRead);
  const canChat = canAssign(useStore((s) => s.viewerRole));
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // The panel is only mounted when the Chat tab is showing, so anything visible
  // here is read — clear the unread badge on mount and as new messages arrive.
  useEffect(() => {
    markChatRead();
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, markChatRead]);

  const submit = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setError("");
    const ok = await sendChat(chatName.trim() || "Ospite", t);
    setSending(false);
    if (ok) setText("");
    else setError("Messaggio non inviato — riprova tra poco.");
  };

  if (!backendOnline) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center text-[12px] text-mut">
        <span>La chat di workspace è disponibile quando il runtime è connesso.</span>
        <span className="text-mut/70">Parla con chi sta guardando lo stesso ufficio, live.</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Roster presence: chi sta guardando lo stesso ufficio, live. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-line/40 px-2 py-1.5 text-[11px]">
        <span className="flex shrink-0 items-center gap-1 font-medium text-mut">
          <Eye size={12} /> {watchingLabel(people, observers)}
        </span>
        {people.length > 0 && (
          <span className="flex min-w-0 flex-wrap gap-1">
            {people.map((name, i) => (
              <span
                key={`${name}-${i}`}
                className="max-w-[10rem] truncate rounded-full bg-brand/15 px-2 py-0.5 text-brand-soft"
                title={name}
              >
                {name}
              </span>
            ))}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 text-[12px] leading-relaxed">
        {messages.length === 0 && (
          <div className="px-1 text-mut">Ancora nessun messaggio. Rompi il ghiaccio 👋</div>
        )}
        {messages.map((m) => {
          const cmd = parseTaskCommand(m.text);
          return (
            <div key={m.id} className="rounded px-1 py-0.5 hover:bg-white/[0.035]">
              <div className="flex items-baseline gap-2">
                <span className="shrink-0 tabular-nums text-mut/70">{clock(m.ts)}</span>
                <span className="shrink-0 font-semibold text-brand-soft">{m.author}</span>
                <span className="min-w-0 whitespace-pre-wrap break-words text-slate-300">{m.text}</span>
              </div>
              {cmd && <TaskCommandCard cmd={cmd} />}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="shrink-0 border-t border-rose-500/20 bg-rose-500/10 px-3 py-1 text-[11px] text-rose-300">
          {error}
        </div>
      )}
      <form
        className="flex shrink-0 items-center gap-1.5 border-t border-line/40 px-2 py-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          value={chatName}
          onChange={(e) => setChatName(e.target.value)}
          onBlur={() => void announcePresence(chatName)}
          placeholder="Nome"
          aria-label="Il tuo nome in chat"
          className="w-24 shrink-0 rounded-md bg-ink-800 px-2 py-1 text-[12px] text-slate-200 outline-none ring-1 ring-inset ring-line/50 placeholder:text-mut/60 focus:ring-brand"
        />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError("");
          }}
          disabled={!canChat}
          placeholder={canChat ? "Scrivi un messaggio…" : "👁 Sola lettura — non puoi scrivere in chat"}
          aria-label="Messaggio"
          maxLength={500}
          className="min-w-0 flex-1 rounded-md bg-ink-800 px-2 py-1 text-[12px] text-slate-200 outline-none ring-1 ring-inset ring-line/50 placeholder:text-mut/60 focus:ring-brand disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!canChat || sending || !text.trim()}
          title="Invia"
          aria-label="Invia"
          className="btn h-7 w-7 shrink-0 px-0 disabled:opacity-40"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}

/**
 * Card azionabile per un messaggio `/task` (umano→agente, Roadmap 4 #2 nodo "d").
 * Il messaggio dichiara l'intento; il lavoro reale parte SOLO da questo bottone —
 * conferma esplicita, mai automatica. Riusa lo stesso percorso di assegnazione
 * degli altri pannelli (`assignTask` locale + `assignRemote` sul runtime).
 */
function TaskCommandCard({ cmd }: { cmd: TaskCommand }) {
  const agents = useStore((s) => s.agents);
  const runtimeReady = useStore((s) => s.runtimeReady);
  const assignTask = useStore((s) => s.assignTask);
  const log = useStore((s) => s.log);
  const canAct = canAssign(useStore((s) => s.viewerRole));
  const [done, setDone] = useState("");

  // Risoluzione dell'agente: per nome se indicato, altrimenti il primo libero.
  const target = cmd.agent
    ? agents.find((a) => a.name.toLowerCase() === cmd.agent!.toLowerCase())
    : agents.find((a) => !a.task);

  const problem = cmd.agent
    ? !target
      ? `Nessun agente di nome «${cmd.agent}»`
      : target.task
        ? `${target.name} è occupato`
        : null
    : !target
      ? "Nessun agente libero adesso"
      : null;

  const assign = () => {
    if (!target || target.task) return;
    assignTask(target.id, cmd.title, "");
    if (backendEnabled) {
      assignRemote(target.id, target.name, cmd.title, undefined, target.role, target.instructions, metaRepo(target)).catch(
        (err: Error) =>
          log({ agentId: target.id, agentName: target.name, color: target.color, level: "ERROR", message: `Runtime: ${err.message}` }),
      );
    }
    setDone(target.name);
  };

  if (done) {
    return (
      <div className="ml-[3.25rem] mt-0.5 text-[11px] text-emerald-400">✓ Assegnato a {done}</div>
    );
  }

  return (
    <div className="ml-[3.25rem] mt-0.5 flex flex-wrap items-center gap-2 text-[11px]">
      <span className="flex items-center gap-1 text-mut">
        <Zap size={11} /> Task{cmd.agent ? ` per ${cmd.agent}` : ""}: “{cmd.title}”
      </span>
      {problem ? (
        <span className="text-amber-400">{problem}</span>
      ) : !canAct ? (
        <span className="text-mut/70" title="Serve il ruolo editor o owner per assegnare">
          👁 Sola lettura
        </span>
      ) : !runtimeReady ? (
        <span className="text-mut/70" title="Configura le chiavi e provisiona per assegnare dal vivo">
          Runtime non pronto
        </span>
      ) : (
        <button onClick={assign} className="btn h-6 gap-1 px-2 py-0 text-[11px]">
          <Send size={11} /> Assegna a {target!.name}
        </button>
      )}
    </div>
  );
}
