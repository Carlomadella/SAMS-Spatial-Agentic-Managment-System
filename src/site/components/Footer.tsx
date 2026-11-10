import { Github, Mail } from "lucide-react";
import { Link } from "../router";
import { CONTACT_EMAIL, GITHUB_URL, TAGLINE } from "../data/site";
import { Container } from "./Container";
import { Logo } from "./Logo";

interface Col {
  title: string;
  links: { label: string; to: string; external?: boolean }[];
}

const COLUMNS: Col[] = [
  {
    title: "Prodotto",
    links: [
      { label: "La stanza", to: "/app" },
      { label: "Funzionalità", to: "/#funzionalita" },
      { label: "Prezzi", to: "/#prezzi" },
    ],
  },
  {
    title: "Docs",
    links: [
      { label: "Documentazione", to: "/docs" },
      { label: "Changelog", to: "/changelog" },
      { label: "GitHub", to: GITHUB_URL, external: true },
    ],
  },
  {
    title: "Contatti",
    links: [
      { label: "Email", to: `mailto:${CONTACT_EMAIL}` },
      { label: "GitHub", to: GITHUB_URL, external: true },
    ],
  },
  {
    title: "Legale",
    links: [
      { label: "Privacy", to: "/#site-footer" },
      { label: "Termini", to: "/#site-footer" },
    ],
  },
];

function FooterLink({ label, to, external }: { label: string; to: string; external?: boolean }) {
  const cls = "text-sm text-slate-400 transition-colors hover:text-slate-100";
  if (external || to.startsWith("mailto:")) {
    return (
      <a href={to} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className={cls}>
        {label}
      </a>
    );
  }
  return (
    <Link to={to} className={cls}>
      {label}
    </Link>
  );
}

/**
 * Footer del sito (destinazione del link "Contatti"): logo + tagline a sinistra, quattro
 * colonne (Prodotto/Docs/Contatti/Legale), riga finale con social/GitHub, email di
 * contatto e © anno corrente. `id="site-footer"` è l'ancora a cui punta "Contatti".
 */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer id="site-footer" className="border-t border-line/70 bg-ink-900/40">
      <Container className="py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-sm leading-relaxed text-slate-400">{TAGLINE}</p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{col.title}</h3>
              <ul className="flex flex-col gap-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <FooterLink {...l} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-line/60 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-slate-500">© {year} SAMS · Spatial Agentic Management System</p>
          <div className="flex items-center gap-3">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-ink-800/40 text-slate-300 transition-colors hover:border-brand/50 hover:text-white"
            >
              <Github size={16} />
            </a>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-100"
            >
              <Mail size={15} />
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </Container>
    </footer>
  );
}
