import { ArrowRight, BookOpen, Boxes, ChevronDown, GitBranch, Radio, Sparkles, Users, Wallet } from "lucide-react";
import { Container } from "../components/Container";
import { CTAButton } from "../components/CTAButton";
import { SectionHeading } from "../components/SectionHeading";
import { Logo } from "../components/Logo";
import { Link } from "../router";
import { TAGLINE } from "../data/site";
import roomHero from "../assets/room-hero.jpg";

const FEATURES = [
  { icon: Boxes, title: "Stanza 3D interattiva", desc: "Seleziona gli agenti, mandali a camminare, orbita la telecamera. Un diorama vivo, non una dashboard statica." },
  { icon: Users, title: "Agenti con una vita", desc: "Stati, ruoli, XP e bisogni: lavorano ai task, prendono un caffè e di notte dormono." },
  { icon: GitBranch, title: "Collaborazione reale", desc: "Relay, reazioni a catena e playbook: gli agenti si passano il lavoro fino al risultato." },
  { icon: Radio, title: "Mondo condiviso", desc: "Più persone nella stessa stanza in tempo reale, con presenza, cursori e simulazione condivisa." },
  { icon: Wallet, title: "Economia e obiettivi", desc: "Monete, livelli e traguardi trasformano il lavoro degli agenti in progressione." },
  { icon: Sparkles, title: "Provider AI flessibile", desc: "Multi-provider: OpenRouter (modelli gratuiti e a pagamento), oltre a Gemini, Anthropic e Groq." },
];

export function Home() {
  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section id="top" className="relative overflow-hidden">
        {/* sfondo: screenshot reale della stanza 3D, sfumato per leggibilità, + bagliori brand */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {/* la stanza vera, ancorata in alto e schiarita così i robot restano riconoscibili */}
          <img
            src={roomHero}
            alt=""
            className="absolute inset-x-0 top-0 h-[120%] w-full object-cover object-top opacity-[0.38]"
          />
          {/* scrim verticale: fonde l'immagine nel colore della pagina (regge tema scuro/chiaro/ambra) */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to bottom, rgb(var(--c-ink-950) / 0.55) 0%, rgb(var(--c-ink-950) / 0.72) 45%, rgb(var(--c-ink-950)) 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(900px 460px at 50% -10%, rgb(var(--c-accent) / 0.20), transparent 60%), radial-gradient(700px 400px at 85% 20%, rgb(var(--c-accent-2) / 0.12), transparent 60%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage: "radial-gradient(circle at 50% 30%, black, transparent 75%)",
              WebkitMaskImage: "radial-gradient(circle at 50% 30%, black, transparent 75%)",
            }}
          />
        </div>

        <Container className="relative flex flex-col items-center py-24 text-center sm:py-32">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-ink-800/50 px-3 py-1 text-xs font-medium text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Spatial Agentic Management System
          </span>
          <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-slate-50 sm:text-6xl">
            La stanza spaziale dei tuoi <span className="text-brand">agenti AI</span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-slate-400">
            Assegna task, guardali collaborare e produrre risultati — in un mondo 3D vivo, condiviso in tempo reale.
          </p>

          {/* i due bottoni centrali richiesti: stanza + documentazione */}
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
            <CTAButton to="/app" variant="primary" size="lg" icon={<ArrowRight size={18} />}>
              Entra nella stanza
            </CTAButton>
            <CTAButton to="/docs" variant="ghost" size="lg" icon={<BookOpen size={17} />}>
              Leggi la documentazione
            </CTAButton>
          </div>
        </Container>

        {/* ── "Scopri di più": cue in basso nella hero ─────────────────────── */}
        <Container className="relative pb-12">
          <a
            href="#funzionalita"
            className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-2xl border border-line/70 bg-ink-900/40 px-6 py-5 text-center transition-colors hover:border-brand/40"
          >
            <Logo withWordmark={false} />
            <h4 className="mt-1 text-sm font-semibold text-slate-200">Scopri di più</h4>
            <p className="text-xs leading-relaxed text-slate-400">{TAGLINE} Un cruscotto operativo e un mondo simulato, insieme.</p>
            <ChevronDown size={18} className="mt-1 animate-bounce text-brand" />
          </a>
        </Container>
      </section>

      {/* ── FUNZIONALITÀ ─────────────────────────────────────────────────── */}
      <section id="funzionalita" className="border-t border-line/60 py-20">
        <Container>
          <SectionHeading
            eyebrow="Funzionalità"
            title="Tutto ciò che serve per orchestrare gli agenti"
            subtitle="Dalla scena 3D alla collaborazione, fino al mondo condiviso in tempo reale."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="group rounded-2xl border border-line/70 bg-ink-900/40 p-6 transition-colors hover:border-brand/40">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand/12 text-brand ring-1 ring-inset ring-brand/25">
                  <f.icon size={20} />
                </div>
                <h3 className="text-base font-semibold text-slate-100">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── PREZZI ───────────────────────────────────────────────────────── */}
      <section id="prezzi" className="border-t border-line/60 py-20">
        <Container>
          <SectionHeading align="center" eyebrow="Prezzi" title="Per ora, gratis" subtitle="SAMS è open source: oggi non costa nulla. Multi-provider — parti dai modelli gratuiti o porti le tue chiavi. I piani potranno cambiare in futuro." />
          <div className="mx-auto mt-10 max-w-md rounded-2xl border border-brand/30 bg-ink-900/50 p-8 text-center">
            <p className="text-sm font-medium text-brand">Open Source</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-50">
              €0<span className="text-lg font-normal text-slate-500">/per ora</span>
            </p>
            <ul className="mx-auto mt-6 flex max-w-xs flex-col gap-2 text-left text-sm text-slate-300">
              {["Stanza 3D e simulazione completa", "Mondo condiviso in tempo reale", "Multi-provider (OpenRouter, Gemini, Anthropic, Groq)", "Task, playbook e collaborazione"].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <span className="mt-0.5 text-brand">✓</span>
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <CTAButton to="/app" variant="primary" size="lg" icon={<ArrowRight size={18} />}>
                Inizia ora
              </CTAButton>
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-slate-500">
            Hai domande?{" "}
            <Link to="/#site-footer" className="text-brand hover:underline">
              Contattaci
            </Link>
            .
          </p>
        </Container>
      </section>
    </>
  );
}
