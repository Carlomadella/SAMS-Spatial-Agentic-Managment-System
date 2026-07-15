import { Check, RotateCcw } from "lucide-react";
import { Container } from "../components/Container";
import { SectionHeading } from "../components/SectionHeading";
import { HeroBackground } from "../components/HeroBackground";
import { CTAButton } from "../components/CTAButton";
import { Logo } from "../components/Logo";
import { ThemeToggle } from "../components/ThemeToggle";
import { useDesign } from "../design/DesignContext";
import { PALETTES, paletteSwatch } from "../data/palettes";
import { NAVBAR_VARIANTS } from "../data/navbarVariants";
import { HERO_VARIANTS } from "../data/heroVariants";
import {
  BUTTON_VARIANTS,
  CONTAINER_VARIANTS,
  FOOTER_VARIANTS,
  HEADING_VARIANTS,
  LOGO_VARIANTS,
  THEME_TOGGLE_VARIANTS,
} from "../data/componentVariants";
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

/** Titolo + spiegazione di una sezione del lab. */
function Group({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

export function Design() {
  const { choice, set, reset } = useDesign();
  const paletteId = choice("palette");
  const navbarId = choice("navbar");
  const heroId = choice("hero");

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
              onClick={() => set("palette", p.id)}
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
            <Option key={v.id} active={navbarId === v.id} onClick={() => set("navbar", v.id)} title={v.name} blurb={v.blurb}>
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
              onClick={() => set("hero", v.id)}
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

      {/* ── COMPONENTI CONDIVISI ─────────────────────────────────────────── */}

      <Group title="Logo" hint="Il mark accanto al nome, in cima a ogni pagina e nel footer. Le anteprime disegnano il mark vero, ognuna col suo.">
        {LOGO_VARIANTS.map((v) => (
          <Option key={v.id} active={choice("logo") === v.id} onClick={() => set("logo", v.id)} title={v.name} blurb={v.blurb}>
            <div className="flex h-14 items-center justify-center rounded-lg border border-line/60 bg-ink-950/60">
              {/* `variant` forzato: senza, ogni anteprima mostrerebbe il logo già scelto */}
              <Logo variant={v.id} />
            </div>
          </Option>
        ))}
      </Group>

      <Group title="Bottoni" hint="La forma degli angoli, uguale per tutte le call-to-action del sito. Guarda anche i bottoni qui sopra: cambiano insieme.">
        {BUTTON_VARIANTS.map((v) => (
          <Option key={v.id} active={choice("button") === v.id} onClick={() => set("button", v.id)} title={v.name} blurb={v.blurb}>
            <div className="flex h-14 items-center justify-center gap-2 rounded-lg border border-line/60 bg-ink-950/60">
              {/* i bottoni veri, nella forma della variante */}
              <span className="pointer-events-none">
                <CTAButton to="/design" variant="primary" shape={v.id}>
                  Entra
                </CTAButton>
              </span>
              <span className="pointer-events-none">
                <CTAButton to="/design" variant="ghost" shape={v.id}>
                  Docs
                </CTAButton>
              </span>
            </div>
          </Option>
        ))}
      </Group>

      <Group title="Testate di sezione" hint="Come si annuncia una sezione: l'etichetta colorata, niente, o una barretta d'accento.">
        {HEADING_VARIANTS.map((v) => (
          <Option key={v.id} active={choice("heading") === v.id} onClick={() => set("heading", v.id)} title={v.name} blurb={v.blurb}>
            <div className="rounded-lg border border-line/60 bg-ink-950/60 p-3">
              <SectionHeading
                variant={v.id}
                eyebrow="Funzionalità"
                title={<span className="text-base">Un mondo vivo</span>}
                className="[&_p:last-child]:text-xs"
              />
            </div>
          </Option>
        ))}
      </Group>

      <Group title="Footer" hint="Quanto deve pesare il fondo pagina. Scorri fino in fondo per vedere quello scelto.">
        {FOOTER_VARIANTS.map((v) => (
          <Option key={v.id} active={choice("footer") === v.id} onClick={() => set("footer", v.id)} title={v.name} blurb={v.blurb}>
            {/* schema in scala: dà l'ingombro, che è la cosa che si sta scegliendo */}
            <div className="flex h-14 flex-col justify-center gap-1.5 rounded-lg border border-line/60 bg-ink-950/60 px-3">
              {v.id === "completo" ? (
                <>
                  <div className="flex gap-3">
                    <span className="h-1.5 w-8 rounded-full bg-brand/70" />
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className="flex flex-1 flex-col gap-1">
                        <span className="h-1 w-full rounded-full bg-slate-600" />
                        <span className="h-1 w-2/3 rounded-full bg-slate-700" />
                        <span className="h-1 w-1/2 rounded-full bg-slate-700" />
                      </span>
                    ))}
                  </div>
                  <span className="mt-1 h-px w-full bg-slate-700" />
                  <span className="h-1 w-16 rounded-full bg-slate-700" />
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-8 rounded-full bg-brand/70" />
                    <span className="h-1 w-6 rounded-full bg-slate-600" />
                    <span className="h-1 w-6 rounded-full bg-slate-600" />
                  </span>
                  <span className="h-1 w-10 rounded-full bg-slate-700" />
                </div>
              )}
            </div>
          </Option>
        ))}
      </Group>

      <Group title="Larghezza del contenuto" hint="Quanto è largo il testo su uno schermo grande. Cambia tutta la pagina, questa compresa: si sente subito.">
        {CONTAINER_VARIANTS.map((v) => (
          <Option key={v.id} active={choice("container") === v.id} onClick={() => set("container", v.id)} title={v.name} blurb={v.blurb}>
            <div className="flex h-14 items-center justify-center rounded-lg border border-line/60 bg-ink-950/60 px-2">
              <span
                className={`flex h-9 items-center justify-center rounded border border-brand/40 bg-brand/10 ${
                  v.id === "stretto" ? "w-2/3" : v.id === "largo" ? "w-full" : "w-5/6"
                }`}
              >
                <span className="h-1 w-1/2 rounded-full bg-slate-500" />
              </span>
            </div>
          </Option>
        ))}
      </Group>

      <Group title="Toggle del tema" hint="Il comando chiaro/scuro nella barra in cima: solo icona o con l'etichetta accanto.">
        {THEME_TOGGLE_VARIANTS.map((v) => (
          <Option key={v.id} active={choice("themeToggle") === v.id} onClick={() => set("themeToggle", v.id)} title={v.name} blurb={v.blurb}>
            <div className="flex h-14 items-center justify-center rounded-lg border border-line/60 bg-ink-950/60">
              {/* il toggle vero: cliccarlo qui cambierebbe il tema, quindi è solo da guardare */}
              <span className="pointer-events-none">
                <ThemeToggle variant={v.id} />
              </span>
            </div>
          </Option>
        ))}
      </Group>

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
