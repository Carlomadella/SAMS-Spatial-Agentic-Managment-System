import { Suspense, useMemo, useRef } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Grid, Html, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
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
  WallClock,
  WallSconce,
  Window,
} from "./Furniture";
import { woodFloorTexture } from "./textures";
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
const WALL_LOWER = "#e4d8c4"; // wainscoting panel
const FLOOR = "#caa877";
const TRIM = "#f5eee1";
const BASEBOARD = "#dccbb0";

function Floor() {
  const downPos = useRef<{ x: number; y: number } | null>(null);
  const wood = useMemo(() => {
    const t = woodFloorTexture();
    t.repeat.set(4.5, 3);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return t;
  }, []);

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
      {/* platform slab (its solid sides form the raised-diorama edge) */}
      <RoundedBox
        args={[ROOM_WIDTH + 2, 0.5, ROOM_DEPTH + 2]}
        radius={0.12}
        smoothness={4}
        position={[0, -0.25, 0]}
        receiveShadow
      >
        <meshStandardMaterial color={FLOOR} roughness={0.95} />
      </RoundedBox>

      {/* wood parquet floor (also receives the move clicks) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.002, 0]}
        receiveShadow
        onPointerDown={onDown}
        onPointerUp={onUp}
      >
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <meshStandardMaterial map={wood} roughness={0.7} metalness={0.04} />
      </mesh>

      {/* a whisper of a grid to keep click-to-move legible */}
      <Grid
        position={[0, 0.006, 0]}
        args={[ROOM_WIDTH, ROOM_DEPTH]}
        cellSize={1}
        cellThickness={0.4}
        cellColor="#a98a5e"
        sectionSize={4}
        sectionThickness={0.7}
        sectionColor="#9c7a4c"
        fadeDistance={40}
        fadeStrength={2.2}
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

      {/* wainscoting on the lower third of each inner wall face */}
      <mesh position={[0, 0.55, ROOM.minZ + 0.03]}>
        <boxGeometry args={[ROOM_WIDTH + 2, 1.1, 0.04]} />
        <meshStandardMaterial color={WALL_LOWER} roughness={0.85} />
      </mesh>
      <mesh position={[ROOM.minX + 0.03, 0.55, 0]}>
        <boxGeometry args={[0.04, 1.1, ROOM_DEPTH + 2]} />
        <meshStandardMaterial color={WALL_LOWER} roughness={0.85} />
      </mesh>
      {/* chair rail (top edge of the wainscoting) */}
      <mesh position={[0, 1.12, ROOM.minZ + 0.06]}>
        <boxGeometry args={[ROOM_WIDTH + 2, 0.06, 0.06]} />
        <meshStandardMaterial color={TRIM} roughness={0.7} />
      </mesh>
      <mesh position={[ROOM.minX + 0.06, 1.12, 0]}>
        <boxGeometry args={[0.06, 0.06, ROOM_DEPTH + 2]} />
        <meshStandardMaterial color={TRIM} roughness={0.7} />
      </mesh>

      {/* baseboards */}
      <mesh position={[0, 0.09, ROOM.minZ + 0.05]}>
        <boxGeometry args={[ROOM_WIDTH + 2, 0.18, 0.06]} />
        <meshStandardMaterial color={BASEBOARD} roughness={0.8} />
      </mesh>
      <mesh position={[ROOM.minX + 0.05, 0.09, 0]}>
        <boxGeometry args={[0.06, 0.18, ROOM_DEPTH + 2]} />
        <meshStandardMaterial color={BASEBOARD} roughness={0.8} />
      </mesh>

      {/* crown molding along the top */}
      <mesh position={[0, ROOM.wallHeight - 0.08, ROOM.minZ + 0.04]}>
        <boxGeometry args={[ROOM_WIDTH + 2, 0.16, 0.1]} />
        <meshStandardMaterial color={TRIM} roughness={0.7} />
      </mesh>
      <mesh position={[ROOM.minX + 0.04, ROOM.wallHeight - 0.08, 0]}>
        <boxGeometry args={[0.1, 0.16, ROOM_DEPTH + 2]} />
        <meshStandardMaterial color={TRIM} roughness={0.7} />
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

      {/* gallery wall + ambiance */}
      <WallArt position={[-0.4, 1.85, -5.83]} />
      <WallArt position={[-7.0, 1.95, -5.83]} color="#6b8f8a" />
      <WallClock position={[1.1, 2.0, -5.83]} />
      <WallSconce position={[-4.9, 2.15, -5.78]} />
      <WallSconce position={[5.6, 2.15, -5.78]} />
      {/* a sconce on the left wall too */}
      <WallSconce position={[-8.78, 2.15, 2.4]} rotation={[0, Math.PI / 2, 0]} />

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
