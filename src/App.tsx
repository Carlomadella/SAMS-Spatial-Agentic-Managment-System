import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Hand, HelpCircle, Loader2, Megaphone, MicOff, Move3d, MousePointerClick, PanelBottom, Volume2, VolumeX, X } from "lucide-react";
import { TitleBar } from "./components/TitleBar";
import { ActivityBar } from "./components/ActivityBar";
import { LeftPanel } from "./components/LeftPanel";
import { RightPanel } from "./components/RightPanel";
import { BottomPanel } from "./components/BottomPanel";
import { PresenceRoster } from "./components/PresenceRoster";
import { MobileBar, MobileDrawer, useIsMobile } from "./components/MobileBar";
import { StatusBar } from "./components/StatusBar";
import { CommandPalette } from "./components/CommandPalette";
import { SettingsModal } from "./components/SettingsModal";
import { FileViewer } from "./components/FileViewer";
import { GardenView } from "./components/GardenView";
import { PublicDashboard } from "./components/PublicDashboard";
import { RuntimeBanner } from "./components/RuntimeBanner";
import { Toaster } from "./components/Toaster";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { Tour } from "./components/Tour";
import { SimBridge } from "./components/SimBridge";
import { useStore } from "./store/useStore";
import { assignRemote, backendEnabled, claimDriver, connectBackend, fetchWorld, getViewerId, pushWorld, sendSelection, sendWorldSim } from "./lib/backend";
import { iAmSimulator, liveAgentPositions } from "./lib/worldsim";
import { isShared } from "./lib/presence";
import { metaRepo, resolveTaskRepo, META_IDEAS, buildMetaTask, pickMetaIdea, shouldProposeMeta } from "./lib/metaAgent";
import { canStartQueued, composeRelayTitle, findRelayTarget, pickFreeAgent, shouldAutoStartQueue } from "./lib/orchestration";
import { affinityBetween } from "./lib/relationships";
import { chainTitle, matchingChains } from "./lib/chains";
import { currentStage, expandStageTitle, runMatching, runRetrospective } from "./lib/collaboration";
import { notificationBody, notificationTitle, shouldNotify } from "./lib/notify";
import { activeGoal } from "./lib/goals";
import { coinsForCompletion } from "./lib/economy";
import { isMobileWidth } from "./lib/layout";
import { canAssign } from "./lib/roleUi";
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
                assignRemote(fresh.id, fresh.name, next.title, next.branch, fresh.role, fresh.instructions, resolveTaskRepo(fresh, next.repo)).catch(
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
        // repeated collaboration builds affinity between the two agents
        useStore.getState().bumpAffinity(relay.fromId, target.id, 2);
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
      // A scheduled-routine wake is always assigned — enabling the routine IS the
      // opt-in. A webhook wake is opt-in: when auto-assign is off, the suggestion
      // already shows in the log (the runtime broadcast a 🔔 WARN) — don't act.
      if (wake.source !== "routine" && !useStore.getState().webhookAutoAssign) return;
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
        message: `🔔 Svegliato (${wake.reason}) → ${target.name}`,
      });
    });
  }, []);
  return null;
}

/**
 * Progression on task completion (transition into "done"): award economy coins
 * (more for a task that produced a concrete result/PR) and advance the agent's
 * active project, celebrating when the milestone is reached. Single-fire per
 * completion — "done" is transient and clears back to idle.
 */
function ProgressionBridge() {
  useEffect(() => {
    return useStore.subscribe((state, prev) => {
      for (const agent of state.agents) {
        const prevAgent = prev.agents.find((a) => a.id === agent.id);
        if (!prevAgent) continue;
        if (prevAgent.status === "done" || agent.status !== "done") continue;

        // Token economy: a completed task pays coins; producing a result (a PR /
        // Notion link on the latest task record) pays a bonus.
        const latest = [...useStore.getState().tasks].reverse().find((t) => t.agentId === agent.id);
        useStore.getState().earnCoins(agent.id, coinsForCompletion({ hasResult: !!latest?.url }));

        const before = activeGoal(useStore.getState().goals, agent.id);
        if (!before) continue;
        useStore.getState().advanceAgentGoal(agent.id);
        const after = useStore.getState().goals.find((g) => g.id === before.id);
        if (after?.done) {
          useStore.getState().log({
            agentId: agent.id,
            agentName: agent.name,
            color: agent.color,
            level: "SUCCESS",
            message: `🎯 Obiettivo raggiunto: ${after.title} (${after.milestone} task)`,
          });
          useStore.getState().pushToast("SUCCESS", `🎯 ${agent.name} ha raggiunto un obiettivo!`);
        }
      }
    });
  }, []);
  return null;
}

