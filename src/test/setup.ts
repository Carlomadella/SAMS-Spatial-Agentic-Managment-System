// Setup condiviso dei test di rendering (React Testing Library): smonta l'albero
// dopo ogni test così i componenti non si accumulano nel DOM di jsdom tra i casi.
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom non implementa matchMedia: forniamo uno stub (default desktop) così i
// componenti responsive (useIsMobile) rendono nei test senza crashare.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => {
  cleanup();
});
