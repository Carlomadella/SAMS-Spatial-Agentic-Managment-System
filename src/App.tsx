import { lazy, Suspense, useEffect, useState } from "react";
import { Hand, HelpCircle, Loader2, Move3d, MousePointerClick, PanelBottom, X } from "lucide-react";
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
import { canStartQueued, composeRelayTitle, findRelayTarget, isIdleEligible, shouldAutoStartQueue } from "./lib/orchestration";
import { BEDS, isNightNow, randomWalkPoint } from "./data/world";
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
                assignRemote(fresh.id, fresh.name, next.title, next.branch, fresh.role, fresh.instructions).catch(
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
        const title = composeRelayTitle(relay);
        if (target.task) {
          useStore.getState().enqueueTask(target.id, { title, branch: relay.branch });
        } else {
          useStore.getState().assignTask(target.id, title, relay.branch);
          if (backendEnabled) {
            // target may have been removed during the 200ms delay — guard the lookup
            const fresh = useStore.getState().agents.find((a) => a.id === target.id);
            if (fresh) {
              assignRemote(fresh.id, fresh.name, title, relay.branch, fresh.role, fresh.instructions).catch(() => {});
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
 * Gives idle agents a life: by day they wander to a random spot in the house
 * every so often; after 23:00 they head to a bed and sleep until morning (or
 * until you give them a task). Runs on a slow tick so movement feels organic.
 */
function LifeBridge() {
  useEffect(() => {
    const near = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.6;

    const tick = () => {
      const st = useStore.getState();
      const night = isNightNow();
      const idle = st.agents.filter((a) => isIdleEligible(a) && !a.target);
      for (const a of idle) {
        if (night) {
          // settle into a bed (stable per-agent assignment) and stay there asleep
          const idx = st.agents.findIndex((x) => x.id === a.id);
          const bed = BEDS[idx % BEDS.length];
          if (!near(a.position, bed)) st.moveAgent(a.id, bed);
        } else if (Math.random() < 0.45) {
          // daytime: occasionally roam to another room
          st.moveAgent(a.id, randomWalkPoint());
        }
      }
    };

    tick();
    const id = setInterval(tick, 6000);
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
      <LifeBridge />
      <NotificationBridge />
      <ResponsiveBridge />
      <SimBridge />
    </div>
  );
}
