import type { ReactNode } from "react";
import { Container } from "./Container";
import { LEGAL_INCOMPLETE, LEGAL_LAST_UPDATED } from "../data/legal";

/**
 * Guscio comune delle pagine Privacy e Termini: titolo, data di aggiornamento, avviso
 * finché titolare/contatto/licenza sono segnaposto, sezioni numerate leggibili.
 */
export function LegalPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <Container className="py-14">
      <article className="mx-auto max-w-3xl">
        <header className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand">{eyebrow}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">{title}</h1>
          <p className="mt-2 font-mono text-xs text-slate-500">
            Ultimo aggiornamento: <time dateTime={LEGAL_LAST_UPDATED}>{LEGAL_LAST_UPDATED}</time>
          </p>
          <div className="mt-4 text-[15px] leading-relaxed text-slate-300">{intro}</div>
        </header>
        {LEGAL_INCOMPLETE && (
          <p role="note" className="mb-8 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm leading-relaxed text-amber-200">
            Bozza: i dati tra parentesi quadre (titolare, contatto, licenza) non sono ancora stati decisi e vanno
            completati prima del rilascio 1.0.
          </p>
        )}
        <div className="flex flex-col gap-8">{children}</div>
      </article>
    </Container>
  );
}

/** Una sezione numerata della pagina. */
export function LegalSection({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  const id = `sezione-${n}`;
  return (
    <section aria-labelledby={id} className="scroll-mt-20">
      <h2 id={id} className="mb-2 text-lg font-semibold text-slate-100">
        <span className="mr-2 font-mono text-brand">{n}.</span>
        {title}
      </h2>
      <div className="flex flex-col gap-2 text-[15px] leading-relaxed text-slate-400 [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-slate-200">
        {children}
      </div>
    </section>
  );
}

/** Valore legale o, se manca, il suo segnaposto evidenziato. */
export function LegalValue({ value, placeholder, href }: { value: string | null; placeholder: string; href?: (v: string) => string }) {
  if (value === null) {
    return <mark className="rounded bg-amber-400/20 px-1 font-mono text-[13px] text-amber-200">{placeholder}</mark>;
  }
  return href ? (
    <a href={href(value)} className="text-brand hover:underline">
      {value}
    </a>
  ) : (
    <strong>{value}</strong>
  );
}