/**
 * Authoritative world state (Roadmap 4, first slice): push a compact snapshot of
 * the agents to the runtime so the world is durable server-side and readable by
 * other views. Throttled: pushes shortly after a change settles and at most once
 * per interval, only while the backend is online. No reconcile-back yet.
 */
const WORLD_SYNC_MS = 20_000;
function WorldSyncBridge() {
  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
    let last = 0;
    // La base del CAS vive ora nello store (`serverWorldVersion`, monotòna): così
    // resta allineata anche quando un altro scrittore ci propaga uno snapshot via
    // SSE (adottato in applyRemote), evitando 409 inutili al giro dopo.

    const snapshot = () =>
      useStore.getState().agents.map((a) => ({
        id: a.id,
        name: a.name,
        color: a.color,
        role: a.role,
        status: a.status,
        task: a.task?.title ?? null,
        progress: a.task?.progress ?? 0,
        // Config/identità autorevole a bassa frequenza (opzione B2).
        model: a.model,
        instructions: a.instructions,
        repo: a.repo ?? "",
        xp: a.xp,
      }));

    const flush = () => {
      pending = null;
      last = Date.now();
      const st = useStore.getState();
      if (!st.backendOnline) return;
      // I viewer non scrivono lo stato del mondo (il server risponderebbe 403): adottano
      // e basta, via SSE/`fetchWorld`. In dev-open il ruolo è owner → si spinge come prima.
      if (!canAssign(st.viewerRole)) return;
      void pushWorld(snapshot(), st.serverWorldVersion).then((res) => {
        if (res.offline) return;
        // Ci si allinea sempre alla versione più recente (200: nuova; 409: corrente).
        useStore.getState().noteWorldVersion(res.version);
        // Conflitto: un altro scrittore ci ha preceduto. Adottiamo davvero il suo
        // stato (il server è la verità), poi ripresentiamo presto: lo stato adottato
        // ridiventa autorevole al prossimo giro, senza flip-flop (riconciliazione).
        if (res.conflict) {
          if (res.remoteAgents?.length) useStore.getState().adoptWorld(res.remoteAgents);
          schedule(true);
        }
      });
    };

    const schedule = (soon = false) => {
      if (pending) return;
      const wait = soon ? 1200 : Math.max(1500, WORLD_SYNC_MS - (Date.now() - last));
      pending = setTimeout(flush, wait);
    };

    const unsub = useStore.subscribe((state, prev) => {
      if (!state.backendOnline) return;
      if (state.agents !== prev.agents || !prev.backendOnline) schedule();
    });
    // All'avvio, semina la versione autorevole corrente (base CAS) e, se il server
    // ha già uno stato durevole, adottalo così una vista appena connessa (o dopo un
    // refresh) riflette la verità del server, non solo il proprio localStorage.
    void fetchWorld().then((w) => {
      if (!w) return;
      useStore.getState().noteWorldVersion(w.version);
      if (w.version > 0 && w.agents.length) useStore.getState().adoptWorld(w.agents);
    });
    if (useStore.getState().backendOnline) schedule();

    return () => {
      unsub();
      if (pending) clearTimeout(pending);
    };
  }, []);
  return null;
}

/**
 * Presenza di selezione (Roadmap 4, frontiera #2): annuncia quale agente questa
 * vista ha selezionato, così le altre lo mostrano con un'aura. Invia subito al
 * cambio di selezione e su un heartbeat lento (per restare "fresca" contro la
 * staleness lato server); nello stesso tick ripulisce le selezioni remote scadute
 * (es. una vista che si è disconnessa). Gemella del canale dei cursori.
 */
