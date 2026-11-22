# Visuale: movimento e telecamera che segue — design

Data: 2026-11-22 · Branch: `feat/visuale-zoom-movimento` · Voce di ROADMAP5 «Zoom e movimento della visuale».

## Perché

Nella casa 3D non ci si può spostare liberamente (`enablePan={false}`): per vedere una stanza o un'ala
lontana bisogna selezionare un agente. Con le ali la casa si allunga e il problema cresce. Inoltre
`CameraFollow` riporta il centro della visuale sull'agente selezionato a ogni fotogramma, quindi qualsiasi
movimento manuale verrebbe annullato. L'utente ha indicato come priorità **come ci si sposta** e
**il contrasto con la telecamera che segue l'agente**.

## Obiettivi

- Spostarsi liberamente in tutta la casa (ali comprese) e nel giardino, con mouse, touch e tastiera.
- Seguire un agente senza che la telecamera combatta con l'utente.

## Non obiettivi

- Cambiare i limiti di zoom/inclinazione o l'aspetto della scena 3D.
- Il giardino non ha agenti: lì niente «segui».

## Anti-obiettivi

- Perdersi nel vuoto fuori dalla casa.
- Scorciatoie che scattano mentre si scrive in un campo di testo.
- Rompere il trascinamento dei mobili in modalità riordino (`MoveHandle` disattiva già l'orbita al pointer-down).

## Approcci considerati

- **Spostamento:** A) destro per spostarsi, sinistro ruota (come oggi + pan); **B) sinistro sposta, destro ruota
  (stile mappe/The Sims)**; **C) tastiera e scorciatoie**. Scelti dall'utente: **B + C**.
- **Segui:** **1) il movimento manuale sgancia, F/pulsante riaggancia**; 2) centra solo alla selezione;
  3) pan bloccato mentre si segue. Scelto dall'utente: **1**, con B + C anche per il giardino.

## Design deciso

**Mouse e touch (B)**, casa e giardino:
- sinistro trascinato = sposta sul pavimento; destro trascinato = ruota; rotella = zoom verso il cursore (come oggi);
- touch: un dito sposta, due dita zoom + rotazione;
- il centro della visuale resta dentro i confini (`house().bounds`, che crescono con le ali; area del giardino);
- limiti di distanza e inclinazione invariati.

**Tastiera (C)**, attiva solo se il focus non è in INPUT/TEXTAREA/SELECT/contentEditable:
- WASD o frecce = sposta (relativo alla direzione della telecamera); Q/E = ruota; +/− = zoom;
- 1–9 = vola alle stanze ordinate da sinistra a destra (oltre la nona: si trascina);
- H = vista di tutta la casa (centro e distanza iniziali).
- Non toccano le scorciatoie esistenti (Ctrl+K, Tab, Esc).

**Segui (1)**, solo nella casa:
- selezione di un agente → la telecamera lo raggiunge e lo segue mentre cammina (come oggi);
- qualsiasi movimento manuale (mouse, touch, tastiera) sgancia il «segui»; l'agente resta selezionato;
- F o un piccolo pulsante «Segui» nell'angolo della scena riaggancia (pulsante visibile solo se c'è un agente
  selezionato e il segui è sganciato); Esc deselezione come oggi.

## Lasciato a chi costruisce (scelte di Claude)

- Logica di tastiera, confini e sgancio in un modulo condiviso usato da `OfficeScene.tsx` e `GardenScene.tsx`.
- Funzioni pure testate: clamp ai confini, ordine stanze → tasto, stato del segui.
- Pulsante «Segui» piccolo e sobrio nei colori rosso/nero/bianco.
- Velocità di spostamento da tastiera e durata del volo verso le stanze: da tarare a vista in Chrome.
