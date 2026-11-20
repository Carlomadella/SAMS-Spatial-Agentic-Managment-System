import { Link } from "../router";
import { LegalPage, LegalSection, LegalValue } from "../components/LegalPage";
import {
  CONTACT_PLACEHOLDER,
  LEGAL_CONTACT,
  LEGAL_LICENSE,
  LEGAL_OWNER,
  LICENSE_PLACEHOLDER,
  OWNER_PLACEHOLDER,
} from "../data/legal";
import { GITHUB_URL } from "../data/site";

const Owner = () => <LegalValue value={LEGAL_OWNER} placeholder={OWNER_PLACEHOLDER} />;
const Contact = () => <LegalValue value={LEGAL_CONTACT} placeholder={CONTACT_PLACEHOLDER} href={(v) => `mailto:${v}`} />;
const License = () => <LegalValue value={LEGAL_LICENSE} placeholder={LICENSE_PLACEHOLDER} />;

/**
 * Termini d'uso (ROADMAP5, 20/11/2026). SAMS è soprattutto da installare da sé (scelta
 * dell'utente): i termini coprono la demo pubblicata da <Owner /> e chiariscono che chi
 * installa SAMS risponde della propria installazione. Da far rileggere prima della 1.0.
 */
export function Terms() {
  return (
    <LegalPage
      eyebrow="Legale"
      title="Termini d'uso"
      intro={
        <p>
          Questi termini regolano l&apos;uso di SAMS nella versione pubblicata da <Owner />. Usando SAMS, o creando un
          account, li accetti. Se non sei d&apos;accordo, non usarlo.
        </p>
      }
    >
      <LegalSection n={1} title="Cos'è SAMS">
        <p>
          SAMS è una stanza 3D in cui coordini agenti di intelligenza artificiale che lavorano sui tuoi repository
          GitHub: leggono e scrivono file, aprono pull request e issue, scrivono su Notion. Il codice è pubblicato su{" "}
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-brand hover:underline">
            GitHub
          </a>{" "}
          con licenza <License />.
        </p>
      </LegalSection>

      <LegalSection n={2} title="Se installi SAMS da te">
        <p>
          Chi installa SAMS sul proprio server ne è l&apos;unico responsabile: sceglie i fornitori di intelligenza
          artificiale, le chiavi e i repository, decide chi può entrare ed è il titolare dei dati della propria
          installazione, con gli obblighi che ne derivano (per esempio un&apos;informativa privacy propria). Questi
          termini non si applicano alle installazioni di altri.
        </p>
      </LegalSection>

      <LegalSection n={3} title="Account">
        <ul>
          <li>Devi avere almeno 16 anni.</li>
          <li>Dai un indirizzo email valido e tieni riservata la password: sei responsabile di ciò che accade con il tuo account.</li>
          <li>
            Il proprietario del workspace decide chi entra e con quale ruolo (owner, editor, viewer) e può togliere
            l&apos;accesso.
          </li>
          <li>
            Puoi eliminare il tuo account quando vuoi dal <Link to="/profilo" className="text-brand hover:underline">Profilo</Link>.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={4} title="Uso consentito">
        <p>Non puoi usare SAMS, né far lavorare gli agenti, per:</p>
        <ul>
          <li>attività illegali o che violano diritti altrui (anche d&apos;autore, privacy e segreti industriali);</li>
          <li>accedere senza autorizzazione a sistemi, account o repository di altri;</li>
          <li>creare malware, spam o contenuti che ingannano o danneggiano persone;</li>
          <li>sovraccaricare o aggirare le protezioni del servizio (limiti, ruoli, verifica dell&apos;email);</li>
          <li>violare le regole d&apos;uso dei fornitori collegati (GitHub, fornitori di intelligenza artificiale, Notion).</li>
        </ul>
      </LegalSection>

      <LegalSection n={5} title="Il lavoro degli agenti">
        <p>
          Gli agenti usano modelli di intelligenza artificiale e <strong>possono sbagliare</strong>: scrivere codice
          errato o insicuro, cancellare o sovrascrivere file, aprire pull request o issue non volute. Sei tu a
          decidere quali permessi dare (token GitHub, repository, approvazione delle modifiche) e{" "}
          <strong>sei responsabile di controllare il loro lavoro</strong> prima di usarlo, unirlo o pubblicarlo. Ti
          consigliamo di lavorare su branch separati e di tenere attiva l&apos;approvazione delle modifiche.
        </p>
      </LegalSection>

      <LegalSection n={6} title="I tuoi contenuti">
        <p>
          Il codice, i testi e i dati che porti in SAMS o che gli agenti producono per te restano tuoi. Ci concedi
          solo ciò che serve a far funzionare il servizio: conservarli, mostrarli al tuo workspace e inviarli ai
          fornitori che li elaborano, come descritto nell&apos;
          <Link to="/privacy" className="text-brand hover:underline">informativa sulla privacy</Link>.
        </p>
      </LegalSection>

      <LegalSection n={7} title="Servizio offerto così com'è">
        <p>
          SAMS è offerto gratuitamente, «così com&apos;è» e senza garanzie di disponibilità, continuità o idoneità a
          uno scopo. Può essere interrotto, cambiato o chiuso in qualsiasi momento. Nei limiti consentiti dalla
          legge, <Owner /> non risponde di danni indiretti o della perdita di dati, codice o profitti derivanti
          dall&apos;uso di SAMS o dal lavoro degli agenti; restano salvi i casi di dolo o colpa grave e i diritti che
          la legge riconosce ai consumatori.
        </p>
      </LegalSection>

      <LegalSection n={8} title="Sospensione">
        <p>
          Possiamo sospendere o chiudere un account che viola questi termini o che mette a rischio il servizio o
          altri utenti.
        </p>
      </LegalSection>

      <LegalSection n={9} title="Modifiche e legge applicabile">
        <p>
          Se cambiamo questi termini aggiorniamo la data in cima alla pagina e segnaliamo i cambiamenti importanti
          nel <Link to="/changelog" className="text-brand hover:underline">changelog</Link>; continuando a usare
          SAMS li accetti. Si applica la legge italiana. Per domande scrivi a <Contact />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
