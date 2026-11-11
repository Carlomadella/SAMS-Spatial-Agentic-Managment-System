# Decisioni per la 1.0: Commit Garden e Privacy/Termini

Due punti "importanti" del collaudo del 2026-11-10 (`ROADMAP5.md`) che richiedono una scelta dell'owner.
Nessuno dei due è ancora implementato: questa PR serve solo a scegliere. Rispondi nei commenti con
la lettera scelta (per esempio "Garden: A · Privacy: A, email: la mia") e il lavoro parte da lì.

---

## 1. Commit Garden: dove salvare i giardini

**Oggi.** Il giardino di ogni agente/utente si salva su MySQL **solo** se è impostato `DB_HOST`
(`server/src/garden/store.ts`). Sul deploy di Render `DB_HOST` è vuoto, quindi si usa la memoria:
a ogni riavvio o deploy tutti i giardini tornano a zero.

| | Opzione | Cosa comporta | Costo / rischio |
|---|---|---|---|
| **A** | **SQLite, quello che c'è già** | Una tabella `gardens` nel `.sams-data.db` che già contiene account, chat e mondo, sullo stesso disco persistente di Render. Si toglie MySQL. | Nessuna configurazione nuova, nessun costo. Un solo database da salvare. Va bene finché SAMS gira su una sola istanza (oggi è così: il disco di Render lo impone). |
| **B** | **MySQL esterno** | Il codice resta com'è; si configura un MySQL gestito e si mettono `DB_HOST`, `DB_USER`, `DB_PASSWORD` su Render. | Render non offre MySQL: serve un fornitore esterno (a pagamento o con limiti), un secondo database da gestire e da salvare, e la latenza di rete. |
| **C** | **SQLite di default, MySQL se configurato** | Come A, ma se c'è `DB_HOST` si continua a usare MySQL. | Due percorsi da mantenere e da testare. Utile solo se qualcuno usa già MySQL per il giardino. |

**Consiglio: A.** Il resto dei dati è già su SQLite e sul disco persistente: il giardino è l'unica cosa
fuori posto. C ha senso solo se esiste già un'installazione con i giardini su MySQL.

---

## 2. Privacy e Termini

**Oggi.** Nel footer "Privacy" e "Termini" puntano a `/#site-footer`: le pagine non esistono. Con la
registrazione, le email e le chiamate ai provider AI servono due pagine vere. In più, `CONTACT_EMAIL`
(`src/site/data/site.ts`) è `contatti@sams.app`: il dominio `sams.app` è registrato e risolve, ma
**non so se è tuo**. Se non lo è, le email dei visitatori finiscono a qualcun altro.

### 2a. Indirizzo di contatto

| | Opzione | Nota |
|---|---|---|
| **A** | Un tuo indirizzo (o un dominio tuo) | Lo scrivi tu nei commenti; lo metto in `site.ts` e nelle due pagine. |
| **B** | Niente email: contatto via GitHub (issue/discussioni) | Nessun indirizzo da gestire; meno adatto a chi non usa GitHub. |
| **C** | `contatti@sams.app`, se il dominio è davvero tuo | Va confermato da te. |

### 2b. Contenuto delle pagine

| | Opzione | Cosa comporta |
|---|---|---|
| **A** | **Le scrivo io, sui dati reali di SAMS** | Due pagine in italiano che elencano cosa SAMS tratta davvero: email, nome, hash della password, sessioni, chat, cronologia dei task, IP nei log; i fornitori coinvolti (provider AI scelto, GitHub, Notion, Resend/SMTP, Render). Con dei segnaposto per il titolare del trattamento che compili tu. **Non è consulenza legale**: per un uso pubblico conviene farle rileggere. |
| **B** | Generatore esterno (iubenda e simili) | Testi più "a norma", ma spesso a pagamento e generici; li incolli tu nelle pagine che preparo. |
| **C** | Per la 1.0 niente registrazione pubblica | Solo inviti (D3-B c'è già): le pagine servono comunque, ma con meno dati da descrivere. Cambia il prodotto. |

**Consiglio: 2a A e 2b A.** Le pagine si scrivono velocemente a partire dal codice, e restano
aggiornabili quando cambia qualcosa.

---

_Preparato il 2026-11-11. Dopo la scelta, questa PR si chiude e il lavoro va in una PR normale._
