import { Link } from "../router";
import { SamsMark } from "../../components/SamsMark";
/**
 * Logo SAMS: il cubo-stanza con l'agente rossonero (stesso disegno di `media/logo/`).
 * È un Link alla home; `withWordmark={false}` mostra solo il mark (es. come cue).
 */
export function Logo({
  className = "",
  withWordmark = true,
  asLink = true,
}: {
  className?: string;
  withWordmark?: boolean;
  /**
   * `false` = solo il disegno, senza link. Serve quando il logo sta già dentro un link o un
   * bottone (il cue "Scopri di più"): un link dentro un link è HTML non valido e il browser
   * lo spezza in due.
   */
  asLink?: boolean;
}) {
  const mark = <SamsMark size={34} className="text-slate-50" />;

  const content = (
    <>
      {mark}
      {withWordmark && (
        <span className="text-[17px] font-semibold tracking-tight text-slate-50">SAMS</span>
      )}
    </>
  );
  if (!asLink) return <span className={`flex items-center gap-2.5 ${className}`}>{content}</span>;
  return (
    <Link to="/" aria-label="SAMS — home" className={`flex items-center gap-2.5 ${className}`}>
      {content}
    </Link>
  );
}
