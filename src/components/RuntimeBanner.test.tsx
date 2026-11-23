import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RuntimeBanner, bannerKind } from "./RuntimeBanner";
import { RouterProvider } from "../site/router";
import { useStore } from "../store/useStore";

// 23/11: su Render, senza accesso, il banner diceva «Runtime non in esecuzione — avvialo
// con npm start» mentre il server rispondeva 401. Mancanza di accesso e server spento sono
// due cose diverse, e `npm start` ha senso solo quando SAMS gira sul proprio computer.
describe("bannerKind", () => {
  it("online e pronto: nessun banner", () => {
    expect(bannerKind({ online: true, ready: true, authRequired: false, local: false })).toBeNull();
  });

  it("senza accesso chiede di accedere, anche in locale", () => {
    expect(bannerKind({ online: false, ready: false, authRequired: true, local: false })).toBe("login");
    expect(bannerKind({ online: false, ready: false, authRequired: true, local: true })).toBe("login");
  });

  it("server spento sul proprio computer: suggerisce npm start", () => {
    expect(bannerKind({ online: false, ready: false, authRequired: false, local: true })).toBe("start-local");
  });

  it("server online che non risponde: niente npm start, si riconnette da solo", () => {
    expect(bannerKind({ online: false, ready: false, authRequired: false, local: false })).toBe("reconnecting");
  });

  it("collegato ma senza chiavi: invita a configurarle", () => {
    expect(bannerKind({ online: true, ready: false, authRequired: false, local: false })).toBe("setup");
  });
});

describe("<RuntimeBanner />", () => {
  afterEach(() => useStore.setState({ backendOnline: false, streamAuthRequired: false }));

  it("senza accesso mostra il link per accedere e non parla di npm start", () => {
    useStore.setState({ backendOnline: false, streamAuthRequired: true });
    render(
      <RouterProvider>
        <RuntimeBanner />
      </RouterProvider>,
    );
    const link = screen.getByRole("link", { name: /accedi/i });
    expect(link.getAttribute("href")).toBe("/login");
    expect(document.body.textContent).not.toContain("npm start");
  });
});
