import { Link } from "../router";

/**
 * Logo SAMS: un piccolo mark (griglia 3×3 di celle, richiama la "stanza spaziale" di
 * agenti) + wordmark. È un Link alla home. Il mark usa `currentColor`/il brand così
 * eredita il tema. `to={null}` lo rende non cliccabile (es. nel footer già dentro un link).
 */
export function Logo({ className = "", withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  const content = (
    <>
      <span className="grid h-8 w-8 grid-cols-3 grid-rows-3 gap-[2px] rounded-lg bg-brand/12 p-[5px] ring-1 ring-brand/30">
        {Array.from({ length: 9 }).map((_, i) => (
          <span
            key={i}
            className="rounded-[1px]"
            // le celle "attive" (diagonale + centro) accese in brand, le altre spente
            style={{ background: [0, 2, 4, 6, 8].includes(i) ? "rgb(var(--c-accent))" : "rgb(var(--c-accent) / 0.28)" }}
          />
        ))}
      </span>
      {withWordmark && (
        <span className="text-[17px] font-semibold tracking-tight text-slate-100">SAMS</span>
      )}
    </>
  );

  return (
    <Link to="/" aria-label="SAMS — home" className={`flex items-center gap-2.5 ${className}`}>
      {content}
    </Link>
  );
}
