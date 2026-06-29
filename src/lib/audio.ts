// ---------------------------------------------------------------------------
// Tiny WebAudio sound engine — everything is synthesised on the fly, so there
// are zero binary assets to ship. A single shared AudioContext feeds a master
// gain (the mute switch). Browsers suspend audio until a user gesture, so call
// resume() from the first pointer/key event.
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = true;

type AmbientHandle = { osc: OscillatorNode[]; gain: GainNode; filter: BiquadFilterNode };
let ambient: AmbientHandle | null = null;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
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

/**
 * A barely-there room tone: two detuned low oscillators through a lowpass.
 * Idempotent. Use setAmbientNight() to shift its character day↔night.
 */
export function startAmbient(): void {
  const c = ensure();
  if (!c || !master || ambient) return;
  const gain = c.createGain();
  gain.gain.value = 0.025;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 480;
  const a = c.createOscillator();
  const b = c.createOscillator();
  a.type = "sine";
  b.type = "sine";
  a.frequency.value = 72;
  b.frequency.value = 90;
  a.connect(filter);
  b.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  a.start();
  b.start();
  ambient = { osc: [a, b], gain, filter };
}

export function stopAmbient(): void {
  if (!ambient) return;
  ambient.osc.forEach((o) => o.stop());
  ambient = null;
}

/** Night = lower, warmer and a touch quieter; day = brighter and a hair louder. */
export function setAmbientNight(night: boolean): void {
  const c = ctx;
  if (!ambient || !c) return;
  ambient.filter.frequency.setTargetAtTime(night ? 320 : 560, c.currentTime, 1.5);
  ambient.gain.gain.setTargetAtTime(night ? 0.018 : 0.028, c.currentTime, 1.5);
}
