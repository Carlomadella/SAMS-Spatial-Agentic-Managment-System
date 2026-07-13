import { Container } from "../components/Container";
import { CTAButton } from "../components/CTAButton";

/** Pagina 404 del sito: percorso non riconosciuto. */
export function NotFound() {
  return (
    <Container className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center py-24 text-center">
      <p className="font-mono text-6xl font-semibold text-brand">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-slate-100">Pagina non trovata</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-400">La pagina che cerchi non esiste o è stata spostata.</p>
      <div className="mt-8">
        <CTAButton to="/" variant="primary">
          Torna alla home
        </CTAButton>
      </div>
    </Container>
  );
}
