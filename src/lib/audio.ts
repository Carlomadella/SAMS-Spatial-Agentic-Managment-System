// ---------------------------------------------------------------------------
// Tiny WebAudio sound engine — everything is synthesised on the fly, so there
// are zero binary assets to ship (the lo-fi background included). A single shared AudioContext feeds a master
// gain (the mute switch). Browsers block audio until a user gesture, so the
// AudioContext is not even created before unlock() — called from the first
// pointer/key event. (Creating it earlier made Firefox log "È stato impedito a un
// AudioContext di avviarsi automaticamente" at every page load.)
// ---------------------------------------------------------------------------

import { BASS_NOTE_S, chordForBar, chordHitAt, drumsAt, midiToHz, stepAdvance, STEPS_PER_BAR } from "./lofi";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = true;
/** True dopo il primo gesto dell'utente: prima non si crea nessun AudioContext. */
let unlocked = false;
/** Il sottofondo è stato chiesto (startAmbient) e partirà allo sblocco. */
let wantAmbient = false;

/** Il sottofondo lo-fi in corso: bus col suo filtro, fruscio del vinile e sequencer. */
type LofiHandle = {
  bus: GainNode;
  filter: BiquadFilterNode;
  crackle: AudioBufferSourceNode;
  timer: ReturnType<typeof setInterval>;
};
let ambient: LofiHandle | null = null;
let night = false;

function ensure(): AudioContext | null {
  if (typeof window === "undefined" || !unlocked) return null;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
  }
  return ctx;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  const c = ensure();
  if (c && master) master.gain.setTargetAtTime(m ? 0 : 1, c.currentTime, 0.05);
  if (!m) resume();
}

export function resume(): void {
  const c = ensure();
  if (c && c.state === "suspended") void c.resume();
}

/**
 * Da chiamare **solo dentro un gesto dell'utente** (pointerdown/keydown): da qui in poi
 * l'audio può esistere. Crea il contesto, lo riprende e avvia il sottofondo se era stato chiesto.
 */
export function unlock(): void {
  unlocked = true;
  resume();
  if (wantAmbient && !ambient) startAmbient();
}

/** One short enveloped tone. No-op when muted or audio is unavailable. */
function blip(freq: number, dur: number, type: OscillatorType = "sine", peak = 0.2, when = 0): void {
  if (muted) return;
  const c = ensure();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t0 = c.currentTime + when;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

/** A soft keyboard tick — played while agents are "typing". */
export function playKeystroke(): void {
  blip(380 + Math.random() * 220, 0.045, "square", 0.04);
}

/** A friendly two-note chime — a task completed. */
export function playChime(): void {
  blip(660, 0.18, "sine", 0.16);
  blip(988, 0.32, "sine", 0.12, 0.11);
}

/** A low buzz — something went wrong (blocked / error). */
export function playError(): void {
  blip(160, 0.28, "sawtooth", 0.1);
}

/** A quick rising sweep — used when a task is handed off between agents. */
export function playWhoosh(): void {
  if (muted) return;
  const c = ensure();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  const t0 = c.currentTime;
  o.frequency.setValueAtTime(300, t0);
  o.frequency.exponentialRampToValueAtTime(900, t0 + 0.25);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(0.1, t0 + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + 0.33);
}

// ---------------------------------------------------------------------------
// Sottofondo lo-fi. La partitura sta in `lofi.ts` (pura); qui la si suona con un
// sequencer a lookahead: un timer ogni 25 ms programma sul clock audio le note dei
// prossimi ~150 ms. È lo schema classico di WebAudio — il timer JS può ritardare, il
// clock audio no, quindi il ritmo resta preciso anche se il thread principale è occupato
// (e qui lo è: c'è una scena 3D che gira).
// ---------------------------------------------------------------------------

const LOOKAHEAD_S = 0.15;
const TICK_MS = 25;
/** Volume del sottofondo: presente ma sotto ai suoni d'evento (chime 0.16). */
const LOFI_DAY_GAIN = 0.55;
const LOFI_NIGHT_GAIN = 0.4;

let noiseBuf: AudioBuffer | null = null;

/** Un secondo di rumore bianco, condiviso da rullante e charleston. */
function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/**
 * Il "vinile": solo qualche click sparso, **nessun fruscio continuo** — un rumore di fondo
 * costante è proprio il ronzio che questo sottofondo sostituisce.
 */
function crackleBuffer(c: AudioContext): AudioBuffer {
  const len = c.sampleRate * 3;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    if (Math.random() < 0.00012) {
      // un click: pochi campioni che decadono subito
      const amp = (Math.random() < 0.5 ? -1 : 1) * (0.15 + Math.random() * 0.2);
      for (let k = 0; k < 24 && i + k < len; k++) d[i + k] += amp * Math.exp(-k / 4);
    }
  }
  return buf;
}

