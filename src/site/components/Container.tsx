import type { ReactNode } from "react";
import { useDesign } from "../design/DesignContext";

/** La misura del contenuto, scelta da /design (Roadmap 5). */
const WIDTH: Record<string, string> = {
  normale: "max-w-6xl", // 1152px
  stretto: "max-w-5xl", // 1024px
  largo: "max-w-7xl", // 1280px
};

/**
 * Larghezza-contenuto centrata e responsive, riusata da tutte le sezioni del sito. La misura
 * è una scelta di design: cambiarla qui la cambia ovunque, ed è proprio questo che il lab
 * fa vedere.
 */
export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { choice } = useDesign();
  const width = WIDTH[choice("container")] ?? WIDTH.normale;
  return <div className={`mx-auto w-full ${width} px-5 sm:px-8 ${className}`}>{children}</div>;
}
