import { SystemOverview } from "./SystemOverview";
import { ActionsPanel } from "./ActionsPanel";
import { ResizeHandle } from "./ResizeHandle";
import { useStore } from "../store/useStore";

export function RightPanel() {
  const rightWidth = useStore((s) => s.rightWidth);
  const setRightWidth = useStore((s) => s.setRightWidth);
  return (
    <aside
      className="relative flex shrink-0 flex-col border-l border-line bg-ink-900/60"
      style={{ width: rightWidth }}
    >
      <ResizeHandle side="left" onDelta={(d) => setRightWidth(useStore.getState().rightWidth - d)} />
      <SystemOverview />
      <ActionsPanel />
    </aside>
  );
}
