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
import { canAssign } from "../lib/roleUi";

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
  const setGardenOpen = useStore((s) => s.setGardenOpen);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const addAgent = useStore((s) => s.addAgent);
  const canEdit = canAssign(useStore((s) => s.viewerRole));
  const leftOpen = useStore((s) => s.leftOpen);
  const rightOpen = useStore((s) => s.rightOpen);
  const bottomOpen = useStore((s) => s.bottomOpen);
  const toggleLeft = useStore((s) => s.toggleLeft);
  const toggleRight = useStore((s) => s.toggleRight);
  const toggleBottom = useStore((s) => s.toggleBottom);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-gradient-to-b from-ink-850 to-ink-900 px-3 shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
      {/* brand */}
      <div className="flex items-center gap-2.5 pl-0.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-[#7a0710] shadow-glow ring-1 ring-white/10">
          <Bot size={16} className="text-white" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-bold tracking-tight text-white">SAMS</span>
          <span className="hidden text-[12px] text-mut sm:inline">
            Spatial Agentic Management System
          </span>
        </div>
      </div>

      <div className="hidden h-5 w-px bg-line sm:block" aria-hidden />

      {/* command search — su un telefono solo l'icona: il testo andava su tre righe (collaudo 10/11) */}
      <button
        onClick={() => setCommandOpen(true)}
        aria-label="Digita un comando o cerca"
        className="group ml-auto flex h-8 w-8 shrink-0 items-center justify-center gap-2 rounded-lg border border-line bg-ink-850 text-sm text-mut transition-colors hover:border-brand/40 hover:bg-ink-800 sm:mx-auto sm:w-full sm:max-w-xl sm:shrink sm:justify-start sm:px-3"
      >
        <Search size={15} className="shrink-0" />
        <span className="hidden flex-1 truncate text-left sm:inline">Digita un comando o cerca…</span>
        <kbd className="hidden items-center gap-0.5 rounded border border-line bg-ink-800 px-1.5 py-0.5 text-[10px] text-slate-400 sm:flex">
          <Command size={10} /> K
        </kbd>
      </button>

      {/* right actions */}
      <div className="flex shrink-0 items-center gap-1">
        {canEdit && (
          <button data-tour="add-agent" onClick={() => addAgent()} aria-label="Aggiungi agente" className="btn btn-primary mr-1 h-7">
            <Plus size={14} /> <span className="hidden sm:inline">Agente</span>
          </button>
        )}
        <span data-tour="garden" className="inline-flex">
          <IconBtn title="Commit Garden" onClick={() => setGardenOpen(true)}>
            <Sprout size={16} />
          </IconBtn>
        </span>
        <IconBtn title={theme === "dark" ? "Tema chiaro" : "Tema scuro"} onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </IconBtn>
        {/* Per tutti: ognuno vede le sue categorie, le sensibili solo l'owner. */}
        <IconBtn title="Impostazioni" onClick={() => setSettingsOpen(true)}>
          <Settings size={16} />
        </IconBtn>
        {/* Su mobile i pannelli si aprono dalla barra in basso (MobileBar): qui sarebbero doppi. */}
        <div className="hidden items-center gap-1 md:flex">
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
      </div>
    </header>
  );
}
