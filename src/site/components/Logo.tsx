import { Link } from "../router";
import { useDesign } from "../design/DesignContext";

/**
 * Logo SAMS. Il mark ha tre varianti (Roadmap 5, scelte da /design): "orbitale" — un nucleo
 * (lo spazio condiviso) con attorno gli agenti in orbita — "monogramma" e "punto". Tutte
 * usano i token d'accento, così seguono tema e palette. È un Link alla home;
 * `withWordmark={false}` mostra solo il mark (es. come cue).
 *
 * `variant` esplicito serve al design lab, che disegna le anteprime dei mark *non* scelti:
 * senza, mostrerebbero tutte la variante attiva. Le pagine non lo passano.
 */
export function Logo({
  className = "",
  withWordmark = true,
  variant,
}: {
  className?: string;
  withWordmark?: boolean;
  variant?: string;
}) {
  const { choice } = useDesign();
  const kind = variant ?? choice("logo");
  const accent = "rgb(var(--c-accent))";
  const accent2 = "rgb(var(--c-accent-2))";

  const mark =
    kind === "monogramma" ? (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden className="shrink-0">
        <rect x="2" y="2" width="28" height="28" rx="8" fill={accent} />
        <text
          x="16"
          y="22"
          textAnchor="middle"
          fontSize="16"
          fontWeight="700"
          fill="rgb(var(--c-on-accent))"
          fontFamily="Inter, sans-serif"
        >
          S
        </text>
      </svg>
    ) : kind === "punto" ? (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden className="shrink-0">
        <circle cx="16" cy="16" r="7" fill={accent} />
        <circle cx="16" cy="16" r="7" fill={accent} opacity="0.3">
          <animate attributeName="r" values="7;9;7" dur="3s" repeatCount="indefinite" />
        </circle>
      </svg>
    ) : (
      <OrbitalMark accent={accent} accent2={accent2} />
    );

  return (
    <Link to="/" aria-label="SAMS — home" className={`flex items-center gap-2.5 ${className}`}>
      {mark}
      {withWordmark && (
        <span className="text-[17px] font-semibold tracking-tight text-slate-50">SAMS</span>
      )}
    </Link>
  );
}

/** Il mark storico: nucleo + anelli + agenti in orbita. */
function OrbitalMark({ accent, accent2 }: { accent: string; accent2: string }) {
  return (
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
  );
}
