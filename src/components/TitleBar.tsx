import type { ReactNode } from "react";
import {
  Bot,
  Command,
  Moon,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Plus,
  Search,
  Settings,
  Sprout,
  Sun,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { cn } from "../lib/utils";
import { canConfigure } from "../lib/roleUi";

function IconBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick?: () => void;
  active?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-ink-700 hover:text-white",
        active && "bg-ink-700 text-white",
      )}
    >
      {children}
    </button>
  );
}

export function TitleBar() {
  const setCommandOpen = useStore((s) => s.setCommandOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const viewerRole = useStore((s) => s.viewerRole);
  const setGardenOpen = useStore((s) => s.setGardenOpen);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const addAgent = useStore((s) => s.addAgent);
  const leftOpen = useStore((s) => s.leftOpen);
  const rightOpen = useStore((s) => s.rightOpen);
  const bottomOpen = useStore((s) => s.bottomOpen);
  const toggleLeft = useStore((s) => s.toggleLeft);
  const toggleRight = useStore((s) => s.toggleRight);
  const toggleBottom = useStore((s) => s.toggleBottom);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-gradient-to-b from-ink-850 to-ink-900 px-3 shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
      {/* brand */}
      <div className="flex items-center gap-2.5 pl-0.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-indigo-600 shadow-glow ring-1 ring-white/10">
          <Bot size={16} className="text-white" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-bold tracking-tight text-white">SAMS</span>
          <span className="hidden text-[12px] text-mut sm:inline">
            Spatial Agentic Management System
          </span>
        </div>
      </div>

      <div className="h-5 w-px bg-line" aria-hidden />

      {/* command search */}
      <button
        onClick={() => setCommandOpen(true)}
        className="group mx-auto flex h-8 w-full max-w-xl items-center gap-2 rounded-lg border border-line bg-ink-850 px-3 text-sm text-mut transition-colors hover:border-brand/40 hover:bg-ink-800"
      >
        <Search size={15} />
        <span className="flex-1 text-left">Digita un comando o cerca…</span>
        <kbd className="flex items-center gap-0.5 rounded border border-line bg-ink-800 px-1.5 py-0.5 text-[10px] text-slate-400">
          <Command size={10} /> K
        </kbd>
      </button>

      {/* right actions */}
      <div className="flex items-center gap-1">
        <button data-tour="add-agent" onClick={() => addAgent()} className="btn btn-primary mr-1 h-7">
          <Plus size={14} /> Agente
        </button>
        <span data-tour="garden" className="inline-flex">
          <IconBtn title="Commit Garden" onClick={() => setGardenOpen(true)}>
            <Sprout size={16} />
          </IconBtn>
        </span>
        <IconBtn title={theme === "dark" ? "Tema chiaro" : "Tema scuro"} onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </IconBtn>
        {canConfigure(viewerRole) && (
        <IconBtn title="Impostazioni runtime" onClick={() => setSettingsOpen(true)}>
          <Settings size={16} />
        </IconBtn>
        )}
        <IconBtn title="Mostra/nascondi Esplora risorse" onClick={toggleLeft} active={leftOpen}>
          <PanelLeft size={16} />
        </IconBtn>
        <IconBtn title="Mostra/nascondi pannello" onClick={toggleBottom} active={bottomOpen}>
          <PanelBottom size={16} />
        </IconBtn>
        <IconBtn title="Mostra/nascondi panoramica sistema" onClick={toggleRight} active={rightOpen}>
          <PanelRight size={16} />
        </IconBtn>
      </div>
    </header>
  );
}