/** Una nota di piano elettrico "smussato": triangolo + sinusoide un filo stonati. */
function keyNote(c: AudioContext, out: AudioNode, freq: number, t: number, dur: number, peak: number): void {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(out);
  for (const [type, detune] of [["triangle", -6], ["sine", 5]] as const) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune + (Math.random() * 6 - 3); // l'imprecisione è il genere
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

function kick(c: AudioContext, out: AudioNode, t: number): void {
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.32, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + 0.32);
}

function noiseHit(c: AudioContext, out: AudioNode, t: number, type: BiquadFilterType, freq: number, peak: number, dur: number): void {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

/** Programma tutto ciò che suona sul sedicesimo `step` all'istante `t`. */
function playStep(c: AudioContext, out: AudioNode, step: number, t: number): void {
  const bar = Math.floor(step / STEPS_PER_BAR);
  const s = step % STEPS_PER_BAR;
  const { notes, bass } = chordForBar(bar);
  const barLen = stepAdvance(0) * 8 + stepAdvance(1) * 8;

  const hit = chordHitAt(s);
  if (hit) {
    const peak = hit === "strike" ? 0.05 : 0.025;
    // accordo leggermente "strummato": le note non partono tutte insieme. Sfuma entro ~2 s
    // (0.6 battute): tra un accordo e l'altro resta silenzio, niente tappeto continuo.
    notes.forEach((n, i) => keyNote(c, out, midiToHz(n), t + i * 0.018, barLen * (hit === "strike" ? 0.6 : 0.3), peak));
    if (hit === "strike") keyNote(c, out, midiToHz(bass), t, BASS_NOTE_S, 0.07);
  }
  // un paio di note di melodia dall'accordo, un'ottava sopra, non sempre: così il loop respira
  if ((s === 6 || s === 14) && Math.random() < 0.45) {
    keyNote(c, out, midiToHz(notes[Math.floor(Math.random() * notes.length)] + 12), t, 0.6, 0.03);
  }
  if (night) return; // di notte niente batteria: la stanza dorme
  for (const d of drumsAt(s)) {
    if (d === "kick") kick(c, out, t);
    else if (d === "snare") noiseHit(c, out, t, "bandpass", 1800, 0.12, 0.16);
    else noiseHit(c, out, t, "highpass", 7000, s % 4 === 0 ? 0.035 : 0.02, 0.04);
  }
}

/**
 * Avvia il sottofondo lo-fi. Idempotente. Con l'audio muto il sequencer avanza senza
 * creare nodi (niente lavoro inutile), così allo smute riprende a tempo.
 */
export function startAmbient(): void {
  wantAmbient = true;
  const c = ensure();
  if (!c || !master || ambient) return;
  const bus = c.createGain();
  bus.gain.value = night ? LOFI_NIGHT_GAIN : LOFI_DAY_GAIN;
  const filter = c.createBiquadFilter(); // il "calore" del lo-fi: si tagliano gli acuti
  filter.type = "lowpass";
  filter.frequency.value = night ? 1100 : 2400;
  filter.Q.value = 0.4;
  filter.connect(bus);
  bus.connect(master);

  const crackle = c.createBufferSource();
  crackle.buffer = crackleBuffer(c);
  crackle.loop = true;
  crackle.connect(filter);
  crackle.start();

  let step = 0;
  let nextAt = c.currentTime + 0.1;
  const timer = setInterval(() => {
    while (nextAt < c.currentTime + LOOKAHEAD_S) {
      if (!muted && c.state === "running") playStep(c, filter, step, nextAt);
      nextAt += stepAdvance(step);
      step = (step + 1) % (STEPS_PER_BAR * 4);
    }
  }, TICK_MS);

  ambient = { bus, filter, crackle, timer };
}

export function stopAmbient(): void {
  wantAmbient = false;
  if (!ambient) return;
  clearInterval(ambient.timer);
  try {
    ambient.crackle.stop();
  } catch {
    /* già fermo */
  }
  ambient.bus.disconnect();
  ambient = null;
}

/** Notte = più scuro (filtro più basso), più piano e senza batteria; giorno = il loop intero. */
export function setAmbientNight(isNight: boolean): void {
  night = isNight;
  const c = ctx;
  if (!ambient || !c) return;
  ambient.filter.frequency.setTargetAtTime(isNight ? 1100 : 2400, c.currentTime, 1.5);
  ambient.bus.gain.setTargetAtTime(isNight ? LOFI_NIGHT_GAIN : LOFI_DAY_GAIN, c.currentTime, 1.5);
}

// In sviluppo, l'aggiornamento a caldo di Vite sostituisce questo modulo senza fermare ciò
// che il modulo vecchio stava suonando: senza questa pulizia il sottofondo precedente
// resterebbe acceso (sotto al nuovo) fino al ricaricamento della pagina.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopAmbient();
    void ctx?.close();
    ctx = null;
    master = null;
  });
}
