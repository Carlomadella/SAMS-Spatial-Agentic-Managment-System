import { Link } from "../router";
import { LegalPage, LegalSection, LegalValue } from "../components/LegalPage";
import { CONTACT_PLACEHOLDER, LEGAL_CONTACT, LEGAL_OWNER, OWNER_PLACEHOLDER } from "../data/legal";

const Owner = () => <LegalValue value={LEGAL_OWNER} placeholder={OWNER_PLACEHOLDER} />;
const Contact = () => <LegalValue value={LEGAL_CONTACT} placeholder={CONTACT_PLACEHOLDER} href={(v) => `mailto:${v}`} />;

/**
 * Informativa privacy (ROADMAP5, 20/11/2026). Descrive i dati che SAMS tratta davvero
 * (tabelle del runtime, localStorage, fornitori esterni). SAMS è soprattutto da installare
 * da sé: chi lo installa diventa titolare dei propri dati; questa pagina copre la demo
 * pubblicata da <Owner />. Testo da far rileggere a un esperto prima della 1.0.
 */
export function Privacy() {
  return (
    <LegalPage
      eyebrow="Legale"
      title="Informativa sulla privacy"
      intro={
        <p>
          Questa pagina spiega quali dati personali tratta SAMS, perché e quali diritti hai, secondo il Regolamento
          UE 2016/679 (GDPR). SAMS è un progetto da installare sul proprio server: <strong>chi lo installa e lo fa
          usare ad altri diventa titolare dei dati della propria installazione</strong> e risponde in prima persona.
          Questa informativa riguarda la versione pubblicata da <Owner />.
        </p>
      }
    >
      <LegalSection n={1} title="Titolare del trattamento">
        <p>
          Il titolare è <Owner />. Per qualsiasi domanda o richiesta sulla privacy scrivi a <Contact />.
        </p>
      </LegalSection>

      <LegalSection n={2} title="Quali dati trattiamo">
        <ul>
          <li>
            <strong>Account</strong>: email, nome, password (salvata solo come hash, mai in chiaro), ruolo nel
            workspace (owner, editor, viewer), data di creazione e verifica dell&apos;email.
          </li>
          <li>
            <strong>Sessioni di accesso</strong>: un token che scade dopo 30 giorni o quando esci.
          </li>
          <li>
            <strong>Link monouso</strong> per verificare l&apos;email, reimpostare la password e accettare un invito:
            ne conserviamo solo l&apos;impronta (hash), con scadenza. Per gli inviti anche l&apos;email invitata e chi
            ha invitato.
          </li>
          <li>
            <strong>Account GitHub collegato</strong>, se scegli di collegarlo: nome utente, repository scelto e il
            token di accesso, conservato cifrato.
          </li>
          <li>
            <strong>Contenuti che crei</strong>: agenti e loro istruzioni, task, risultati e cronologia, memoria degli
            agenti, routine, messaggi della chat del workspace (con il nome con cui compari) e, per il Commit
            Garden, lo stato del giardino legato al tuo nome utente GitHub.
          </li>
          <li>
            <strong>Dati tecnici</strong>: l&apos;indirizzo IP è usato in memoria per limitare gli abusi (troppe
            richieste o tentativi di accesso) e non viene salvato nel database.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={3} title="Perché e su quale base">
        <ul>
          <li>
            <strong>Fornirti il servizio</strong> (account, workspace, agenti, collegamento a GitHub): esecuzione del
            contratto, cioè dei <Link to="/termini" className="text-brand hover:underline">Termini</Link> che accetti
            usando SAMS.
          </li>
          <li>
            <strong>Sicurezza</strong> (limiti alle richieste, verifica dell&apos;email, scadenza delle sessioni):
            legittimo interesse a proteggere il servizio e i suoi utenti.
          </li>
          <li>
            <strong>Email di servizio</strong> (verifica, reimpostazione password, inviti): necessarie per
            l&apos;account. Non inviamo newsletter né pubblicità.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={4} title="Con chi condividiamo i dati">
        <p>Non vendiamo dati. Per funzionare SAMS si appoggia a questi fornitori, che li trattano per nostro conto:</p>
        <ul>
          <li>
            <strong>Fornitori di intelligenza artificiale</strong> (a seconda della configurazione: OpenRouter, Google
            Gemini, Groq, Anthropic): ricevono il testo dei task, le istruzioni degli agenti e i file del repository
            che l&apos;agente legge. <strong>Non scrivere nei task dati personali o segreti</strong> che non vuoi
            mandare a questi servizi.
          </li>
          <li>
            <strong>GitHub</strong>: i file letti e scritti dagli agenti, le pull request e le issue, con il tuo
            account collegato.
          </li>
          <li>
            <strong>Hosting e database</strong> (per esempio Render e TiDB Cloud): ospitano il server e i dati.
          </li>
          <li>
            <strong>Servizio di invio email</strong> (per esempio Resend o un server SMTP): recapita le email di
            servizio.
          </li>
          <li>
            <strong>Notion</strong> e altri servizi esterni collegati dagli agenti, solo se configurati.
          </li>
        </ul>
        <p>
          Alcuni di questi fornitori hanno sede negli Stati Uniti: il trasferimento avviene con le garanzie previste
          dal GDPR (decisione di adeguatezza UE-USA o clausole contrattuali standard).
        </p>
      </LegalSection>

      <LegalSection n={5} title="Per quanto tempo">
        <ul>
          <li>
            Account, collegamento a GitHub e inviti: finché l&apos;account esiste. Se lo elimini, li cancelliamo
            subito (vedi sotto).
          </li>
          <li>
            Agenti, task, cronologia e memoria degli agenti appartengono al workspace condiviso con il tuo team e
            restano al workspace anche se elimini il tuo account.
          </li>
          <li>Sessioni: 30 giorni al massimo. Link monouso: fino alla loro scadenza.</li>
          <li>
            Messaggi della chat del workspace: restano nella cronologia condivisa con il nome con cui sono stati
            scritti; puoi chiederne la cancellazione a <Contact />.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={6} title="Nel tuo browser">
        <p>
          SAMS non usa cookie di profilazione, analytics o tracker. Salva nel tuo browser (localStorage) solo ciò che
          serve a farlo funzionare: la sessione di accesso, le preferenze (tema, pannelli, suoni) e lo stato della
          stanza. Puoi cancellarlo in qualsiasi momento dalle impostazioni del browser.
        </p>
      </LegalSection>

      <LegalSection n={7} title="I tuoi diritti">
        <p>
          Puoi chiedere di accedere ai tuoi dati, correggerli, cancellarli, limitarne il trattamento, opporti e
          riceverli in un formato leggibile (portabilità). <strong>Puoi eliminare il tuo account da solo</strong> dal{" "}
          <Link to="/profilo" className="text-brand hover:underline">Profilo</Link>, con «Elimina account»: cancella
          account, sessioni, collegamento a GitHub e inviti in sospeso. Per tutto il resto scrivi a <Contact />.
        </p>
        <p>
          Se ritieni che il trattamento violi il GDPR puoi presentare reclamo al Garante per la protezione dei dati
          personali (garanteprivacy.it).
        </p>
      </LegalSection>

      <LegalSection n={8} title="Minori">
        <p>SAMS non è pensato per chi ha meno di 16 anni: se hai meno di 16 anni non creare un account.</p>
      </LegalSection>

      <LegalSection n={9} title="Modifiche">
        <p>
          Se questa informativa cambia, aggiorniamo la data in cima alla pagina; per i cambiamenti importanti lo
          segnaliamo anche nel <Link to="/changelog" className="text-brand hover:underline">changelog</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
