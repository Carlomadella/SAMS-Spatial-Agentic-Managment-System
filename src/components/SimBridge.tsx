import { useEffect } from "react";
import { approveChanges, assignRemote, claimSimIssue, fetchSimIssues, releaseSimIssue } from "../lib/backend";
import { useStore } from "../store/useStore";
import type { Agent } from "../types";

/**
 * Invisible bridge that powers the Live Simulation mode.
 *
 * When simMode is on it:
 * 1. Polls GitHub issues every 30 s and refreshes the store.
 * 2. Detects agents going idle → atomically claims the next available issue →
 *    assigns it via the runtime.
 * 3. Auto-approves staged files so the agent can commit without user interaction.
 * 4. Auto-clears the "review" status so the cycle restarts.
 */
export function SimBridge() {
  // --- polling ---------------------------------------------------------------
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const unsub = useStore.subscribe((state, prev) => {
      const wasOn = prev.simMode && prev.backendOnline;
      const isOn = state.simMode && state.backendOnline;

      if (!wasOn && isOn) {
        void poll();
        timer = setInterval(() => void poll(), 30_000);
      } else if (wasOn && !isOn) {
        if (timer !== null) { clearInterval(timer); timer = null; }
      }
    });

    // Bootstrap if already on when the component mounts
    if (useStore.getState().simMode && useStore.getState().backendOnline) {
      void poll();
      timer = setInterval(() => void poll(), 30_000);
    }

    return () => {
      unsub();
      if (timer !== null) clearInterval(timer);
    };
  }, []);

  // --- auto-assign + auto-approve + auto-clear --------------------------------
  useEffect(() => {
    return useStore.subscribe((state, prev) => {
      if (!state.simMode || !state.backendOnline) return;

      for (const agent of state.agents) {
        const prevAgent = prev.agents.find((a) => a.id === agent.id);
        if (!prevAgent) continue;

        // Agent just became idle (from any active status) → try to pick next issue
        const wasActive = ["working", "review", "done", "blocked", "awaiting_approval"].includes(
          prevAgent.status,
        );
        const isNowIdle = agent.status === "idle" && !agent.task;
        if (wasActive && isNowIdle) {
          void handleIdle(agent);
        }

        // Agent entered awaiting_approval while sim is on → auto-approve
        if (
          agent.status === "awaiting_approval" &&
          prevAgent.status !== "awaiting_approval" &&
          (agent.pendingFiles?.length ?? 0) > 0
        ) {
          const hasClaim = state.simIssues.some((i) => i.claimedBy === agent.id);
          if (hasClaim) void autoApprove(agent.id);
        }

        // Agent reached "review" while holding a sim claim → auto-clear after a pause
        if (agent.status === "review" && prevAgent.status !== "review") {
          const hasClaim = state.simIssues.some((i) => i.claimedBy === agent.id);
          if (hasClaim) {
            setTimeout(() => {
              const fresh = useStore.getState().agents.find((a) => a.id === agent.id);
              if (fresh?.status === "review") useStore.getState().clearTask(agent.id);
            }, 2500);
          }
        }
      }
    });
  }, []);

  return null;
}

async function poll(): Promise<void> {
  const issues = await fetchSimIssues();
  useStore.getState().setSimIssues(issues);
}

async function autoApprove(agentId: string): Promise<void> {
  await approveChanges(agentId).catch(() => {});
}

async function handleIdle(agent: Agent): Promise<void> {
  const s = useStore.getState();
  if (!s.simMode || !s.backendOnline || !s.runtimeReady) return;

  // Release any issue previously held by this agent
  const previous = s.simIssues.find((i) => i.claimedBy === agent.id);
  if (previous) {
    useStore.getState().setSimIssues(
      useStore.getState().simIssues.map((i) =>
        i.number === previous.number ? { ...i, claimedBy: undefined } : i,
      ),
    );
    void releaseSimIssue(previous.number);
  }

  // Pick next unclaimed issue
  const available = useStore.getState().simIssues.find((i) => !i.claimedBy);
  if (!available) return;

  // Atomically claim on the server
  const ok = await claimSimIssue(available.number, agent.id);
  if (!ok) return; // another agent beat us to it

  // Mark as claimed in the store immediately so other concurrent handlers skip it
  useStore.getState().setSimIssues(
    useStore.getState().simIssues.map((i) =>
      i.number === available.number ? { ...i, claimedBy: agent.id } : i,
    ),
  );

  // Re-check agent is still idle (it might have received a task in the meantime)
  const fresh = useStore.getState().agents.find((a) => a.id === agent.id);
  if (!fresh || fresh.status !== "idle") {
    void releaseSimIssue(available.number);
    useStore.getState().setSimIssues(
      useStore.getState().simIssues.map((i) =>
        i.number === available.number ? { ...i, claimedBy: undefined } : i,
      ),
    );
    return;
  }

  // Compose the task: issue body injected as context in instructions
  const context = `## GitHub Issue #${available.number}: ${available.title}\n\n${available.body ?? "(nessuna descrizione)"}`;
  const instructions = fresh.instructions ? `${fresh.instructions}\n\n${context}` : context;
  const title = `Issue #${available.number} — ${available.title}`;

  useStore.getState().assignTask(agent.id, title, "");
  void assignRemote(agent.id, agent.name, title, undefined, fresh.role, instructions).catch(
    (err: Error) => {
      useStore.getState().log({
        agentId: agent.id,
        agentName: agent.name,
        color: agent.color,
        level: "ERROR",
        message: `Sim: ${err.message}`,
      });
    },
  );
}
