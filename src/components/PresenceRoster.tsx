import { useStore } from "../store/useStore";
import { observerRoster, overflowCount } from "../lib/observers";

/**
 * Ufficio multiplayer (Roadmap 4): una fila di avatar in alto a sinistra della
 * scena che mostra *chi* sta guardando lo stesso ufficio, live. Si aggiorna dalla
 * presence SSE (nomi distinti). Compare solo quando il workspace è davvero
 * condiviso (almeno due persone) per non disturbare chi lavora da solo.
 */
export function PresenceRoster() {
  const backendOnline = useStore((s) => s.backendOnline);
  const people = useStore((s) => s.people);
  const myName = useStore((s) => s.chatName);

  if (!backendOnline) return null;
  const roster = observerRoster(people, myName);
  const overflow = overflowCount(people, myName);
  if (roster.length < 2 && overflow === 0) return null;

  const names = roster.map((r) => (r.isYou ? `${r.name} (tu)` : r.name)).join(", ");

  return (
    <div
      className="absolute left-3 top-3 flex items-center rounded-full border border-slate-300/60 bg-white/80 px-1.5 py-1 shadow-sm backdrop-blur"
      title={`Nel workspace ora: ${names}`}
    >
      <div className="flex -space-x-2">
        {roster.map((r) => (
          <div
            key={`${r.name}-${r.isYou ? "you" : "x"}`}
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ${
              r.isYou ? "ring-slate-800/70" : "ring-white/90"
            }`}
            style={{ backgroundColor: r.color }}
          >
            {r.initial}
          </div>
        ))}
        {overflow > 0 && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-500 text-[10px] font-semibold text-white ring-2 ring-white/90">
            +{overflow}
          </div>
        )}
      </div>
      <span className="ml-2 mr-1 text-[11px] font-medium text-slate-600">nel workspace</span>
    </div>
  );
}
