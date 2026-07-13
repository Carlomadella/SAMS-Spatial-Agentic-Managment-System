import type { ReactNode } from "react";
import { Link } from "../router";

type Variant = "primary" | "ghost" | "soft";
type Size = "md" | "lg";

const VARIANT: Record<Variant, string> = {
  // pieno brand: la CTA principale. `!text-white` così resta bianco anche in tema chiaro
  // (il testo bianco è corretto su fondo blu; la rimappa globale del light non deve toccarlo).
  primary:
    "bg-brand !text-white shadow-[0_1px_0_rgba(255,255,255,0.14)_inset,0_10px_28px_-12px_rgba(79,140,255,0.8)] hover:bg-brand/90",
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
  const { children, variant = "primary", size = "md", className = "", icon } = props;
  const cls = `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 active:scale-[0.98] ${VARIANT[variant]} ${SIZE[size]} ${className}`;

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
