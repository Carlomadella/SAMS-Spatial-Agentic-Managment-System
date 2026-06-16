import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileText,
  Folder,
  FolderOpen,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { STATIC_TREE } from "../data/seed";
import { AGENT_HEX, type FileNode } from "../types";
import { cn } from "../lib/utils";

const BADGE_COLOR: Record<string, string> = {
  M: "text-amber-400",
  U: "text-emerald-400",
  A: "text-emerald-400",
};

function fileIcon(name: string) {
  if (name.endsWith(".md")) return FileText;
  if (
    name.endsWith(".flow") ||
    name.endsWith(".yaml") ||
    name.endsWith(".env") ||
    name.endsWith(".spatial")
  )
    return FileCode2;
  return FileText;
}

function TreeRow({
  node,
  depth,
  expanded,
  toggle,
}: {
  node: FileNode;
  depth: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
}) {
  const selectedAgentId = useStore((s) => s.selectedAgentId);
  const selectAgent = useStore((s) => s.selectAgent);
  const agents = useStore((s) => s.agents);

  const isFolder = node.kind === "folder";
  const isOpen = expanded.has(node.id);
  const isSelectedAgent = !!node.agentId && node.agentId === selectedAgentId;
  const agent = node.agentId ? agents.find((a) => a.id === node.agentId) : undefined;
  const Icon = isFolder ? (isOpen ? FolderOpen : Folder) : fileIcon(node.name);

  return (
    <>
      <button
        onClick={() => {
          if (isFolder) toggle(node.id);
          else if (node.agentId) selectAgent(node.agentId);
        }}
        className={cn(
          "group flex w-full items-center gap-1 rounded px-1 py-[3px] text-left text-[13px] transition-colors hover:bg-ink-700/70",
          isSelectedAgent ? "bg-brand/15 text-white" : "text-slate-300",
        )}
        style={{ paddingLeft: 6 + depth * 12 }}
      >
        {isFolder ? (
          isOpen ? (
            <ChevronDown size={13} className="shrink-0 text-mut" />
          ) : (
            <ChevronRight size={13} className="shrink-0 text-mut" />
          )
        ) : (
          <span className="w-[13px] shrink-0" />
        )}

        {agent ? (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: AGENT_HEX[agent.color] }}
          />
        ) : (
          <Icon size={14} className={cn("shrink-0", isFolder ? "text-brand-soft" : "text-mut")} />
        )}

        <span className="flex-1 truncate">{node.name}</span>
        {node.badge && (
          <span className={cn("pr-1 text-[11px] font-semibold", BADGE_COLOR[node.badge])}>
            {node.badge}
          </span>
        )}
      </button>

      {isFolder &&
        isOpen &&
        node.children?.map((child) => (
          <TreeRow key={child.id} node={child} depth={depth + 1} expanded={expanded} toggle={toggle} />
        ))}
    </>
  );
}

export function Explorer() {
  const agents = useStore((s) => s.agents);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["root", "agents", "workflows", "environments", "configs"]),
  );

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const tree: FileNode = {
    id: "root",
    name: "SAMS-WORKSPACE",
    kind: "folder",
    children: [
      {
        id: "agents",
        name: "agents",
        kind: "folder",
        children: agents.map((a) => ({
          id: `file-${a.id}`,
          name: a.name,
          kind: "file" as const,
          agentId: a.id,
          badge: a.task ? ("M" as const) : ("U" as const),
        })),
      },
      ...STATIC_TREE,
    ],
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-mut">
          Explorer
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 pb-3">
        <TreeRow node={tree} depth={0} expanded={expanded} toggle={toggle} />
      </div>
    </div>
  );
}
