import { useEffect, useState } from "react";
import { Hand, HelpCircle, Move3d, MousePointerClick, PanelBottom, X } from "lucide-react";
import { TitleBar } from "./components/TitleBar";
import { ActivityBar } from "./components/ActivityBar";
import { LeftPanel } from "./components/LeftPanel";
import { RightPanel } from "./components/RightPanel";
import { BottomPanel } from "./components/BottomPanel";
import { StatusBar } from "./components/StatusBar";
import { CommandPalette } from "./components/CommandPalette";
import { SettingsModal } from "./components/SettingsModal";
import { OfficeScene } from "./scene/OfficeScene";
import { useStore } from "./store/useStore";
import { connectBackend } from "./lib/backend";

function StageHint() {
  const [open, setOpen] = useState(() => localStorage.getItem("sams.hint") !== "off");

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          localStorage.removeItem("sams.hint");
        }}
        title="Show tips"
        className="absolute bottom-3 left-3 flex h-7 w-7 items-center justify-center rounded-full border border-slate-300/60 bg-white/80 text-slate-600 shadow-sm backdrop-blur transition-colors hover:bg-white"
      >
        <HelpCircle size={15} />
      </button>
    );
  }

  return (
    <div className="absolute bottom-3 left-3 flex flex-col gap-1 rounded-lg border border-slate-300/60 bg-white/85 px-3 py-2 pr-8 text-[11px] text-slate-600 shadow-sm backdrop-blur">
      <button
        onClick={() => {
          setOpen(false);
          localStorage.setItem("sams.hint", "off");
        }}
        title="Dismiss"
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700"
      >
        <X size={12} />
      </button>
      <span className="flex items-center gap-1.5">
        <MousePointerClick size={13} /> Click an agent to select &amp; command it
      </span>
      <span className="flex items-center gap-1.5">
        <Hand size={13} /> Click the floor to send it walking
      </span>
      <span className="flex items-center gap-1.5">
        <Move3d size={13} /> Drag to orbit · scroll to zoom
      </span>
    </div>
  );
}

/** Floating affordance to reopen the bottom panel (Event Log) once it's hidden. */
function ReopenPanelButton() {
  const bottomOpen = useStore((s) => s.bottomOpen);
  const setBottomTab = useStore((s) => s.setBottomTab);
  if (bottomOpen) return null;
  return (
    <button
      onClick={() => setBottomTab("eventlog")}
      title="Show the Event Log panel"
      className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-line bg-ink-800/90 px-3 py-1.5 text-[11px] font-medium text-slate-200 shadow-panel backdrop-blur transition-all hover:border-brand/50 hover:bg-ink-700 hover:text-white active:scale-[0.97]"
    >
      <PanelBottom size={14} className="text-brand-soft" />
      Event Log
    </button>
  );
}

export default function App() {
  const leftOpen = useStore((s) => s.leftOpen);
  const rightOpen = useStore((s) => s.rightOpen);
  const bottomOpen = useStore((s) => s.bottomOpen);
  const setCommandOpen = useStore((s) => s.setCommandOpen);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(!useStore.getState().commandOpen);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen]);

  // Connect to the optional managed-agents runtime (no-op if not configured).
  useEffect(() => connectBackend(), []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-ink-950 text-slate-200">
      <TitleBar />

      <div className="flex min-h-0 flex-1">
        <ActivityBar />
        {leftOpen && <LeftPanel />}

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <OfficeScene />
            <StageHint />
            <ReopenPanelButton />
          </div>
          {bottomOpen && <BottomPanel />}
        </main>

        {rightOpen && <RightPanel />}
      </div>

      <StatusBar />
      <CommandPalette />
      <SettingsModal />
    </div>
  );
}
