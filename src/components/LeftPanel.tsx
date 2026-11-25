import { MapPin } from "lucide-react";
import { Explorer } from "./Explorer";
import { ResizeHandle } from "./ResizeHandle";
import { ScmView } from "./ScmView";
import { SearchView } from "./SearchView";
import { useStore, useHouse } from "../store/useStore";

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="px-3 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-mut">{title}</span>
    </div>
  );
}

function CadView() {
  const selectedAgentId = useStore((s) => s.selectedAgentId);
  const sendToZone = useStore((s) => s.sendToZone);
  const zones = useHouse().zones;

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="CAD spaziale · Zone" />
      <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {zones.map((z) => (
          <button
            key={z.id}
            disabled={!selectedAgentId}
            onClick={() => selectedAgentId && sendToZone(selectedAgentId, z.id)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-ink-700 disabled:opacity-40"
          >
            <MapPin size={15} className="text-brand-soft" />
            <span className="flex-1">
              <span className="block text-[13px] text-slate-200">{z.label}</span>
              <span className="block text-[11px] text-mut">{z.sublabel}</span>
            </span>
          </button>
        ))}
        <p className="px-2 pt-2 text-[11px] leading-relaxed text-mut">
          Seleziona un agente, poi scegli una zona per inviarlo lì.
        </p>
      </div>
    </div>
  );
}

export function LeftPanel() {
  const activity = useStore((s) => s.activity);
  const leftWidth = useStore((s) => s.leftWidth);
  const setLeftWidth = useStore((s) => s.setLeftWidth);
  return (
    <aside
      className="relative flex shrink-0 flex-col border-r border-line bg-gradient-to-b from-ink-850/70 to-ink-900/70 backdrop-blur-sm"
      style={{ width: leftWidth }}
    >
      {activity === "explorer" && <Explorer />}
      {activity === "search" && <SearchView />}
      {activity === "scm" && <ScmView />}
      {activity === "cad" && <CadView />}
      <ResizeHandle side="right" onDelta={(d) => setLeftWidth(useStore.getState().leftWidth + d)} />
    </aside>
  );
}
