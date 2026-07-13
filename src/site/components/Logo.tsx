import { Link } from "../router";

/**
 * Logo SAMS: mark "orbitale" — un nucleo (lo spazio condiviso) con attorno gli agenti in
 * orbita. Usa i token d'accento del sito (ambra + corallo) così segue tema e palette.
 * È un Link alla home. `withWordmark={false}` mostra solo il mark (es. come cue/favicon).
 */
export function Logo({ className = "", withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  const accent = "rgb(var(--c-accent))";
  const accent2 = "rgb(var(--c-accent-2))";
  return (
    <Link to="/" aria-label="SAMS — home" className={`flex items-center gap-2.5 ${className}`}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden className="shrink-0">
        {/* anelli d'orbita */}
        <circle cx="16" cy="16" r="13" stroke={accent} strokeOpacity="0.28" strokeWidth="1" />
        <circle cx="16" cy="16" r="8.5" stroke={accent} strokeOpacity="0.18" strokeWidth="1" />
        {/* nucleo */}
        <circle cx="16" cy="16" r="4" fill={accent} />
        <circle cx="16" cy="16" r="4" fill={accent} opacity="0.35">
          <animate attributeName="r" values="4;5.5;4" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.35;0;0.35" dur="3s" repeatCount="indefinite" />
        </circle>
        {/* agenti in orbita */}
        <circle cx="16" cy="3" r="2.3" fill={accent} />
        <circle cx="29" cy="16" r="2.3" fill={accent2} />
        <circle cx="16" cy="29" r="2.3" fill={accent} />
        <circle cx="3" cy="16" r="2.3" fill={accent2} />
      </svg>
      {withWordmark && <span className="text-[17px] font-semibold tracking-tight text-slate-100">SAMS</span>}
    </Link>
  );
}
