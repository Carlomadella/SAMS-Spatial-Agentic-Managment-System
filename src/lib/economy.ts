// Economia del token come risorsa di gioco — ogni agente ha un portafoglio di
// "gettoni" (una valuta): completare un task ne frutta un po', e produrre un
// risultato concreto (PR/Notion) ne frutta molti di più. Gli agenti che lavorano
// meglio diventano più "ricchi". Logica pura e testabile; lo store tiene e
// persiste i saldi, il ProgressionBridge accredita i gettoni al completamento.

/** Saldo gettoni per agente. */
export type Wallets = Record<string, number>;

/** Gettoni base per un task completato. */
export const COIN_BASE = 15;
/** Bonus quando il task produce un risultato condivisibile (PR/Notion/URL). */
export const COIN_RESULT_BONUS = 35;

/** Gettoni guadagnati al completamento di un task. */
export function coinsForCompletion(opts: { hasResult: boolean }): number {
  return COIN_BASE + (opts.hasResult ? COIN_RESULT_BONUS : 0);
}

/** Accredita (immutabilmente) gettoni a un agente. Importi ≤ 0 sono ignorati. */
export function earnCoins(wallets: Wallets, agentId: string, amount: number): Wallets {
  if (!agentId || amount <= 0) return wallets;
  return { ...wallets, [agentId]: (wallets[agentId] ?? 0) + amount };
}

/** Saldo corrente di un agente (0 se mai guadagnato). */
export function balanceOf(wallets: Wallets, agentId: string): number {
  return wallets[agentId] ?? 0;
}

export interface WealthRow {
  agentId: string;
  name: string;
  coins: number;
}

/** Classifica di ricchezza, dal più ricco. A parità, ordine alfabetico stabile. */
export function wealthRanking(wallets: Wallets, agents: { id: string; name: string }[]): WealthRow[] {
  return agents
    .map((a) => ({ agentId: a.id, name: a.name, coins: balanceOf(wallets, a.id) }))
    .sort((x, y) => y.coins - x.coins || x.name.localeCompare(y.name));
}

/** Formatta un saldo compatto (1200 → "1.2k"). */
export function formatCoins(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
