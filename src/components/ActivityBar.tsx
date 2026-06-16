import { Boxes, Files, GitBranch, Puzzle, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useStore } from "../store/useStore";
import type { ActivityView } from "../types";
import { cn } from "../lib/utils";

const ITEMS: { id: ActivityView; icon: LucideIcon; label: string }[] = [
  { id: "explorer", icon: Files, label: "Explorer" },
  { id: "search", icon: Search, label: "Search" },
  { id: "scm", icon: GitBranch, label: "Source Control" },
  { id: "cad", icon: Boxes, label: "Spatial CAD" },
  { id: "extensions", icon: Puzzle, label: "Extensions" },
];

export function ActivityBar() {
  const activity = useStore((s) => s.activity);
  const setActivity = useStore((s) => s.setActivity);
  const leftOpen = useStore((s) => s.leftOpen);
  const toggleLeft = useStore((s) => s.toggleLeft);

  return (
    <nav className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-line bg-ink-900 py-2">
      {ITEMS.map(({ id, icon: Icon, label }) => {
        const active = activity === id && leftOpen;
        return (
          <button
            key={id}
            title={label}
            onClick={() => {
              if (activity === id && leftOpen) toggleLeft();
              else {
                setActivity(id);
                if (!leftOpen) toggleLeft();
              }
            }}
            className={cn(
              "relative flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-white",
              active && "text-white",
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand" />
            )}
            <Icon size={20} />
          </button>
        );
      })}
    </nav>
  );
}
