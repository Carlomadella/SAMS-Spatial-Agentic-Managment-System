import type { ReactNode } from "react";

/**
 * Testata di sezione riusabile: un "eyebrow" (etichetta brand in maiuscoletto), un
 * titolo e un sottotitolo opzionale. Allineamento a sinistra (default) o centrato.
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  const centered = align === "center";
  return (
    <div className={`${centered ? "mx-auto max-w-2xl text-center" : "max-w-2xl"} ${className}`}>
      {eyebrow && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand">{eyebrow}</p>
      )}
      <h2 className="text-balance text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">{title}</h2>
      {subtitle && <p className="mt-3 text-[15px] leading-relaxed text-slate-400">{subtitle}</p>}
    </div>
  );
}
