import type { ReactNode } from "react";
import {
  Bot,
  Command,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Plus,
  Search,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { cn } from "../lib/utils";

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
  const addAgent = useStore((s) => s.addAgent);
  const leftOpen = useStore((s) => s.leftOpen);
  const rightOpen = useStore((s) => s.rightOpen);
  const bottomOpen = useStore((s) => s.bottomOpen);
  const toggleLeft = useStore((s) => s.toggleLeft);
  const toggleRight = useStore((s) => s.toggleRight);
  const toggleBottom = useStore((s) => s.toggleBottom);

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line bg-ink-900 px-3">
      {/* window dots */}
      <div className="flex items-center gap-2 pl-1 pr-2">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
      </div>

      {/* brand */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-indigo-600 shadow-glow">
          <Bot size={16} className="text-white" />
        </div>
        <div className="leading-none">
          <div className="text-[13px] font-bold tracking-tight text-white">SAMS</div>
        </div>
        <span className="hidden text-[12px] text-mut md:inline">
          Spatial Agentic Management System
        </span>
      </div>

      {/* command search */}
      <button
        onClick={() => setCommandOpen(true)}
        className="group mx-auto flex h-8 w-full max-w-xl items-center gap-2 rounded-lg border border-line bg-ink-850 px-3 text-sm text-mut transition-colors hover:border-brand/40 hover:bg-ink-800"
      >
        <Search size={15} />
        <span className="flex-1 text-left">Type a command or search…</span>
        <kbd className="flex items-center gap-0.5 rounded border border-line bg-ink-800 px-1.5 py-0.5 text-[10px] text-slate-400">
          <Command size={10} /> K
        </kbd>
      </button>

      {/* right actions */}
      <div className="flex items-center gap-1">
        <button onClick={() => addAgent()} className="btn btn-primary mr-1 h-7">
          <Plus size={14} /> Agent
        </button>
        <IconBtn title="Toggle Explorer" onClick={toggleLeft} active={leftOpen}>
          <PanelLeft size={16} />
        </IconBtn>
        <IconBtn title="Toggle Panel" onClick={toggleBottom} active={bottomOpen}>
          <PanelBottom size={16} />
        </IconBtn>
        <IconBtn title="Toggle System Overview" onClick={toggleRight} active={rightOpen}>
          <PanelRight size={16} />
        </IconBtn>
      </div>
    </header>
  );
}