function SelectionBridge() {
  useEffect(() => {
    let prevSel = useStore.getState().selectedAgentId;
    sendSelection(prevSel);
    const unsub = useStore.subscribe((state) => {
      if (state.selectedAgentId !== prevSel) {
        prevSel = state.selectedAgentId;
        sendSelection(prevSel);
      }
    });
    const beat = setInterval(() => {
      useStore.getState().pruneSelections();
      if (useStore.getState().backendOnline) sendSelection(useStore.getState().selectedAgentId);
    }, 2500);
    return () => {
      unsub();
      clearInterval(beat);
    };
  }, []);
  return null;
}

/**
 * Driver lease (opzione B3): questa vista rinnova periodicamente la richiesta di
 * essere il simulatore autorevole. Il titolare vince sempre il rinnovo; se sparisce,
 * un'altra vista subentra alla scadenza (o subito, via rilascio server-side sul
 * disconnect). Primo mattone del "mondo animato condiviso" — non sposta ancora il
 * game loop, elegge solo il driver.
 */
function DriverBridge() {
  useEffect(() => {
    void claimDriver();
    const beat = setInterval(() => void claimDriver(), 2000);
    return () => clearInterval(beat);
  }, []);
  return null;
}

/**
 * Movimento condiviso (opzione B3): il secondo mattone del "mondo animato condiviso",
 * dove sta il valore visibile. Se questa vista tiene il driver lease spinge, ad alta
 * frequenza, le posizioni live degli agenti (dal ref della mesh, non dallo store che
 * committa solo all'arrivo) alle altre viste, che le adottano read-only e interpolano
 * (vedi `Agent3D`). Se un'ALTRA vista guida, questa è follower: non manda nulla e, sul
 * battito, ripulisce lo stato cinematico scaduto. Attivo solo a mondo condiviso (≥2
 * viste); da soli non c'è nessuno che ascolta e la simulazione resta identica a prima.
 */
const WORLD_SIM_MS = 280; // ~3.5 update/s: fluido interpolando, payload minuscolo
function WorldSimBridge() {
  useEffect(() => {
    const self = getViewerId();
    useStore.getState().setSelfViewerId(self); // così lo store sa se è driver o follower
    const beat = setInterval(() => {
      const st = useStore.getState();
      if (!st.backendOnline) return;
      st.pruneSim();
      if (!isShared(st.observers)) return; // nessuno che segue → non spingere
      if (!iAmSimulator(st.worldDriver, self)) return; // solo il driver spinge
      sendWorldSim(
        st.agents.map((a) => {
          const live = liveAgentPositions.get(a.id);
          return {
            id: a.id,
            x: live ? live[0] : a.position[0],
            z: live ? live[1] : a.position[1],
            tx: a.target ? a.target[0] : null,
            tz: a.target ? a.target[1] : null,
            // bisogni: i follower li adottano così barra/piattino/umore combaciano col driver
            energy: a.energy,
            hunger: a.hunger,
          };
        }),
      );
    }, WORLD_SIM_MS);
    return () => clearInterval(beat);
  }, []);
  return null;
}

/**
 * Smooth handover del lease (opzione B3, 3° mattone): quando QUESTA vista passa da
 * follower a simulatore (il driver è sparito o è passato a noi), semina la posizione
 * degli agenti nello store dall'ultima posizione live seguita. Senza, la simulazione
 * ripartirebbe dalla `position` committata (potenzialmente stantìa) → micro-scatto.
 */
function DriverHandoverBridge() {
  useEffect(() => {
    const self = getViewerId();
    let wasSimulator = iAmSimulator(useStore.getState().worldDriver, self);
    return useStore.subscribe((state) => {
      const nowSimulator = iAmSimulator(state.worldDriver, self);
      if (nowSimulator && !wasSimulator) useStore.getState().seedLivePositions();
      wasSimulator = nowSimulator;
    });
  }, []);
  return null;
}

