import { useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
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
};

const SPEED = 2.7; // world units / second

function dampAngle(current: number, target: number, lambda: number, dt: number) {
  let diff = target - current;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest path
  return current + diff * (1 - Math.exp(-lambda * dt));
}

export function Agent3D({ agent, selected }: { agent: Agent; selected: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const charRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const armLRef = useRef<THREE.Group>(null);
  const armRRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Group>(null);
  const cur = useRef(new THREE.Vector3(agent.position[0], 0, agent.position[1]));

  const selectAgent = useStore((s) => s.selectAgent);
  const setStatus = useStore((s) => s.setStatus);
  const updateProgress = useStore((s) => s.updateProgress);
  const sendToZone = useStore((s) => s.sendToZone);
  const removeAgent = useStore((s) => s.removeAgent);

  const hex = AGENT_HEX[agent.color];

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

    // bob / breathe
    const t = state.clock.elapsedTime;
    const bob = moving ? Math.sin(t * 11) * 0.07 : Math.sin(t * 2.2) * 0.02;
    if (charRef.current) charRef.current.position.y = bob;

    if (ringRef.current) {
      const s = 1 + Math.sin(t * 4) * 0.05;
      ringRef.current.scale.set(s, s, s);
    }

    // limbs swing while walking; gentle idle sway otherwise
    const swing = moving ? Math.sin(t * 11) * 0.6 : Math.sin(t * 2.2) * 0.12;
    if (armLRef.current) armLRef.current.rotation.x = swing;
    if (armRRef.current) armRRef.current.rotation.x = -swing;
    // "working" orbiter spins above the head
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

      {/* the character */}
      <group
        ref={charRef}
        onPointerDown={onSelect}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "default";
        }}
      >
        {/* body */}
        <mesh position={[0, 0.62, 0]} castShadow>
          <capsuleGeometry args={[0.32, 0.5, 8, 20]} />
          <meshStandardMaterial color={hex} roughness={0.5} metalness={0.08} />
        </mesh>
        {/* arms (swing while walking) */}
        <group ref={armLRef} position={[-0.34, 0.92, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.26, 6, 12]} />
            <meshStandardMaterial color={hex} roughness={0.5} metalness={0.08} />
          </mesh>
        </group>
        <group ref={armRRef} position={[0.34, 0.92, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.26, 6, 12]} />
            <meshStandardMaterial color={hex} roughness={0.5} metalness={0.08} />
          </mesh>
        </group>
        {/* head */}
        <mesh position={[0, 1.28, 0]} castShadow>
          <sphereGeometry args={[0.3, 28, 28]} />
          <meshStandardMaterial color={hex} roughness={0.45} metalness={0.08} />
        </mesh>
        {/* eyes */}
        <mesh position={[-0.11, 1.32, 0.26]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color="#0b0e14" roughness={0.3} />
        </mesh>
        <mesh position={[0.11, 1.32, 0.26]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color="#0b0e14" roughness={0.3} />
        </mesh>
        {/* antenna */}
        <mesh position={[0, 1.68, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.2, 8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.4} roughness={0.4} />
        </mesh>
        <mesh position={[0, 1.82, 0]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial
            color={STATUS_HEX[agent.status]}
            emissive={STATUS_HEX[agent.status]}
            emissiveIntensity={agent.status === "working" ? 1.6 : 0.8}
            toneMapped={false}
          />
        </mesh>
        {/* "working" orbiter */}
        {agent.status === "working" && (
          <group ref={haloRef} position={[0, 1.98, 0]}>
            <mesh position={[0.2, 0, 0]}>
              <sphereGeometry args={[0.05, 12, 12]} />
              <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.6} toneMapped={false} />
            </mesh>
          </group>
        )}
      </group>

      {/* name label */}
      <Html position={[0, 2.4, 0]} center distanceFactor={11} zIndexRange={[60, 40]} pointerEvents="none">
        <div className="pointer-events-none flex select-none items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-ink-900/90 px-2.5 py-1 text-[12px] font-medium text-slate-100 shadow-panel">
          <span className="h-2 w-2 rounded-full" style={{ background: STATUS_HEX[agent.status] }} />
          {agent.name}
        </div>
      </Html>

      {/* in-world radial actions when selected */}
      {selected && (
        <Html position={[0, 1.28, 0]} center distanceFactor={9} zIndexRange={[40, 10]}>
          <RadialMenu items={items} color={hex} initial={agent.name.charAt(0).toUpperCase()} />
        </Html>
      )}
    </group>
  );
}
