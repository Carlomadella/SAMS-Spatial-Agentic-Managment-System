import { useStore } from "../store/useStore";
import { placedCount } from "../lib/furnitureLayout";

/**
 * Banner della "modalità riordino" (Roadmap 4, frontiera #3 — drag mobili): appare
 * quando i mobili sono trascinabili, con l'istruzione e le azioni Fatto/Reset. Rende la
 * feature scopribile senza la palette. Fuori dalla modalità non renderizza nulla.
 */
export function RoomEditBanner() {
  const editMode = useStore((s) => s.roomEditMode);
  const setRoomEditMode = useStore((s) => s.setRoomEditMode);
  const resetFurniture = useStore((s) => s.resetFurniture);
  const placed = useStore((s) => placedCount(s.furniturePlacements));
  if (!editMode) return null;
  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-[3] flex -translate-x-1/2 items-center gap-3 rounded-full border border-brand/50 bg-ink-800/90 px-4 py-1.5 text-[12px] text-slate-200 shadow-panel backdrop-blur">
      <span className="flex items-center gap-1.5">
        <span className="text-base leading-none">🪑</span>
        Trascina i mobili con l'anello arancione
      </span>
      {placed > 0 && (
        <button
          onClick={() => resetFurniture()}
          className="rounded-full px-2 py-0.5 text-slate-400 transition-colors hover:text-white"
          title="Rimetti tutti i mobili a posto"
        >
          Reset ({placed})
        </button>
      )}
      <button
        onClick={() => setRoomEditMode(false)}
        className="rounded-full bg-brand px-3 py-0.5 font-medium text-white transition-colors hover:bg-brand/80 active:scale-[0.97]"
      >
        Fatto
      </button>
    </div>
  );
}
