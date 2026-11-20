import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { suggestNewAgent, useStore } from "../store/useStore";
import { AGENT_HEX } from "../types";
import { AGENT_ROLES } from "./AgentInspector";
import { AGENT_TEMPLATES, findTemplate } from "../lib/agentTemplates";

/** Stesso tetto dell'inspector per le istruzioni permanenti. */
const RULES_MAX = 1200;

/**
 * Finestra «Nuovo agente»: i pulsanti "+ Agente" e "Crea agente" non creano più
 * l'agente con un clic ma chiedono nome e ruolo, con Crea / Annulla (collaudo
 * sim-prenota-sale, scelta dell'utente del 19/11). Esc o clic fuori = Annulla.
 * In più (ROADMAP5, 20/11) si può partire da un agente preimpostato: è facoltativo,
 * di default «Nessuno» e l'agente nasce vuoto come prima. Scelto un preimpostato se
 * ne vedono descrizione e regole, modificabili prima di creare.
 */
export function NewAgentDialog() {
  const request = useStore((s) => s.newAgentOpen);
  if (!request) return null;
  // key: ogni apertura riparte dalla proposta fresca (nome libero, ruolo Generalista)
  return <NewAgentForm key={JSON.stringify(request)} color={request.color} />;
}

function NewAgentForm({ color }: { color?: Parameters<typeof suggestNewAgent>[1] }) {
  const close = useStore((s) => s.closeNewAgent);
  const addAgent = useStore((s) => s.addAgent);
  const myPresets = useStore((s) => s.agentPresets);
  const [suggested] = useState(() => suggestNewAgent(useStore.getState().agents, color));
  const [name, setName] = useState(suggested.name);
  const [role, setRole] = useState("Generalist");
  const [presetId, setPresetId] = useState("");
  const [rules, setRules] = useState("");
  const preset = findTemplate(presetId, myPresets);

  function choosePreset(id: string) {
    setPresetId(id);
    const t = findTemplate(id, myPresets);
    setRules(t ? t.instructions.slice(0, RULES_MAX) : "");
    if (t) setRole(t.role);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close]);

  function create() {
    addAgent(suggested.color, {
      name: name.trim() || suggested.name,
      role,
      ...(preset ? { model: preset.model, instructions: rules, presetId: preset.id } : {}),
    });
    close();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-3 py-[12vh] backdrop-blur-sm" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nuovo agente"
        className="w-full max-w-md animate-fade-in rounded-xl border border-line bg-ink-850 p-4 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: AGENT_HEX[suggested.color] }} />
            Nuovo agente
          </h2>
          <button onClick={close} aria-label="Chiudi" className="btn h-7 w-7 px-0">
            <X size={16} />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
          className="space-y-3"
        >
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-mut">Parti da</span>
            <select value={presetId} onChange={(e) => choosePreset(e.target.value)} className="w-full rounded-md border border-line bg-ink-800 px-2 py-1.5 text-[12px] text-slate-200 outline-none focus:border-brand/50">
              <option value="">Nessuno (agente vuoto)</option>
              <optgroup label="Preimpostati">
                {AGENT_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
                ))}
              </optgroup>
              {myPresets.length > 0 && (
                <optgroup label="I miei preset">
                  {myPresets.map((t) => (
                    <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          {preset && (
            <div className="space-y-1.5 rounded-md border border-line bg-ink-800/60 p-2">
              {preset.description && <p className="text-[11px] leading-snug text-slate-300">{preset.description}</p>}
              <label className="block">
                <span className="mb-1 flex items-center justify-between text-[11px] font-medium text-mut">
                  <span>Regole (istruzioni permanenti, puoi cambiarle)</span>
                  <span className="font-normal opacity-70">{rules.length}/{RULES_MAX}</span>
                </span>
                <textarea
                  value={rules}
                  onChange={(e) => setRules(e.target.value.slice(0, RULES_MAX))}
                  rows={6}
                  className="w-full resize-y rounded-md border border-line bg-ink-850 px-2 py-1.5 text-[11px] leading-relaxed text-slate-200 outline-none focus:border-brand/50"
                />
              </label>
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-mut">Nome</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              className="w-full rounded-md border border-line bg-ink-800 px-2 py-1.5 text-[12px] text-slate-200 outline-none placeholder:text-mut focus:border-brand/50"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-mut">Ruolo</span>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded-md border border-line bg-ink-800 px-2 py-1.5 text-[12px] text-slate-200 outline-none placeholder:text-mut focus:border-brand/50">
              {AGENT_ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </label>
          <p className="-mt-2 text-[11px] leading-snug text-mut">
            {AGENT_ROLES.find((r) => r.id === role)?.desc}
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="btn h-8 px-3 text-[12px]">Annulla</button>
            <button type="submit" className="btn btn-primary h-8 px-3 text-[12px]">Crea</button>
          </div>
        </form>
      </div>
    </div>
  );
}
