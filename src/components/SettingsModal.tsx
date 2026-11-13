import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  Bot,
  Check,
  ExternalLink,
  FileText,
  Github,
  KeyRound,
  Loader2,
  Lock,
  Palette,
  Plug,
  Rocket,
  Sparkles,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useStore } from "../store/useStore";
import {
  applyRuntimeStatus,
  fetchStatus,
  fetchWhoami,
  provisionAgents,
  saveSettings,
  type Provider,
  type RuntimeStatus,
  type SettingsInput,
} from "../lib/backend";
import { cn } from "../lib/utils";
import { withoutLocked } from "../lib/settingsPatch";
import { isValidRepo } from "../lib/validation";
import { canConfigure, roleMeta } from "../lib/roleUi";
import { ROOM_THEMES } from "../lib/roomThemes";
import { OFFICE_ARRANGEMENTS } from "../lib/officeLayout";
import { GithubAccount } from "./GithubAccount";
import { UsersAdmin } from "../site/components/UsersAdmin";

const MODELS: Record<Provider, string[]> = {
  gemini: ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-pro"],
  claude: ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"],
  // Modelli ":free" con supporto ai tool. Il catalogo gratuito di OpenRouter ruota:
  // se uno sparisce, cambialo qui o metti un altro id ":free" tool-capable.
  // Verificati il 2026-11-10 con una vera chiamata a tool (i tre di prima — Llama 3.3,
  // Qwen 2.5, DeepSeek V3 — non sono più gratuiti: OpenRouter risponde 404).
  openrouter: [
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "cohere/north-mini-code:free",
    "nvidia/nemotron-3.5-super-vl:free",
    "google/gemma-4-31b-it:free",
  ],
  // Modelli OpenAI (ChatGPT) con tool calling — a consumo (serve una chiave sk-…).
  openai: ["gpt-4o-mini", "gpt-4o", "o4-mini"],
};

const PROVIDER_LABEL: Record<Provider, string> = {
  gemini: "Gemini",
  groq: "Groq",
  openrouter: "OpenRouter",
  openai: "ChatGPT",
  claude: "Claude",
};

/** I campi segreti della finestra: su disco effimero si impostano solo sul server. */
const SECRET_UI_FIELDS = ["geminiApiKey", "anthropicApiKey", "groqApiKey", "openrouterApiKey", "openaiApiKey", "githubToken", "notionToken"];

/**
 * Le categorie della finestra. Le prime quattro le vede chiunque entri; le altre
 * toccano chiavi, token e utenti e le vede solo l'owner (il server le protegge
 * comunque: `POST /api/settings` e la gestione utenti rispondono 403 agli altri).
 */
export type SettingsSection =
  | "account"
  | "github"
  | "aspetto"
  | "stato"
  | "motore"
  | "repository"
  | "agenti"
  | "integrazioni"
  | "utenti";

interface SectionDef {
  id: SettingsSection;
  label: string;
  hint: string;
  icon: LucideIcon;
  ownerOnly: boolean;
}

export const SETTINGS_SECTIONS: SectionDef[] = [
  { id: "account", label: "Account", hint: "Chi sei e che ruolo hai in questo workspace.", icon: User, ownerOnly: false },
  { id: "github", label: "Il tuo GitHub", hint: "Il tuo account GitHub e la repo su cui lavorano i tuoi task.", icon: Github, ownerOnly: false },
  { id: "aspetto", label: "Aspetto", hint: "Tema dell'interfaccia e della stanza. Vale solo su questo browser.", icon: Palette, ownerOnly: false },
  { id: "stato", label: "Stato del sistema", hint: "Cosa è configurato sul server, in sola lettura.", icon: Activity, ownerOnly: false },
  { id: "motore", label: "Motore AI", hint: "Il fornitore del modello, la sua chiave e il modello usato dagli agenti.", icon: Sparkles, ownerOnly: true },
  { id: "repository", label: "GitHub del server", hint: "Token e repo usati da routine, simulazione e webhook.", icon: KeyRound, ownerOnly: true },
  { id: "agenti", label: "Comportamento agenti", hint: "Cosa fanno gli agenti dopo aver scritto il codice.", icon: Bot, ownerOnly: true },
  { id: "integrazioni", label: "Integrazioni", hint: "Servizi esterni collegati agli agenti.", icon: Plug, ownerOnly: true },
  { id: "utenti", label: "Utenti e inviti", hint: "Ruoli degli account, inviti e link di reset password.", icon: Users, ownerOnly: true },
];

