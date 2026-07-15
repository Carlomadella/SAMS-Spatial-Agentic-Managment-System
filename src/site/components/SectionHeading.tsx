import type { ReactNode } from "react";
import { useDesign } from "../design/DesignContext";

/**
 * Testata di sezione riusabile: un "eyebrow" (etichetta brand in maiuscoletto), un
 * titolo e un sottotitolo opzionale. Allineamento a sinistra (default) o centrato.
 * Come viene segnata la sezione è una variante di design (vedi /design).
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
  className = "",
  variant,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "left" | "center";
  className?: string;
  /** Forza lo stile: serve al design lab per le anteprime non scelte. */
  variant?: string;
}) {
  const { choice } = useDesign();
  const centered = align === "center";
  // Come si segna l'inizio di una sezione: etichetta, niente, o una barretta d'accento
  // (Roadmap 5, scelta da /design). `variant` esplicito serve alle anteprime del lab.
  const kind = variant ?? choice("heading");
  return (
    <div className={`${centered ? "mx-auto max-w-2xl text-center" : "max-w-2xl"} ${className}`}>
      {eyebrow && kind === "eyebrow" && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand">{eyebrow}</p>
      )}
      {kind === "linea" && (
        <span className={`mb-3 block h-1 w-10 rounded-full bg-brand ${centered ? "mx-auto" : ""}`} aria-hidden />
      )}
      <h2 className="text-balance text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">{title}</h2>
      {subtitle && <p className="mt-3 text-[15px] leading-relaxed text-slate-400">{subtitle}</p>}
    </div>
  );
}
