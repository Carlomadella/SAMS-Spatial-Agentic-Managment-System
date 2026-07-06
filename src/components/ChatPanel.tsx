import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useStore } from "../store/useStore";
import { sendChat } from "../lib/backend";
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
  const markChatRead = useStore((s) => s.markChatRead);
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
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 text-[12px] leading-relaxed">
        {messages.length === 0 && (
          <div className="px-1 text-mut">Ancora nessun messaggio. Rompi il ghiaccio 👋</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className="flex items-baseline gap-2 rounded px-1 py-0.5 hover:bg-white/[0.035]">
            <span className="shrink-0 tabular-nums text-mut/70">{clock(m.ts)}</span>
            <span className="shrink-0 font-semibold text-brand-soft">{m.author}</span>
            <span className="min-w-0 whitespace-pre-wrap break-words text-slate-300">{m.text}</span>
          </div>
        ))}
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
          placeholder="Scrivi un messaggio…"
          aria-label="Messaggio"
          maxLength={500}
          className="min-w-0 flex-1 rounded-md bg-ink-800 px-2 py-1 text-[12px] text-slate-200 outline-none ring-1 ring-inset ring-line/50 placeholder:text-mut/60 focus:ring-brand"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
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
