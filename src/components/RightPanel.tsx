import { SystemOverview } from "./SystemOverview";
import { ActionsPanel } from "./ActionsPanel";

export function RightPanel() {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-line bg-gradient-to-b from-ink-850/70 to-ink-900/70 backdrop-blur-sm">
      <SystemOverview />
      <ActionsPanel />
    </aside>
  );
}
