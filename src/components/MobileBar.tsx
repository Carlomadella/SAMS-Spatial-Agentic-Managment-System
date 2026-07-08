import { useEffect, useState, type ReactNode } from "react";
import { Bot, Building2, Files, Terminal } from "lucide-react";
import { useStore } from "../store/useStore";
import { isMobileWidth, MOBILE_BREAKPOINT } from "../lib/layout";
import { cn } from "../lib/utils";

/**
 * Reagisce alla fascia mobile (touch) in modo reattivo. Sotto `MOBILE_BREAKPOINT`
 * il workspace passa a un layout a drawer + barra azioni (vedi App.tsx).
 */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => (typeof window !== "undefined" ? isMobileWidth(window.innerWidth) : false));
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}

/**
 * Drawer in overlay per un pannello laterale su mobile: invece di schiacciare la
 * scena come colonna inline, il pannello scorre sopra con uno scrim che lo chiude
 * al tocco. Il pannello figlio mantiene la sua larghezza.
 */
export function MobileDrawer({ side, onClose, children }: { side: "left" | "right"; onClose: () => void; children: ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <div className={cn("fixed bottom-0 top-0 z-40 flex max-w-[85vw]", side === "left" ? "left-0" : "right-0")}>
        {children}
      </div>
    </>
  );
}

/** Un bottone della barra mobile. */
function BarButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
        active ? "text-brand" : "text-mut hover:text-slate-200",
      )}
    >
      {children}
      {label}
    </button>
  );
}

/**
 * Barra azioni in basso, visibile solo su mobile (< md): dà un affordance touch per
 * raggiungere Explorer, scena, Inspector e il pannello inferiore — che altrimenti,
 * a pannelli collassati, non sono apribili senza tastiera. I due drawer laterali si
 * escludono a vicenda per non sovrapporsi.
 */
export function MobileBar() {
  const leftOpen = useStore((s) => s.leftOpen);
  const rightOpen = useStore((s) => s.rightOpen);
  const bottomOpen = useStore((s) => s.bottomOpen);
  const setLeftOpen = useStore((s) => s.setLeftOpen);
  const setRightOpen = useStore((s) => s.setRightOpen);
  const setBottomTab = useStore((s) => s.setBottomTab);
  const toggleBottom = useStore((s) => s.toggleBottom);

  const openLeft = () => {
    setRightOpen(false);
    setLeftOpen(!leftOpen);
  };
  const openRight = () => {
    setLeftOpen(false);
    setRightOpen(!rightOpen);
  };
  const showScene = () => {
    setLeftOpen(false);
    setRightOpen(false);
  };

  return (
    <nav className="flex shrink-0 items-stretch border-t border-line bg-ink-900/95 backdrop-blur md:hidden">
      <BarButton label="Explorer" active={leftOpen} onClick={openLeft}>
        <Files size={17} />
      </BarButton>
      <BarButton label="Scena" active={!leftOpen && !rightOpen} onClick={showScene}>
        <Building2 size={17} />
      </BarButton>
      <BarButton label="Inspector" active={rightOpen} onClick={openRight}>
        <Bot size={17} />
      </BarButton>
      <BarButton label="Pannello" active={bottomOpen} onClick={() => (bottomOpen ? toggleBottom() : setBottomTab("eventlog"))}>
        <Terminal size={17} />
      </BarButton>
    </nav>
  );
}
