import { beforeEach, describe, expect, it } from "vitest";
import { noteAgentEvent, overlayLiveStatus, resetLiveStatus } from "./liveStatus";
import { clearPending, setPending } from "./pendingBuffer";
import { beginRun, resetRuns } from "./taskRuns";
import type { WorldSnapshot } from "./worldState";

const snap = (status: string, task: string | null, updatedAt = 1000): WorldSnapshot => ({
  version: 3,
  updatedAt,
  agents: [{ id: "a1", name: "Sim-Dev", color: "red", role: "Dev", status, task, progress: 40 }],
});

describe("overlayLiveStatus — lo stato degli agenti anche senza nessuno nella stanza", () => {
  beforeEach(() => {
    resetLiveStatus();
    resetRuns();
  });

  it("senza eventi lo snapshot resta com'è", () => {
    const s = snap("working", "T1");
    expect(overlayLiveStatus(s)).toEqual(s);
  });

  it("un task finito dopo l'ultimo salvataggio rende l'agente non più al lavoro", () => {
    noteAgentEvent({ agentId: "a1", agentName: "Sim-Dev", status: "review", progress: 100 }, 2000);
    const a = overlayLiveStatus(snap("working", "T1")).agents[0];
    expect(a.status).toBe("review");
    expect(a.progress).toBe(100);
    expect(a.task).toBe("T1");
  });

  it("inattivo dopo un task annullato: niente task in corso", () => {
    noteAgentEvent({ agentId: "a1", agentName: "Sim-Dev", status: "idle" }, 2000);
    const a = overlayLiveStatus(snap("blocked", "T1")).agents[0];
    expect(a).toMatchObject({ status: "idle", task: null, progress: 0 });
  });

  it("un task in corso sul server vince: al lavoro, con il suo titolo", () => {
    beginRun("a1", "Ripristina UTC", 2000);
    const a = overlayLiveStatus(snap("blocked", "vecchio"), 2500).agents[0];
    expect(a).toMatchObject({ status: "working", task: "Ripristina UTC" });
  });

  it("un evento più vecchio dell'ultimo salvataggio non sovrascrive", () => {
    noteAgentEvent({ agentId: "a1", agentName: "Sim-Dev", status: "blocked" }, 500);
    expect(overlayLiveStatus(snap("working", "T1")).agents[0].status).toBe("working");
  });

  it("gli eventi senza stato (log, chat) non contano", () => {
    noteAgentEvent({ agentId: "a1", agentName: "Sim-Dev", message: "sto leggendo" }, 2000);
    expect(overlayLiveStatus(snap("working", "T1")).agents[0].status).toBe("working");
  });

  it("non tocca gli agenti cancellati", () => {
    beginRun("a1", "X", 2000);
    const s = snap("idle", null);
    s.agents[0].deleted = true;
    expect(overlayLiveStatus(s, 2500).agents[0]).toEqual(s.agents[0]);
  });
});

describe("overlayLiveStatus — sala d'attesa (push/merge sul branch principale)", () => {
  beforeEach(() => { resetLiveStatus(); resetRuns(); clearPending("a1"); });

  it("un merge in attesa tiene l'agente in attesa anche dopo un salvataggio più recente", () => {
    setPending("a1", { branch: "b", title: "T", agentName: "Sim-Dev", files: [], merge: { prNumber: 3, method: "squash" } });
    expect(overlayLiveStatus(snap("idle", null, 9e15)).agents[0].status).toBe("awaiting_approval");
    clearPending("a1");
    expect(overlayLiveStatus(snap("idle", null, 9e15)).agents[0].status).toBe("idle");
  });

  it("file in attesa su un branch di lavoro non sono la sala d'attesa", () => {
    setPending("a1", { branch: "b", title: "T", agentName: "Sim-Dev", files: [{ path: "x", content: "y", message: "m" }] });
    expect(overlayLiveStatus(snap("idle", null, 9e15)).agents[0].status).toBe("idle");
    clearPending("a1");
  });
});
