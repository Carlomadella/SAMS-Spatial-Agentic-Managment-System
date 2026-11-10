import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Un AudioContext finto: conta quante volte viene creato.
let created = 0;
class FakeParam {
  value = 0;
  setValueAtTime() {}
  setTargetAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
}
class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  Q = new FakeParam();
  type = "";
  buffer: unknown = null;
  loop = false;
  connect() {}
  disconnect() {}
  start() {}
  stop() {}
}
class FakeAudioContext {
  state = "suspended";
  currentTime = 0;
  sampleRate = 8000;
  destination = new FakeNode();
  constructor() {
    created++;
  }
  createGain() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createOscillator() { return new FakeNode(); }
  createBufferSource() { return new FakeNode(); }
  createBuffer(_ch: number, len: number) { return { getChannelData: () => new Float32Array(len) }; }
  resume() { this.state = "running"; return Promise.resolve(); }
  close() { return Promise.resolve(); }
}

describe("audio: niente AudioContext prima di un gesto dell'utente", () => {
  beforeEach(() => {
    created = 0;
    vi.resetModules();
    vi.stubGlobal("AudioContext", FakeAudioContext);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("startAmbient, setMuted e i suoni non creano il contesto finché non c'è unlock()", async () => {
    const audio = await import("./audio");
    audio.startAmbient();
    audio.setMuted(false); // anche col suono attivo da una sessione precedente
    audio.playChime();
    audio.resume();
    expect(created).toBe(0);
    audio.stopAmbient();
  });

  it("unlock() (dal primo gesto) crea il contesto e fa partire il sottofondo chiesto prima", async () => {
    const audio = await import("./audio");
    audio.startAmbient();
    audio.unlock();
    expect(created).toBe(1);
    audio.unlock(); // un secondo gesto non ne crea un altro
    expect(created).toBe(1);
    audio.stopAmbient();
  });
});
