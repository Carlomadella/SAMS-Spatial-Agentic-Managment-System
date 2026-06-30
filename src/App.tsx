import { lazy, Suspense, useEffect, useState } from "react";
import { Hand, HelpCircle, Loader2, Megaphone, MicOff, Move3d, MousePointerClick, PanelBottom, Volume2, VolumeX, X } from "lucide-react";
import { TitleBar } from "./components/TitleBar";
import { ActivityBar } from "./components/ActivityBar";
import { LeftPanel } from "./components/LeftPanel";
import { RightPanel } from "./components/RightPanel";
import { BottomPanel } from "./components/BottomPanel";
import { StatusBar } from "./components/StatusBar";
import { CommandPalette } from "./components/CommandPalette";
import { SettingsModal } from "./components/SettingsModal";
import { GardenView } from "./components/GardenView";
import { RuntimeBanner } from "./components/RuntimeBanner";
import { Toaster } from "./components/Toaster";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { SimBridge } from "./components/SimBridge";
import { useStore } from "./store/useStore";
import { assignRemote, backendEnabled, connectBackend } from "./lib/backend";
import { metaRepo } from "./lib/metaAgent";
import { canStartQueued, composeRelayTitle, findRelayTarget, pickFreeAgent, shouldAutoStartQueue } from "./lib/orchestration";
import { BEDS, ZONE_BY_ID, isNightNow, randomWalkPoint } from "./data/world";
import * as audio from "./lib/audio";
import { narrationLine, narrator } from "./lib/narration";
import type { Vec2 } from "./types";

// The 3D scene (three.js + drei) is heavy — load it as its own chunk so the
// IDE shell paints immediately.
const OfficeScene = lazy(() => import("./scene/OfficeScene").then((m) => ({ default: m.OfficeScene })));

function SceneLoading() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#eef2f7] text-slate-500">
      <Loader2 size={22} className="animate-spin" />
      <span className="text-[12px]">Caricamento scena 3D…</span>
    </div>
  );
}

function StageHint() {
  const [open, setOpen] = useState(() => localStorage.getItem("sams.hint") !== "off");

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          localStorage.removeItem("sams.hint");
        }}
        title="Mostra suggerimenti"
        className="absolute bottom-3 left-3 flex h-7 w-7 items-center justify-center rounded-full border border-slate-300/60 bg-white/80 text-slate-600 shadow-sm backdrop-blur transition-colors hover:bg-white"
      >
        <HelpCircle size={15} />
      </button>
    );
  }

  return (
    <div className="absolute bottom-3 left-3 flex flex-col gap-1 rounded-lg border border-slate-300/60 bg-white/85 px-3 py-2 pr-8 text-[11px] text-slate-600 shadow-sm backdrop-blur">
      <button
        onClick={() => {
          setOpen(false);
          localStorage.setItem("sams.hint", "off");
        }}
        title="Nascondi"
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700"
      >
        <X size={12} />
      </button>
      <span className="flex items-center gap-1.5">
        <MousePointerClick size={13} /> Clicca un agente per selezionarlo e comandarlo
      </span>
      <span className="flex items-center gap-1.5">
        <Hand size={13} /> Clicca sul pavimento per farlo camminare
      </span>
      <span className="flex items-center gap-1.5">
        <Move3d size={13} /> Trascina per ruotare · scorri per lo zoom
      </span>
    </div>
  );
}

/**
 * Invisible component that watches the store and auto-starts the next queued
 * task whenever an agent transitions to idle with a non-empty queue.
 */
function QueueBridge() {
  useEffect(() => {
    return useStore.subscribe((state, prev) => {
      for (const agent of state.agents) {
        const prevAgent = prev.agents.find((a) => a.id === agent.id);
        if (shouldAutoStartQueue(agent, prevAgent)) {
          const next = agent.taskQueue[0];
          setTimeout(() => {
            const { agents } = useStore.getState();
            const fresh = agents.find((a) => a.id === agent.id);
            if (fresh && canStartQueued(fresh)) {
              useStore.getState().shiftQueue(fresh.id);
              useStore.getState().assignTask(fresh.id, next.title, next.branch);
              if (backendEnabled) {
                assignRemote(fresh.id, fresh.name, next.title, next.branch, fresh.role, fresh.instructions, metaRepo(fresh)).catch(
                  (err: Error) =>
                    useStore.getState().log({
                      agentId: fresh.id,
                      agentName: fresh.name,
                      color: fresh.color,
                      level: "ERROR",
                      message: `Coda: ${err.message}`,
                    }),
                );
              }
            }
          }, 800);
        }
      }
    });
  }, []);
  return null;
}