/**
 * Reazioni a catena: when an agent transitions into "done", match the completed
 * task against the user's declarative chain rules and fire each matching one as a
 * follow-up task (assigned, or queued if the target is busy) — a self-feeding
 * pipeline on top of the point-to-point `relay_task`. Drawn as a handoff arc and
 * given a small affinity bump, like a relay. A per-rule cooldown caps runaway
 * cascades; the pure module already blocks direct self-loops.
 */
const CHAIN_COOLDOWN_MS = 15_000;
function ChainBridge() {
  const lastFired = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    return useStore.subscribe((state, prev) => {
      for (const agent of state.agents) {
        const prevAgent = prev.agents.find((a) => a.id === agent.id);
        if (!prevAgent) continue;
        if (prevAgent.status === "done" || agent.status !== "done") continue;

        const completedTitle =
          agent.task?.title ??
          [...useStore.getState().tasks].reverse().find((t) => t.agentId === agent.id)?.title;
        if (!completedTitle) continue;

        const matches = matchingChains(useStore.getState().chains, {
          title: completedTitle,
          role: agent.role,
        });
        if (matches.length === 0) continue;

        const now = Date.now();
        for (const rule of matches) {
          // runaway guard: a given rule fires at most once per cooldown window
          if (now - (lastFired.current.get(rule.id) ?? 0) < CHAIN_COOLDOWN_MS) continue;
          lastFired.current.set(rule.id, now);

          const target = findRelayTarget(useStore.getState().agents, rule.target);
          if (!target) continue;

          const title = chainTitle(rule, { title: completedTitle });
          const branch = rule.branch.trim() || "main";
          // treat it like a relay in the 3D world: draw the arc + build affinity
          useStore.getState().addHandoff(agent.id, target.id);
          useStore.getState().bumpAffinity(agent.id, target.id, 1);
          audio.playWhoosh();

          if (target.task) {
            useStore.getState().enqueueTask(target.id, { title, branch });
          } else {
            useStore.getState().assignTask(target.id, title, branch);
            if (backendEnabled) {
              const fresh = useStore.getState().agents.find((a) => a.id === target.id);
              if (fresh) {
                assignRemote(fresh.id, fresh.name, title, branch, fresh.role, fresh.instructions, metaRepo(fresh)).catch(() => {});
              }
            }
          }
          useStore.getState().log({
            agentId: target.id,
            agentName: target.name,
            color: target.color,
            level: "INFO",
            message: `⛓ Reazione a catena da ${agent.name}: ${title}`,
          });
        }
      }
    });
  }, []);
  return null;
}

/**
 * Protocolli di collaborazione: quando un agente passa in "done", vede se il task
 * completato è lo stadio corrente di una run di playbook attiva (match per titolo
 * espanso + ruolo). In tal caso avanza la run e assegna lo stadio successivo al suo
 * target — un hand-off *esplicito e ordinato*, disegnato come un relay. A differenza
 * delle reazioni a catena (regole globali), una run è una pipeline con inizio e fine.
 */
