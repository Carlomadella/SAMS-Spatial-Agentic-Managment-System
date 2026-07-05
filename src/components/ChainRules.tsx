import { Link2, Plus, X } from "lucide-react";
import { useState } from "react";
import { chainSummary } from "../lib/chains";
import { useStore } from "../store/useStore";
import { cn } from "../lib/utils";

/**
 * Editor delle "Reazioni a catena": regole dichiarative che, al completamento di
 * un task, ne innescano un altro verso un ruolo/agente. Vive nel pannello Live Sim.
 */
export function ChainRules() {
  const chains = useStore((s) => s.chains);
  const addChain = useStore((s) => s.addChain);
  const removeChain = useStore((s) => s.removeChain);
  const toggleChain = useStore((s) => s.toggleChain);

  const [adding, setAdding] = useState(false);
  const [when, setWhen] = useState("");
  const [fromRole, setFromRole] = useState("");
  const [target, setTarget] = useState("");
  const [title, setTitle] = useState("");
  const [branch, setBranch] = useState("");

  const canAdd = target.trim() !== "" && title.trim() !== "";

  function submit() {
    if (!canAdd) return;
    addChain({ when: when.trim(), fromRole: fromRole.trim(), target: target.trim(), title: title.trim(), branch: branch.trim(), enabled: true });
    setWhen(""); setFromRole(""); setTarget(""); setTitle(""); setBranch("");
    setAdding(false);
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
          <Link2 size={12} /> Reazioni a catena
          {chains.length > 0 && <span className="text-mut">· {chains.length}</span>}
        </span>
        <button
          onClick={() => setAdding((v) => !v)}
          className="btn h-6 gap-1 px-1.5 text-[10px]"
          title="Aggiungi regola"
        >
          <Plus size={11} /> Regola
        </button>
      </div>
      <p className="mt-0.5 text-[10px] text-mut">
        Quando un task viene completato, ne innesca un altro verso un ruolo/agente.
      </p>

      {/* Elenco regole */}
      {chains.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {chains.map((c) => (
            <li
              key={c.id}
              className={cn(
                "flex items-start gap-2 rounded-md border border-line px-2 py-1.5",
                c.enabled ? "bg-white/[0.02]" : "opacity-50",
              )}
            >
              <input
                type="checkbox"
                checked={c.enabled}
                onChange={() => toggleChain(c.id)}
                className="mt-0.5 accent-sky-500"
                aria-label={c.enabled ? "Disattiva regola" : "Attiva regola"}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] text-slate-200">{chainSummary(c)}</div>
                <div className="truncate text-[10px] text-mut">↳ {c.title}</div>
              </div>
              <button
                onClick={() => removeChain(c.id)}
                className="mt-0.5 shrink-0 text-mut transition-colors hover:text-rose-400"
                title="Rimuovi regola"
                aria-label="Rimuovi regola"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Form */}
      {adding && (
        <div className="mt-2 flex flex-col gap-1.5 rounded-md border border-line bg-white/[0.02] p-2">
          <input
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            placeholder="Quando il titolo contiene… (vuoto = qualsiasi task)"
            className="settings-input w-full text-[11px]"
          />
          <input
            value={fromRole}
            onChange={(e) => setFromRole(e.target.value)}
            placeholder="…da un agente col ruolo (facoltativo)"
            className="settings-input w-full text-[11px]"
          />
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Assegna a — ruolo o nome agente"
            className="settings-input w-full text-[11px]"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titolo del follow-up ({task} = titolo completato)"
            className="settings-input w-full text-[11px]"
          />
          <input
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="Branch (facoltativo, default main)"
            className="settings-input w-full text-[11px]"
          />
          <div className="flex justify-end gap-1.5">
            <button onClick={() => setAdding(false)} className="btn h-6 px-2 text-[10px]">
              Annulla
            </button>
            <button
              onClick={submit}
              disabled={!canAdd}
              className="btn btn-primary h-6 px-2 text-[10px]"
            >
              Aggiungi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