/**
 * Invisible component that watches pendingRelays and forwards each one
 * to the matching agent (by role or name), queuing if the agent is busy.
 */
function RelayBridge() {
  useEffect(() => {
    return useStore.subscribe((s) => {
      if (s.pendingRelays.length === 0) return;
      const relay = s.pendingRelays[0];
      useStore.getState().shiftRelay();
      setTimeout(() => {
        const { agents } = useStore.getState();
        const target = findRelayTarget(agents, relay.target);
        if (!target) return;
        // draw the 3D handoff arc from sender → target and play a whoosh
        useStore.getState().addHandoff(relay.fromId, target.id);
        audio.playWhoosh();
        const title = composeRelayTitle(relay);
        if (target.task) {
          useStore.getState().enqueueTask(target.id, { title, branch: relay.branch });
        } else {
          useStore.getState().assignTask(target.id, title, relay.branch);
          if (backendEnabled) {
            // target may have been removed during the 200ms delay — guard the lookup
            const fresh = useStore.getState().agents.find((a) => a.id === target.id);
            if (fresh) {
              assignRemote(fresh.id, fresh.name, title, relay.branch, fresh.role, fresh.instructions, metaRepo(fresh)).catch(() => {});
            }
          }
        }
        useStore.getState().log({
          agentId: target.id,
          agentName: target.name,
          color: target.color,
          level: "INFO",
          message: `← Handoff da ${relay.fromName}: ${relay.title}`,
        });
      }, 200);
    });
  }, []);
  return null;
}

/**
 * Incoming webhook → action. When the runtime forwards a "wake" (e.g. a CI
 * failure), assign the contextual task to a free agent (or the least-loaded
 * one), reusing the same local + backend assignment path as a manual task.
 */
function WakeBridge() {
  useEffect(() => {
    return useStore.subscribe((s) => {
      if (s.pendingWakes.length === 0) return;
      const wake = s.pendingWakes[0];
      useStore.getState().shiftWake();
      // Opt-in: when auto-assign is off, the suggestion already shows in the log
      // (the runtime broadcast a 🔔 WARN) — we just don't act on it.
      if (!useStore.getState().webhookAutoAssign) return;
      const { agents } = useStore.getState();
      const target = pickFreeAgent(agents);
      if (!target) return;
      const branch = wake.branch || `fix/ci-${Date.now().toString(36)}`;
      if (target.task) {
        useStore.getState().enqueueTask(target.id, { title: wake.title, branch });
      } else {
        useStore.getState().assignTask(target.id, wake.title, branch);
        if (backendEnabled) {
          const fresh = useStore.getState().agents.find((a) => a.id === target.id);
          if (fresh) {
            assignRemote(fresh.id, fresh.name, wake.title, branch, fresh.role, fresh.instructions, metaRepo(fresh)).catch(() => {});
          }
        }
      }
      useStore.getState().log({
        agentId: target.id,
        agentName: target.name,
        color: target.color,
        level: "WARN",
        message: `🔔 Svegliato da webhook (${wake.reason}) → ${target.name}`,
      });
    });
  }, []);
  return null;
}

/**
 * Synthesised ambience: a soft room tone (warmer at night), keyboard ticks
 * while agents type, a chime on completion and a buzz on errors. Audio is
 * suspended by the browser until the first user gesture, which we resume here.
 */
