import { useMemo, useState } from "react";
import { Bot, FileCode2, Search, Workflow, X } from "lucide-react";
import { useStore } from "../store/useStore";
import { STATIC_TREE, WORKFLOW_DEFS } from "../data/seed";
import { flattenFiles } from "../lib/fileTree";
import { searchWorkspace, type SearchResult } from "../lib/search";
import { AGENT_HEX } from "../types";
import { cn } from "../lib/utils";

const KIND_META: Record<SearchResult["kind"], { icon: typeof Bot; label: string }> = {
  agent: { icon: Bot, label: "Agenti" },
  workflow: { icon: Workflow, label: "Workflow" },
  file: { icon: FileCode2, label: "File" },
};

export function SearchView() {
  const agents = useStore((s) => s.agents);
  const selectAgent = useStore((s) => s.selectAgent);
  const setActivity = useStore((s) => s.setActivity);
  const [query, setQuery] = useState("");

  const files = useMemo(() => flattenFiles(STATIC_TREE), []);
  const results = useMemo(
    () => searchWorkspace(query, agents, WORKFLOW_DEFS, files),
    [query, agents, files],
  );

  // group results by kind, preserving the search order
  const groups = useMemo(() => {
    const g: Record<SearchResult["kind"], SearchResult[]> = { agent: [], workflow: [], file: [] };
    for (const r of results) g[r.kind].push(r);
    return g;
  }, [results]);

  function onPick(r: SearchResult) {
    if (r.agentId) {
      selectAgent(r.agentId);
    } else if (r.workflowId) {
      setActivity("explorer"); // workflows live in the Explorer runner
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-mut">Search</span>
      </div>

      {/* search box */}
      <div className="px-3">
        <div className="flex items-center gap-2 rounded-md border border-line bg-ink-850 px-2 py-1.5 focus-within:border-brand/50">
          <Search size={14} className="shrink-0 text-mut" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            placeholder="Cerca agenti, workflow, file…"
            className="w-full bg-transparent text-[13px] text-slate-200 outline-none placeholder:text-mut"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="shrink-0 rounded p-0.5 text-mut hover:text-slate-300"
              aria-label="Cancella ricerca"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* results */}
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {query.trim() === "" ? (
          <p className="px-1 pt-2 text-[12px] leading-relaxed text-mut">
            Cerca tra agenti (nome, ruolo, task), workflow e file del workspace.
          </p>
        ) : results.length === 0 ? (
          <p className="px-1 pt-2 text-[12px] text-mut">
            Nessun risultato per <span className="text-slate-300">“{query}”</span>.
          </p>
        ) : (
          (Object.keys(groups) as SearchResult["kind"][])
            .filter((k) => groups[k].length > 0)
            .map((kind) => {
              const Meta = KIND_META[kind];
              const Icon = Meta.icon;
              return (
                <div key={kind} className="mb-2">
                  <div className="px-1 py-1 text-[10px] font-semibold uppercase tracking-widest text-mut">
                    {Meta.label} <span className="text-mut/60">({groups[kind].length})</span>
                  </div>
                  {groups[kind].map((r) => {
                    const agent = r.agentId ? agents.find((a) => a.id === r.agentId) : null;
                    return (
                      <button
                        key={r.key}
                        onClick={() => onPick(r)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-ink-700/60",
                          r.kind === "file" && "cursor-default",
                        )}
                      >
                        {agent ? (
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/20"
                            style={{ background: AGENT_HEX[agent.color] }}
                          />
                        ) : (
                          <Icon size={13} className="shrink-0 text-mut" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] text-slate-200">{r.label}</span>
                          <span className="block truncate text-[10px] text-mut">{r.sublabel}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}
