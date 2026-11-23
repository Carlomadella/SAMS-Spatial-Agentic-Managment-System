import { useEffect } from "react";
import { Trash2 } from "lucide-react";
import { useStore } from "../store/useStore";
import { deleteWorldAgent } from "../lib/backend";
import { canDeleteAgents } from "../lib/roleUi";
import { AGENT_HEX } from "../types";

/**
 * Finestra «Eliminare l'agente?» (24/11): il cestino dell'Inspector e la voce
 * «Rimuovi agente» del menu nella scena chiedono conferma invece di eliminare subito.
 * Solo l'owner elimina agenti (24/11). Confermata, la cancellazione arriva **subito**
 * al server (tombstone), non al prossimo salvataggio del mondo: un refresh non fa più
 * ricomparire l'agente. Esc = Annulla.
 */
export function RemoveAgentDialog() {
  const id = useStore((s) => s.agentToRemove);
  const agent = useStore((s) => s.agents.find((a) => a.id === s.agentToRemove));
  const cancel = useStore((s) => s.cancelRemoveAgent);
  const mayDelete = useStore((s) => canDeleteAgents(s.viewerRole));

  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      cancel();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [id, cancel]);

  if (!id) return null;
  if (!agent || !mayDelete) {
    // l'agente è già sparito (es. cancellato da un'altra vista) o chi guarda non è owner
    queueMicrotask(cancel);
    return null;
  }

  function confirm() {
    const st = useStore.getState();
    st.removeAgent(agent!.id);
    st.cancelRemoveAgent();
    if (st.backendOnline) {
      void deleteWorldAgent(agent!.id).then((version) => {
        if (version != null) useStore.getState().noteWorldVersion(version);
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-3 py-[18vh] backdrop-blur-sm" onClick={cancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Eliminare l'agente?"
        className="w-full max-w-sm animate-fade-in rounded-xl border border-line bg-ink-850 p-4 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
          <Trash2 size={15} className="text-rose-300" />
          Eliminare l'agente?
        </h2>
        <p className="text-[13px] leading-relaxed text-slate-300">
          <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: AGENT_HEX[agent.color] }} />
          <strong className="text-white">{agent.name}</strong> verrà eliminato definitivamente, anche dopo aver ricaricato
          la pagina e per chi guarda la stessa casa.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={cancel} className="btn h-8 px-3" autoFocus>
            Annulla
          </button>
          <button
            type="button"
            onClick={confirm}
            className="btn h-8 border-rose-500/60 bg-rose-600/80 px-3 text-white hover:bg-rose-600"
          >
            Elimina
          </button>
        </div>
      </div>
    </div>
  );
}