function AudioBridge() {
  useEffect(() => {
    const kick = () => audio.resume();
    window.addEventListener("pointerdown", kick);
    window.addEventListener("keydown", kick);

    audio.startAmbient();
    audio.setAmbientNight(isNightNow());
    const nightId = setInterval(() => audio.setAmbientNight(isNightNow()), 60000);

    // Event sounds — track the newest event id so trimming (slice(-300)) is safe.
    let lastId = useStore.getState().events.slice(-1)[0]?.id ?? null;
    const unsub = useStore.subscribe((state) => {
      const evs = state.events;
      const newest = evs[evs.length - 1];
      if (!newest || newest.id === lastId) return;
      let start = 0;
      for (let i = evs.length - 1; i >= 0; i--) {
        if (evs[i].id === lastId) { start = i + 1; break; }
      }
      for (let i = start; i < evs.length; i++) {
        if (evs[i].level === "SUCCESS") audio.playChime();
        else if (evs[i].level === "ERROR") audio.playError();
      }
      lastId = newest.id;
    });

    // Typing ambience while someone is working (daytime only).
    const typeId = setInterval(() => {
      if (isNightNow()) return;
      if (useStore.getState().agents.some((a) => a.status === "working") && Math.random() < 0.55) {
        audio.playKeystroke();
      }
    }, 240);

    return () => {
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
      clearInterval(nightId);
      clearInterval(typeId);
      unsub();
      audio.stopAmbient();
    };
  }, []);
  return null;
}

