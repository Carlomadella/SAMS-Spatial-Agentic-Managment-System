import { useEffect, useLayoutEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useStore } from "../store/useStore";
import { clampStep, isLastStep, TOUR_STEPS, tourProgress } from "../lib/tour";

interface Rect { top: number; left: number; width: number; height: number }

/** Read the on-screen rect of the current step's target, or null if absent. */
function targetRect(selector?: string): Rect | null {
  if (!selector || typeof document === "undefined") return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * Interactive UI tour: a dimmed overlay with a spotlight cut-out around each
 * highlighted element and an explanatory card. Robust — if a target element is
 * missing, the card simply centres with no spotlight.
 */
export function Tour() {
  const open = useStore((s) => s.tourOpen);
  const setTourOpen = useStore((s) => s.setTourOpen);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const current = TOUR_STEPS[clampStep(step)];

  // Re-measure the target on step change, resize and scroll.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => setRect(targetRect(current.target));
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, current.target]);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  if (!open) return null;

  function finish() {
    try { localStorage.setItem("sams.tour", "1"); } catch { /* ignore */ }
    setTourOpen(false);
  }
  function next() {
    if (isLastStep(step)) finish();
    else setStep((i) => clampStep(i + 1));
  }
  function prev() {
    setStep((i) => clampStep(i - 1));
  }

  const pad = 8;
  const spotlight = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  // Place the card below the target if there's room, else above; else centre.
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardStyle: React.CSSProperties = (() => {
    if (!spotlight) return { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
    const below = spotlight.top + spotlight.height + 12;
    const wantAbove = below > vh - 180;
    const clampLeft = Math.min(Math.max(12, spotlight.left), (typeof window !== "undefined" ? window.innerWidth : 1200) - 340);
    return wantAbove
      ? { top: Math.max(12, spotlight.top - 12), left: clampLeft, transform: "translateY(-100%)" }
      : { top: below, left: clampLeft };
  })();

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Tour dell'interfaccia">
      {/* Dim + spotlight. A big box-shadow around the cut-out darkens everything else. */}
      {spotlight ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-brand/70 transition-all duration-200"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: "0 0 0 9999px rgba(2,6,12,0.72)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/70" />
      )}

      {/* Click-catcher to advance (but not on the card) */}
      <div className="absolute inset-0" onClick={next} />

      {/* Card */}
      <div
        className="absolute w-[320px] animate-fade-in rounded-xl border border-line bg-ink-850 p-4 shadow-panel"
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={finish}
          aria-label="Chiudi tour"
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-ink-700 hover:text-slate-200"
        >
          <X size={14} />
        </button>
        <div className="text-[11px] font-medium text-brand-soft">{tourProgress(step)}</div>
        <h3 className="mt-1 text-[15px] font-bold text-white">{current.title}</h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-300">{current.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button onClick={finish} className="text-[12px] text-mut transition-colors hover:text-slate-300">
            Salta
          </button>
          <div className="flex items-center gap-1.5">
            {step > 0 && (
              <button onClick={prev} className="btn h-7 gap-1 px-2 text-[12px]">
                <ArrowLeft size={13} /> Indietro
              </button>
            )}
            <button onClick={next} className="btn btn-primary h-7 gap-1 px-2.5 text-[12px]">
              {isLastStep(step) ? (<><Check size={13} /> Fine</>) : (<>Avanti <ArrowRight size={13} /></>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
