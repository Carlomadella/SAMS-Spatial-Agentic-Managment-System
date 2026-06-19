import { Suspense, useMemo, useRef } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls, RoundedBox, SoftShadows } from "@react-three/drei";
import {
  Armchair,
  Bookshelf,
  CoffeeTable,
  Desk,
  FloorLamp,
  FrontDoor,
  Plant,
  Rug,
  Sideboard,
  SideTable,
  Sofa,
  TableLamp,
  TVUnit,
  WallArt,
  Window,
} from "./Furniture";
import { Agent3D } from "./Agent3D";
import { tileFloorTexture } from "./textures";
import { useStore } from "../store/useStore";
import {
  ROOM,
  ROOM_DEPTH,
  ROOM_WIDTH,
  ZONES,
} from "../data/world";
import type { Vec2, Zone } from "../types";

// flat, bright Habbo-style room palette
const WALL_TOP = "#d7dee6"; // cool light plaster
const WALL_LOWER = "#b9c4cf"; // wainscot band
const WALL_TRIM = "#eef2f6";
const FLOOR_EDGE = "#b79a63";

function Floor() {
  const downPos = useRef<{ x: number; y: number } | null>(null);
  const tiles = useMemo(() => tileFloorTexture(), []);

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
      {/* raised tile platform (the classic Habbo room slab) */}
      <RoundedBox
        args={[ROOM_WIDTH + 1.6, 0.6, ROOM_DEPTH + 1.6]}
        radius={0.06}
        smoothness={2}
        position={[0, -0.3, 0]}
        receiveShadow
      >
        <meshStandardMaterial color={FLOOR_EDGE} roughness={0.85} />
      </RoundedBox>

      {/* checkerboard tile floor (also receives the move clicks) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, 0]}
        receiveShadow
        onPointerDown={onDown}
        onPointerUp={onUp}
      >
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <meshStandardMaterial map={tiles} roughness={0.85} metalness={0} />
      </mesh>

      {/* --- walls: flat upper plaster + darker wainscot + trim line ------- */}
      {/* back wall */}
      <mesh position={[0, ROOM.wallHeight / 2, ROOM.minZ - 0.15]} receiveShadow>
        <boxGeometry args={[ROOM_WIDTH + 1.6, ROOM.wallHeight, 0.3]} />
        <meshStandardMaterial color={WALL_TOP} roughness={1} />
      </mesh>
      <mesh position={[0, 0.55, ROOM.minZ + 0.01]}>
        <boxGeometry args={[ROOM_WIDTH + 1.6, 1.1, 0.04]} />
        <meshStandardMaterial color={WALL_LOWER} roughness={1} />
      </mesh>
      <mesh position={[0, 1.12, ROOM.minZ + 0.02]}>
        <boxGeometry args={[ROOM_WIDTH + 1.6, 0.06, 0.05]} />
        <meshStandardMaterial color={WALL_TRIM} roughness={0.8} />
      </mesh>

      {/* left wall */}
      <mesh position={[ROOM.minX - 0.15, ROOM.wallHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[0.3, ROOM.wallHeight, ROOM_DEPTH + 1.6]} />
        <meshStandardMaterial color={WALL_TOP} roughness={1} />
      </mesh>
      <mesh position={[ROOM.minX + 0.01, 0.55, 0]}>
        <boxGeometry args={[0.04, 1.1, ROOM_DEPTH + 1.6]} />
        <meshStandardMaterial color={WALL_LOWER} roughness={1} />
      </mesh>
      <mesh position={[ROOM.minX + 0.02, 1.12, 0]}>
        <boxGeometry args={[0.05, 0.06, ROOM_DEPTH + 1.6]} />
        <meshStandardMaterial color={WALL_TRIM} roughness={0.8} />
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
      {/* Habbo-style square tile highlight */}
      <mesh
        rotation={[-Math.PI / 2, 0, Math.PI / 4]}
        position={[0, 0.03, 0]}
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => (document.body.style.cursor = "default")}
      >
        <planeGeometry args={[1.18, 1.18]} />
        <meshBasicMaterial color="#3fd0e0" transparent opacity={0.32} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[0, 0.031, 0]}>
        <ringGeometry args={[0.78, 0.84, 4]} />
        <meshBasicMaterial color="#23b8cc" transparent opacity={0.8} />
      </mesh>
      <Html position={[0, 0.02, -1.05]} center distanceFactor={13} pointerEvents="none" zIndexRange={[10, 0]}>
        <div className="pointer-events-none select-none whitespace-nowrap rounded-md border border-cyan-200/70 bg-white/90 px-2 py-1 text-center shadow-sm">
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
      {/* a touch of softness so furniture still grounds, but mostly flat */}
      <SoftShadows size={18} samples={10} focus={0.8} />

      {/* flat, bright, evenly-lit Habbo room */}
      <hemisphereLight args={["#ffffff", "#c4cdd8", 0.55]} />
      <ambientLight intensity={0.85} />
      {/* single soft key for gentle definition (kept low so it reads flat) */}
      <directionalLight
        position={[10, 18, 8]}
        intensity={0.85}
        color="#ffffff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-8, 10, -6]} intensity={0.25} color="#eaf0ff" />

      <Floor />

      <ContactShadows
        position={[0, 0.02, 0]}
        scale={ROOM_WIDTH + 6}
        resolution={1024}
        far={5}
        blur={2.4}
        opacity={0.26}
        color="#2a3550"
      />

      {/* ---- furnished room ------------------------------------------------- */}
      <Sideboard position={[-6.4, 0, -5.4]} />
      <Bookshelf position={[-1.8, 0, -5.5]} />
      <Window position={[2.4, 1.6, -5.78]} />
      <TVUnit position={[5.4, 0, -5.45]} />

      <WallArt position={[-8.62, 1.9, -1.6]} rotation={[0, Math.PI / 2, 0]} color="#ef7d52" />
      <WallArt position={[-8.62, 1.9, 0.4]} rotation={[0, Math.PI / 2, 0]} color="#4fb0c0" />

      <Rug position={[-4.6, 0, 2.2]} size={[6, 4.2]} />
      <Sofa position={[-6.2, 0, 2.7]} rotation={[0, 0.95, 0]} />
      <Armchair position={[-2.3, 0, 3.4]} rotation={[0, -2.1, 0]} />
      <CoffeeTable position={[-4.5, 0, 2.3]} rotation={[0, 0.25, 0]} />
      <FloorLamp position={[-7.7, 0, 0.9]} />
      <SideTable position={[-7.6, 0, 4.0]} />

      <Desk position={[1.2, 0, 2.6]} rotation={[0, Math.PI, 0]} />
      <TableLamp position={[2.4, 0.92, 2.9]} />

      <FrontDoor position={[8.4, 0, 0.4]} rotation={[0, -Math.PI / 2, 0]} />

      <Plant position={[-8.1, 0, -3.6]} />
      <Plant position={[7.4, 0, 3.6]} />

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
      orthographic
      dpr={0.62} // low internal resolution → upscaled = chunky pixel-art look
      className="habbo-canvas"
      camera={{ position: [18, 14, 18], zoom: 32, near: 0.1, far: 400 }}
      gl={{ antialias: false }}
    >
      <color attach="background" args={["#aeb8c4"]} />
      <Suspense fallback={null}>
        <SceneContents />
      </Suspense>
      <OrbitControls
        target={[0, 0.8, 0]}
        enablePan={false}
        minZoom={18}
        maxZoom={80}
        maxPolarAngle={1.2}
        minPolarAngle={0.2}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
}
