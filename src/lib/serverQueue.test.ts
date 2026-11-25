import { beforeEach, describe, expect, it } from "vitest";
import { noteQueueEvent, queueOf, useServerQueue, type ServerQueued } from "./serverQueue";
import { useStore } from "../store/useStore";

const item = (id: string, agentId: string): ServerQueued => ({
  id, agentId, agentName: agentId, title: id, branch: "", status: "queued", createdBy: "Carlo", createdAt: 0, afterTaskId: "", urgent: false, waitNote: "",
});

beforeEach(() => useServerQueue.setState({ list: [], loaded: false }));

describe("coda sul server — client", () => {
  it("lo stream manda la coda intera; ogni agente vede la sua", () => {
    noteQueueEvent({ agentId: "queue", queue: [item("t1", "a"), item("t2", "b"), item("t3", "a")] });
    const s = useServerQueue.getState();
    expect(s.loaded).toBe(true);
    expect(queueOf(s.list, "a").map((q) => q.id)).toEqual(["t1", "t3"]);
  });

  it("gli altri eventi non toccano la coda", () => {
    noteQueueEvent({ agentId: "a", queue: [item("x", "a")] });
    noteQueueEvent({ agentId: "queue" });
    expect(useServerQueue.getState().list).toEqual([]);
  });

  it("un task partito dal server mostra il suo titolo, non il primo messaggio", () => {
    const a = useStore.getState().agents[0];
    useStore.getState().applyRemote({ agentId: a.id, taskTitle: "Scrivi i test del login", message: "Parte dalla coda: Scrivi i test del login" });
    useStore.getState().applyRemote({ agentId: a.id, status: "working", progress: 6, message: "Avvio · OpenRouter" });
    const t = useStore.getState().agents.find((x) => x.id === a.id)?.task;
    expect(t?.title).toBe("Scrivi i test del login");
    expect(t?.progress).toBe(6);
  });
});
