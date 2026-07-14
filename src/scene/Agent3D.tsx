import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { CheckCheck, Coffee, Dumbbell, Eye, Moon, Pencil, Play, Trash2, Utensils, type LucideIcon } from "lucide-react";
import { AGENT_HEX, type Agent, type AgentStatus, type Vec2 } from "../types";
import { useStore } from "../store/useStore";
import { findPath, isPointClear } from "../lib/pathfind";
import { levelFromXp } from "../lib/skill";
import { BEDS, OBSTACLES, ZONE_BY_ID, isNightNow, clampToRoom } from "../data/world";
import { STATUS_META } from "../lib/meta";
import { selectorsOf } from "../lib/selections";
import { cursorColor } from "../lib/cursors";
import { iAmSimulator, liveAgentPositions, movingAgents, separationPush, resolveSeparation } from "../lib/worldsim";
import { getViewerId } from "../lib/backend";
import { RadialMenu, type RadialItem } from "./RadialMenu";

// Colori-stato centralizzati in STATUS_META (lib/meta): unica fonte per scena e pannelli.
const STATUS_HEX: Record<AgentStatus, string> = Object.fromEntries(
  Object.entries(STATUS_META).map(([k, v]) => [k, v.hex]),
) as Record<AgentStatus, string>;

const SPEED = 2.7; // world units / second
const MIN_SEP = 1.6; // "due passi": distanza minima tra due agenti (world units)

/** Idle "life" micro-activities, derived from where a free agent is standing. */
type Activity = null | "coffee" | "sketch" | "stretch";

function dampAngle(current: number, target: number, lambda: number, dt: number) {
  let diff = target - current;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest path
  return current + diff * (1 - Math.exp(-lambda * dt));
}

/** Lighten (amt>0, toward white) or darken (amt<0, toward black) a hex color. */
function shade(hex: string, amt: number) {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(amt >= 0 ? "#ffffff" : "#000000"), Math.abs(amt));
  return `#${c.getHexString()}`;
}

/**
 * Indicatore di stato-di-vita mostrato *inline* nell'etichetta dell'agente (fame,
 * caffè, schizzo, stretch): icona vettoriale nitida + tinta semantica, invece di
 * un'emoji fluttuante che collideva col nome. `hunger` ha precedenza sull'attività.
 */
const LIFE_ICON: Record<"hunger" | "coffee" | "sketch" | "stretch", { Icon: LucideIcon; tint: string }> = {
  hunger: { Icon: Utensils, tint: "#fbbf24" }, // ambra: fame
  coffee: { Icon: Coffee, tint: "#e0a56b" }, // caldo: caffè
  sketch: { Icon: Pencil, tint: "#a5b4fc" }, // indaco: idee/schizzo
  stretch: { Icon: Dumbbell, tint: "#5eead4" }, // verde acqua: stretch
};

