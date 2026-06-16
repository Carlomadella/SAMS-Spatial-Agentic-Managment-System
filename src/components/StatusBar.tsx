import { Check, CircleAlert, GitBranch, Radio, TriangleAlert, Users } from "lucide-react";
import { useStore } from "../store/useStore";
import { backendEnabled } from "../lib/backend";

export function StatusBar() {
  const environment = useStore((s) => s.environment);
  const agents = useStore((s) => s.agents);
  const backendOnline = useStore((s) => s.backendOnline);
  const warnings = useStore(
    (s) => s.agents.filter((a) => a.status === "blocked" || a.status === "review").length,
  );

  const runtime = !backendEnabled
    ? "Runtime: sandbox"
    : backendOnline
      ? "Runtime: live"
      : "Runtime: offline";

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between bg-brand px-3 text-[11px] font-medium text-white/90">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <GitBranch size={12} /> main
        </span>
        <span className="capitalize opacity-90">{environment}</span>
        <span className="flex items-center gap-1">
          <CircleAlert size={12} /> 0
        </span>
        <span className="flex items-center gap-1">
          <TriangleAlert size={12} /> {warnings}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <Users size={12} /> {agents.length} agents
        </span>
        <span
          className="flex items-center gap-1"
          title={backendEnabled ? "Managed-agents runtime" : "Set VITE_SAMS_BACKEND_URL to go live"}
        >
          <Radio size={12} /> {runtime}
        </span>
        <span className="hidden sm:inline">UTF-8</span>
        <span className="hidden sm:inline">LF</span>
        <span className="hidden sm:inline">YAML</span>
        <span className="flex items-center gap-1">
          <Check size={12} /> SAMS: Connected
        </span>
      </div>
    </footer>
  );
}
