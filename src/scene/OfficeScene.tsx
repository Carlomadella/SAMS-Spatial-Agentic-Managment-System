import { Suspense, useRef } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Grid, Html, OrbitControls, RoundedBox } from "@react-three/drei";
import {
  Desk,
  KanbanWall,
  LoungeSofa,
  Plant,
  SecurityGate,
  Vault,
  Whiteboard,
} from "./Furniture";
import { Agent3D } from "./Agent3D";
import { useStore } from "../store/useStore";
import {
  ROOM,
  ROOM_DEPTH,
  ROOM_WIDTH,
  ZONES,
} from "../data/world";
import type { Vec2, Zone } from "../types";

const WALL = "#eef2f9";
const FLOOR = "#e7ecf4";

function Floor() {
  const downPos = useRef<{ x: number; y: number } | null>(null);

  function onDown(e: ThreeEvent<PointerEvent>) {
    downPos.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
  }
  function onUp(e: ThreeEvent<PointerEvent>) {
    const start = downPos.current;
    downPos.current = null;
    if (!start) return;
    const moved = Math.hypot(e.nativeEvent.clientX - start.x, e.nativeEvent.clientY - start.y);
    if (moved > 6) return; // it was an orbit drag, not a click
    const { selectedAgentId, moveAgent } = useStore.getState();
    if (!selectedAgentId) return;
    e.stopPropagation();
    moveAgent(selectedAgentId, [e.point.x, e.point.z] as Vec2);
  }

  return (
    <group>
      {/* platform slab */}
      <RoundedBox
        args={[ROOM_WIDTH + 2, 0.5, ROOM_DEPTH + 2]}
        radius={0.12}
        smoothness={4}
        position={[0, -0.25, 0]}
        receiveShadow
      >
        <meshStandardMaterial color={FLOOR} roughness={0.95} />
      </RoundedBox>

      {/* click-catcher floor (also receives the move clicks) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, 0]}
        receiveShadow
        onPointerDown={onDown}
        onPointerUp={onUp}
      >
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <meshStandardMaterial color={FLOOR} roughness={0.95} />
      </mesh>

      <Grid
        position={[0, 0.004, 0]}
        args={[ROOM_WIDTH, ROOM_DEPTH]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#cdd6e4"
        sectionSize={4}
        sectionThickness={1}
        sectionColor="#b7c2d6"
        fadeDistance={42}
        fadeStrength={1.4}
        infiniteGrid={false}
      />

      {/* walls (back + left form an open L, matching the iso diorama) */}
      <mesh position={[0, ROOM.wallHeight / 2, ROOM.minZ - 0.15]} receiveShadow>
        <boxGeometry args={[ROOM_WIDTH + 2, ROOM.wallHeight, 0.3]} />
        <meshStandardMaterial color={WALL} roughness={0.9} />
      </mesh>
      <mesh position={[ROOM.minX - 0.15, ROOM.wallHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[0.3, ROOM.wallHeight, ROOM_DEPTH + 2]} />
        <meshStandardMaterial color={WALL} roughness={0.9} />
      </mesh>
    </group>
  );
}

function ZoneMarker({ zone }: { zone: Zone }) {
  const [x, z] = zone.position;

  function onClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    const { selectedAgentId, sendToZone } = useStore.getState();
    if (selectedAgentId) sendToZone(selectedAgentId, zone.id);
  }

  return (
    <group position={[x, 0, z]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.012, 0]}
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => (document.body.style.cursor = "default")}
      >
        <ringGeometry args={[0.62, 0.78, 40]} />
        <meshBasicMaterial color="#5b7da8" transparent opacity={0.45} />
      </mesh>
      <Html position={[0, 0.02, -1.05]} center distanceFactor={13} pointerEvents="none" zIndexRange={[10, 0]}>
        <div className="pointer-events-none select-none whitespace-nowrap rounded-md border border-slate-300/70 bg-white/90 px-2 py-1 text-center shadow-sm">
          <div className="text-[12px] font-semibold leading-tight text-slate-800">{zone.label}</div>
          <div className="text-[10px] leading-tight text-slate-500">{zone.sublabel}</div>
        </div>
      </Html>
    </group>
  );
}

function SceneContents() {
  const agents = useStore((s) => s.agents);
  const selectedAgentId = useStore((s) => s.selectedAgentId);

  return (
    <>
      <hemisphereLight args={["#ffffff", "#c9d3e3", 0.65]} />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[9, 15, 7]}
        intensity={1.25}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-bias={-0.0004}
      />

      <Floor />

      {/* furniture, placed against the back / left of the room */}
      <Vault position={[-6.4, 0, -4.6]} rotation={[0, 0.2, 0]} />
      <Whiteboard position={[-1.5, 0, -5.4]} />
      <KanbanWall position={[3.8, 0, -5.4]} />
      <Desk position={[0, 0, 1.6]} rotation={[0, Math.PI, 0]} />
      <SecurityGate position={[7.4, 0, 0.4]} rotation={[0, -Math.PI / 2, 0]} />
      <LoungeSofa position={[-6.6, 0, 2.4]} rotation={[0, 0.7, 0]} />
      <Plant position={[-7.6, 0, -1.2]} />
      <Plant position={[6.4, 0, -4.4]} />

      {ZONES.map((z) => (
        <ZoneMarker key={z.id} zone={z} />
      ))}

      {agents.map((a) => (
        <Agent3D key={a.id} agent={a} selected={a.id === selectedAgentId} />
      ))}
    </>
  );
}

export function OfficeScene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [13, 11, 14], fov: 32 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#eef2f7"]} />
      <fog attach="fog" args={["#eef2f7", 30, 58]} />
      <Suspense fallback={null}>
        <SceneContents />
      </Suspense>
      <OrbitControls
        target={[0, 0.8, 0]}
        enablePan={false}
        minDistance={9}
        maxDistance={34}
        maxPolarAngle={1.35}
        minPolarAngle={0.25}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
}
