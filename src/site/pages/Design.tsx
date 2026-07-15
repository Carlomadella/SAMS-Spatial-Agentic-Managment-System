import { Check, RotateCcw } from "lucide-react";
import { Container } from "../components/Container";
import { SectionHeading } from "../components/SectionHeading";
import { HeroBackground } from "../components/HeroBackground";
import { useDesign } from "../design/DesignContext";
import { PALETTES, paletteSwatch } from "../data/palettes";
import { NAVBAR_VARIANTS } from "../data/navbarVariants";
import { HERO_VARIANTS } from "../data/heroVariants";
import { Link } from "../router";

/**
 * Design lab (Roadmap 5) — il posto dove le scelte aperte si **guardano** invece di
 * immaginarle. Ogni opzione si applica al sito vero, subito: la navbar qui sopra cambia
 * mentre scegli, e la home mostra la hero scelta. È il motivo per cui le varianti vivono
 * in un contesto e non in una galleria di finti screenshot — un'anteprima statica non
 * risponde alla domanda "questo colore regge sulle mie pagine?".
 *
 * La scelta è persistita, quindi resta anche navigando; "Ripristina" torna al punto di
 * partenza (Ambra + navbar completa + screenshot).
 */

/** Cornice di una scelta: bordo acceso e spunta quando è quella attiva. */
function Option({
  active,
  onClick,
  title,
  blurb,
  children,
  footer,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  blurb: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col gap-3 rounded-2xl border p-4 text-left transition-all ${
        active ? "border-brand/60 bg-brand/5 ring-1 ring-brand/30" : "border-line/70 bg-ink-900/40 hover:border-line"
      }`}
    >
      {children}
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
          {title}
          {active && <Check size={14} className="text-brand" />}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{blurb}</p>
        {footer}
      </div>
    </button>
  );
}

export function Design() {
  const { paletteId, navbarId, heroId, setPalette, setNavbar, setHero, reset } = useDesign();

  return (
    <Container className="py-16">
      <SectionHeading
        eyebrow="Design lab"
        title="Prova le varianti"
        subtitle="Ogni scelta si applica al sito vero, subito: la navbar qui sopra cambia mentre scegli, e la home userà la hero selezionata. Le scelte restano salvate su questo dispositivo."
      />

      {/* ── PALETTE ──────────────────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Palette</h2>
        <p className="mt-1 text-xs text-slate-500">
          Cinque opzioni: «SAMS» richiama i colori della stanza, le altre portano il sito altrove. Ognuna
          funziona sia in chiaro sia in scuro — provale con il toggle del tema.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PALETTES.map((p) => (
            <Option
              key={p.id}
              active={paletteId === p.id}
              onClick={() => setPalette(p.id)}
              title={p.name}
              blurb={p.blurb}
            >
              {/* swatch coi colori *di quella* palette, non con quelli in uso */}
              <div className="flex h-12 overflow-hidden rounded-lg border border-line/60">
                {paletteSwatch(p).map((c, i) => (
                  <span key={i} className="flex-1" style={{ backgroundColor: c }} />
                ))}
              </div>
            </Option>
          ))}
        </div>
      </section>

      {/* ── NAVBAR ───────────────────────────────────────────────────────── */}
      <section className="mt-14">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Navbar</h2>
        <p className="mt-1 text-xs text-slate-500">
          Ogni variante toglie un pezzo diverso, così il confronto isola una cosa per volta. Guarda in cima
          alla pagina: è la navbar vera che cambia.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {NAVBAR_VARIANTS.map((v) => (
            <Option key={v.id} active={navbarId === v.id} onClick={() => setNavbar(v.id)} title={v.name} blurb={v.blurb}>
              {/* schema in scala: logo · link · azioni — dà il ritmo senza fingere uno screenshot */}
              <div className="flex h-12 items-center gap-2 rounded-lg border border-line/60 bg-ink-950/60 px-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand" />
                <span className="flex flex-1 items-center justify-center gap-1.5">
                  {v.links.map((l) => (
                    <span key={l.label} className="h-1.5 w-7 rounded-full bg-slate-600" />
                  ))}
                </span>
                {v.theme && <span className="h-4 w-4 shrink-0 rounded bg-slate-700" />}
                {v.roomCta && <span className="h-4 w-10 shrink-0 rounded bg-brand/70" />}
                <span className="h-4 w-8 shrink-0 rounded border border-line bg-ink-800" />
              </div>
            </Option>
          ))}
        </div>
      </section>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="mt-14">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Hero</h2>
        <p className="mt-1 text-xs text-slate-500">
          Dal mostrare la stanza al non mostrarla affatto. Le anteprime sono quelle vere, in miniatura —{" "}
          <Link to="/" className="text-brand hover:underline">
            aprile a schermo intero in home
          </Link>
          .
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HERO_VARIANTS.map((v) => (
            <Option
              key={v.id}
              active={heroId === v.id}
              onClick={() => setHero(v.id)}
              title={v.name}
              blurb={v.blurb}
              footer={<p className="mt-2 border-t border-line/50 pt-2 text-[11px] leading-relaxed text-slate-500">{v.tradeoff}</p>}
            >
              {/* la hero vera in miniatura: stesso componente della home, non un'imitazione */}
              <div className="relative h-24 overflow-hidden rounded-lg border border-line/60 bg-ink-950">
                <HeroBackground kind={v.id} />
                <div className="relative flex h-full flex-col items-center justify-center gap-1.5">
                  <span className="h-1.5 w-20 rounded-full bg-slate-300/80" />
                  <span className="h-1 w-28 rounded-full bg-slate-500/70" />
                  <span className="mt-1 h-3 w-12 rounded bg-brand/80" />
                </div>
              </div>
            </Option>
          ))}
        </div>
      </section>

      <div className="mt-12 flex justify-center">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-ink-800/40 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-brand/40 hover:text-slate-100"
        >
          <RotateCcw size={14} />
          Ripristina il design di partenza
        </button>
      </div>
    </Container>
  );
}
