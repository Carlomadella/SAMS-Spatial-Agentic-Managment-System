import { useEffect, useState } from "react";
import { Github, Loader2, LogOut } from "lucide-react";
import {
  chooseGithubRepo,
  disconnectGithub,
  fetchGithubAccount,
  fetchGithubRepos,
  GITHUB_CHANGED_EVENT,
  startGithubConnect,
  type GithubAccountStatus,
  type GithubRepoOption,
} from "../lib/backend";

/** Avvisa il resto della workspace (es. l'albero dei file) che il GitHub dell'utente è cambiato. */
function announceChange(): void {
  window.dispatchEvent(new Event(GITHUB_CHANGED_EVENT));
}

/**
 * "Il tuo GitHub": ogni utente collega il proprio account GitHub e sceglie una delle sue
 * repo. I task che assegna lavorano lì, con il suo token. Visibile solo se il server ha
 * la OAuth App configurata; altrimenti vale la repo impostata sotto (quella del server).
 */
export function GithubAccount() {
  const [account, setAccount] = useState<GithubAccountStatus | null>(null);
  const [repos, setRepos] = useState<GithubRepoOption[] | null>(null);
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("");
  const [busy, setBusy] = useState<"" | "connect" | "save" | "disconnect" | "repos">("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchGithubAccount().then((a) => {
      if (!alive) return;
      setAccount(a);
      if (a?.connected) {
        setRepo(a.repo);
        setBranch(a.baseBranch);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const connected = Boolean(account?.connected);
  useEffect(() => {
    if (!connected) return;
    let alive = true;
    setBusy("repos");
    fetchGithubRepos()
      .then((list) => alive && setRepos(list))
      .catch((err: unknown) => alive && setMsg({ kind: "err", text: err instanceof Error ? err.message : String(err) }))
      .finally(() => alive && setBusy(""));
    return () => {
      alive = false;
    };
  }, [connected]);

  if (!account?.enabled) return null;

  async function onConnect() {
    setBusy("connect");
    setMsg(null);
    try {
      window.location.assign(await startGithubConnect());
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : String(err) });
      setBusy("");
    }
  }

  async function onSave() {
    setBusy("save");
    setMsg(null);
    try {
      const saved = await chooseGithubRepo(repo, branch.trim() || undefined);
      setAccount((a) => (a ? { ...a, repo: saved.repo, baseBranch: saved.baseBranch } : a));
      setBranch(saved.baseBranch);
      setMsg({ kind: "ok", text: `Gli agenti lavoreranno su ${saved.repo} (branch ${saved.baseBranch}).` });
      announceChange();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy("");
    }
  }

  async function onDisconnect() {
    setBusy("disconnect");
    setMsg(null);
    try {
      await disconnectGithub();
      setAccount((a) => (a ? { ...a, connected: false, login: "", repo: "", baseBranch: "" } : a));
      setRepos(null);
      setRepo("");
      setBranch("");
      announceChange();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy("");
    }
  }

  function pickRepo(name: string) {
    setRepo(name);
    const r = repos?.find((x) => x.fullName === name);
    if (r) setBranch(r.defaultBranch);
  }

  const chosen = repos?.find((r) => r.fullName === repo);
  const unchanged = repo === account.repo && (branch.trim() || chosen?.defaultBranch) === account.baseBranch;

  return (
    <section aria-label="Il tuo GitHub" className="space-y-2 rounded-lg border border-line bg-ink-800 px-3 py-3">
      <div className="flex items-center gap-2">
        <Github size={14} className="text-white" />
        <h3 className="text-xs font-semibold text-white">Il tuo GitHub</h3>
        {connected && (
          <span className="ml-auto truncate text-[11px] text-mut">
            collegato come <b className="text-white">@{account.login}</b>
          </span>
        )}
      </div>

      {!account.signedIn && (
        <p className="text-[11px] leading-relaxed text-mut">
          Accedi al tuo account SAMS per collegare il tuo GitHub: gli agenti lavoreranno sulle tue repo.
        </p>
      )}

      {account.signedIn && !connected && (
        <>
          <p className="text-[11px] leading-relaxed text-mut">
            Collega il tuo account GitHub e scegli una tua repo: i task che assegni lavoreranno lì, con i tuoi permessi.
          </p>
          <button type="button" onClick={onConnect} disabled={busy !== ""} className="btn btn-primary h-8 w-full justify-center">
            {busy === "connect" ? <Loader2 size={14} className="animate-spin" /> : <Github size={14} />}
            Collega GitHub
          </button>
        </>
      )}

      {connected && (
        <>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-mut">Repository di lavoro</span>
            {repos === null ? (
              <p className="text-[11px] text-mut">{busy === "repos" ? "Carico le tue repo…" : "Repo non disponibili."}</p>
            ) : (
              <select value={repo} onChange={(e) => pickRepo(e.target.value)} className="settings-input">
                <option value="">— scegli una repo —</option>
                {repos.map((r) => (
                  <option key={r.fullName} value={r.fullName} disabled={!r.canPush}>
                    {r.fullName}
                    {r.private ? " (privata)" : ""}
                    {r.canPush ? "" : " — sola lettura"}
                  </option>
                ))}
                {repo && !repos.some((r) => r.fullName === repo) && <option value={repo}>{repo}</option>}
              </select>
            )}
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-mut">Branch base</span>
            <input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder={chosen?.defaultBranch ?? "main"}
              className="settings-input"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={busy !== "" || !repo || unchanged}
              className="btn btn-primary h-8 flex-1 justify-center"
            >
              {busy === "save" && <Loader2 size={14} className="animate-spin" />}
              Usa questa repo
            </button>
            <button type="button" onClick={onDisconnect} disabled={busy !== ""} className="btn h-8 justify-center" title="Scollega GitHub">
              {busy === "disconnect" ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
              Scollega
            </button>
          </div>
          {!account.repo && (
            <p className="text-[11px] text-rose-300">Scegli una repo: finché manca, gli agenti non possono lavorare per te.</p>
          )}
        </>
      )}

      {msg && (
        <p role={msg.kind === "err" ? "alert" : "status"} className={msg.kind === "err" ? "text-[11px] text-rose-300" : "text-[11px] text-emerald-300"}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
