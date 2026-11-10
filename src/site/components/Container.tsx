import type { ReactNode } from "react";

/** Larghezza-contenuto centrata e responsive (1152px), riusata da tutte le sezioni del sito. */
export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-5 sm:px-8 ${className}`}>{children}</div>;
}