function PlaybookBridge() {
  const fired = useRef<Set<string>>(new Set());
  useEffect(() => {
    return useStore.subscribe((state, prev) => {
      for (const agent of state.agents) {
        const prevAgent = prev.agents.find((a) => a.id === agent.id);
        if (!prevAgent) continue;
        if (prevAgent.status === "done" || agent.status !== "done") continue;

        const completedTitle =
          agent.task?.title ??
          [...useStore.getState().tasks].reverse().find((t) => t.agentId === agent.id)?.title;
        if (!completedTitle) continue;

        const run = runMatching(useStore.getState().playbookRuns, {
          title: completedTitle,
          role: agent.role,
        });
        if (!run) continue;

        // single-fire per (run, stadio): evita doppie assegnazioni sullo stesso passo
        const key = `${run.id}:${run.stageIndex}`;
        if (fired.current.has(key)) continue;
        fired.current.add(key);

        useStore.getState().advancePlaybookRun(run.id, agent.name);
        const advanced = useStore.getState().playbookRuns.find((r) => r.id === run.id);
        const next = advanced ? currentStage(advanced) : null;

        if (!next || !advanced) {
          // pipeline conclusa — retrospettiva con durata e contributori
          const retro = advanced ? runRetrospective(advanced, Date.now()) : `Tavolo "${run.name}"`;
          useStore.getState().log({
            agentId: agent.id,
            agentName: agent.name,
            color: agent.color,
            level: "SUCCESS",
            message: `🤝 ${retro}`,
          });
          useStore.getState().pushToast("SUCCESS", `🤝 Tavolo "${run.name}" completato!`);
          continue;
        }

        const target = findRelayTarget(useStore.getState().agents, next.role);
        if (!target) {
          useStore.getState().log({
            agentId: agent.id,
            agentName: agent.name,
            color: agent.color,
            level: "WARN",
            message: `🤝 ${run.name}: nessun agente per lo stadio "${next.role}"`,
          });
          continue;
        }

        const title = expandStageTitle(next, advanced.goal);
        const branch = advanced.branch.trim() || "main";
        useStore.getState().addHandoff(agent.id, target.id);
        useStore.getState().bumpAffinity(agent.id, target.id, 1);
        audio.playWhoosh();

        if (target.task) {
          useStore.getState().enqueueTask(target.id, { title, branch });
        } else {
          useStore.getState().assignTask(target.id, title, branch);
          if (backendEnabled) {
            const fresh = useStore.getState().agents.find((a) => a.id === target.id);
            if (fresh) {
              assignRemote(fresh.id, fresh.name, title, branch, fresh.role, fresh.instructions, metaRepo(fresh)).catch(() => {});
            }
          }
        }
        useStore.getState().log({
          agentId: target.id,
          agentName: target.name,
          color: target.color,
          level: "INFO",
          message: `🤝 ${run.name} (${advanced.stageIndex + 1}/${advanced.stages.length}) → ${title}`,
        });
      }
    });
  }, []);
  return null;
}

/**
 * Notifiche desktop (opt-in): quando la scheda è in secondo piano, gli eventi ad
 * alto segnale (completamenti, errori, richieste di approvazione) sollevano una
 * notifica del sistema operativo. Guardato tre volte: flag persistito, permesso
 * concesso e `document.hidden`. Il cursore `lastId` avanza sempre (anche a
 * notifiche spente) così riattivandolo non parte un arretrato di avvisi.
 */
function NotificationBridge() {
  const lastId = useRef<string | null>(null);
  useEffect(() => {
    const init = useStore.getState().events;
    lastId.current = init.length ? init[init.length - 1].id : null;
    return useStore.subscribe((state, prev) => {
      if (state.events === prev.events) return;
      const events = state.events;
      // eventi comparsi dall'ultimo giro; se il cursore è caduto fuori dal cap
      // (300) trattiamo solo gli ultimi pochi per non esplodere.
      let startIdx = 0;
      if (lastId.current) {
        const i = events.findIndex((e) => e.id === lastId.current);
        startIdx = i >= 0 ? i + 1 : Math.max(0, events.length - 5);
      }
      const fresh = events.slice(startIdx);
      if (fresh.length) lastId.current = events[events.length - 1].id;

      if (!useStore.getState().desktopNotifications) return;
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      if (typeof document !== "undefined" && !document.hidden) return; // solo a scheda nascosta

      for (const ev of fresh) {
        if (!shouldNotify(ev)) continue;
        try {
          new Notification(notificationTitle(ev), { body: notificationBody(ev), tag: "sams" });
        } catch {
          /* Notifiche non disponibili in questo contesto — ignora. */
        }
      }
    });
  }, []);
  return null;
}

/**
 * Proactive meta-agent (opt-in): every so often, an idle meta-agent proposes a
 * SAMS self-improvement on its own — picking a rotating idea and assigning it to
 * itself (targeting the SAMS repo). A per-agent cooldown avoids spamming; night
 * time is skipped so agents "rest". Off by default (toggle in the Live Sim panel).
 */
