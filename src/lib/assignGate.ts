import type { GithubAccountStatus } from "./backend";
import { useStore } from "../store/useStore";
import { canConfigure } from "./roleUi";

/** Perché «Assegna» è spento, e dove si sistema (sezione di ⚙, o null se non tocca a chi guarda). */
export interface AssignBlock {
  message: string;
  section: "github" | "repository" | null;
}

/**
 * Blocca l'assegnazione *prima* di avviare il lavoro quando il runtime fallirebbe comunque:
 * - GitHub per utente attivo (OAuth) e chi guarda ha fatto l'accesso → serve il suo GitHub con una repo
 *   (stesse regole di `userGithub` sul server, che altrimenti risponde 409);
 * - altrimenti valgono gli strumenti del server (`toolsReady`: GitHub, Notion o MCP), come nei runner.
 * Senza runtime o con lo stato ancora sconosciuto non blocca nulla.
 */
export function assignBlock(i: {
  online: boolean;
  toolsReady: boolean | null;
  account: GithubAccountStatus | null;
  owner: boolean;
}): AssignBlock | null {
  if (!i.online) return null;
  const a = i.account;
  if (a?.enabled && a.signedIn) {
    if (!a.connected) {
      return { message: "Prima collega il tuo GitHub: gli agenti lavorano sulle tue repo.", section: "github" };
    }
    if (!a.repo) {
      return { message: "Scegli la repo GitHub su cui far lavorare gli agenti.", section: "github" };
    }
    return null;
  }
  if (i.toolsReady === false) {
    return i.owner
      ? { message: "Gli agenti non hanno strumenti: inserisci il token GitHub del server.", section: "repository" }
      : { message: "Il proprietario del workspace non ha ancora collegato GitHub: finché non lo fa gli agenti non possono lavorare.", section: null };
  }
  return null;
}

/** Il blocco di «Assegna» letto dallo store in questo momento (per i gestori di eventi, fuori da React). */
export function currentAssignBlock(): AssignBlock | null {
  const s = useStore.getState();
  return assignBlock({ online: s.backendOnline, toolsReady: s.toolsReady, account: s.githubAccount, owner: canConfigure(s.viewerRole) });
}

/** Il blocco di «Assegna» per chi guarda, dallo stato del runtime nello store. */
export function useAssignBlock(): AssignBlock | null {
  const online = useStore((s) => s.backendOnline);
  const toolsReady = useStore((s) => s.toolsReady);
  const account = useStore((s) => s.githubAccount);
  const role = useStore((s) => s.viewerRole);
  return assignBlock({ online, toolsReady, account, owner: canConfigure(role) });
}
