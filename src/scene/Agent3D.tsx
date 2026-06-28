import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { CheckCheck, Eye, Moon, Play, Trash2 } from "lucide-react";
import { AGENT_HEX, type Agent, type AgentStatus } from "../types";
import { useStore } from "../store/useStore";
import { RadialMenu, type RadialItem } from "./RadialMenu";

const STATUS_HEX: Record<AgentStatus, string> = {
  idle: "#94a3b8",
  working: "#38bdf8",
  review: "#fbbf24",
  blocked: "#fb7185",
  done: "#34d399",
  awaiting_approval: "#a78bfa",
};

const SPEED = 2.7; // world units / second

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

export function Agent3D({ agent, selected }: { agent: Agent; selected: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const charRef = useRef<THREE.Group>(null); // upper body: bob + lean
  const ringRef = useRef<THREE.Mesh>(null);
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

  const [hovered, setHovered] = useState(false);

  const selectAgent = useStore((s) => s.selectAgent);
  const setStatus = useStore((s) => s.setStatus);
  const updateProgress = useStore((s) => s.updateProgress);
  const sendToZone = useStore((s) => s.sendToZone);
  const removeAgent = useStore((s) => s.removeAgent);

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

    const dest = agent.target ?? agent.position;
    const dx = dest[0] - cur.current.x;
    const dz = dest[1] - cur.current.z;
    const dist = Math.hypot(dx, dz);
    const moving = dist > 0.03;

    if (agent.target && dist < 0.06) {
      useStore.getState().arriveAgent(agent.id);
    }

    if (dist > 1e-4) {
      const step = Math.min(dist, SPEED * d);
      cur.current.x += (dx / dist) * step;
      cur.current.z += (dz / dist) * step;
    }
    g.position.x = cur.current.x;
    g.position.z = cur.current.z;

    // face direction of travel
    if (moving) {
      const targetRot = Math.atan2(dx, dz);
      g.rotation.y = dampAngle(g.rotation.y, targetRot, 9, d);
    }

    const t = state.clock.elapsedTime;
    const isTyping = agent.status === "working" && !moving;

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

    // idle look-around: build up over 4 s, decay fast when agent gets busy
    if (agent.status === "idle" && !moving) {
      idleTimer.current = Math.min(idleTimer.current + d, 60);
    } else {
      idleTimer.current = Math.max(0, idleTimer.current - d * 3);
    }
    const idleFactor = Math.min(1, idleTimer.current / 4);
    if (headGroupRef.current) {
      const lookY = agent.status === "idle" && !moving ? Math.sin(t * 0.45) * idleFactor * 0.45 : 0;
      headGroupRef.current.rotation.y = THREE.MathUtils.lerp(headGroupRef.current.rotation.y, lookY, 0.04);
    }

    // upper body: bob slightly deeper when bored
    const bob = moving ? Math.sin(t * 10) * 0.05 : isTyping ? Math.sin(t * 8) * 0.025 : Math.sin(t * 2.2) * (0.02 + idleFactor * 0.012);
    if (charRef.current) {
      charRef.current.position.y = bob + celebrateBump;
      charRef.current.rotation.x = THREE.MathUtils.lerp(
        charRef.current.rotation.x,
        moving ? 0.1 : isTyping ? 0.16 : 0,
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

    // blink (eyes squash on their own y axis)
    const bt = (t + blinkPhase) % 3.6;
    const ey = bt > 3.42 && bt < 3.54 ? 0.12 : 1;
    if (eyeLRef.current) eyeLRef.current.scale.y = ey;
    if (eyeRRef.current) eyeRRef.current.scale.y = ey;

    if (ringRef.current) {
      const s = 1 + Math.sin(t * 4) * 0.05;
      ringRef.current.scale.set(s, s, s);
    }
    if (haloRef.current) haloRef.current.rotation.y += d * 3;
  });

  function onSelect(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    selectAgent(agent.id);
  }

  const items: RadialItem[] = [
    { id: "work", label: "Set working", icon: Play, onClick: () => setStatus(agent.id, "working") },
    { id: "review", label: "Send to review", icon: Eye, onClick: () => setStatus(agent.id, "review") },
    {
      id: "done",
      label: "Mark done",
      icon: CheckCheck,
      onClick: () => (agent.task ? updateProgress(agent.id, 100) : setStatus(agent.id, "done")),
    },
    {
      id: "idle",
      label: "Send to lounge",
      icon: Moon,
      onClick: () => {
        sendToZone(agent.id, "lounge");
        setStatus(agent.id, "idle");
      },
    },
    { id: "remove", label: "Remove agent", icon: Trash2, danger: true, onClick: () => removeAgent(agent.id) },
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

      {/* the character (whole body is the click target) */}
      <group
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
      {hovered && !selected && (
        <Html position={[0.72, 1.7, 0]} distanceFactor={10} zIndexRange={[80, 60]} pointerEvents="none">
          <div className="pointer-events-none w-[148px] select-none rounded-xl border border-white/10 bg-ink-900/96 p-2 text-[11px] shadow-panel">
            <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-slate-100">
              <span className="h-2 w-2 rounded-full" style={{ background: STATUS_HEX[agent.status] }} />
              {agent.name}
            </div>
            <div className="flex justify-between text-mut">
              <span>Stato</span>
              <span className="capitalize text-slate-200">{agent.status}</span>
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
                <span className="text-mut">Progress</span>
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
      {bubble && (
        <Html position={[0, 2.95, 0]} center distanceFactor={11} zIndexRange={[70, 50]} pointerEvents="none">
          <div className="pointer-events-none relative max-w-[180px] select-none rounded-2xl border border-white/10 bg-ink-900/95 px-2.5 py-1.5 text-center text-[11px] leading-snug text-slate-100 shadow-panel">
            {bubble}
            <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-white/10 bg-ink-900/95" />
          </div>
        </Html>
      )}

      {/* name label */}
      <Html position={[0, 2.55, 0]} center distanceFactor={11} zIndexRange={[60, 40]} pointerEvents="none">
        <div className="pointer-events-none flex select-none items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-ink-900/90 px-2.5 py-1 text-[12px] font-medium text-slate-100 shadow-panel">
          <span className="h-2 w-2 rounded-full" style={{ background: STATUS_HEX[agent.status] }} />
          {agent.name}
        </div>
      </Html>

      {/* in-world radial actions when selected */}
      {selected && (
        <Html position={[0, 1.4, 0]} center distanceFactor={9} zIndexRange={[40, 10]}>
          <RadialMenu items={items} color={hex} initial={agent.name.charAt(0).toUpperCase()} />
        </Html>
      )}
    </group>
  );
}
