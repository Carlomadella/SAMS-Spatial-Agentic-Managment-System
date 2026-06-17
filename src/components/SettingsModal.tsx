import { useEffect, useState, type ReactNode } from "react";
import { AlertCircle, Check, FileText, Github, KeyRound, Loader2, Rocket, Sparkles, X } from "lucide-react";
import { useStore } from "../store/useStore";
import {
  fetchStatus,
  provisionAgents,
  saveSettings,
  type Provider,
  type RuntimeStatus,
  type SettingsInput,
} from "../lib/backend";
import { cn } from "../lib/utils";

const MODELS: Record<Provider, string[]> = {
  gemini: ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-pro"],
  claude: ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"],
};

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn("chip", ok ? "bg-emerald-500/15 text-emerald-300" : "bg-ink-700 text-mut")}>
      <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-emerald-400" : "bg-slate-500")} />
      {label}
    </span>
  );
}

export function SettingsModal() {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  const online = useStore((s) => s.backendOnline);

  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [provider, setProvider] = useState<Provider>("gemini");
  const [geminiApiKey, setGeminiKey] = useState("");
  const [anthropicApiKey, setAnthropicKey] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [model, setModel] = useState(MODELS.gemini[0]);
  const [notionToken, setNotionToken] = useState("");
  const [notionPageId, setNotionPageId] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "provision">("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setMsg(null);
    void (async () => {
      const st = await fetchStatus();
      if (!alive) return;
      if (!st) {
        setStatus(null);
        setMsg({ kind: "err", text: "Runtime non raggiungibile. Avvia il runtime (npm start), poi riprova." });
        return;
      }
      setStatus(st);
      setProvider(st.provider);
      setRepo(st.repo);
      setBranch(st.baseBranch);
      setModel(st.model);
      setNotionPageId(st.notionPageId);
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  if (!open) return null;

  function changeProvider(p: Provider) {
    setProvider(p);
    if (!MODELS[p].includes(model)) setModel(MODELS[p][0]);
  }

  async function onSave() {
    setBusy("save");
    setMsg(null);
    try {
      const patch: SettingsInput = { provider, githubRepo: repo, baseBranch: branch, model, notionPageId };
      if (provider === "gemini" && geminiApiKey.trim()) patch.geminiApiKey = geminiApiKey.trim();
      if (provider === "claude" && anthropicApiKey.trim()) patch.anthropicApiKey = anthropicApiKey.trim();
      if (githubToken.trim()) patch.githubToken = githubToken.trim();
      if (notionToken.trim()) patch.notionToken = notionToken.trim();
      const st = await saveSettings(patch);
      setStatus(st);
      setGeminiKey("");
      setAnthropicKey("");
      setGithubToken("");
      setNotionToken("");
      setMsg({ kind: "ok", text: "Impostazioni salvate." });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy("");
    }
  }

  async function onProvision() {
    setBusy("provision");
    setMsg(null);
    try {
      const st = await provisionAgents();
      setStatus(st);
      setMsg({ kind: "ok", text: "Agenti provisionati e pronti." });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy("");
    }
  }

  const keyChip =
    provider === "gemini"
      ? { ok: !!status?.hasGeminiKey, label: "Gemini key" }
      : { ok: !!status?.hasAnthropicKey, label: "Anthropic key" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 py-[6vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg animate-fade-in overflow-hidden rounded-xl border border-line bg-ink-850 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Runtime · Agenti</h2>
            <p className="text-[11px] text-mut">Scegli il motore, collega le chiavi — tutto da qui.</p>
          </div>
          <button onClick={() => setOpen(false)} className="btn h-7 w-7 px-0">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-3">
          <Chip ok={online} label={online ? "Runtime online" : "Runtime offline"} />
          <Chip ok={keyChip.ok} label={keyChip.label} />
          <Chip ok={!!status?.hasGithubToken} label="GitHub token" />
          {provider === "claude" && <Chip ok={!!status?.provisioned} label="Agenti pronti" />}
          <Chip ok={!!status?.notionReady} label="Notion" />
        </div>

        <div className="space-y-3 px-4 py-4">
          <Field label="Motore (modello AI)">
            <select
              value={provider}
              onChange={(e) => changeProvider(e.target.value as Provider)}
              className="settings-input"
            >
              <option value="gemini" className="bg-ink-800">Gemini — Google (free tier)</option>
              <option value="claude" className="bg-ink-800">Claude — Anthropic (a pagamento)</option>
            </select>
          </Field>

          {provider === "gemini" ? (
            <Field label="Gemini API key" icon={Sparkles}>
              <input
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder={status?.hasGeminiKey ? "•••••••• (impostata — lascia vuoto per tenerla)" : "AIza…  (aistudio.google.com)"}
                className="settings-input"
              />
            </Field>
          ) : (
            <Field label="Anthropic API key" icon={KeyRound}>
              <input
                type="password"
                value={anthropicApiKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder={status?.hasAnthropicKey ? "•••••••• (impostata — lascia vuoto per tenerla)" : "sk-ant-…"}
                className="settings-input"
              />
            </Field>
          )}

          <Field label="GitHub token (fine-grained, Contents R/W)" icon={Github}>
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder={status?.hasGithubToken ? "•••••••• (impostato — lascia vuoto per tenerlo)" : "github_pat_…"}
              className="settings-input"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Repository (owner/repo)">
              <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/repo" className="settings-input" />
            </Field>
            <Field label="Branch base">
              <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" className="settings-input" />
            </Field>
          </div>

          <Field label="Modello">
            <select value={model} onChange={(e) => setModel(e.target.value)} className="settings-input">
              {MODELS[provider].map((m) => (
                <option key={m} value={m} className="bg-ink-800">{m}</option>
              ))}
            </select>
          </Field>

          <div className="border-t border-line pt-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-mut">Notion (opzionale)</div>
            <div className="space-y-3">
              <Field label="Notion integration token" icon={KeyRound}>
                <input
                  type="password"
                  value={notionToken}
                  onChange={(e) => setNotionToken(e.target.value)}
                  placeholder={status?.hasNotionToken ? "•••••••• (impostato — lascia vuoto per tenerlo)" : "ntn_… / secret_…"}
                  className="settings-input"
                />
              </Field>
              <Field label="Pagina Notion (URL o ID) per il log dei task" icon={FileText}>
                <input
                  value={notionPageId}
                  onChange={(e) => setNotionPageId(e.target.value)}
                  placeholder="https://notion.so/…  oppure  ID"
                  className="settings-input"
                />
              </Field>
              <p className="text-[11px] leading-relaxed text-mut">
                Crea un'integrazione su notion.so/my-integrations e <strong>condividi le pagine</strong> con essa.
                Gli agenti potranno scrivere su una pagina trovandola per titolo.
              </p>
            </div>
          </div>

          {msg && (
            <div
              className={cn(
                "flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]",
                msg.kind === "ok"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-300",
              )}
            >
              {msg.kind === "ok" ? <Check size={14} className="mt-0.5" /> : <AlertCircle size={14} className="mt-0.5" />}
              <span>{msg.text}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
          <button onClick={onSave} disabled={busy !== ""} className="btn">
            {busy === "save" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salva
          </button>
          {provider === "claude" ? (
            <button
              onClick={onProvision}
              disabled={busy !== "" || !status?.hasAnthropicKey}
              title={!status?.hasAnthropicKey ? "Salva prima la API key Anthropic" : "Crea l'agente + ambiente"}
              className="btn btn-primary"
            >
              {busy === "provision" ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
              {status?.provisioned ? "Re-provisiona" : "Provisiona agenti"}
            </button>
          ) : (
            <span className="text-[11px] text-mut">Con Gemini sei pronto subito dopo <strong>Salva</strong>.</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: typeof KeyRound;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-mut">
        {Icon && <Icon size={12} />}
        {label}
      </span>
      {children}
    </label>
  );
}
