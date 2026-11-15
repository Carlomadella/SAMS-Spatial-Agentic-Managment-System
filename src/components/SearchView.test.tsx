import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SearchView } from "./SearchView";
import { useStore } from "../store/useStore";

// La ricerca dei file usa l'albero vero del repo (/api/repo/tree), non più l'albero finto
// del seed (architecture.spatial, LICENSE…). Un file trovato si apre nel visualizzatore.

function stubTree(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("<SearchView /> — file del repo", () => {
  it("trova i file veri del repo e li apre", async () => {
    stubTree({
      repo: "a/b",
      branch: "main",
      truncated: false,
      connected: true,
      entries: [
        { path: "src", type: "tree" },
        { path: "src/server.ts", type: "blob" },
      ],
    });
    useStore.setState({ openedFilePath: null });
    render(<SearchView />);
    fireEvent.change(screen.getByPlaceholderText(/Cerca agenti/), { target: { value: "server" } });
    const hit = await screen.findByText("server.ts");
    fireEvent.click(hit);
    expect(useStore.getState().openedFilePath).toBe("src/server.ts");
  });

  it("non propone più i file finti del seed", async () => {
    stubTree({ repo: "", branch: "", truncated: false, connected: false, entries: [] });
    render(<SearchView />);
    fireEvent.change(screen.getByPlaceholderText(/Cerca agenti/), { target: { value: "architecture" } });
    expect(await screen.findByText(/Nessun risultato/)).toBeTruthy();
  });
});
