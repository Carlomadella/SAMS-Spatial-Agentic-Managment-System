import { Link } from "../router";

/**
 * Riga sotto il pulsante di registrazione (collaudo 21/11, punto 6.8; opzione A): con i
 * link a Termini e Privacy. Una casella obbligatoria (opzione B) serve solo per consensi
 * facoltativi, che SAMS non chiede. Da riverificare quando si compilano i dati legali.
 */
export function ConsentNote() {
  return (
    <p className="text-center text-[11px] leading-relaxed text-slate-500">
      Registrandoti accetti i <Link to="/termini" className="text-brand hover:underline">Termini</Link> e
      l'<Link to="/privacy" className="text-brand hover:underline">informativa Privacy</Link>.
    </p>
  );
}
