import { useEffect } from "react";
import { Hand, Move3d, MousePointerClick } from "lucide-react";
import { TitleBar } from "./components/TitleBar";
import { ActivityBar } from "./components/ActivityBar";
import { LeftPanel } from "./components/LeftPanel";
import { RightPanel } from "./components/RightPanel";
import { BottomPanel } from "./components/BottomPanel";
import { StatusBar } from "./components/StatusBar";
import { CommandPalette } from "./components/CommandPalette";
import { OfficeScene } from "./scene/OfficeScene";
import { useStore } from "./store/useStore";

function StageHint() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1 rounded-lg border border-slate-300/60 bg-white/80 px-3 py-2 text-[11px] text-slate-600 shadow-sm backdrop-blur">
      <span className="flex items-center gap-1.5">
        <MousePointerClick size={13} /> Click an agent to select & command it
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
          </div>
          {bottomOpen && <BottomPanel />}
        </main>

        {rightOpen && <RightPanel />}
      </div>

      <StatusBar />
      <CommandPalette />
    </div>
  );
}
