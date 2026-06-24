import { useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  Maximize2,
  MapPin,
  MousePointer2,
  Plus,
  RotateCcw,
  Send,
  Server,
  Sprout,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useStore } from "../store/useStore";
import { AGENT_COLORS, type EnvironmentName } from "../types";
import { ZONES } from "../data/world";
import { titleCase } from "../lib/utils";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  keywords?: string;
  run: () => void;
}

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

    list.push({ id: "add", label: "Spawn new agent", icon: Plus, keywords: "create add new", run: () => s.addAgent() });
    for (const c of AGENT_COLORS) {
      list.push({
        id: `add-${c}`,
        label: `Spawn ${c} agent`,
        icon: Plus,
        keywords: `create ${c}`,
        run: () => s.addAgent(c),
      });
    }

    for (const a of agents) {
      list.push({
        id: `sel-${a.id}`,
        label: `Select ${a.name}`,
        hint: a.role,
        icon: MousePointer2,
        keywords: "select focus agent",
        run: () => s.selectAgent(a.id),
      });
    }

    if (sel) {
      for (const z of ZONES) {
        list.push({
          id: `zone-${z.id}`,
          label: `Send ${sel.name} → ${z.label}`,
          hint: z.sublabel,
          icon: MapPin,
          keywords: "dispatch move send zone",
          run: () => s.sendToZone(sel.id, z.id),
        });
      }
    }

    (["dev", "staging", "prod"] as EnvironmentName[]).forEach((e) => {
      list.push({
        id: `env-${e}`,
        label: `Switch environment → ${e}`,
        icon: Server,
        keywords: "environment env deploy",
        run: () => s.setEnvironment(e),
      });
    });

    list.push({ id: "cad", label: "Open Spatial CAD · Zones", icon: Boxes, keywords: "zones cad layout", run: () => s.setActivity("cad") });
    list.push({ id: "focus", label: "Toggle focus mode (hide/show panels)", icon: Maximize2, keywords: "focus zen panels hide", run: () => s.toggleFocus() });
    list.push({ id: "garden", label: "Open Commit Garden", icon: Sprout, keywords: "garden plant commit grow", run: () => s.setGardenOpen(true) });
    list.push({ id: "clear", label: "Clear event log", icon: Trash2, keywords: "log clear", run: () => s.clearEvents() });
    list.push({ id: "reset", label: "Reset workspace", icon: RotateCcw, keywords: "reset restore", run: () => s.resetWorld() });

    return list;
  }, [agents, selectedAgentId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => `${c.label} ${c.hint ?? ""} ${c.keywords ?? ""}`.toLowerCase().includes(q),
    );
  }, [commands, query]);

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
          placeholder="Type a command or search…"
          className="w-full border-b border-line bg-transparent px-4 py-3.5 text-sm text-slate-100 outline-none placeholder:text-mut"
        />
        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-[13px] text-mut">No matching commands</div>
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
          <span><kbd className="rounded bg-ink-700 px-1">↑</kbd> <kbd className="rounded bg-ink-700 px-1">↓</kbd> navigate</span>
          <span><kbd className="rounded bg-ink-700 px-1">↵</kbd> run</span>
          <span><kbd className="rounded bg-ink-700 px-1">esc</kbd> close</span>
          <span className="ml-auto flex items-center gap-1"><Send size={11} /> {filtered.length} commands</span>
        </div>
      </div>
    </div>
  );
}
