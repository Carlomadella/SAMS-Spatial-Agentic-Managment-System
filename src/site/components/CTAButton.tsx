import type { ReactNode } from "react";
import { Link } from "../router";
import { useDesign } from "../design/DesignContext";

type Variant = "primary" | "ghost" | "soft";
type Size = "md" | "lg";

/** La forma degli angoli, scelta da /design (Roadmap 5). Vale per tutti i bottoni del sito. */
const SHAPE: Record<string, string> = {
  arrotondato: "rounded-lg",
  pillola: "rounded-full",
  squadrato: "rounded-sm",
};

const VARIANT: Record<Variant, string> = {
  // Pieno brand: la CTA principale. Il colore del testo è `--c-on-accent`, **derivato** dal
  // contrasto con l'accento della palette (vedi `onAccent` in data/palettes.ts): con cinque
  // accenti diversi × due temi nessun colore fisso funziona — bianco su ambra dà 2.15:1.
  //
  // Non `text-white` né la sua variante important: `index.css` rimappa `.theme-light
  // .text-white` a quasi-nero, e Tailwind genera la versione important anche di quella
  // rimappa, che vince per specificità. Un token è immune a entrambe le insidie.
  primary:
    "bg-brand text-[rgb(var(--c-on-accent))] shadow-[0_1px_0_rgba(255,255,255,0.14)_inset,0_10px_28px_-12px_rgba(245,158,11,0.55)] hover:bg-brand/90",
  // bordo sottile su fondo trasparente: azione secondaria
  ghost: "border border-line bg-ink-800/40 text-slate-200 hover:border-brand/50 hover:bg-ink-700/60 hover:text-white",
  // riempimento tenue brand: terza gerarchia
  soft: "bg-brand/12 text-brand ring-1 ring-inset ring-brand/25 hover:bg-brand/20",
};

const SIZE: Record<Size, string> = {
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-[15px]",
};

interface BaseProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  icon?: ReactNode;
  /** Forza la forma: serve al design lab per mostrare le anteprime *non* scelte. */
  shape?: string;
}

/**
 * Bottone/CTA del sito. Sceglie l'elemento giusto: `to` → <Link> interno (SPA),
 * `href` → <a> esterno (nuova scheda), altrimenti <button>. Stile unico, tre varianti
 * gerarchiche + due taglie, così le call-to-action restano coerenti su tutte le pagine.
 */
export function CTAButton(
  props: BaseProps &
    ({ to: string; href?: never; onClick?: never } | { href: string; to?: never; onClick?: never } | { onClick: () => void; to?: never; href?: never }),
) {
  const { children, variant = "primary", size = "md", className = "", icon, shape } = props;
  const { choice } = useDesign();
  const radius = SHAPE[shape ?? choice("button")] ?? SHAPE.arrotondato;
  const cls = `inline-flex items-center justify-center gap-2 ${radius} font-medium transition-all duration-150 active:scale-[0.98] ${VARIANT[variant]} ${SIZE[size]} ${className}`;

  const inner = (
    <>
      {children}
      {icon}
    </>
  );

  if ("to" in props && props.to) {
    return (
      <Link to={props.to} className={cls}>
        {inner}
      </Link>
    );
  }
  if ("href" in props && props.href) {
    return (
      <a href={props.href} target="_blank" rel="noreferrer" className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={"onClick" in props ? props.onClick : undefined} className={cls}>
      {inner}
    </button>
  );
}