/** Le sezioni che si salvano con il pulsante «Salva» (il resto si applica da solo). */
const SAVED_SECTIONS = new Set<SettingsSection>(["motore", "repository", "agenti", "integrazioni"]);

/** Le categorie che un ruolo può vedere. */
export function visibleSections(isOwner: boolean): SectionDef[] {
  return SETTINGS_SECTIONS.filter((s) => isOwner || !s.ownerOnly);
}

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn("chip", ok ? "bg-emerald-500/15 text-emerald-300" : "bg-ink-700 text-mut")}>
      <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-emerald-400" : "bg-slate-500")} />
      {label}
    </span>
  );
}

/** L'esito del ritorno da GitHub letto dall'indirizzo, o null se non si torna da lì. */
export function githubReturnOutcome(search: string): "connected" | "denied" | "error" | null {
  const v = new URLSearchParams(search).get("github");
  return v === "connected" || v === "denied" || v === "error" ? v : null;
}

export function SettingsModal() {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  const online = useStore((s) => s.backendOnline);
  const viewerRole = useStore((s) => s.viewerRole);
  const isOwner = canConfigure(viewerRole);

  const section = useStore((s) => s.settingsSection);
  const setSection = useStore((s) => s.setSettingsSection);
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [selfEmail, setSelfEmail] = useState("");
  const [provider, setProvider] = useState<Provider>("gemini");
  const [geminiApiKey, setGeminiKey] = useState("");
  const [anthropicApiKey, setAnthropicKey] = useState("");
  const [groqApiKey, setGroqKey] = useState("");
  const [openrouterApiKey, setOpenrouterKey] = useState("");
  const [openaiApiKey, setOpenaiKey] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [model, setModel] = useState(MODELS.gemini[0]);
  const [openPRs, setOpenPRs] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [notionToken, setNotionToken] = useState("");
  const [notionPageId, setNotionPageId] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "provision">("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Ritorno da GitHub dopo "Collega GitHub" (/app?github=…): si dice com'è andata, si
  // riapre questa finestra su «Il tuo GitHub» per scegliere la repo e si pulisce l'indirizzo.
  useEffect(() => {
    const outcome = githubReturnOutcome(window.location.search);
    if (!outcome) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("github");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    const { pushToast } = useStore.getState();
    if (outcome === "connected") {
      pushToast("SUCCESS", "GitHub collegato: ora scegli la repo su cui far lavorare gli agenti.");
      setOpen(true, "github");
    } else if (outcome === "denied") {
      pushToast("WARN", "Collegamento a GitHub annullato.");
    } else {
      pushToast("ERROR", "Collegamento a GitHub non riuscito: riprova da ⚙ Impostazioni → Il tuo GitHub.");
    }
  }, [setOpen]);

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
      setOpenPRs(st.openPRs);
      setRequireApproval(st.requireApproval);
      setNotionPageId(st.notionPageId);
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  // La gestione utenti vuole l'email di chi guarda (per non togliersi da solo il ruolo).
  useEffect(() => {
    if (!open || !isOwner) return;
    let alive = true;
    void fetchWhoami().then((w) => {
      if (alive) setSelfEmail(w.email);
    });
    return () => {
      alive = false;
    };
  }, [open, isOwner]);

  if (!open) return null;

  const sections = visibleSections(isOwner);
  // Se il ruolo cambia mentre si guarda una sezione riservata, si torna all'account.
  const current = sections.find((s) => s.id === section) ?? sections[0];

  function changeProvider(p: Provider) {
    setProvider(p);
    // Un modello fissato dall'ambiente non si tocca: resta quello del server.
    const modelLocked = (status?.envManaged ?? []).includes("model");
    if (!modelLocked && !MODELS[p].includes(model)) setModel(MODELS[p][0]);
  }

  async function onSave() {
    setBusy("save");
    setMsg(null);
    try {
      const patch: SettingsInput = { provider, githubRepo: repo, baseBranch: branch, model, openPRs, requireApproval, notionPageId };
      if (provider === "gemini" && geminiApiKey.trim()) patch.geminiApiKey = geminiApiKey.trim();
      if (provider === "claude" && anthropicApiKey.trim()) patch.anthropicApiKey = anthropicApiKey.trim();
      if (provider === "groq" && groqApiKey.trim()) patch.groqApiKey = groqApiKey.trim();
      if (provider === "openrouter" && openrouterApiKey.trim()) patch.openrouterApiKey = openrouterApiKey.trim();
      if (provider === "openai" && openaiApiKey.trim()) patch.openaiApiKey = openaiApiKey.trim();
      if (githubToken.trim()) patch.githubToken = githubToken.trim();
      if (notionToken.trim()) patch.notionToken = notionToken.trim();
      // I campi fissati dall'ambiente (e su disco effimero le chiavi) non si mandano:
      // il server risponderebbe 409.
      const locked = new Set<string>([...(status?.envManaged ?? []), ...(status?.ephemeralDisk ? SECRET_UI_FIELDS : [])]);
      const st = await saveSettings(withoutLocked(patch, locked));
      setStatus(st);
      applyRuntimeStatus(st);
      setGeminiKey("");
      setAnthropicKey("");
      setGroqKey("");
      setOpenrouterKey("");
      setOpenaiKey("");
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
      applyRuntimeStatus(st);
      setMsg({ kind: "ok", text: "Agenti provisionati e pronti." });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy("");
    }
  }

  // Campi impostati da variabili d'ambiente sul server: l'ambiente vince al riavvio,
  // quindi qui sono in sola lettura (il server rifiuterebbe comunque il cambio con 409).
  // Disco effimero: anche le chiavi stanno solo sul server (una chiave salvata da qui
  // sparirebbe al primo riavvio). Le scelte (modello, repo…) restano modificabili.
  const ephemeral = !!status?.ephemeralDisk;
  const envLocked = new Set([...(status?.envManaged ?? []), ...(ephemeral ? SECRET_UI_FIELDS : [])]);
  const lockedHint = "Impostato da una variabile d'ambiente sul server: si cambia lì, non da qui.";
  const lockedPlaceholder = "•••••••• (impostato dal server)";
  const lockedPh = (has: boolean, envVar: string) => (has ? lockedPlaceholder : `da impostare sul server: ${envVar}`);

  const keyChip =
    provider === "gemini"
      ? { ok: !!status?.hasGeminiKey, label: "Chiave Gemini" }
      : provider === "groq"
        ? { ok: !!status?.hasGroqKey, label: "Chiave Groq" }
        : provider === "openrouter"
          ? { ok: !!status?.hasOpenrouterKey, label: "Chiave OpenRouter" }
          : provider === "openai"
            ? { ok: !!status?.hasOpenaiKey, label: "Chiave OpenAI" }
            : { ok: !!status?.hasAnthropicKey, label: "Chiave Anthropic" };

  const ephemeralNote = ephemeral && (
    <p role="note" className="rounded-md border border-line bg-ink-800 px-3 py-2 text-[11px] leading-relaxed text-mut">
      Questo server non ha un disco che sopravvive ai riavvii: le <b className="text-white">chiavi e i token</b> si
      impostano come variabili d&apos;ambiente sul server (es. su Render). Le altre scelte si salvano da qui e restano.
    </p>
  );

  function renderSection(id: SettingsSection): ReactNode {
    switch (id) {
      case "account":
        return <AccountSection />;
      case "github":
        return <GithubAccount />;
      case "aspetto":
        return <AppearanceSection />;
      case "stato":
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <Chip ok={online} label={online ? "Runtime online" : "Runtime offline"} />
              <Chip ok={!!status?.ready} label={status?.ready ? "Agenti pronti" : "Agenti non pronti"} />
              <Chip ok={keyChip.ok} label={keyChip.label} />
              <Chip ok={!!status?.hasGithubToken} label="GitHub del server" />
              <Chip ok={!!status?.notionReady} label="Notion" />
            </div>
            <dl className="divide-y divide-line rounded-lg border border-line bg-ink-800 text-[12px]">
              <InfoRow label="Motore" value={status ? PROVIDER_LABEL[status.provider] : "—"} />
              <InfoRow label="Modello" value={status?.model || "—"} mono />
              <InfoRow label="Repo del server" value={status?.repo || "—"} mono />
              <InfoRow label="PR automatiche" value={status ? (status.openPRs ? "Sì" : "No") : "—"} />
              <InfoRow label="Approvazione prima del commit" value={status ? (status.requireApproval ? "Sì" : "No") : "—"} />
            </dl>
            {!isOwner && (
              <p className="text-[11px] leading-relaxed text-mut">
                Chiavi, motore e utenti li gestisce l&apos;owner del workspace.
              </p>
            )}
          </div>
        );
      case "motore":
        return (
          <div className="space-y-3">
            {ephemeralNote}
            <Field label="Motore (modello AI)" locked={envLocked.has("provider")}>
              <select
                value={provider}
                onChange={(e) => changeProvider(e.target.value as Provider)}
                disabled={envLocked.has("provider")}
                title={envLocked.has("provider") ? lockedHint : undefined}
                className="settings-input"
              >
                <option value="gemini" className="bg-ink-800">Gemini — Google (piano gratuito)</option>
                <option value="groq" className="bg-ink-800">Groq — Llama 3.3 70B (piano gratuito)</option>
                <option value="openrouter" className="bg-ink-800">OpenRouter — modelli :free (piano gratuito)</option>
                <option value="openai" className="bg-ink-800">ChatGPT — OpenAI (a pagamento)</option>
                <option value="claude" className="bg-ink-800">Claude — Anthropic (a pagamento)</option>
              </select>
            </Field>

            {provider === "gemini" ? (
              <Field label="Gemini API key" icon={Sparkles} locked={envLocked.has("geminiApiKey")}>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  disabled={envLocked.has("geminiApiKey")}
                  placeholder={envLocked.has("geminiApiKey") ? lockedPh(!!status?.hasGeminiKey, "GEMINI_API_KEY") : status?.hasGeminiKey ? "•••••••• (impostata — lascia vuoto per tenerla)" : "AIza…  (aistudio.google.com)"}
                  className="settings-input"
                />
              </Field>
            ) : provider === "groq" ? (
              <Field label="Groq API key" icon={KeyRound} locked={envLocked.has("groqApiKey")}>
                <input
                  type="password"
                  value={groqApiKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  disabled={envLocked.has("groqApiKey")}
                  placeholder={envLocked.has("groqApiKey") ? lockedPh(!!status?.hasGroqKey, "GROQ_API_KEY") : status?.hasGroqKey ? "•••••••• (impostata — lascia vuoto per tenerla)" : "gsk_…  (console.groq.com)"}
                  className="settings-input"
                />
              </Field>
            ) : provider === "openrouter" ? (
              <Field label="OpenRouter API key" icon={KeyRound} locked={envLocked.has("openrouterApiKey")}>
                <input
                  type="password"
                  value={openrouterApiKey}
                  onChange={(e) => setOpenrouterKey(e.target.value)}
                  disabled={envLocked.has("openrouterApiKey")}
                  placeholder={envLocked.has("openrouterApiKey") ? lockedPh(!!status?.hasOpenrouterKey, "OPENROUTER_API_KEY") : status?.hasOpenrouterKey ? "•••••••• (impostata — lascia vuoto per tenerla)" : "sk-or-…  (openrouter.ai/keys)"}
                  className="settings-input"
                />
              </Field>
            ) : provider === "openai" ? (
              <Field label="OpenAI API key" icon={KeyRound} locked={envLocked.has("openaiApiKey")}>
                <input
                  type="password"
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  disabled={envLocked.has("openaiApiKey")}
                  placeholder={envLocked.has("openaiApiKey") ? lockedPh(!!status?.hasOpenaiKey, "OPENAI_API_KEY") : status?.hasOpenaiKey ? "•••••••• (impostata — lascia vuoto per tenerla)" : "sk-…  (platform.openai.com/api-keys)"}
                  className="settings-input"
                />
              </Field>
            ) : (
              <Field label="Anthropic API key" icon={KeyRound} locked={envLocked.has("anthropicApiKey")}>
                <input
                  type="password"
                  value={anthropicApiKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  disabled={envLocked.has("anthropicApiKey")}
                  placeholder={envLocked.has("anthropicApiKey") ? lockedPh(!!status?.hasAnthropicKey, "ANTHROPIC_API_KEY") : status?.hasAnthropicKey ? "•••••••• (impostata — lascia vuoto per tenerla)" : "sk-ant-…"}
                  className="settings-input"
                />
              </Field>
            )}

            <Field label="Modello" locked={envLocked.has("model")}>
              <select disabled={envLocked.has("model")} value={model} onChange={(e) => setModel(e.target.value)} className="settings-input">
                {MODELS[provider].map((m) => (
                  <option key={m} value={m} className="bg-ink-800">{m}</option>
                ))}
              </select>
            </Field>

            {provider === "claude" ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-ink-800 px-3 py-2.5">
                <span className="text-[11px] leading-relaxed text-mut">Claude vuole un agente e un ambiente creati una volta.</span>
                <button
                  onClick={onProvision}
                  disabled={busy !== "" || !status?.hasAnthropicKey || envLocked.has("agentId") || envLocked.has("environmentId")}
                  title={
                    envLocked.has("agentId") || envLocked.has("environmentId")
                      ? lockedHint
                      : !status?.hasAnthropicKey
                        ? "Salva prima la API key Anthropic"
                        : "Crea l'agente + ambiente"
                  }
                  className="btn btn-primary shrink-0"
                >
                  {busy === "provision" ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                  {status?.provisioned ? "Re-provisiona" : "Provisiona agenti"}
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-mut">
                Con {PROVIDER_LABEL[provider]} sei pronto subito dopo <strong>Salva</strong>.
              </p>
            )}
          </div>
        );
      case "repository":
        return (
          <div className="space-y-3">
            {ephemeralNote}
            <p className="text-[11px] leading-relaxed text-mut">
              Ogni utente fa lavorare i suoi task sulla propria repo da <b className="text-slate-300">Il tuo GitHub</b>.
              Questo token serve ai lavori che girano senza un utente: routine, simulazione e webhook.
            </p>
            <Field label="GitHub token (fine-grained, Contents R/W)" icon={Github} locked={envLocked.has("githubToken")}>
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                disabled={envLocked.has("githubToken")}
                placeholder={envLocked.has("githubToken") ? lockedPh(!!status?.hasGithubToken, "GITHUB_TOKEN") : status?.hasGithubToken ? "•••••••• (impostato — lascia vuoto per tenerlo)" : "github_pat_…"}
                className="settings-input"
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Repository (owner/repo)" locked={envLocked.has("githubRepo")}>
                <input disabled={envLocked.has("githubRepo")} value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/repo" className="settings-input" />
              </Field>
              <Field label="Branch base" locked={envLocked.has("baseBranch")}>
                <input disabled={envLocked.has("baseBranch")} value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" className="settings-input" />
              </Field>
            </div>
            {repo.trim() !== "" && !isValidRepo(repo) && (
              <p className="-mt-1.5 text-[11px] text-slate-400">
                Formato non valido — usa <code className="rounded bg-ink-700 px-1">owner/repo</code>.
              </p>
            )}
          </div>
        );
      case "agenti":
        return (
          <div className="space-y-2">
            <ToggleRow
              label="Apri PR automaticamente dopo il commit"
              hint="L'agente apre una pull request appena ha fatto il commit sul suo branch."
              checked={openPRs}
              onChange={setOpenPRs}
              locked={envLocked.has("openPRs")}
              lockedHint={lockedHint}
            />
            <ToggleRow
              label="Richiedi approvazione prima del commit"
              hint="Le modifiche restano in attesa finché qualcuno non le approva."
              checked={requireApproval}
              onChange={setRequireApproval}
              locked={envLocked.has("requireApproval")}
              lockedHint={lockedHint}
            />
          </div>
        );
      case "integrazioni":
        return (
          <div className="space-y-3">
            {ephemeralNote}
            <h4 className="text-[12px] font-semibold text-white">Notion</h4>
            <Field label="Notion integration token" icon={KeyRound} locked={envLocked.has("notionToken")}>
              <input
                type="password"
                value={notionToken}
                onChange={(e) => setNotionToken(e.target.value)}
                disabled={envLocked.has("notionToken")}
                placeholder={envLocked.has("notionToken") ? lockedPh(!!status?.hasNotionToken, "NOTION_TOKEN") : status?.hasNotionToken ? "•••••••• (impostato — lascia vuoto per tenerlo)" : "ntn_… / secret_…"}
                className="settings-input"
              />
            </Field>
            <Field label="Pagina Notion (URL o ID) per il log dei task" icon={FileText} locked={envLocked.has("notionPageId")}>
              <input
                disabled={envLocked.has("notionPageId")}
                value={notionPageId}
                onChange={(e) => setNotionPageId(e.target.value)}
                placeholder="https://notion.so/…  oppure  ID"
                className="settings-input"
              />
            </Field>
            <p className="text-[11px] leading-relaxed text-mut">
              Crea un&apos;integrazione su notion.so/my-integrations e <strong>condividi le pagine</strong> con essa.
              Gli agenti potranno scrivere su una pagina trovandola per titolo.
            </p>
          </div>
        );
      case "utenti":
        return <UsersAdmin selfEmail={selfEmail} />;
    }
  }

  const saves = SAVED_SECTIONS.has(current.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-3 py-[5vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Impostazioni"
        className="flex w-full max-w-3xl animate-fade-in flex-col overflow-hidden rounded-xl border border-line bg-ink-850 shadow-panel sm:h-[min(640px,88vh)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Impostazioni</h2>
          <button onClick={() => setOpen(false)} aria-label="Chiudi impostazioni" className="btn h-7 w-7 px-0">
            <X size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* categorie: colonna a sinistra, su telefono una fila che scorre */}
          <nav
            aria-label="Categorie delle impostazioni"
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-line px-2 py-2 sm:w-52 sm:flex-col sm:overflow-y-auto sm:border-b-0 sm:border-r"
          >
            {sections.map((s, i) => {
              const firstOwner = s.ownerOnly && !sections[i - 1]?.ownerOnly;
              return (
                <div key={s.id} className="contents">
                  {firstOwner && (
                    <div className="hidden items-center gap-1.5 px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-mut sm:flex">
                      <Lock size={10} /> Solo owner
                    </div>
                  )}
                  <button
                    type="button"
                    // Su telefono le categorie sono una fila che scorre: quella attiva resta in vista.
                    ref={current.id === s.id ? (el) => el?.scrollIntoView?.({ block: "nearest", inline: "nearest" }) : undefined}
                    onClick={() => {
                      setSection(s.id);
                      setMsg(null);
                    }}
                    aria-current={current.id === s.id ? "page" : undefined}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors",
                      current.id === s.id ? "bg-brand/15 text-white" : "text-slate-400 hover:bg-ink-800 hover:text-slate-200",
                    )}
                  >
                    <s.icon size={14} className="shrink-0" />
                    <span className="whitespace-nowrap">{s.label}</span>
                    {s.ownerOnly && <Lock size={10} className="ml-auto shrink-0 text-mut sm:hidden" aria-label="solo owner" />}
                  </button>
                </div>
              );
            })}
          </nav>

          <section aria-label={current.label} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <header>
                <h3 className="flex items-center gap-2 text-[13px] font-semibold text-white">
                  {current.label}
                  {current.ownerOnly && (
                    <span className="chip bg-ink-700 text-mut">
                      <Lock size={10} /> solo owner
                    </span>
                  )}
                </h3>
                <p className="mt-0.5 text-[11px] text-mut">{current.hint}</p>
              </header>

              {renderSection(current.id)}

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

            {saves && (
              <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line px-4 py-3">
                <span className="text-[11px] text-mut">Salva vale per tutte le sezioni «solo owner».</span>
                <button onClick={onSave} disabled={busy !== ""} className="btn btn-primary">
                  {busy === "save" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salva
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/** Chi sta guardando: nome, ruolo e la strada per profilo, password e uscita. */
function AccountSection() {
  const name = useStore((s) => s.accountName);
  const role = useStore((s) => s.viewerRole);
  const enforced = useStore((s) => s.roleEnforced);
  const meta = roleMeta(role);

  if (!enforced) {
    return (
      <p className="rounded-lg border border-line bg-ink-800 px-3 py-2.5 text-[12px] leading-relaxed text-slate-300">
        Questo runtime gira in <b className="text-white">modalità aperta</b>: non ci sono account e chiunque lo apra ha
        accesso completo. I ruoli si attivano appena qualcuno si registra.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <dl className="divide-y divide-line rounded-lg border border-line bg-ink-800 text-[12px]">
        <InfoRow label="Nome" value={name || "Non hai fatto l'accesso"} />
        <InfoRow label="Ruolo" value={`${meta.icon} ${meta.label}`} />
      </dl>
      <p className="text-[11px] leading-relaxed text-mut">{meta.title}.</p>
      <a href="/profilo" className="btn inline-flex">
        <ExternalLink size={14} /> {name ? "Profilo, password ed esci" : "Accedi"}
      </a>
    </div>
  );
}

/** Tema dell'interfaccia, colori della stanza e disposizione del salotto (solo locali). */
function AppearanceSection() {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const roomTheme = useStore((s) => s.roomTheme);
  const setRoomTheme = useStore((s) => s.setRoomTheme);
  const officeLayout = useStore((s) => s.officeLayout);
  const setOfficeLayout = useStore((s) => s.setOfficeLayout);

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-1.5 text-[12px] font-semibold text-white">Interfaccia</h4>
        <div className="flex gap-1.5" role="radiogroup" aria-label="Tema dell'interfaccia">
          {(["dark", "light"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={theme === t}
              onClick={() => theme !== t && toggleTheme()}
              className={cn("btn", theme === t && "border-brand/60 bg-brand/15 text-white")}
            >
              {t === "dark" ? "Scuro" : "Chiaro"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-1.5 text-[12px] font-semibold text-white">Colori della stanza</h4>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label="Colori della stanza">
          {ROOM_THEMES.map((rt) => (
            <button
              key={rt.id}
              type="button"
              role="radio"
              aria-checked={roomTheme === rt.id}
              onClick={() => setRoomTheme(rt.id)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[12px] transition-colors",
                roomTheme === rt.id ? "border-brand/60 bg-brand/15 text-white" : "border-line text-slate-300 hover:bg-ink-800",
              )}
            >
              <span className="flex shrink-0 overflow-hidden rounded-sm ring-1 ring-black/20" aria-hidden>
                <span className="h-4 w-2.5" style={{ background: rt.wall }} />
                <span className="h-4 w-2.5" style={{ background: rt.floor }} />
              </span>
              <span className="truncate">{rt.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-1.5 text-[12px] font-semibold text-white">Disposizione del salotto</h4>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="Disposizione del salotto">
          {OFFICE_ARRANGEMENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={officeLayout === a.id}
              onClick={() => setOfficeLayout(a.id)}
              className={cn(
                "rounded-md border px-2 py-1.5 text-[12px] transition-colors",
                officeLayout === a.id ? "border-brand/60 bg-brand/15 text-white" : "border-line text-slate-300 hover:bg-ink-800",
              )}
            >
              {a.emoji} {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <dt className="text-mut">{label}</dt>
      <dd className={cn("min-w-0 truncate text-right text-slate-200", mono && "font-mono text-[11px]")}>{value}</dd>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  locked,
  lockedHint,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  locked: boolean;
  lockedHint: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-line bg-ink-800 px-3 py-2.5">
      <div>
        <div className="flex items-center gap-1.5 text-[12px] text-slate-200">
          {label}
          {locked && (
            <span className="inline-flex items-center gap-1 text-[10px] text-mut" title={lockedHint}>
              <Lock size={10} /> dal server
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-mut">{hint}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={locked} title={locked ? lockedHint : undefined} label={label} />
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  locked = false,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  /** Campo impostato da una variabile d'ambiente sul server: in sola lettura. */
  locked?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-mut">
        {Icon && <Icon size={12} />}
        {label}
        {locked && (
          <span
            className="ml-auto inline-flex items-center gap-1 text-[10px] font-normal"
            title="Impostato da una variabile d'ambiente sul server: si cambia lì, non da qui."
          >
            <Lock size={10} /> dal server
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  disabled = false,
  title,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  title?: string;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      title={title}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-brand" : "bg-ink-700",
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-1",
        )}
      />
    </button>
  );
}
