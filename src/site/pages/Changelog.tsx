import { Container } from "../components/Container";
import { CHANGELOG_ENTRIES } from "../data/changelog";
import { GITHUB_URL } from "../data/site";

const TAG_STYLE: Record<string, string> = {
  Added: "bg-emerald-400/12 text-emerald-300 ring-emerald-400/25",
  Changed: "bg-amber-400/12 text-amber-300 ring-amber-400/25",
  Fixed: "bg-brand/12 text-brand ring-brand/25",
};

/**
 * Pagina Changelog dedicata (raggiungibile dal footer, non dalla navbar: volutamente
 * poco in vista). Elenco cronologico delle novità; la storia completa vive in
 * CHANGELOG.md nel repo.
 */
export function Changelog() {
  return (
    <Container className="py-14">
      <header className="mb-10 max-w-2xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand">Changelog</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">Novità di SAMS</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-400">
          Le modifiche più recenti. La cronologia completa è nel{" "}
          <a href={`${GITHUB_URL}/blob/main/CHANGELOG.md`} target="_blank" rel="noreferrer" className="text-brand hover:underline">
            changelog del repository
          </a>
          .
        </p>
      </header>

      <ol className="relative flex flex-col gap-4 border-l border-line/70 pl-6">
        {CHANGELOG_ENTRIES.map((e) => (
          <li key={e.date + e.title} className="relative">
            <span className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand ring-4 ring-ink-950" />
            <div className="rounded-xl border border-line/70 bg-ink-900/40 p-4">
              <div className="mb-1.5 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset ${TAG_STYLE[e.tag]}`}>{e.tag}</span>
                <time className="font-mono text-xs text-slate-500">{e.date}</time>
              </div>
              <h3 className="text-sm font-semibold text-slate-100">{e.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{e.summary}</p>
            </div>
          </li>
        ))}
      </ol>
    </Container>
  );
}