function MetaProactiveBridge() {
  const lastProposed = useRef<Map<string, number>>(new Map());
  const seed = useRef(0);
  useEffect(() => {
    const tick = () => {
      const st = useStore.getState();
      if (!st.metaProactive || isNightNow()) return;
      const now = Date.now();
      for (const agent of st.agents) {
        if (!shouldProposeMeta(agent, lastProposed.current.get(agent.id), now)) continue;
        const idea = pickMetaIdea(META_IDEAS, seed.current++);
        const { title, branch } = buildMetaTask(idea);
        lastProposed.current.set(agent.id, now);
        st.assignTask(agent.id, title, branch);
        st.log({ agentId: agent.id, agentName: agent.name, color: agent.color, level: "INFO", message: `🤯 Proposta autonoma: ${idea.label}` });
        if (backendEnabled) {
          const fresh = useStore.getState().agents.find((a) => a.id === agent.id);
          if (fresh) {
            assignRemote(fresh.id, fresh.name, title, branch, fresh.role, fresh.instructions, metaRepo(fresh)).catch(() => {});
          }
        }
      }
    };
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
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
    const self = getViewerId();
    const id = setInterval(() => {
      // Solo il simulatore fa vivere il mondo: un follower adotta i bisogni dal
      // driver (per ora la posizione; movimento condiviso B3) e non li fa scorrere
      // per conto suo, così non divergono. Da solo → simula come prima.
      if (!iAmSimulator(useStore.getState().worldDriver, self)) return;
      useStore.getState().growHunger(1);
    }, 7000);
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

    const self = getViewerId();
    const tick = () => {
      const st = useStore.getState();
      // Solo il simulatore muove gli agenti liberi: un follower segue il movimento
      // del driver (opzione B3), non ne genera uno proprio con Math.random → niente
      // due mondi che vagano diversamente. Da solo → guida sé stesso, come prima.
      if (!iAmSimulator(st.worldDriver, self)) return;
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
    const self = getViewerId();
    const tick = () => {
      if (isNightNow()) return; // everyone's asleep
      const st = useStore.getState();
      // Solo il simulatore anima la socialità (chiacchiere = Math.random locale, non
      // condivise): un follower resta quieto e vede il mondo del driver. Da solo, come prima.
      if (!iAmSimulator(st.worldDriver, self)) return;
      const free = st.agents.filter(isFreeAgent);
      if (free.length < 2 || Math.random() > 0.5) return;

      // pick a nearby pair, biased toward friends: among agents close enough to
      // talk, prefer the pair with the strongest affinity (friends seek friends).
      let best: [typeof free[number], typeof free[number]] | null = null;
      let bestScore = Infinity;
      for (let i = 0; i < free.length; i++) {
        for (let j = i + 1; j < free.length; j++) {
          const d = Math.hypot(
            free[i].position[0] - free[j].position[0],
            free[i].position[1] - free[j].position[1],
          );
          if (d > 9) continue; // must be near enough to chat
          const aff = affinityBetween(st.affinity, free[i].id, free[j].id);
          const score = d - aff * 0.5; // affinità "avvicina": gli amici parlano più spesso
          if (score < bestScore) { bestScore = score; best = [free[i], free[j]]; }
        }
      }
      if (!best) return;

      const [a, b] = best;
      // the exchange itself deepens their bond
      st.bumpAffinity(a.id, b.id, 1);
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
/**
 * On small screens (< 768 px) automatically collapse left and right panels
 * so the 3D scene is visible. Re-runs on resize.
 */
function ResponsiveBridge() {
  const setLeftOpen = useStore((s) => s.setLeftOpen);
  const setRightOpen = useStore((s) => s.setRightOpen);

  useEffect(() => {
    // Collassa i pannelli solo *entrando* in fascia mobile (o al primo mount se già
    // mobile), non a ogni resize: così un drawer aperto dal tocco non si richiude
    // da solo a ogni piccolo cambio di viewport (es. rotazione, barra URL mobile).
    let wasMobile = isMobileWidth(window.innerWidth);
    if (wasMobile) {
      setLeftOpen(false);
      setRightOpen(false);
    }
    function apply() {
      const nowMobile = isMobileWidth(window.innerWidth);
      if (nowMobile && !wasMobile) {
        setLeftOpen(false);
        setRightOpen(false);
      }
      wasMobile = nowMobile;
    }
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

/** Read the `?public` flag once at module load — it never changes within a session. */
const IS_PUBLIC = new URLSearchParams(window.location.search).has("public");

export default function App() {
  // Shareable read-only dashboard: a separate, self-contained view that doesn't
  // mount the workspace (no SSE, no scene, no controls).
  if (IS_PUBLIC) return <PublicDashboard />;
  return <Workspace />;
}

function Workspace() {
  const leftOpen = useStore((s) => s.leftOpen);
  const rightOpen = useStore((s) => s.rightOpen);
  const bottomOpen = useStore((s) => s.bottomOpen);
  const theme = useStore((s) => s.theme);
  const setCommandOpen = useStore((s) => s.setCommandOpen);
  const setLeftOpen = useStore((s) => s.setLeftOpen);
  const setRightOpen = useStore((s) => s.setRightOpen);
  const isMobile = useIsMobile();

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

  // Auto-start the UI tour once, after onboarding has been seen (the onboarding
  // explains the concepts; the tour shows the actual UI). Never for a brand-new
  // user (who's still in onboarding) and never twice.
  useEffect(() => {
    let seen = true;
    let welcomed = false;
    try {
      seen = !!localStorage.getItem("sams.tour");
      welcomed = !!localStorage.getItem("sams.welcomed");
    } catch { /* ignore */ }
    if (welcomed && !seen) {
      const t = setTimeout(() => useStore.getState().setTourOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-ink-950 text-slate-200">
      <TitleBar />
      <RuntimeBanner />

      <div className="flex min-h-0 flex-1">
        <ActivityBar />
        {/* Desktop: colonna inline. Mobile: drawer in overlay (non schiaccia la scena). */}
        {leftOpen &&
          (isMobile ? (
            <MobileDrawer side="left" onClose={() => setLeftOpen(false)}>
              <LeftPanel />
            </MobileDrawer>
          ) : (
            <LeftPanel />
          ))}

        <main className="flex min-w-0 flex-1 flex-col">
          <div data-tour="scene" className="relative min-h-0 flex-1">
            <Suspense fallback={<SceneLoading />}>
              <OfficeScene />
            </Suspense>
            {/* Vignettatura: un velo radiale che scurisce gli angoli e mette a
                fuoco il diorama al centro. Puramente decorativa, non intercetta
                click (pointer-events-none) così l'orbita/selezione restano libere. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-[1]"
              style={{
                background:
                  "radial-gradient(120% 100% at 50% 42%, transparent 55%, rgba(6,9,15,0.28) 100%)",
                boxShadow: "inset 0 0 120px 8px rgba(6,9,15,0.22)",
              }}
            />
            <StageHint />
            <PresenceRoster />
            <SoundToggle />
            <NarrationToggle />
            <ReopenPanelButton />
          </div>
          {bottomOpen && <BottomPanel />}
        </main>

        {rightOpen &&
          (isMobile ? (
            <MobileDrawer side="right" onClose={() => setRightOpen(false)}>
              <RightPanel />
            </MobileDrawer>
          ) : (
            <RightPanel />
          ))}
      </div>

      <MobileBar />
      <StatusBar />
      <CommandPalette />
      <SettingsModal />
      <FileViewer />
      <GardenView />
      <Toaster />
      <OnboardingWizard />
      <Tour />
      <QueueBridge />
      <RelayBridge />
      <WakeBridge />
      <ProgressionBridge />
      <ChainBridge />
      <PlaybookBridge />
      <NotificationBridge />
      <WorldSyncBridge />
      <WorldSimBridge />
      <DriverHandoverBridge />
      <SelectionBridge />
      <DriverBridge />
      <MetaProactiveBridge />
      <LifeBridge />
      <TalkBridge />
      <HungerBridge />
      <AudioBridge />
      <NarrationBridge />
      <ResponsiveBridge />
      <SimBridge />
    </div>
  );
}
