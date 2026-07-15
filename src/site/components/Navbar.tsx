import { useState } from "react";
import { Menu, User, X } from "lucide-react";
import { Link, useLocation } from "../router";
import { useAuth } from "../auth/AuthContext";
import { useDesign } from "../design/DesignContext";
import { navbarById } from "../data/navbarVariants";
import { Container } from "./Container";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { CTAButton } from "./CTAButton";

/** Un link della navbar: <Link> interno o <a> esterno (GitHub), con stato attivo. */
function NavItem({ label, to, external, onClick }: { label: string; to: string; external?: boolean; onClick?: () => void }) {
  const { path } = useLocation();
  const active = !external && (to === path || (to !== "/" && !to.startsWith("/#") && path.startsWith(to)));
  const cls = `text-sm font-medium transition-colors ${active ? "text-white" : "text-slate-400 hover:text-slate-100"}`;
  if (external) {
    return (
      <a href={to} target="_blank" rel="noreferrer" className={cls} onClick={onClick}>
        {label}
      </a>
    );
  }
  return (
    <Link to={to} className={cls} onClick={onClick}>
      {label}
    </Link>
  );
}

/**
 * Header del sito: logo a sinistra, i link centrali e a destra le azioni (tema, "Apri la
 * stanza", Accedi/Profilo). Sticky in cima; su mobile collassa in un menu.
 *
 * **Quanti** link e **quante** azioni li decide la variante scelta (Roadmap 5): la navbar
 * è una sola e si configura da `navbarVariants.ts`, invece di esistere in quattro copie
 * che divergerebbero al primo ritocco. Accedi/Profilo non è opzionale: è il modo di entrare.
 */
export function Navbar() {
  const { user } = useAuth();
  const { navbarId } = useDesign();
  const variant = navbarById(navbarId);
  const [open, setOpen] = useState(false);

  const authControl = user ? (
    <CTAButton to="/profilo" variant="soft" icon={<User size={15} />}>
      {user.name}
    </CTAButton>
  ) : (
    <CTAButton to="/login" variant="ghost">
      Accedi
    </CTAButton>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ink-950/80 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Logo />

        {/* link centrali (desktop) */}
        <nav className="hidden items-center gap-7 md:flex">
          {variant.links.map((l) => (
            <NavItem key={l.label} {...l} />
          ))}
        </nav>

        {/* azioni a destra (desktop) */}
        <div className="hidden items-center gap-2.5 md:flex">
          {variant.theme && <ThemeToggle />}
          {variant.roomCta && (
            <CTAButton to="/app" variant="primary">
              Apri la stanza
            </CTAButton>
          )}
          {authControl}
        </div>

        {/* toggle menu mobile */}
        <div className="flex items-center gap-2 md:hidden">
          {variant.theme && <ThemeToggle />}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Chiudi il menu" : "Apri il menu"}
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-ink-800/40 text-slate-300 hover:text-white"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </Container>

      {/* pannello mobile */}
      {open && (
        <div className="border-t border-line/70 bg-ink-950/95 md:hidden">
          <Container className="flex flex-col gap-1 py-3">
            {variant.links.map((l) => (
              <div key={l.label} className="py-1.5">
                <NavItem {...l} onClick={() => setOpen(false)} />
              </div>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-line/60 pt-3">
              {variant.roomCta && (
                <CTAButton to="/app" variant="primary">
                  Apri la stanza
                </CTAButton>
              )}
              {authControl}
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}