/** Floating speaker toggle to mute/unmute the synthesised ambience. */
function SoundToggle() {
  const [muted, setMuted] = useState(() => {
    const s = localStorage.getItem("sams.muted");
    return s == null ? audio.isMuted() : s !== "0";
  });
  useEffect(() => {
    // apply a restored "sound on" preference once (avoids eagerly creating the
    // AudioContext when sound stays muted, the default).
    if (!muted) audio.setMuted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const toggle = () => {
    const next = !muted;
    audio.setMuted(next);
    setMuted(next);
    try {
      localStorage.setItem("sams.muted", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      onClick={toggle}
      title={muted ? "Attiva i suoni" : "Disattiva i suoni"}
      className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-slate-300/60 bg-white/80 text-slate-600 shadow-sm backdrop-blur transition-colors hover:bg-white"
    >
      {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
    </button>
  );
}

/**
 * Voice narration: reads out *significant* workspace events (completions, PRs,
 * errors, reviews) via the Web Speech API. Off by default; the toggle below
 * flips `narrator`. Mirrors AudioBridge's newest-event tracking.
 */
function NarrationBridge() {
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    let lastId = useStore.getState().events.slice(-1)[0]?.id ?? null;
    const unsub = useStore.subscribe((state) => {
      if (!narrator.isEnabled()) return;
      const evs = state.events;
      const newest = evs[evs.length - 1];
      if (!newest || newest.id === lastId) return;
      let start = 0;
      for (let i = evs.length - 1; i >= 0; i--) {
        if (evs[i].id === lastId) { start = i + 1; break; }
      }
      for (let i = start; i < evs.length; i++) {
        const line = narrationLine(evs[i]);
        if (line) narrator.speak(line);
      }
      lastId = newest.id;
    });
    return () => {
      unsub();
      narrator.cancel();
    };
  }, []);
  return null;
}

/** Floating toggle to enable/disable spoken narration of events. */
function NarrationToggle() {
  const [on, setOn] = useState(() => {
    try { return localStorage.getItem("sams.narration") === "1"; } catch { return false; }
  });
  useEffect(() => {
    narrator.setEnabled(on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const toggle = () => {
    const next = !on;
    narrator.setEnabled(next);
    setOn(next);
    try { localStorage.setItem("sams.narration", next ? "1" : "0"); } catch { /* ignore */ }
  };
  return (
    <button
      onClick={toggle}
      title={on ? "Disattiva la narrazione vocale" : "Attiva la narrazione vocale"}
      className="absolute right-12 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-slate-300/60 bg-white/80 text-slate-600 shadow-sm backdrop-blur transition-colors hover:bg-white"
    >
      {on ? <Megaphone size={15} /> : <MicOff size={15} />}
    </button>
  );
}

/**
 * Hunger is a slow Sims-style need: every agent gets a little hungrier over time.
 * Assigning a task "feeds" them (see assignTask), so keeping agents busy keeps
 * them fed — a starving agent turns "hungry" (see moodFor).
 */
function HungerBridge() {
  useEffect(() => {
    const id = setInterval(() => useStore.getState().growHunger(1), 7000);
    return () => clearInterval(id);
  }, []);
  return null;
}

/** Agents that aren't actively working a task are "free" to live their life. */
function isFreeAgent(a: { status: string; target: Vec2 | null }): boolean {
  return a.status !== "working" && a.status !== "awaiting_approval" && !a.target;
}

/**
 * Gives every free agent a life: by day they wander to a random spot in the
 * house every so often; after 23:00 they head to a bed and sleep until morning
 * (or until you give them a task). Runs on a slow tick so movement feels organic.
 */
function LifeBridge() {
  useEffect(() => {
    const near = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.6;

    const tick = () => {
      const st = useStore.getState();
      const night = isNightNow();
      // Only "free" agents live a life: an agent on a real task keeps working,
      // day or night — it doesn't get dragged to bed.
      const free = st.agents.filter(isFreeAgent);
      for (const a of free) {
        if (night) {
          // settle into a stable per-agent bed and sleep there
          const idx = st.agents.findIndex((x) => x.id === a.id);
          const bed = BEDS[idx % BEDS.length];
          if (!near(a.position, bed)) st.moveAgent(a.id, bed);
        } else if (Math.random() < 0.5) {
          // daytime: roam — sometimes for a coffee or to the whiteboard (where
          // Agent3D plays the matching micro-animation).
          const r = Math.random();
          const dest =
            r < 0.22 ? ZONE_BY_ID.kitchen.position
            : r < 0.4 ? ZONE_BY_ID.whiteboard.position
            : randomWalkPoint();
          st.moveAgent(a.id, dest);
        }
      }
    };

    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, []);
  return null;
}

// Short collaborative exchanges shown as speech bubbles when two free agents meet.
const CHATTER: [string, string][] = [
  ["Come procede il tuo task?", "Sto sistemando un bug, mi dai una mano?"],
  ["Hai visto quell'errore nei test?", "Sì, proviamo a risolverlo insieme."],
  ["Mi serve un parere su questa funzione.", "Certo, guardiamola insieme."],
  ["Questo refactor mi sta dando filo da torcere.", "Ti aiuto, dividiamo il lavoro."],
  ["Secondo te qui conviene una PR?", "Sì, apriamola e la rivediamo a quattro occhi."],
  ["Pausa caffè in cucina?", "Volentieri, poi torniamo al codice."],
];

/**
 * Socialisation: now and then two nearby free agents turn to chat — a short
 * back-and-forth shown as speech bubbles (the agents "help each other"). Purely
 * visual; reuses the event log so the bubbles surface over each agent.
 */
function TalkBridge() {
  useEffect(() => {
    const tick = () => {
      if (isNightNow()) return; // everyone's asleep
      const st = useStore.getState();
      const free = st.agents.filter(isFreeAgent);
      if (free.length < 2 || Math.random() > 0.5) return;

      // pick the two closest free agents
      let best: [typeof free[number], typeof free[number]] | null = null;
      let bestD = Infinity;
      for (let i = 0; i < free.length; i++) {
        for (let j = i + 1; j < free.length; j++) {
          const d = Math.hypot(
            free[i].position[0] - free[j].position[0],
            free[i].position[1] - free[j].position[1],
          );
          if (d < bestD) { bestD = d; best = [free[i], free[j]]; }
        }
      }
      if (!best || bestD > 9) return;

      const [a, b] = best;
      const [lineA, lineB] = CHATTER[Math.floor(Math.random() * CHATTER.length)];
      const log = st.log;
      log({ agentId: a.id, agentName: a.name, color: a.color, level: "INFO", message: `💬 ${a.name} → ${b.name}: ${lineA}` });
      setTimeout(() => {
        const fresh = useStore.getState().agents.find((x) => x.id === b.id);
        if (fresh) log({ agentId: b.id, agentName: fresh.name, color: fresh.color, level: "INFO", message: `💬 ${fresh.name} → ${a.name}: ${lineB}` });
      }, 2600);
    };
    const id = setInterval(tick, 11000);
    return () => clearInterval(id);
  }, []);
  return null;
}

/**
 * Fires a browser Notification when an agent completes a task.
 * Requests permission lazily on the first completion event.
 */
function NotificationBridge() {
  useEffect(() => {
    return useStore.subscribe((state, prev) => {
      if (!("Notification" in window)) return;
      for (const agent of state.agents) {
        const prevAgent = prev.agents.find((a) => a.id === agent.id);
        if (!prevAgent) continue;
        // Treat both "working" and "review" as in-progress so tasks that pass
        // through review (working→review→done) still notify on completion.
        const wasActive = (prevAgent.status === "working" || prevAgent.status === "review") && prevAgent.task;
        const isDone = agent.status === "idle" || agent.status === "done";
        if (wasActive && isDone) {
          const taskTitle = prevAgent.task?.title ?? "Task completato";
          const fire = () =>
            new Notification(`✅ ${agent.name}`, {
              body: taskTitle,
              icon: "/favicon.ico",
              tag: agent.id,
              silent: true,
            });
          if (Notification.permission === "granted") {
            fire();
          } else if (Notification.permission !== "denied") {
            void Notification.requestPermission().then((p) => { if (p === "granted") fire(); });
          }
        }
      }
    });
  }, []);
  return null;
}

/**
 * On small screens (< 768 px) automatically collapse left and right panels
 * so the 3D scene is visible. Re-runs on resize.
 */
function ResponsiveBridge() {
  const setLeftOpen = useStore((s) => s.setLeftOpen);
  const setRightOpen = useStore((s) => s.setRightOpen);

  useEffect(() => {
    function apply() {
      if (window.innerWidth < 768) {
        setLeftOpen(false);
        setRightOpen(false);
      }
    }
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [setLeftOpen, setRightOpen]);
  return null;
}

/** Floating affordance to reopen the bottom panel (Event Log) once it's hidden. */
function ReopenPanelButton() {
  const bottomOpen = useStore((s) => s.bottomOpen);
  const setBottomTab = useStore((s) => s.setBottomTab);
  if (bottomOpen) return null;
  return (
    <button
      onClick={() => setBottomTab("eventlog")}
      title="Mostra il pannello Log eventi"
      className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-line bg-ink-800/90 px-3 py-1.5 text-[11px] font-medium text-slate-200 shadow-panel backdrop-blur transition-all hover:border-brand/50 hover:bg-ink-700 hover:text-white active:scale-[0.97]"
    >
      <PanelBottom size={14} className="text-brand-soft" />
      Log eventi
    </button>
  );
}

export default function App() {
  const leftOpen = useStore((s) => s.leftOpen);
  const rightOpen = useStore((s) => s.rightOpen);
  const bottomOpen = useStore((s) => s.bottomOpen);
  const theme = useStore((s) => s.theme);
  const setCommandOpen = useStore((s) => s.setCommandOpen);

  useEffect(() => {
    document.documentElement.classList.toggle("theme-light", theme === "light");
    try {
      localStorage.setItem("sams.theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const editing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement).isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(!useStore.getState().commandOpen);
        return;
      }

      // Tab / Shift+Tab: cycle through agents (skip when typing in a field)
      if (e.key === "Tab" && !editing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const { agents, selectedAgentId, selectAgent } = useStore.getState();
        if (!agents.length) return;
        const idx = agents.findIndex((a) => a.id === selectedAgentId);
        const next = e.shiftKey
          ? (idx - 1 + agents.length) % agents.length
          : (idx + 1) % agents.length;
        selectAgent(agents[next].id);
        return;
      }

      // Escape: deselect agent
      if (e.key === "Escape" && !editing) {
        useStore.getState().selectAgent(null);
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen]);

  // Connect to the optional managed-agents runtime (no-op if not configured).
  useEffect(() => connectBackend(), []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-ink-950 text-slate-200">
      <TitleBar />
      <RuntimeBanner />

      <div className="flex min-h-0 flex-1">
        <ActivityBar />
        {leftOpen && <LeftPanel />}

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <Suspense fallback={<SceneLoading />}>
              <OfficeScene />
            </Suspense>
            <StageHint />
            <SoundToggle />
            <NarrationToggle />
            <ReopenPanelButton />
          </div>
          {bottomOpen && <BottomPanel />}
        </main>

        {rightOpen && <RightPanel />}
      </div>

      <StatusBar />
      <CommandPalette />
      <SettingsModal />
      <GardenView />
      <Toaster />
      <OnboardingWizard />
      <QueueBridge />
      <RelayBridge />
      <WakeBridge />
      <LifeBridge />
      <TalkBridge />
      <HungerBridge />
      <AudioBridge />
      <NarrationBridge />
      <NotificationBridge />
      <ResponsiveBridge />
      <SimBridge />
    </div>
  );
}
