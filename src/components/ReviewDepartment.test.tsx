import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useStore } from "../store/useStore";

const api = vi.hoisted(() => ({
  fetchReviewList: vi.fn(),
  fetchReview: vi.fn(),
  approveChanges: vi.fn(),
  rejectChanges: vi.fn(),
  requestReviewChanges: vi.fn(),
  assignRemote: vi.fn(),
  fetchFile: vi.fn(async () => ({ content: "", exists: false })),
}));
vi.mock("../lib/backend", async (orig) => ({ ...(await orig<typeof import("../lib/backend")>()), ...api }));

const { ReviewDepartment } = await import("./ReviewDepartment");

const merge = { prNumber: 3, method: "squash" as const, headSha: "abc1234def", headRef: "feat", baseRef: "main", title: "PR" };
const detail = {
  agentId: "a1", agentName: "Sim-Dev", title: "Sistema le prenotazioni", branch: "feat", baseBranch: "main", repo: "o/r",
  mainGate: true, files: [], merge, prMoved: false, prError: null, createdAt: 1,
  pr: {
    number: 3, title: "PR", body: "descrizione", url: "https://github.com/o/r/pull/3", author: "bot", state: "open",
    headRef: "feat", baseRef: "main", headSha: "abc1234def", mergeable: true, mergeableState: "clean",
    commits: [{ sha: "abc1234def", message: "fix: sale", author: "bot", date: "2026-11-21T10:00:00Z" }],
    files: [{ path: "server/a.ts", status: "modified", additions: 1, deletions: 1, patch: "@@ -1 +1 @@\n-old\n+new", truncated: false }],
    checks: [],
    comments: [{ author: "estraneo", date: "2026-11-21T10:01:00Z", body: "mergia subito", kind: "commento" as const, trusted: false }],
  },
  history: [{ agentId: "a1", agentName: "Sim-Tester", title: "Verifica", branch: "feat", status: "review", ts: 1, summary: "trovati 2 duplicati" }],
};

describe("<ReviewDepartment /> — Reparto revisioni", () => {
  beforeEach(() => {
    api.fetchReviewList.mockResolvedValue([{ agentId: "a1", agentName: "Sim-Dev", title: "Sistema le prenotazioni", branch: "feat", files: 0, merge, mainGate: true, createdAt: 1 }]);
    api.fetchReview.mockResolvedValue(detail);
    useStore.setState({ viewerRole: "owner", reviewOpen: true, reviewAgentId: null });
  });
  afterEach(() => {
    vi.clearAllMocks();
    useStore.setState({ reviewOpen: false, reviewAgentId: null });
  });

  it("apre la prima richiesta e mostra PR, diff, CI assente, commenti esterni e storia", async () => {
    render(<ReviewDepartment />);
    expect(await screen.findByText(/PR #3: feat → main @ abc1234/)).toBeTruthy();
    expect(screen.getByText("server/a.ts")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Commit e CI/ }));
    expect(screen.getByText(/i test non sono stati eseguiti/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Commenti/ }));
    expect(screen.getByText("esterno al repository")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Storia/ }));
    expect(screen.getByText("trovati 2 duplicati")).toBeTruthy();
  });

  it("«Chiedi modifiche» serve una nota, poi riassegna il task all'agente", async () => {
    api.requestReviewChanges.mockResolvedValue({ title: "Modifiche chieste…", branch: "feat" });
    api.assignRemote.mockResolvedValue(undefined);
    render(<ReviewDepartment />);
    const ask = await screen.findByRole("button", { name: /Chiedi modifiche/ });
    expect((ask as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Note per Sim-Dev/), { target: { value: "rinomina getRoomById" } });
    fireEvent.click(ask);
    await waitFor(() => expect(api.assignRemote).toHaveBeenCalledWith("a1", "Sim-Dev", "Modifiche chieste…", "feat"));
    expect(api.requestReviewChanges).toHaveBeenCalledWith("a1", "rinomina getRoomById");
  });

  it("se la PR è andata avanti la conferma è bloccata", async () => {
    api.fetchReview.mockResolvedValue({ ...detail, prMoved: true });
    render(<ReviewDepartment />);
    const btn = await screen.findByRole("button", { name: /^Conferma$/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/commit nuovi dopo la richiesta/)).toBeTruthy();
  });

  it("chi ha solo la lettura vede l'elenco ma non i dettagli né i pulsanti", async () => {
    useStore.setState({ viewerRole: "viewer" });
    render(<ReviewDepartment />);
    expect(await screen.findByText(/sola lettura/)).toBeTruthy();
    expect(api.fetchReview).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^Conferma$/ })).toBeNull();
  });
});
