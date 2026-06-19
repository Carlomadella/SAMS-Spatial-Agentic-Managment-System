import { cn } from "../lib/utils";

type Side = "left" | "right" | "top";

/** A thin drag strip on a panel edge. Reports per-move deltas in px. */
export function ResizeHandle({ side, onDelta }: { side: Side; onDelta: (delta: number) => void }) {
  const vertical = side === "top";

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    const move = (ev: PointerEvent) => onDelta(vertical ? ev.movementY : ev.movementX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    document.body.style.cursor = vertical ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
  }

  return (
    <div
      onPointerDown={onPointerDown}
      className={cn(
        "absolute z-20 bg-transparent transition-colors hover:bg-brand/40",
        side === "right" && "right-0 top-0 h-full w-1.5 translate-x-1/2 cursor-col-resize",
        side === "left" && "left-0 top-0 h-full w-1.5 -translate-x-1/2 cursor-col-resize",
        side === "top" && "left-0 top-0 h-1.5 w-full -translate-y-1/2 cursor-row-resize",
      )}
    />
  );
}
