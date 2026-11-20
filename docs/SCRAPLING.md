# 🕷️ Agenti che leggono il web — Scrapling via MCP

[Scrapling](https://github.com/D4Vinci/Scrapling) è una libreria Python di web
scraping con un **server MCP** integrato. Collegandolo a SAMS, qualsiasi agente
può aprire una pagina web e riceverla come **Markdown pulito** attraverso lo
strumento `mcp_call`.

```
Agente SAMS ──mcp_call("scrapling", "make_request", { url })──▶ runtime SAMS
                                                                   │ POST JSON-RPC
                                                                   ▼
                                               scrapling mcp --http (Python, :8000)
                                                                   │ HTTP / browser stealth
                                                                   ▼
                                                               sito web
```

## 1 · Avvia il server MCP di Scrapling

Serve Python ≥ 3.10. Meglio in un virtualenv, fuori dal repo:

```bash
python3 -m venv ~/.scrapling && ~/.scrapling/bin/pip install "scrapling[ai]"
```

Solo se vuoi anche il tool con browser (`browser_fetch_once`, pagine che usano JavaScript):

```bash
~/.scrapling/bin/scrapling install
```

Avvio in HTTP con un token (senza token `--http` si rifiuta di partire):

```bash
SCRAPLING_MCP_AUTH_TOKEN=cambia-questo-token ~/.scrapling/bin/scrapling mcp --http --port 8000
```

Il server ascolta su `http://127.0.0.1:8000/mcp`.

## 2 · Collega SAMS

In `server/.env` (oppure nel campo MCP delle impostazioni ⚙):

```bash
SAMS_MCP_SERVERS='[{"name":"scrapling","url":"http://127.0.0.1:8000/mcp","token":"cambia-questo-token","tools":["make_request","browser_fetch_once"]}]'
```

L'allow-list `tools` è voluta: espone solo i due tool **di sola lettura e senza
stato**. Gli altri tool di Scrapling (`browser_open`, `browser_actions`,
`browser_evaluate`, salvataggio cookie…) danno all'agente un browser pilotabile:
aggiungili solo se ti servono davvero.

| Tool | Quando | Argomenti tipici |
| --- | --- | --- |
| `make_request` | Pagine statiche, veloce | `{ "url": "…", "extraction_type": "markdown", "main_content_only": true }` |
| `browser_fetch_once` | Pagine renderizzate in JS (SPA React…) | gli stessi, più `network_idle: true` |

## 3 · Prova

Assegna a un agente un task tipo:

> *Leggi https://quotes.toscrape.com/ con Scrapling e scrivi in `docs/citazioni.md` le prime 5 citazioni con autore.*

Nel log eventi compare `MCP scrapling/make_request`, poi l'agente scrive il file.

## Note

- **Handshake**: Scrapling usa il trasporto *Streamable HTTP*, che vuole
  `initialize` e poi l'header `Mcp-Session-Id` su ogni chiamata. `mcp_call` lo fa
  in automatico a ogni invocazione (vedi `server/src/mcp.ts`).
- **Limite di output**: il risultato passato all'agente è troncato a 6000
  caratteri. Usa `main_content_only: true` o un `css_selector` per stare dentro.
- **Uso responsabile**: rispetta i Termini di Servizio e il `robots.txt` dei siti.
  Le funzioni anti-bot di Scrapling (es. `solve_cloudflare`) non vanno usate per
  aggirare un divieto esplicito; in UE vale il GDPR sui dati personali raccolti.
- **Deploy**: se SAMS gira su un server pubblico, avvia Scrapling con
  `--allowed-host` e non esporlo su `0.0.0.0` senza token.
