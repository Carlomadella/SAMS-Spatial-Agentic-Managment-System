import { useEffect, useState } from "react";
import { Container } from "../components/Container";
import { DOCS_SECTIONS } from "../data/docsSections";

/**
 * Documentazione a sezioni (contenuti a mano in docsSections.ts). Indice laterale
 * sticky + contenuto; la sezione attiva si evidenzia in base allo scroll. Ogni sezione
 * ha un ancoraggio (#id) così è linkabile direttamente.
 */
export function Docs() {
  const [active, setActive] = useState(DOCS_SECTIONS[0]?.id);

  // Evidenzia nell'indice la sezione più in vista (scroll spy).
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: [0, 0.5, 1] },
    );
    for (const s of DOCS_SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <Container className="py-14">
      <header className="mb-10 max-w-2xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand">Documentazione</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">Come funziona SAMS</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-400">
          Ogni elemento della workspace e ogni strumento a disposizione, spiegato per sezioni.
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        {/* indice laterale */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 flex flex-col gap-1">
            {DOCS_SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active === s.id ? "bg-brand/12 font-medium text-brand" : "text-slate-400 hover:bg-ink-800/50 hover:text-slate-100"
                }`}
              >
                {s.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* contenuto */}
        <div className="flex flex-col gap-14">
          {DOCS_SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="text-xl font-semibold tracking-tight text-slate-100">{s.title}</h2>
              <p className="mt-2.5 text-[15px] leading-relaxed text-slate-400">{s.intro}</p>
              {s.items && (
                <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                  {s.items.map((it) => (
                    <div key={it.term} className="rounded-xl border border-line/70 bg-ink-900/40 p-4">
                      <dt className="text-sm font-semibold text-slate-100">{it.term}</dt>
                      <dd className="mt-1 text-sm leading-relaxed text-slate-400">{it.desc}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          ))}
        </div>
      </div>
    </Container>
  );
}
