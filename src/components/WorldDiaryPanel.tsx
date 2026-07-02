import { useMemo, useState } from "react";
import { BookOpen, Volume2, VolumeX } from "lucide-react";
import { useStore } from "../store/useStore";
import { buildWorldDiary, diaryPlainText } from "../lib/worldDiary";
import { narrator } from "../lib/narration";

/**
 * Diario del mondo — un feed narrativo della giornata costruito dagli eventi
 * (`buildWorldDiary`, puro). Bottone per leggerlo ad alta voce (riusa il
 * `narrator` TTS di narration.ts).
 */
export function WorldDiaryPanel() {
  const events = useStore((s) => s.events);
  const [speaking, setSpeaking] = useState(false);

  // Ricostruisce il diario a ogni cambio di eventi. `events` è già limitato a
  // 300 nello store, quindi il costo è trascurabile.
  const diary = useMemo(() => buildWorldDiary(events), [events]);

  function toggleSpeak() {
    if (speaking) {
      narrator.cancel();
      setSpeaking(false);
      return;
    }
    narrator.setEnabled(true);
    narrator.speak(diaryPlainText(diary));
    setSpeaking(true);
    // il TTS non ha callback affidabile cross-browser: resettiamo lo stato UI
    // dopo una stima generosa così il bottone torna disponibile.
    window.setTimeout(() => setSpeaking(false), 12000);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-line/40 px-3 py-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-mut">
          <BookOpen size={12} /> Diario del mondo
        </div>
        {!diary.quiet && (
          <button
            onClick={toggleSpeak}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-mut transition-colors hover:bg-ink-700 hover:text-slate-300"
            title={speaking ? "Interrompi lettura" : "Leggi ad alta voce"}
          >
            {speaking ? <VolumeX size={11} /> : <Volume2 size={11} />}
            {speaking ? "Ferma" : "Leggi"}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <p className="mb-3 text-[12px] font-semibold text-slate-200">{diary.headline}</p>
        {diary.quiet ? (
          <p className="text-[12px] text-mut">
            Quando gli agenti apriranno PR, completeranno task o andranno in pausa, qui comparirà il
            racconto della giornata.
          </p>
        ) : (
          <ul className="space-y-2">
            {diary.lines.map((line, i) => (
              <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-slate-300">
                <span className="select-none text-mut">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
