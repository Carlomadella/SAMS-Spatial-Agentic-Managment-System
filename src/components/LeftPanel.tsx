import { MapPin, Package } from "lucide-react";
import { Explorer } from "./Explorer";
import { ResizeHandle } from "./ResizeHandle";
import { ScmView } from "./ScmView";
import { SearchView } from "./SearchView";
import { useStore } from "../store/useStore";
import { ZONES } from "../data/world";

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

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="CAD spaziale · Zone" />
      <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {ZONES.map((z) => (
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


function ExtensionsView() {
  const backendOnline = useStore((s) => s.backendOnline);
  const runtimeReady = useStore((s) => s.runtimeReady);
  const simMode = useStore((s) => s.simMode);

  // Each "extension" reflects a real capability and its live state, instead of
  // a hardcoded on/off flag.
  const exts: { name: string; desc: string; state: "on" | "live" | "off" }[] = [
    { name: "CAD spaziale", desc: "Layout 3D dell'ufficio e zone", state: "on" },
    { name: "Runtime agenti", desc: "Ciclo di vita e scheduling dei task", state: runtimeReady ? "on" : "off" },
    { name: "Gate di sicurezza", desc: "Approvazione del diff prima del commit", state: "on" },
    { name: "Stream eventi", desc: "Telemetria live dell'area di lavoro (SSE)", state: backendOnline ? "live" : "off" },
    { name: "Simulazione live", desc: "Gli agenti prendono le issue GitHub in autonomia", state: simMode ? "live" : "off" },
  ];

  const chip: Record<string, string> = {
    on: "bg-emerald-500/15 text-emerald-300",
    live: "bg-brand/15 text-brand-soft",
    off: "bg-ink-700 text-mut",
  };
  const label: Record<string, string> = { on: "Attiva", live: "Live", off: "Off" };

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Estensioni" />
      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-3">
        {exts.map((e) => (
          <div key={e.name} className="flex items-start gap-2 rounded-md border border-line bg-ink-850 p-2">
            <Package size={16} className="mt-0.5 text-brand-soft" />
            <div className="flex-1">
              <div className="text-[13px] text-slate-200">{e.name}</div>
              <div className="text-[11px] text-mut">{e.desc}</div>
            </div>
            <span className={`chip ${chip[e.state]}`}>
              {e.state === "live" && (
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-soft" />
              )}
              {label[e.state]}
            </span>
          </div>
        ))}
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
      {activity === "extensions" && <ExtensionsView />}
      <ResizeHandle side="right" onDelta={(d) => setLeftWidth(useStore.getState().leftWidth + d)} />
    </aside>
  );
}
