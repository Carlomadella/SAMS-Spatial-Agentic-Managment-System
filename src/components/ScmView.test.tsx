import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScmView } from "./ScmView";
import { useStore } from "../store/useStore";
import { SEED_AGENTS } from "../data/seed";

// Un agente con modifiche in attesa, così la PendingCard viene renderizzata.
function seedPending(role: "owner" | "editor" | "viewer") {
  useStore.setState({
    backendOnline: false,
    viewerRole: role,
    roleEnforced: role !== "owner",
    agents: [
      {
        ...SEED_AGENTS[0],
        status: "review",
        task: { title: "Fix bug", branch: "fix/bug", progress: 100 },
        pendingFiles: [{ path: "src/a.ts", content: "x", message: "fix" }],
      },
    ],
  });
}

describe("<ScmView /> — gating dei ruoli", () => {
  beforeEach(() => seedPending("owner"));

  it("un owner vede il pulsante Approva e committa", () => {
    render(<ScmView />);
    expect(screen.getByText(/Approva e committa/)).toBeTruthy();
  });

  it("un viewer non vede l'approvazione ma un avviso di sola lettura", () => {
    seedPending("viewer");
    render(<ScmView />);
    expect(screen.queryByText(/Approva e committa/)).toBeNull();
    expect(screen.getByText(/Sola lettura/)).toBeTruthy();
  });
});
