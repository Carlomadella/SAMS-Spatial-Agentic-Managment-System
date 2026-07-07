import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BookOpen,
  Bot,
  Boxes,
  ClipboardList,
  Clock,
  Coffee,
  Compass,
  Film,
  History,
  ListTodo,
  MessageSquare,
  Maximize2,
  MapPin,
  MousePointer2,
  Paintbrush,
  Plus,
  RotateCcw,
  Send,
  Server,
  Settings,
  Sprout,
  SunMoon,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useStore } from "../store/useStore";
import { AGENT_COLORS, type EnvironmentName } from "../types";
import { ROOM_THEMES } from "../lib/roomThemes";
import { coffeeBreak, officeClockChime } from "../lib/interactions";
import { ZONES } from "../data/world";
import { assignRemote } from "../lib/backend";
import { metaRepo } from "../lib/metaAgent";
import { hasUnfilledPlaceholders } from "../lib/validation";
import { titleCase } from "../lib/utils";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  keywords?: string;
  run: () => void;
}

/** Italian names for the agent palette colors (shown in the command list). */
const COLOR_IT: Record<string, string> = {
  blue: "blu",
  green: "verde",
  orange: "arancione",
  purple: "viola",
  red: "rosso",
  yellow: "giallo",
};

export function CommandPalette() {
  const open = useStore((s) => s.commandOpen);
  const setOpen = useStore((s) => s.setCommandOpen);
  const agents = useStore((s) => s.agents);
  const selectedAgentId = useStore((s) => s.selectedAgentId);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const s = useStore.getState();
    const sel = agents.find((a) => a.id === selectedAgentId);
    const list: Command[] = [];

    list.push({ id: "add", label: "Crea nuovo agente", icon: Plus, keywords: "create add new crea aggiungi nuovo", run: () => s.addAgent() });
    for (const c of AGENT_COLORS) {
      list.push({
        id: `add-${c}`,
        label: `Crea agente ${COLOR_IT[c] ?? c}`,
        icon: Plus,
        keywords: `create crea ${c} ${COLOR_IT[c] ?? ""}`,
        run: () => s.addAgent(c),
      });
    }

    for (const a of agents) {
      list.push({
        id: `sel-${a.id}`,
        label: `Seleziona ${a.name}`,
        hint: a.role,
        icon: MousePointer2,
        keywords: "select focus agent seleziona",
        run: () => s.selectAgent(a.id),
      });
    }

    if (sel) {
      for (const z of ZONES) {
        list.push({
          id: `zone-${z.id}`,
          label: `Invia ${sel.name} → ${z.label}`,
          hint: z.sublabel,
          icon: MapPin,
          keywords: "dispatch move send zone invia sposta zona",
          run: () => s.sendToZone(sel.id, z.id),
        });
      }
    }

    (["dev", "staging", "prod"] as EnvironmentName[]).forEach((e) => {
      list.push({
        id: `env-${e}`,
        label: `Cambia ambiente → ${e}`,
        icon: Server,
        keywords: "environment env deploy ambiente",
        run: () => s.setEnvironment(e),
      });
    });

    list.push({ id: "cad", label: "Apri CAD spaziale · Zone", icon: Boxes, keywords: "zones cad layout zone", run: () => s.setActivity("cad") });
    list.push({ id: "focus", label: "Modalità focus (mostra/nascondi pannelli)", icon: Maximize2, keywords: "focus zen panels hide pannelli", run: () => s.toggleFocus() });
    list.push({ id: "garden", label: "Apri Commit Garden", icon: Sprout, keywords: "garden plant commit grow giardino", run: () => s.setGardenOpen(true) });
    list.push({ id: "tour", label: "Avvia tour dell'interfaccia", icon: Compass, keywords: "tour guida interfaccia onboarding aiuto help giro", run: () => s.setTourOpen(true) });

    // Quick navigation to feature panels (routine/reazioni, replay, diario…).
    list.push({ id: "livesim", label: "Apri Live Sim · Routine e reazioni a catena", icon: Clock, keywords: "live sim routine trigger temporali reazioni catena chain automazione", run: () => s.setBottomTab("livesim") });
    list.push({ id: "replay", label: "Apri Replay cinematografico", icon: Film, keywords: "replay clip timeline rivedi cinematografico", run: () => s.setBottomTab("replay") });
    list.push({ id: "diario", label: "Apri Diario del mondo", icon: BookOpen, keywords: "diario diary racconto world narrazione", run: () => s.setBottomTab("diario") });
    list.push({ id: "chat", label: "Apri Chat di workspace", icon: MessageSquare, keywords: "chat messaggi workspace condiviso presence parla", run: () => s.setBottomTab("chat") });
    list.push({ id: "history", label: "Apri Cronologia task", icon: History, keywords: "history cronologia storico task", run: () => s.setBottomTab("history") });
    list.push({ id: "tasks", label: "Apri elenco Task", icon: ListTodo, keywords: "tasks task elenco lavori", run: () => s.setBottomTab("tasks") });
    list.push({ id: "settings", label: "Apri Impostazioni runtime", icon: Settings, keywords: "settings impostazioni chiavi keys runtime config", run: () => s.setSettingsOpen(true) });
    list.push({ id: "theme", label: `Tema: passa a ${s.theme === "dark" ? "chiaro" : "scuro"}`, icon: SunMoon, keywords: "theme tema chiaro scuro dark light", run: () => s.toggleTheme() });
    for (const rt of ROOM_THEMES) {
      list.push({
        id: `room-${rt.id}`,
        label: `Stanza: ${rt.emoji} ${rt.name}${s.roomTheme === rt.id ? " ✓" : ""}`,
        icon: Paintbrush,
        keywords: `stanza room tema colore pareti pavimento ${rt.name} ${rt.id}`,
        run: () => s.setRoomTheme(rt.id),
      });
    }
    list.push({ id: "meta", label: `Meta-agente proattivo: ${s.metaProactive ? "disattiva" : "attiva"}`, icon: Bot, keywords: "meta proattivo autonomo toggle", run: () => s.setMetaProactive(!s.metaProactive) });
    list.push({ id: "webhook", label: `Risposta ai webhook GitHub: ${s.webhookAutoAssign ? "disattiva" : "attiva"}`, icon: Bell, keywords: "webhook github ci wake toggle", run: () => s.setWebhookAutoAssign(!s.webhookAutoAssign) });

    // Interazioni della stanza, raggiungibili anche senza cliccare l'hotspot 3D.
    list.push({ id: "coffee", label: "Pausa caffè per tutti", icon: Coffee, keywords: "caffè coffee pausa energia sazia bisogni fame", run: () => {
      const r = coffeeBreak(s.agents);
      r.fedIds.forEach((id) => s.feedAgent(id, r.amount));
      s.pushToast("SUCCESS", r.message);
    } });
    list.push({ id: "clock", label: "Che ore sono in ufficio?", icon: Clock, keywords: "orologio ora tempo clock giornata", run: () => s.pushToast("INFO", officeClockChime()) });

    list.push({ id: "clear", label: "Svuota log eventi", icon: Trash2, keywords: "log clear svuota", run: () => s.clearEvents() });
    list.push({ id: "reset", label: "Reimposta l'area di lavoro", icon: RotateCcw, keywords: "reset restore reimposta", run: () => s.resetWorld() });

    return list;
  }, [agents, selectedAgentId]);

  const quickAssign = useMemo<Command | null>(() => {
    const q = query.trim();
    if (!q) return null;
    if (hasUnfilledPlaceholders(q)) return null; // don't assign an unfilled template
    const sel = agents.find((a) => a.id === selectedAgentId);
    if (!sel) return null;
    const backendOnline = useStore.getState().backendOnline;
    if (!backendOnline) return null;
    return {
      id: "__quick_assign__",
      label: `Assegna "${q}" → ${sel.name}`,
      hint: "task rapido",
      icon: ClipboardList,
      keywords: "",
      run: () => {
        assignRemote(sel.id, sel.name, q, undefined, sel.role, sel.instructions, metaRepo(sel)).catch(() => {});
      },
    };
  }, [query, agents, selectedAgentId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? commands.filter(
          (c) => `${c.label} ${c.hint ?? ""} ${c.keywords ?? ""}`.toLowerCase().includes(q),
        )
      : commands;
    if (quickAssign) return [quickAssign, ...base];
    return base;
  }, [commands, query, quickAssign]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // focus after paint
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  if (!open) return null;

  function runAt(i: number) {
    const cmd = filtered[i];
    if (!cmd) return;
    cmd.run();
    setOpen(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="mt-[12vh] w-full max-w-xl animate-fade-in overflow-hidden rounded-xl border border-line bg-ink-850 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              runAt(active);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Digita un comando o cerca…"
          className="w-full border-b border-line bg-transparent px-4 py-3.5 text-sm text-slate-100 outline-none placeholder:text-mut"
        />
        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-[13px] text-mut">Nessun comando corrispondente</div>
          )}
          {filtered.map((c, i) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => runAt(i)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] ${
                  i === active ? "bg-brand/20 text-white" : "text-slate-300"
                }`}
              >
                <Icon size={16} className="shrink-0 text-brand-soft" />
                <span className="flex-1">{c.label}</span>
                {c.hint && <span className="text-[11px] text-mut">{titleCase(c.hint)}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3 border-t border-line px-3 py-2 text-[11px] text-mut">
          <span><kbd className="rounded bg-ink-700 px-1">↑</kbd> <kbd className="rounded bg-ink-700 px-1">↓</kbd> naviga</span>
          <span><kbd className="rounded bg-ink-700 px-1">↵</kbd> esegui</span>
          <span><kbd className="rounded bg-ink-700 px-1">esc</kbd> chiudi</span>
          <span className="ml-auto flex items-center gap-1"><Send size={11} /> {filtered.length} comandi</span>
        </div>
      </div>
    </div>
  );
}
