import React, { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Grid, Html, Line, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  Armchair,
  Bed,
  Bookshelf,
  CoffeeTable,
  Desk,
  FloorLamp,
  Fridge,
  FrontDoor,
  KitchenCounter,
  KitchenIsland,
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
import { monitorView, queueBoard } from "../lib/sceneDisplays";
import { getWeather, type Precipitation as PrecipKind } from "../lib/weather";
import { coffeeBreak, officeClockChime } from "../lib/interactions";
import { AGENT_HEX } from "../types";
import { useStore } from "../store/useStore";
import {
  ROOM,
  ROOM_DEPTH,
  ROOM_WIDTH,
  WALLS,
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
    t.repeat.set(6.5, 4.5);
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
    const { selectedAgentId, moveAgent, selectAgent } = useStore.getState();
    if (!selectedAgentId) return;
    e.stopPropagation();
    if (e.nativeEvent.button === 2) {
      // right-click on the floor unlocks from the agent (also frees the camera)
      selectAgent(null);
      return;
    }
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

      {/* outer walls: back + left + right (front stays open for the iso view) */}
      <mesh position={[0, ROOM.wallHeight / 2, ROOM.minZ - 0.15]} receiveShadow>
        <boxGeometry args={[ROOM_WIDTH + 2, ROOM.wallHeight, 0.3]} />
        <meshStandardMaterial color={WALL} roughness={0.9} />
      </mesh>
      <mesh position={[ROOM.minX - 0.15, ROOM.wallHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[0.3, ROOM.wallHeight, ROOM_DEPTH + 2]} />
        <meshStandardMaterial color={WALL} roughness={0.9} />
      </mesh>
      <mesh position={[ROOM.maxX + 0.15, ROOM.wallHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[0.3, ROOM.wallHeight, ROOM_DEPTH + 2]} />
        <meshStandardMaterial color={WALL} roughness={0.9} />
      </mesh>

      {/* internal walls — rendered straight from the WALLS data so what you see is
          exactly what the pathfinder treats as solid (gaps are doorways) */}
      {WALLS.map((w, i) => {
        const cx = (w.minX + w.maxX) / 2;
        const cz = (w.minZ + w.maxZ) / 2;
        const sx = w.maxX - w.minX;
        const sz = w.maxZ - w.minZ;
        return (
          <mesh key={i} position={[cx, ROOM.wallHeight / 2, cz]} castShadow receiveShadow>
            <boxGeometry args={[sx, ROOM.wallHeight, sz]} />
            <meshStandardMaterial color={WALL} roughness={0.9} />
          </mesh>
        );
      })}

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
    <group position={[-6, 0, ROOM.minZ + 0.16]}>
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

/**
 * Hotspot cliccabile dall'utente: cursore a mano, `stopPropagation` così non
 * muove l'agente selezionato, un'etichetta al passaggio del mouse e un'azione
 * one-shot al click. È il mattone degli "oggetti interagibili" della stanza.
 */
function Interactable({
  position, rotation, title, onActivate, children,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  title: string;
  onActivate: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <group
      position={position}
      rotation={rotation}
      onClick={(e) => { e.stopPropagation(); onActivate(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = "default"; }}
    >
      {children}
      {hover && (
        <Html position={[0, 0.5, 0]} center distanceFactor={9} zIndexRange={[40, 20]} pointerEvents="none">
          <div className="pointer-events-none select-none whitespace-nowrap rounded-full border border-amber-500/40 bg-white/85 px-2 py-0.5 text-[10px] font-semibold text-amber-800 shadow-sm">
            {title}
          </div>
        </Html>
      )}
    </group>
  );
}

/** Drives the directional light and scene background from the REAL time of day. */
function DayNightCycle() {
  const dirRef = useRef<THREE.DirectionalLight>(null);
  const ambRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);

  // Pre-allocate color objects — never `new THREE.Color()` inside useFrame
  const bgDay   = useMemo(() => new THREE.Color("#f3ece0"), []);
  const bgNight  = useMemo(() => new THREE.Color("#0d1520"), []);
  const skyDay   = useMemo(() => new THREE.Color("#ffffff"), []);
  const skyNight = useMemo(() => new THREE.Color("#1a2550"), []);
  const gndDay   = useMemo(() => new THREE.Color("#c9d3e3"), []);
  const gndNight = useMemo(() => new THREE.Color("#0e1020"), []);
  const bgTemp   = useMemo(() => new THREE.Color("#f3ece0"), []);

  // Tinta stagionale: velo sottile applicato alla luce diurna (svanisce di notte).
  const weather  = useMemo(() => getWeather(), []);
  const tintCol  = useMemo(() => new THREE.Color(weather.tint), [weather.tint]);

  const { scene } = useThree();

  useFrame(() => {
    const now = new Date();
    const t = (now.getHours() + now.getMinutes() / 60) / 24; // 0..1 across the real day
    // sunAngle: -π/2 at midnight (t=0), π/2 at noon (t=0.5)
    const sunAngle = t * Math.PI * 2 - Math.PI / 2;
    const sunY = Math.sin(sunAngle);          // -1 (night) … +1 (noon)
    const sunX = Math.cos(sunAngle);
    const dayness = Math.max(0, sunY);        // 0..1, zero when sun is below horizon

    if (dirRef.current) {
      dirRef.current.position.set(sunX * 14, Math.max(sunY * 14, -3), 7);
      dirRef.current.intensity = 0.15 + dayness * 1.2;
    }
    if (ambRef.current) ambRef.current.intensity = 0.2 + dayness * 0.45;
    if (hemiRef.current) {
      hemiRef.current.color.lerpColors(skyNight, skyDay, dayness);
      hemiRef.current.groundColor.lerpColors(gndNight, gndDay, dayness);
    }

    bgTemp.lerpColors(bgNight, bgDay, dayness);
    // inclina il fondale verso la tinta stagionale, ma solo di giorno e di poco
    bgTemp.lerp(tintCol, weather.tintStrength * dayness);
    scene.background = bgTemp;
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(bgTemp);
  });

  return (
    <>
      <hemisphereLight ref={hemiRef} args={["#ffffff", "#c9d3e3", 0.65]} />
      <ambientLight ref={ambRef} intensity={0.55} />
      <directionalLight
        ref={dirRef}
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
    </>
  );
}

const HANDOFF_LIFE = 3.2; // seconds an arc stays on screen

/** A single relay arc: a dashed bezier from sender→target with a travelling pulse. */
function HandoffArc({ from, to, color, born }: { from: Vec2; to: Vec2; color: string; born: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  const curve = useMemo(() => {
    const a = new THREE.Vector3(from[0], 1.7, from[1]);
    const b = new THREE.Vector3(to[0], 1.7, to[1]);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y += 2.0 + a.distanceTo(b) * 0.14;
    return new THREE.QuadraticBezierCurve3(a, mid, b);
  }, [from, to]);
  const points = useMemo(() => curve.getPoints(36), [curve]);

  useFrame(() => {
    const age = (Date.now() - born) / 1000;
    const k = age / HANDOFF_LIFE;
    if (groupRef.current) groupRef.current.visible = k < 1;
    if (pulseRef.current) {
      const p = curve.getPoint(Math.min(1, age / 1.1)); // pulse rides from sender to target
      pulseRef.current.position.copy(p);
      pulseRef.current.scale.setScalar(Math.max(0.01, 0.16 * (1 - Math.min(1, k))));
    }
  });

  return (
    <group ref={groupRef}>
      <Line points={points} color={color} lineWidth={2.5} transparent opacity={0.5} dashed dashSize={0.3} gapSize={0.18} />
      <mesh ref={pulseRef}>
        <sphereGeometry args={[0.16, 14, 14]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Draws every active task handoff as an animated 3D arc between the two agents. */
function Handoffs() {
  const handoffs = useStore((s) => s.handoffs);
  const agents = useStore((s) => s.agents);
  const locate = (id: string): Vec2 | null => {
    const a = agents.find((x) => x.id === id);
    return a ? a.target ?? a.position : null;
  };
  return (
    <>
      {handoffs.map((h) => {
        const from = locate(h.fromId);
        const to = locate(h.toId);
        if (!from || !to) return null;
        const sender = agents.find((x) => x.id === h.fromId);
        return (
          <HandoffArc key={h.id} from={from} to={to} color={sender ? AGENT_HEX[sender.color] : "#ffffff"} born={h.ts} />
        );
      })}
    </>
  );
}

/**
 * Una cortina di particelle che cadono oltre i vetri (neve/pioggia/petali).
 * Puramente decorativa: ogni mota che tocca il pavimento viene riciclata in
 * alto. La geometria e la dinamica cambiano col tipo di precipitazione.
 */
function WeatherCurtain({
  kind, color, count, spanX, spanZ, center,
}: {
  kind: Exclude<PrecipKind, "none">;
  color: string;
  count: number;
  spanX: number;
  spanZ: number;
  center: [number, number, number];
}) {
  const ref = useRef<THREE.Group>(null);
  const top = 9; // altezza da cui ricadono le particelle
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() * 2 - 1) * spanX * 0.5,
        z: (Math.random() * 2 - 1) * spanZ * 0.5,
        y: Math.random() * top,
        phase: Math.random() * Math.PI * 2,
        sway: 0.4 + Math.random() * 0.8,
        speed: 0.7 + Math.random() * 0.6,
        spin: Math.random() * Math.PI,
      })),
    [count, spanX, spanZ],
  );
  const fall = kind === "rain" ? 7 : kind === "petals" ? 1.1 : 0.9;
  const swayAmp = kind === "rain" ? 0 : kind === "petals" ? 0.5 : 0.35;

  useFrame((state, delta) => {
    const g = ref.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const d = Math.min(delta, 0.05);
    g.children.forEach((child, i) => {
      const s = seeds[i];
      child.position.y -= s.speed * fall * d;
      if (child.position.y < 0) child.position.y = top;
      child.position.x = s.x + Math.sin(t * s.sway + s.phase) * swayAmp;
      if (kind === "petals") child.rotation.z = s.spin + t * s.sway;
    });
  });

  return (
    <group ref={ref} position={center}>
      {seeds.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, s.z]} rotation={[0, 0, s.spin]}>
          {kind === "rain" ? (
            <boxGeometry args={[0.015, 0.4, 0.015]} />
          ) : kind === "petals" ? (
            <planeGeometry args={[0.12, 0.08]} />
          ) : (
            <sphereGeometry args={[0.05, 8, 8]} />
          )}
          <meshBasicMaterial
            color={color}
            transparent
            opacity={kind === "rain" ? 0.35 : kind === "petals" ? 0.8 : 0.85}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Meteo stagionale visto oltre le finestre: due cortine (parete di fondo e
 * parete-finestra a destra). Nessuna particella quando il cielo è sereno.
 */
function Weather() {
  const weather = useMemo(() => getWeather(), []);
  if (weather.precipitation === "none") return null;
  const kind = weather.precipitation;
  const color = weather.particleColor;
  return (
    <>
      <WeatherCurtain
        kind={kind}
        color={color}
        count={kind === "rain" ? 70 : 44}
        spanX={ROOM_WIDTH + 4}
        spanZ={1.6}
        center={[0, 0, ROOM.minZ - 1.4]}
      />
      <WeatherCurtain
        kind={kind}
        color={color}
        count={kind === "rain" ? 40 : 26}
        spanX={1.6}
        spanZ={ROOM_DEPTH}
        center={[ROOM.maxX + 1.4, 0, 1]}
      />
    </>
  );
}

function SceneContents() {
  const agents = useStore((s) => s.agents);
  const selectedAgentId = useStore((s) => s.selectedAgentId);
  const workingAgent = agents.find((a) => a.status === "working" && a.task) ?? null;
  const monitor = monitorView(workingAgent);
  const queue = queueBoard(agents);

  return (
    <>
      <DayNightCycle />
      <Weather />

      <Floor />

      {/* ── Studio — back-left quadrant ── */}
      <Desk position={[-9, 0, -7.85]} />
      <Desk position={[-4.5, 0, -7.85]} />
      {/* live desk monitor — the file the working agent is writing right now */}
      <Html position={[-9, 1.62, -8.04]} center distanceFactor={6} zIndexRange={[9, 0]} pointerEvents="none">
        <div className="pointer-events-none w-[230px] select-none overflow-hidden rounded-[3px] bg-[#0b0f17] p-1.5 font-mono shadow-inner ring-1 ring-inset ring-sky-900/50">
          {monitor ? (
            <>
              <div className="mb-1 flex items-center gap-1 text-[8px] uppercase tracking-wider text-sky-600">
                <span className={monitor.status === "writing" ? "text-emerald-400" : "text-amber-400"}>
                  {monitor.status === "writing" ? "✎ scrive" : "✷ pianifica"}
                </span>
                <span className="truncate text-slate-500">{monitor.path}</span>
              </div>
              {monitor.lines.map((l, i) => (
                <div key={i} className="flex gap-1 text-[9px] leading-[1.35]">
                  <span className="w-3 shrink-0 text-right text-slate-700">{i + 1}</span>
                  <span className="truncate text-sky-200/90">
                    {l}
                    {i === monitor.lines.length - 1 && <span className="ml-0.5 animate-pulse text-emerald-300">█</span>}
                  </span>
                </div>
              ))}
              <div className="mt-1 text-[7px] text-slate-600">— {monitor.agentName} · {monitor.branch}</div>
            </>
          ) : (
            <div className="py-3 text-center text-[9px] text-slate-700">// nessun agente al lavoro</div>
          )}
        </div>
      </Html>
      <Bookshelf position={[-12, 0, -8.55]} />
      <FloorLamp position={[-11, 0, -1.6]} />
      <Plant position={[-1.6, 0, -7.5]} />
      <WallArt position={[-7, 1.9, -8.84]} color="#6b8f8a" />
      <WallSconce position={[-12.82, 2.15, -4]} rotation={[0, Math.PI / 2, 0]} />

      {/* ── Cucina — back-right quadrant ── */}
      <KitchenCounter position={[6.5, 0, -8.2]} length={10} />
      <Fridge position={[12.2, 0, -7.6]} rotation={[0, -Math.PI / 2, 0]} />
      <KitchenIsland position={[6.5, 0, -3.8]} />
      <WallSconce position={[3, 2.15, -8.84]} />
      <WallSconce position={[10, 2.15, -8.84]} />

      {/* ── Salotto — front-left quadrant ── */}
      <Rug position={[-7.5, 0, 3.8]} />
      <Sofa position={[-7.5, 0, 2.3]} />
      <CoffeeTable position={[-7.5, 0, 4.2]} />
      <Armchair position={[-4, 0, 4.3]} rotation={[0, 0.8, 0]} />
      <SideTable position={[-9.4, 0, 2]} />
      <TableLamp position={[-9.4, 0.59, 2]} />
      <TVUnit position={[-12.5, 0, 4.5]} rotation={[0, Math.PI / 2, 0]} />
      {/* media wall — the "up next" board: tasks queued across all agents */}
      <Html position={[-12.0, 1.55, 4.5]} center distanceFactor={7} zIndexRange={[8, 0]} pointerEvents="none">
        <div className="pointer-events-none w-[200px] select-none overflow-hidden rounded-sm bg-[#080d14] p-1.5 font-mono text-green-400 shadow-inner ring-1 ring-inset ring-green-900/40">
          <div className="mb-1 flex items-center justify-between text-[8px] uppercase tracking-widest text-green-700">
            <span>◉ in coda</span>
            <span>{queue.length}</span>
          </div>
          {queue.length ? (
            <div className="flex flex-col gap-0.5">
              {queue.map((q, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: AGENT_HEX[q.color] }} />
                  <span className="truncate text-[9px] leading-tight text-green-300/90">{q.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-2 text-[9px] text-green-800">nessun task in coda_</div>
          )}
        </div>
      </Html>
      <WallArt position={[-9, 1.9, 0.25]} />
      <WallClock position={[-12.84, 2.1, 6.5]} rotation={[0, Math.PI / 2, 0]} />
      <FrontDoor position={[-11, 0, 8.6]} />

      {/* ── Camera — front-right quadrant (six beds, one per agent) ── */}
      {([
        [3.0, 2.4, "#6b8f8a"], [6.5, 2.4, "#b07a5e"], [10.0, 2.4, "#8a6f9e"],
        [3.0, 6.0, "#5a8fb0"], [6.5, 6.0, "#b0975a"], [10.0, 6.0, "#8aae6a"],
      ] as [number, number, string][]).map(([x, z, c], i) => (
        <Bed key={i} position={[x, 0, z]} color={c} />
      ))}
      <Sideboard position={[12.4, 0, 5]} rotation={[0, -Math.PI / 2, 0]} />
      <Window position={[12.84, 1.5, 2]} rotation={[0, -Math.PI / 2, 0]} />
      <WallSconce position={[12.82, 2.15, 7.5]} rotation={[0, -Math.PI / 2, 0]} />
      <Plant position={[1.3, 0, 8.2]} />

      <GardenDoor />

      {/* ── Oggetti interagibili dell'utente (micro-interazioni) ── */}
      {/* Tazza sul piano cucina → pausa caffè: sazia tutti gli agenti affamati */}
      <Interactable
        position={[6.5, 1.06, -3.8]}
        title="☕ Pausa caffè per tutti"
        onActivate={() => {
          const { agents, feedAgent, pushToast } = useStore.getState();
          const r = coffeeBreak(agents);
          r.fedIds.forEach((id) => feedAgent(id, r.amount));
          pushToast("SUCCESS", r.message);
        }}
      >
        <mesh castShadow>
          <cylinderGeometry args={[0.1, 0.08, 0.16, 16]} />
          <meshStandardMaterial color="#f2efe9" roughness={0.5} />
        </mesh>
        <mesh position={[0.12, 0, 0]}>
          <torusGeometry args={[0.05, 0.018, 8, 16]} />
          <meshStandardMaterial color="#f2efe9" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.078, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.088, 16]} />
          <meshStandardMaterial color="#5a3a22" roughness={0.4} />
        </mesh>
      </Interactable>
      {/* Lavagna della coda (media wall) → apre il tab Task */}
      <Interactable
        position={[-11.9, 1.55, 4.5]}
        rotation={[0, Math.PI / 2, 0]}
        title="📋 Apri i task in coda"
        onActivate={() => useStore.getState().setBottomTab("tasks")}
      >
        <mesh>
          <planeGeometry args={[2.2, 1.4]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </Interactable>
      {/* Orologio a muro → rintocca l'ora e la fase della giornata */}
      <Interactable
        position={[-12.7, 2.1, 6.5]}
        rotation={[0, Math.PI / 2, 0]}
        title="🕰️ Che ore sono?"
        onActivate={() => useStore.getState().pushToast("INFO", officeClockChime())}
      >
        <mesh>
          <circleGeometry args={[0.36, 24]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </Interactable>

      {ZONES.map((z) => (
        <ZoneMarker key={z.id} zone={z} />
      ))}

      {agents.map((a) => (
        <Agent3D key={a.id} agent={a} selected={a.id === selectedAgentId} />
      ))}

      <Handoffs />
    </>
  );
}

/**
 * Cinematic follow camera. On selection it smoothly recenters on the agent and
 * dollies in to a framing distance; while the agent walks it gently tracks it;
 * on deselection it eases back to the room centre. The dolly only runs during
 * the brief transition so manual orbit/zoom stays free afterwards.
 */
function CameraFollow({ controlsRef }: { controlsRef: React.RefObject<{ target: THREE.Vector3; update(): void } | null> }) {
  const { camera } = useThree();
  // Scratch vectors reused every frame — never allocate inside useFrame.
  const agentVec = useMemo(() => new THREE.Vector3(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const roomCenter = useMemo(() => new THREE.Vector3(0, 0.8, 0), []);
  const prevSelected = useRef<string | null>(null);
  const transition = useRef(0); // 1 → 0 over the cinematic ease-in/out

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const d = Math.min(delta, 0.05);
    const { selectedAgentId, agents } = useStore.getState();

    // A change of selection (including deselect) starts a smooth ~0.8 s move.
    if (selectedAgentId !== prevSelected.current) {
      prevSelected.current = selectedAgentId;
      transition.current = 1;
    }

    if (selectedAgentId) {
      const agent = agents.find((a) => a.id === selectedAgentId);
      if (!agent) return;
      const dest = agent.target ?? agent.position;
      agentVec.set(dest[0], 0.9, dest[1]);
      // Snappier recentering during the transition, gentle tracking afterwards.
      controls.target.lerp(agentVec, transition.current > 0 ? 0.07 : 0.03);
      // Dolly toward a framing distance only while transitioning.
      if (transition.current > 0) {
        offset.copy(camera.position).sub(controls.target);
        const dist = offset.length() || 1;
        const framed = THREE.MathUtils.clamp(dist, 9, 13);
        offset.setLength(THREE.MathUtils.lerp(dist, framed, 0.05));
        camera.position.copy(controls.target).add(offset);
        transition.current = Math.max(0, transition.current - d / 0.8);
      }
      controls.update();
    } else if (transition.current > 0) {
      // Deselected: ease the camera target back to the room centre.
      controls.target.lerp(roomCenter, 0.05);
      transition.current = Math.max(0, transition.current - d / 0.8);
      controls.update();
    }
  });
  return null;
}

export function OfficeScene() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [13, 11, 14], fov: 32 }}
      gl={{ antialias: true }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <color attach="background" args={["#f3ece0"]} />
      <fog attach="fog" args={["#f3ece0", 30, 58]} />
      <Suspense fallback={null}>
        <SceneContents />
      </Suspense>
      <OrbitControls
        ref={controlsRef}
        target={[0, 0.8, 0]}
        enablePan={false}
        zoomToCursor
        minDistance={9}
        maxDistance={34}
        maxPolarAngle={1.35}
        minPolarAngle={0.25}
        enableDamping
        dampingFactor={0.08}
      />
      <CameraFollow controlsRef={controlsRef} />
    </Canvas>
  );
}
