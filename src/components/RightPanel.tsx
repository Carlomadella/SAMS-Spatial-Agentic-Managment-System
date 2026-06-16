import { SystemOverview } from "./SystemOverview";
import { ActionsPanel } from "./ActionsPanel";

export function RightPanel() {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-line bg-ink-900/60">
      <SystemOverview />
      <ActionsPanel />
    </aside>
  );
}
