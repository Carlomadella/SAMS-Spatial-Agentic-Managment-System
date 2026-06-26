# 🗺️ SAMS — Roadmap & Brainstorming

Idee per far crescere **SAMS** (Spatial Agentic Management System): stanza 3D
isometrica + agenti AI autonomi (Gemini Flash) con strumenti GitHub/Notion, il
**Commit Garden** in 3D e il runtime Express.

> **Come si mantiene questo file**
> A ogni sessione di brainstorming aggiungo nuove idee qui e aggiorno gli stati.
> In fondo c'è un **Log dei brainstorming** datato.
>
> **Legenda stato:** 💡 idea · 🔜 prossimo · 🏗️ in corso · ✅ fatto · ❄️ in pausa
> **Impatto/Effort:** 🟢 basso · 🟡 medio · 🔴 alto

---

## ⭐ Shortlist consigliata (alto impatto, fattibile col setup gratuito)

| # | Idea | Stato | Impatto | Effort |
|---|------|-------|---------|--------|
| 1 | Anteprima + **approvazione del diff** prima del push | 💡 | 🔴 | 🟡 |
| 2 | **Libreria di istruzioni pronte** (task in 1 click) | 💡 | 🔴 | 🟢 |
| 3 | **Agenti più vivi**: cammino mirato + fumetto col passo corrente | 💡 | 🟡 | 🟡 |
| 4 | **Auto-verifica**: l'agente lancia test/lint e si autocorregge | 💡 | 🔴 | 🟡 |
| 5 | **Persistenza** di agenti/task/eventi al refresh | 💡 | 🟡 | 🟢 |

---

## 🧠 Intelligenza & autonomia degli agenti
- [ ] 💡 **Piano visibile prima di agire** — l'agente elenca i passi e tu approvi.
- [ ] 💡 **Auto-verifica qualità** — dopo aver scritto codice lancia test/lint del repo e ritenta in loop se falliscono.
- [ ] 💡 **Memoria di progetto** — file `CONVENTIONS.md` per repo letto sempre (stile, cartelle, regole).
- [ ] 💡 **Ruoli specializzati** — prompt dedicati per frontend / backend / docs / reviewer / tester.
- [ ] 💡 **Coda di task per agente** — gli agenti pescano i task in coda autonomamente.
- [ ] 💡 **Collaborazione tra agenti** — handoff (red scrive → blue revisiona → green scrive i test).

## 🔌 Più strumenti per gli agenti
- [ ] 💡 **Web search / fetch** — ricerca prima di scrivere.
- [ ] 💡 **GitHub esteso** — creare issue, commentare PR, leggere log CI.
- [ ] 💡 **Notion completo** — leggere/aggiornare blocchi, creare pagine e database (ora solo append).
- [ ] 💡 **Notifiche a fine task** — Slack / Discord / email (in-app i toast ci sono già).
- [ ] 💡 **Sfruttare gli MCP disponibili** — report su Google Drive, eventi su Calendar, grafiche su Canva.

## 🎮 Mondo 3D (feel "The Sims")
- [ ] 💡 **Cammino mirato** — l'agente va alla zona giusta per il tipo di task.
- [ ] 💡 **Animazioni di lavoro** — digita alla scrivania, disegna sul muro.
- [ ] 💡 **Fumetti di stato** — mostrano il passo corrente, collegati agli eventi SSE.
- [ ] 💡 **Mobili vivi** — il monitor mostra il diff reale, la media wall i task reali.
- [ ] 💡 **Ciclo giorno/notte** + suoni ambientali.
- [ ] 💡 **Mood/energia** degli agenti (pausa caffè quando idle).
- [ ] 💡 **Camera cinematografica** che segue l'agente selezionato.
- [ ] 💡 **Pathfinding** attorno ai mobili (ora è in linea retta).

## 🖱️ UX / UI
- [ ] 💡 **Anteprima & approvazione del diff** nel pannello destro prima del push.
- [ ] 💡 **Libreria di istruzioni pronte** — template ("Documenta file", "Aggiungi test", "Fixa issue").
- [ ] 💡 **Onboarding guidato** al primo avvio (repo + key + spawn agenti).
- [ ] 💡 **Meter di utilizzo/token** per task (trasparenza costi).
- [ ] 💡 **Output in streaming** nell'event log.
- [ ] 💡 **Layout responsive/mobile** e accessibilità (keyboard nav, label sul 3D).

## 🌿 Commit Garden
- [ ] 💡 **Specie/biomi diversi** per linguaggio o repo.
- [ ] 💡 **Stagioni/meteo** legati alla frequenza di commit.
- [ ] 💡 **Achievement/badge** (primo PR, streak 7 giorni) e **decorazioni sbloccabili**.
- [ ] 💡 **Immagine OG condivisibile** per i social.
- [ ] 💡 **Giardini di team** (tutta l'organizzazione).
- [ ] ❄️ **Auto-innaffiatura via webhook** — opzionale (per ora refresh manuale, scelta voluta).

## 🛠️ Solidità (engineering)
- [ ] 💡 **Persistenza** — agenti/task/eventi sopravvivono al refresh (localStorage o DB).
- [ ] 💡 **CI su PR** — lint + typecheck + test + build.
- [ ] 💡 **Test frontend / e2e** (Playwright) — finora solo unit test del runtime.
- [ ] 💡 **Dockerizzare il runtime** + deploy in un comando.
- [ ] 💡 **Gestione rate-limit/retry** centralizzata (oltre al backoff Gemini esistente).
- [ ] 💡 **Più provider gratuiti** — Groq, OpenRouter, Ollama locale; **modello per-agente**.

## ✅ Già fatto (storico)
- [x] ✅ Stanza 3D isometrica in stile salotto (mobili, pavimento in parquet, boiserie, applique, orologio).
- [x] ✅ Personaggi agenti come robottini chibi espressivi (occhi che sbattono, ciclo di camminata, spia di stato).
- [x] ✅ Agenti autonomi via Gemini Flash (function-calling: GitHub read/write/branch, Notion write).
- [x] ✅ **Commit Garden** trasformato in scena 3D vera (prato, cielo, recinto, la tua pianta che cresce per stadi).
- [x] ✅ Integrazione runtime (SSE, settings, provisioning) + Vite proxy (no CORS).
- [x] ✅ ErrorBoundary + code-splitting delle scene 3D.

---

## 🗒️ Log dei brainstorming

### 2026-06-26
Primo brainstorming completo organizzato per aree (vedi sezioni sopra).
Shortlist consigliata: anteprima/approvazione diff, libreria istruzioni pronte,
agenti più vivi, auto-verifica, persistenza. Scelta: accumulare le idee in questo
file (nessuna implementazione in questo giro).