export function Agent3D({ agent, selected }: { agent: Agent; selected: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null); // whole body: tips over to lie on the bed
  const charRef = useRef<THREE.Group>(null); // upper body: bob + lean
  const ringRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Mesh>(null); // remote-selection aura pulse
  const armLRef = useRef<THREE.Group>(null);
  const armRRef = useRef<THREE.Group>(null);
  const legLRef = useRef<THREE.Group>(null);
  const legRRef = useRef<THREE.Group>(null);
  const eyeLRef = useRef<THREE.Mesh>(null);
  const eyeRRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Group>(null);
  const cur = useRef(new THREE.Vector3(agent.position[0], 0, agent.position[1]));
  const prevStatus = useRef(agent.status);
  const celebrate = useRef(0); // 1 → 0 over ~0.5s, drives a bounce
  const headGroupRef = useRef<THREE.Group>(null);
  const idleTimer = useRef(0); // seconds idle, drives look-around animation
  const wpIndex = useRef(0); // index into the current path's waypoints

  // Allo smontaggio (agente rimosso), togli le voci effimere: una posizione/stato di
  // movimento fantasma continuerebbe altrimenti a influenzare la separazione dei vivi.
  useEffect(() => {
    const id = agent.id;
    return () => {
      liveAgentPositions.delete(id);
      movingAgents.delete(id);
    };
  }, [agent.id]);

  const [hovered, setHovered] = useState(false);
  const [nightTime, setNightTime] = useState(isNightNow);
  useEffect(() => {
    const id = setInterval(() => setNightTime(isNightNow()), 30000);
    return () => clearInterval(id);
  }, []);
  // Asleep when it's night and the agent has settled onto a bed (no matter its
  // task status — at night everyone sleeps). Position-based so working agents
  // that walked to bed also lie down.
  const atBed = BEDS.some((b) => Math.hypot(agent.position[0] - b[0], agent.position[1] - b[1]) < 1.2);
  const sleeping = nightTime && !agent.target && atBed;

  // Micro-activities for free agents: a coffee in the kitchen, a sketch at the
  // whiteboard, or an occasional stretch elsewhere. Purely visual, re-evaluated
  // on a slow tick from the agent's committed position.
  const [activity, setActivity] = useState<Activity>(null);
  const activityRef = useRef<Activity>(null);
  activityRef.current = activity;
  useEffect(() => {
    const pick = () => {
      if (nightTime || agent.status !== "idle" || agent.target || agent.task) {
        setActivity(null);
        return;
      }
      const [x, z] = agent.position;
      const near = (p: Vec2) => Math.hypot(x - p[0], z - p[1]) < 3;
      if (near(ZONE_BY_ID.kitchen.position)) setActivity("coffee");
      else if (near(ZONE_BY_ID.whiteboard.position)) setActivity("sketch");
      else setActivity((a) => (a === "stretch" ? null : Math.random() < 0.3 ? "stretch" : null));
    };
    pick();
    const id = setInterval(pick, 2600);
    return () => clearInterval(id);
  }, [agent.status, agent.target, agent.task, agent.position, nightTime]);

  // Indicatore di vita mostrato inline nell'etichetta: la fame ha precedenza
  // sull'attività; nessuno mentre dorme.
  const lifeIndicator = sleeping
    ? null
    : agent.hunger >= 75
      ? LIFE_ICON.hunger
      : activity
        ? LIFE_ICON[activity]
        : null;

  // Waypoints that steer around furniture; last entry is always the destination.
  // Recomputed only when a new target is set (position is committed, not per-frame).
  const path = useMemo(
    () => (agent.target ? findPath(agent.position, agent.target, OBSTACLES) : []),
    [agent.target, agent.position],
  );
  useEffect(() => {
    wpIndex.current = 0;
  }, [path]);

  const selectAgent = useStore((s) => s.selectAgent);
  const setStatus = useStore((s) => s.setStatus);
  const updateProgress = useStore((s) => s.updateProgress);
  const sendToZone = useStore((s) => s.sendToZone);
  const removeAgent = useStore((s) => s.removeAgent);
  // Il garden è un overlay a schermo intero: le <Html> degli agenti sono portali
  // DOM che altrimenti "bucano" l'overlay (dialoghi e simboli restano visibili
  // sopra il giardino). Quando il garden è aperto le sopprimiamo tutte.
  const gardenOpen = useStore((s) => s.gardenOpen);
  // Presenza di selezione: quali ALTRE viste hanno selezionato questo agente.
  // `remoteSelections` cambia ref solo su update di selezione (non sui cursori),
  // quindi questo re-render resta raro.
  const remoteSelections = useStore((s) => s.remoteSelections);
  const selfViewer = useMemo(() => getViewerId(), []);
  const remoteSelectors = useMemo(
    () => selectorsOf(remoteSelections, agent.id, selfViewer),
    [remoteSelections, agent.id, selfViewer],
  );
  const auraColor = remoteSelectors.length ? cursorColor(remoteSelectors[0].id) : "#ffffff";

  const hex = AGENT_HEX[agent.color];
  const tint = useMemo(
    () => ({
      main: hex,
      light: shade(hex, 0.32),
      dark: shade(hex, -0.24),
    }),
    [hex],
  );

  // each agent blinks on its own rhythm
  const blinkPhase = useMemo(() => {
    let h = 7;
    for (const ch of agent.id) h = (h * 33 + ch.charCodeAt(0)) % 997;
    return (h / 997) * Math.PI * 2;
  }, [agent.id]);

  // speech bubble: surface this agent's latest event for a few seconds
  const lastEvent = useStore((s) => {
    for (let i = s.events.length - 1; i >= 0; i--) if (s.events[i].agentId === agent.id) return s.events[i];
    return undefined;
  });
  const [bubble, setBubble] = useState<string | null>(null);
  useEffect(() => {
    if (!lastEvent || Date.now() - lastEvent.ts > 8000) return;
    const msg = lastEvent.message;
    setBubble(msg.length > 90 ? msg.slice(0, 89) + "…" : msg);
    const t = setTimeout(() => setBubble(null), 6000);
    return () => clearTimeout(t);
  }, [lastEvent?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const d = Math.min(delta, 0.05); // guard against tab-switch spikes

    // Movimento condiviso (opzione B3): se un'ALTRA vista guida, seguiamo la sua
    // posizione live invece di simulare per conto nostro. Lettura ref-stabile dallo
    // store (getState → nessun re-render, come cursori/selezione).
    const rt = useStore.getState();
    const follow = iAmSimulator(rt.worldDriver, selfViewer) ? undefined : rt.remoteSim[agent.id];

    // Walk toward the current waypoint; the final waypoint is the destination. When
    // following the driver, chase its live position instead (no local path/commit).
    const hasPath = !follow && agent.target != null && path.length > 0;
    // C'è davvero una destinazione verso cui camminare? Solo con un cammino attivo o
    // seguendo il driver. A RIPOSO (target raggiunto, `arriveAgent` ha azzerato il
    // target) non c'è: la posizione la possiede la separazione e NON va richiamata
    // indietro alla cella committata — quel richiamo era la causa del "cerchio",
    // perché un agente spinto via dalla separazione ci rientrava e ricollideva.
    const goingSomewhere = hasPath || !!follow;
    const wp: Vec2 = hasPath
      ? path[Math.min(wpIndex.current, path.length - 1)]
      : follow
        ? [follow.x, follow.z]
        : agent.position;
    const dest = wp;
    const dx = dest[0] - cur.current.x;
    const dz = dest[1] - cur.current.z;
    const dist = Math.hypot(dx, dz);
    // "In movimento" solo se sta raggiungendo una destinazione reale: uno spostamento
    // dovuto alla sola separazione (da fermo) non è una camminata, quindi non conta.
    const moving = goingSomewhere && dist > 0.03;
    // "In transito": ha un cammino attivo o si sta ancora spostando verso una meta. Da
    // fermo questo è falso → scatta la separazione (e non viene segnato come moving).
    const traveling = hasPath || moving;
    // Pubblica lo stato di movimento (gemello di liveAgentPositions): la separazione
    // altrui salta chi è in transito, così ci si può attraversare mentre si cammina.
    if (traveling) movingAgents.add(agent.id);
    else movingAgents.delete(agent.id);

    if (hasPath && dist < 0.08) {
      if (wpIndex.current < path.length - 1) {
        wpIndex.current++; // turn the corner toward the next waypoint
      } else {
        useStore.getState().arriveAgent(agent.id); // reached the destination
      }
    }

    // Cammina verso la meta SOLO se ne ha una (cammino/follow). A riposo non si
    // auto-richiama alla cella committata: così la separazione può tenerlo a distanza
    // minima dagli altri fermi senza che lui rientri di continuo nella collisione.
    if (goingSomewhere && dist > 1e-4) {
      const step = Math.min(dist, SPEED * d);
      cur.current.x += (dx / dist) * step;
      cur.current.z += (dz / dist) * step;
    }

    // Separazione: due agenti FERMI non condividono la stessa cella — se un altro fermo
    // è a meno di MIN_SEP ("due passi"), spingi via da lui. Chi cammina (`traveling`) è
    // escluso da entrambi i lati: questo agente non spinge mentre si muove, e i vicini in
    // movimento vengono saltati (`movingAgents`) — così ci si passa vicino/attraverso senza
    // il cerchio, ma da fermi ci si separa. Solo quando questa vista simula l'agente
    // (`!follow`: i follower rendono le posizioni già risolte dal driver) e non mentre dorme.
    if (!follow && !sleeping && !traveling) {
      const [pushX, pushZ] = separationPush(
        [cur.current.x, cur.current.z],
        liveAgentPositions,
        agent.id,
        MIN_SEP,
        (id) => movingAgents.has(id),
      );
      if (pushX !== 0 || pushZ !== 0) {
        // vincolo duro: correzione posizionale diretta (non scalata dal dt) così la
        // distanza minima regge anche contro il richiamo del cammino. La spinta però
        // non deve MAI cacciare l'agente dentro un muro/mobile (altrimenti resta
        // incastrato e non passa le porte): `resolveSeparation` scivola o rinuncia.
        const target = clampToRoom([cur.current.x + pushX, cur.current.z + pushZ]);
        const [rx, rz] = resolveSeparation(
          [cur.current.x, cur.current.z],
          target,
          (x, z) => isPointClear([x, z], OBSTACLES),
        );
        cur.current.x = rx;
        cur.current.z = rz;
      }
    }

    g.position.x = cur.current.x;
    g.position.z = cur.current.z;
    // Pubblica la posizione live della mesh (interpolata lungo il cammino) così il
    // WorldSimBridge del driver la spinge alle altre viste; lo store committa solo
    // all'arrivo, quindi qui c'è la sola verità del movimento fluido.
    liveAgentPositions.set(agent.id, [cur.current.x, cur.current.z]);

    // face direction of travel
    if (moving) {
      const targetRot = Math.atan2(dx, dz);
      g.rotation.y = dampAngle(g.rotation.y, targetRot, 9, d);
    }

    const t = state.clock.elapsedTime;
    const sleepPose = sleeping && !moving; // asleep and settled in place
    const isTyping = agent.status === "working" && !moving && !sleepPose;

    // Lie down on the bed when asleep: tip the whole body onto its back, lift it
    // onto the mattress and slide it toward the headboard; otherwise stand upright.
    if (bodyRef.current) {
      bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, sleepPose ? -Math.PI / 2 : 0, 0.1);
      bodyRef.current.position.y = THREE.MathUtils.lerp(bodyRef.current.position.y, sleepPose ? 0.62 : 0, 0.1);
      bodyRef.current.position.z = THREE.MathUtils.lerp(bodyRef.current.position.z, sleepPose ? 0.7 : 0, 0.1);
    }
    // a sleeping body lies straight along the bed (which runs north–south, z axis)
    if (sleepPose) g.rotation.y = dampAngle(g.rotation.y, 0, 6, d);

    // Trigger a bounce when the agent finishes a task (working → review/done)
    if (agent.status !== prevStatus.current) {
      if (
        (agent.status === "review" || agent.status === "done") &&
        prevStatus.current === "working"
      ) {
        celebrate.current = 1.0;
      }
      prevStatus.current = agent.status;
    }
    if (celebrate.current > 0) {
      celebrate.current = Math.max(0, celebrate.current - d * 2.2);
    }
    const celebrateBump = celebrate.current > 0 ? Math.sin(celebrate.current * Math.PI) * 0.55 : 0;

    // idle look-around: build up over 4 s, decay fast when agent gets busy (never while asleep)
    if (agent.status === "idle" && !moving && !sleepPose) {
      idleTimer.current = Math.min(idleTimer.current + d, 60);
    } else {
      idleTimer.current = Math.max(0, idleTimer.current - d * 3);
    }
    const idleFactor = Math.min(1, idleTimer.current / 4);
    if (headGroupRef.current) {
      const lookY = !sleepPose && agent.status === "idle" && !moving ? Math.sin(t * 0.45) * idleFactor * 0.45 : 0;
      headGroupRef.current.rotation.y = THREE.MathUtils.lerp(headGroupRef.current.rotation.y, lookY, 0.04);
      // tuck the chin gently toward the pillow when asleep (body already horizontal)
      headGroupRef.current.rotation.x = THREE.MathUtils.lerp(headGroupRef.current.rotation.x, sleepPose ? 0.18 : 0, 0.05);
    }

    // upper body: gentle breathing while asleep, otherwise bob with mood/activity
    const bob = sleepPose
      ? Math.sin(t * 1.4) * 0.012
      : moving ? Math.sin(t * 10) * 0.05 : isTyping ? Math.sin(t * 8) * 0.025 : Math.sin(t * 2.2) * (0.02 + idleFactor * 0.012);
    if (charRef.current) {
      charRef.current.position.y = bob + celebrateBump;
      charRef.current.rotation.x = THREE.MathUtils.lerp(
        charRef.current.rotation.x,
        sleepPose ? 0 : moving ? 0.1 : isTyping ? 0.16 : 0,
        0.09,
      );
    }

    // walk cycle: legs swing, arms counter-swing; when typing, arms go forward with alternating stutter
    const swing = moving ? Math.sin(t * 10) * 0.55 : Math.sin(t * 2.0) * 0.05;
    if (legLRef.current) legLRef.current.rotation.x = swing;
    if (legRRef.current) legRRef.current.rotation.x = -swing;
    if (armLRef.current) {
      if (isTyping) {
        armLRef.current.rotation.x = THREE.MathUtils.lerp(armLRef.current.rotation.x, 0.55 + Math.sin(t * 13) * 0.14, 0.18);
        armLRef.current.rotation.z = THREE.MathUtils.lerp(armLRef.current.rotation.z, -0.18, 0.1);
      } else {
        armLRef.current.rotation.x = THREE.MathUtils.lerp(armLRef.current.rotation.x, -swing * 0.9, 0.2);
        armLRef.current.rotation.z = THREE.MathUtils.lerp(armLRef.current.rotation.z, 0, 0.1);
      }
    }
    if (armRRef.current) {
      if (isTyping) {
        armRRef.current.rotation.x = THREE.MathUtils.lerp(armRRef.current.rotation.x, 0.55 + Math.sin(t * 13 + Math.PI) * 0.14, 0.18);
        armRRef.current.rotation.z = THREE.MathUtils.lerp(armRRef.current.rotation.z, 0.18, 0.1);
      } else {
        armRRef.current.rotation.x = THREE.MathUtils.lerp(armRRef.current.rotation.x, swing * 0.9, 0.2);
        armRRef.current.rotation.z = THREE.MathUtils.lerp(armRRef.current.rotation.z, 0, 0.1);
      }
    }

    // micro-activity poses, layered over the idle arms (only when standing still)
    const act = activityRef.current;
    if (act && !moving && !sleepPose && !isTyping) {
      if (act === "stretch") {
        // both arms reach overhead, a gentle lean back
        const s = (Math.sin(t * 1.6) + 1) * 0.5; // 0..1
        const up = -2.2 - s * 0.25;
        if (armLRef.current) armLRef.current.rotation.x = THREE.MathUtils.lerp(armLRef.current.rotation.x, up, 0.08);
        if (armRRef.current) armRRef.current.rotation.x = THREE.MathUtils.lerp(armRRef.current.rotation.x, up, 0.08);
        if (charRef.current) charRef.current.rotation.x = THREE.MathUtils.lerp(charRef.current.rotation.x, -0.16, 0.07);
      } else if (act === "coffee") {
        // right hand rises to the mouth in slow sips
        const sip = Math.max(0, Math.sin(t * 1.5));
        if (armRRef.current) {
          armRRef.current.rotation.x = THREE.MathUtils.lerp(armRRef.current.rotation.x, -0.5 - sip * 1.3, 0.12);
          armRRef.current.rotation.z = THREE.MathUtils.lerp(armRRef.current.rotation.z, 0.28, 0.1);
        }
        if (headGroupRef.current) headGroupRef.current.rotation.x = THREE.MathUtils.lerp(headGroupRef.current.rotation.x, sip * 0.2, 0.1);
      } else if (act === "sketch") {
        // right hand up at the board, drawing back and forth
        const draw = Math.sin(t * 6) * 0.28;
        if (armRRef.current) {
          armRRef.current.rotation.x = THREE.MathUtils.lerp(armRRef.current.rotation.x, -1.45 + draw, 0.15);
          armRRef.current.rotation.z = THREE.MathUtils.lerp(armRRef.current.rotation.z, 0.18, 0.1);
        }
      }
    }

    // blink (eyes squash on their own y axis) — closed while asleep
    const bt = (t + blinkPhase) % 3.6;
    const ey = sleepPose ? 0.1 : bt > 3.42 && bt < 3.54 ? 0.12 : 1;
    if (eyeLRef.current) eyeLRef.current.scale.y = ey;
    if (eyeRRef.current) eyeRRef.current.scale.y = ey;

    if (ringRef.current) {
      const s = 1 + Math.sin(t * 4) * 0.05;
      ringRef.current.scale.set(s, s, s);
    }
    if (auraRef.current) {
      const s = 1 + Math.sin(t * 3.2) * 0.08;
      auraRef.current.scale.set(s, s, s);
    }
    if (haloRef.current) haloRef.current.rotation.y += d * 3;
  });

  function onSelect(e: ThreeEvent<PointerEvent>) {
    if (e.nativeEvent.button !== 0) return; // left-click locks; right-click is the unlock gesture
    e.stopPropagation();
    selectAgent(agent.id);
  }

  const items: RadialItem[] = [
    { id: "work", label: "Metti al lavoro", icon: Play, onClick: () => setStatus(agent.id, "working") },
    { id: "review", label: "Invia in revisione", icon: Eye, onClick: () => setStatus(agent.id, "review") },
    {
      id: "done",
      label: "Segna completato",
      icon: CheckCheck,
      onClick: () => (agent.task ? updateProgress(agent.id, 100) : setStatus(agent.id, "done")),
    },
    {
      id: "idle",
      label: "Manda nel salotto",
      icon: Moon,
      onClick: () => {
        sendToZone(agent.id, "lounge");
        setStatus(agent.id, "idle");
      },
    },
    { id: "remove", label: "Rimuovi agente", icon: Trash2, danger: true, onClick: () => removeAgent(agent.id) },
  ];

  return (
    <group ref={groupRef} position={[agent.position[0], 0, agent.position[1]]}>
      {/* contact shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.55, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} />
      </mesh>

      {/* selection ring */}
      {selected && (
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <torusGeometry args={[0.52, 0.045, 16, 48]} />
          <meshStandardMaterial color={hex} emissive={hex} emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      )}

      {/* remote-selection aura — another view is focused on this agent */}
      {remoteSelectors.length > 0 && (
        <>
          <mesh ref={auraRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <ringGeometry args={[0.6, 0.72, 44]} />
            <meshBasicMaterial color={auraColor} transparent opacity={0.7} depthWrite={false} />
          </mesh>
          {!gardenOpen && (
            <Html position={[0, 0.06, 0.95]} center distanceFactor={11} pointerEvents="none" zIndexRange={[54, 34]}>
              <div
                className="pointer-events-none select-none whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white shadow"
                style={{ background: auraColor }}
              >
                👁 {remoteSelectors.slice(0, 2).map((s) => s.name).join(", ")}
                {remoteSelectors.length > 2 ? ` +${remoteSelectors.length - 2}` : ""}
              </div>
            </Html>
          )}
        </>
      )}

      {/* the character (whole body is the click target) */}
      <group
        ref={bodyRef}
        onPointerDown={onSelect}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
          setHovered(true);
        }}
        onPointerOut={() => {
          document.body.style.cursor = "default";
          setHovered(false);
        }}
      >
        {/* legs stay planted while the body bobs */}
        <group ref={legLRef} position={[-0.17, 0.44, 0]}>
          <mesh position={[0, -0.17, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.18, 6, 12]} />
            <meshStandardMaterial color={tint.dark} roughness={0.5} metalness={0.1} />
          </mesh>
          <mesh position={[0, -0.34, 0.05]} castShadow>
            <boxGeometry args={[0.21, 0.1, 0.3]} />
            <meshStandardMaterial color={tint.dark} roughness={0.55} />
          </mesh>
        </group>
        <group ref={legRRef} position={[0.17, 0.44, 0]}>
          <mesh position={[0, -0.17, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.18, 6, 12]} />
            <meshStandardMaterial color={tint.dark} roughness={0.5} metalness={0.1} />
          </mesh>
          <mesh position={[0, -0.34, 0.05]} castShadow>
            <boxGeometry args={[0.21, 0.1, 0.3]} />
            <meshStandardMaterial color={tint.dark} roughness={0.55} />
          </mesh>
        </group>

        {/* upper body — bobs & leans */}
        <group ref={charRef}>
          {/* torso */}
          <RoundedBox args={[0.66, 0.64, 0.46]} radius={0.18} smoothness={4} position={[0, 0.92, 0]} castShadow>
            <meshStandardMaterial color={tint.main} roughness={0.42} metalness={0.12} />
          </RoundedBox>
          {/* belly panel */}
          <RoundedBox args={[0.42, 0.44, 0.12]} radius={0.12} smoothness={4} position={[0, 0.9, 0.2]} castShadow>
            <meshStandardMaterial color={tint.light} roughness={0.5} />
          </RoundedBox>
          {/* chest status pip */}
          <mesh position={[0, 1.03, 0.27]}>
            <circleGeometry args={[0.05, 20]} />
            <meshStandardMaterial
              color={STATUS_HEX[agent.status]}
              emissive={STATUS_HEX[agent.status]}
              emissiveIntensity={1.1}
              toneMapped={false}
            />
          </mesh>

          {/* arms */}
          <group ref={armLRef} position={[-0.38, 1.12, 0]}>
            <mesh position={[0, -0.2, 0]} castShadow>
              <capsuleGeometry args={[0.09, 0.24, 6, 12]} />
              <meshStandardMaterial color={tint.main} roughness={0.45} metalness={0.1} />
            </mesh>
            <mesh position={[0, -0.4, 0]} castShadow>
              <sphereGeometry args={[0.1, 14, 14]} />
              <meshStandardMaterial color={tint.light} roughness={0.5} />
            </mesh>
          </group>
          <group ref={armRRef} position={[0.38, 1.12, 0]}>
            <mesh position={[0, -0.2, 0]} castShadow>
              <capsuleGeometry args={[0.09, 0.24, 6, 12]} />
              <meshStandardMaterial color={tint.main} roughness={0.45} metalness={0.1} />
            </mesh>
            <mesh position={[0, -0.4, 0]} castShadow>
              <sphereGeometry args={[0.1, 14, 14]} />
              <meshStandardMaterial color={tint.light} roughness={0.5} />
            </mesh>
          </group>

          {/* head group — pivots at head centre so look-around feels natural */}
          <group ref={headGroupRef} position={[0, 1.55, 0]}>
            <RoundedBox args={[0.66, 0.58, 0.6]} radius={0.2} smoothness={4} position={[0, 0, 0]} castShadow>
              <meshStandardMaterial color={tint.main} roughness={0.4} metalness={0.12} />
            </RoundedBox>
            {/* glossy visor face */}
            <RoundedBox args={[0.54, 0.3, 0.12]} radius={0.13} smoothness={4} position={[0, 0.01, 0.26]} castShadow>
              <meshStandardMaterial color="#0d1119" roughness={0.15} metalness={0.45} />
            </RoundedBox>
            {/* eyes */}
            <mesh ref={eyeLRef} position={[-0.12, 0.02, 0.34]}>
              <sphereGeometry args={[0.052, 16, 16]} />
              <meshStandardMaterial color="#eafff8" emissive="#bdeede" emissiveIntensity={0.7} toneMapped={false} />
            </mesh>
            <mesh ref={eyeRRef} position={[0.12, 0.02, 0.34]}>
              <sphereGeometry args={[0.052, 16, 16]} />
              <meshStandardMaterial color="#eafff8" emissive="#bdeede" emissiveIntensity={0.7} toneMapped={false} />
            </mesh>
            {/* ear cups */}
            {[-0.35, 0.35].map((x, i) => (
              <mesh key={i} position={[x, -0.01, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.11, 0.11, 0.09, 18]} />
                <meshStandardMaterial color={tint.dark} roughness={0.5} metalness={0.15} />
              </mesh>
            ))}
            {/* antenna + status light */}
            <mesh position={[0, 0.37, 0]}>
              <cylinderGeometry args={[0.014, 0.014, 0.16, 8]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.4} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.49, 0]}>
              <sphereGeometry args={[0.06, 16, 16]} />
              <meshStandardMaterial
                color={STATUS_HEX[agent.status]}
                emissive={STATUS_HEX[agent.status]}
                emissiveIntensity={agent.status === "working" ? 1.6 : 0.85}
                toneMapped={false}
              />
            </mesh>
            {/* "working" orbiter */}
            {agent.status === "working" && (
              <group ref={haloRef} position={[0, 0.49, 0]}>
                <mesh position={[0.22, 0, 0]}>
                  <sphereGeometry args={[0.05, 12, 12]} />
                  <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.6} toneMapped={false} />
                </mesh>
              </group>
            )}
          </group>
        </group>
      </group>

      {/* hover tooltip with quick stats */}
      {hovered && !selected && !gardenOpen && (
        <Html position={[0.72, 1.7, 0]} distanceFactor={10} zIndexRange={[80, 60]} pointerEvents="none">
          <div className="pointer-events-none w-[148px] select-none rounded-xl border border-white/10 bg-ink-900/96 p-2 text-[11px] shadow-panel">
            <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-slate-100">
              <span className="h-2 w-2 rounded-full" style={{ background: STATUS_HEX[agent.status] }} />
              {agent.name}
            </div>
            <div className="flex justify-between text-mut">
              <span>Stato</span>
              <span className="text-slate-200">{STATUS_META[agent.status].label}</span>
            </div>
            {agent.energy != null && (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-mut">Energia</span>
                <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-ink-700">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${agent.energy}%`,
                      background: agent.energy > 60 ? "#22c55e" : agent.energy > 30 ? "#eab308" : "#ef4444",
                    }}
                  />
                </div>
                <span className="text-mut">{agent.energy}%</span>
              </div>
            )}
            {agent.task && (
              <div className="mt-1 flex justify-between text-mut">
                <span>Task</span>
                <span className="max-w-[80px] truncate text-right text-slate-200">{agent.task.title}</span>
              </div>
            )}
            {agent.task && (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-mut">Avanzamento</span>
                <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-ink-700">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-brand"
                    style={{ width: `${agent.task.progress}%` }}
                  />
                </div>
                <span className="text-mut">{agent.task.progress}%</span>
              </div>
            )}
          </div>
        </Html>
      )}

      {/* speech bubble — the agent's latest action */}
      {bubble && !gardenOpen && (
        <Html position={[0, 2.95, 0]} center distanceFactor={11} zIndexRange={[70, 50]} pointerEvents="none">
          <div className="pointer-events-none relative max-w-[180px] select-none rounded-2xl border border-white/10 bg-ink-900/95 px-2.5 py-1.5 text-center text-[11px] leading-snug text-slate-100 shadow-panel">
            {bubble}
            <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-white/10 bg-ink-900/95" />
          </div>
        </Html>
      )}

      {/* sleeping indicator */}
      {sleeping && !gardenOpen && (
        <Html position={[0.4, 2.5, 0]} center distanceFactor={10} zIndexRange={[70, 50]} pointerEvents="none">
          <div className="pointer-events-none select-none text-[15px] font-bold tracking-tight text-sky-200/90 drop-shadow">
            z<span className="text-[12px]">z</span><span className="text-[9px]">z</span>
          </div>
        </Html>
      )}

      {/* name label + optional task progress bar */}
      {!gardenOpen && (
      <Html position={[0, 2.55, 0]} center distanceFactor={11} zIndexRange={[60, 40]} pointerEvents="none">
        <div className="pointer-events-none flex select-none flex-col items-center gap-1">
          <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-ink-900/90 px-2.5 py-1 text-[12px] font-medium text-slate-100 shadow-panel">
            <span className="h-2 w-2 rounded-full" style={{ background: STATUS_HEX[agent.status] }} />
            {agent.name}
            <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-amber-300" title={levelFromXp(agent.xp).name}>
              ⭐{levelFromXp(agent.xp).level}
            </span>
            {lifeIndicator && (
              <span
                className="flex h-[18px] w-[18px] items-center justify-center rounded-md"
                style={{ background: `${lifeIndicator.tint}26`, color: lifeIndicator.tint }}
              >
                <lifeIndicator.Icon size={12} strokeWidth={2.4} />
              </span>
            )}
            {agent.status === "working" && (
              <span className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="inline-block h-1 w-1 rounded-full bg-brand"
                    style={{ animation: `pulse 1.2s ${i * 0.2}s infinite` }}
                  />
                ))}
              </span>
            )}
          </div>
          {agent.task && agent.task.progress > 0 && agent.task.progress < 100 && (
            <div className="h-0.5 w-20 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-brand transition-all duration-700"
                style={{ width: `${agent.task.progress}%` }}
              />
            </div>
          )}
        </div>
      </Html>
      )}

      {/* in-world radial actions when selected */}
      {selected && !gardenOpen && (
        <Html position={[0, 1.4, 0]} center distanceFactor={9} zIndexRange={[40, 10]}>
          <RadialMenu items={items} color={hex} initial={agent.name.charAt(0).toUpperCase()} />
        </Html>
      )}
    </group>
  );
}
