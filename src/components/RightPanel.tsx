import { SystemOverview } from "./SystemOverview";
import { ActionsPanel } from "./ActionsPanel";
import { ResizeHandle } from "./ResizeHandle";
import { useStore } from "../store/useStore";
import { AgentInspector } from "./AgentInspector";
import { useIsMobile } from "./MobileBar";

export function RightPanel() {
  const rightWidth = useStore((s) => s.rightWidth);
  const setRightWidth = useStore((s) => s.setRightWidth);
  // Su mobile l'Inspector non sta nel pannello inferiore (lo copriva): sta qui, in cima al
  // drawer che si apre col bottone "Inspector" della barra in basso.
  const isMobile = useIsMobile();
  return (
    <aside
      data-tour="inspector"
      className="relative flex shrink-0 flex-col border-l border-line bg-gradient-to-b from-ink-850/70 to-ink-900/70 backdrop-blur-sm"
      style={{ width: rightWidth }}
    >
      <ResizeHandle side="left" onDelta={(d) => setRightWidth(useStore.getState().rightWidth - d)} />
      {isMobile && (
        <div className="max-h-[60%] shrink-0 overflow-y-auto border-b border-line">
          <AgentInspector />
        </div>
      )}
      <SystemOverview />
      <ActionsPanel />
    </aside>
  );
}
