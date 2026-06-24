import { Suspense, useRef } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Grid, Html, OrbitControls, RoundedBox } from "@react-three/drei";
import {
  Armchair,
  Bookshelf,
  CoffeeTable,
  Desk,
  FloorLamp,
  FrontDoor,
  Plant,
  Rug,
  SideTable,
  Sideboard,
  Sofa,
  TableLamp,
  TVUnit,
  WallArt,
  Window,
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

const WALL = "#efe7da";
const FLOOR = "#d8c4a8";

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
        cellColor="#c9b79a"
        sectionSize={4}
        sectionThickness={1}
        sectionColor="#bda782"
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
      <Html position={[0, 0.04, -1.2]} center distanceFactor={10} pointerEvents="none" zIndexRange={[15, 0]}>
        <div className="pointer-events-none select-none whitespace-nowrap rounded-md border border-slate-300/60 bg-white/75 px-1.5 py-0.5 text-center shadow-sm">
          <div className="text-[11px] font-semibold leading-tight text-slate-700">{zone.label}</div>
          <div className="text-[9px] leading-tight text-slate-500">{zone.sublabel}</div>
        </div>
      </Html>
    </group>
  );
}

function GardenDoor() {
  const onOpen = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    useStore.getState().setGardenOpen(true);
  };
  return (
    <group position={[8, 0, ROOM.minZ + 0.16]}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[1.5, 2.4, 0.18]} />
        <meshStandardMaterial color="#2f6d45" roughness={0.6} />
      </mesh>
      <mesh
        position={[0, 1.15, 0.12]}
        onClick={onOpen}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => (document.body.style.cursor = "default")}
      >
        <boxGeometry args={[1.16, 2.05, 0.12]} />
        <meshStandardMaterial color="#5bbf7e" emissive="#2c7d43" emissiveIntensity={0.4} roughness={0.5} toneMapped={false} />
      </mesh>
      <mesh position={[0.42, 1.15, 0.2]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color="#eaf6ef" metalness={0.3} />
      </mesh>
      <group position={[1.18, 0, 0.15]}>
        <mesh position={[0, 0.2, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.12, 0.4, 12]} />
          <meshStandardMaterial color="#c2724a" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.56, 0]} castShadow>
          <sphereGeometry args={[0.28, 16, 16]} />
          <meshStandardMaterial color="#3aa657" roughness={0.8} />
        </mesh>
      </group>
      <Html position={[0, 2.78, 0.2]} center distanceFactor={11} zIndexRange={[40, 20]} pointerEvents="none">
        <div className="pointer-events-none select-none whitespace-nowrap rounded-full border border-emerald-600/30 bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 shadow-sm">
          🌿 Commit Garden — entra
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

      {/* cozy living-room layout (faces the open corner of the iso diorama) */}
      <Rug position={[-1.4, 0, 1.8]} />
      <Sofa position={[-1.4, 0, -0.2]} />
      <CoffeeTable position={[-1.4, 0, 1.8]} />
      <Armchair position={[2.4, 0, 1.9]} rotation={[0, -1.1, 0]} />
      <SideTable position={[-3.6, 0, 0.2]} />
      <TableLamp position={[-3.6, 0.59, 0.2]} />
      <FloorLamp position={[1.7, 0, -1.4]} />

      {/* pieces along the back / left walls */}
      <Sideboard position={[-6.6, 0, -5.45]} />
      <Bookshelf position={[-2.4, 0, -5.5]} />
      <TVUnit position={[3.6, 0, -5.5]} />
      <Window position={[6.9, 1.5, -5.84]} />
      <WallArt position={[0.3, 1.85, -5.84]} />

      {/* a small work desk tucked in the corner + greenery */}
      <Desk position={[6.2, 0, 3.4]} rotation={[0, -Math.PI / 2, 0]} />
      <Plant position={[-7.9, 0, -1.6]} />
      <Plant position={[5.6, 0, 4.2]} />

      <FrontDoor position={[8.5, 0, 1.2]} rotation={[0, -Math.PI / 2, 0]} />
      <GardenDoor />

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
      <color attach="background" args={["#f3ece0"]} />
      <fog attach="fog" args={["#f3ece0", 30, 58]} />
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
