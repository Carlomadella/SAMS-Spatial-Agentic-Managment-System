import { MapPin, Package, Search } from "lucide-react";
import { Explorer } from "./Explorer";
import { ResizeHandle } from "./ResizeHandle";
import { ScmView } from "./ScmView";
import { useStore } from "../store/useStore";
import { ZONES } from "../data/world";

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="px-3 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-mut">{title}</span>
    </div>
  );
}

function SearchView() {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Search" />
      <div className="px-3">
        <div className="flex items-center gap-2 rounded-md border border-line bg-ink-850 px-2 py-1.5">
          <Search size={14} className="text-mut" />
          <input
            placeholder="Search workspace…"
            className="w-full bg-transparent text-[13px] text-slate-200 outline-none placeholder:text-mut"
          />
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-mut">
          Search across agents, workflows and configs. Try an agent name or a task keyword.
        </p>
      </div>
    </div>
  );
}

function CadView() {
  const selectedAgentId = useStore((s) => s.selectedAgentId);
  const sendToZone = useStore((s) => s.sendToZone);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Spatial CAD · Zones" />
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
          Select an agent, then pick a zone to dispatch it there.
        </p>
      </div>
    </div>
  );
}


function ExtensionsView() {
  const exts = [
    { name: "Spatial CAD", desc: "3D office layout editor", on: true },
    { name: "Agent Runtime", desc: "Lifecycle & task scheduling", on: true },
    { name: "Security Gate", desc: "Access rules & approvals", on: true },
    { name: "Event Stream", desc: "Live workspace telemetry", on: false },
  ];
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Extensions" />
      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-3">
        {exts.map((e) => (
          <div key={e.name} className="flex items-start gap-2 rounded-md border border-line bg-ink-850 p-2">
            <Package size={16} className="mt-0.5 text-brand-soft" />
            <div className="flex-1">
              <div className="text-[13px] text-slate-200">{e.name}</div>
              <div className="text-[11px] text-mut">{e.desc}</div>
            </div>
            <span
              className={`chip ${e.on ? "bg-emerald-500/15 text-emerald-300" : "bg-ink-700 text-mut"}`}
            >
              {e.on ? "Enabled" : "Off"}
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
