import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { grassTexture } from "./textures";
import { STAGE_LABEL, type GardenState, type Stage } from "../lib/garden";

type Vec3 = [number, number, number];

// ---------------------------------------------------------------------------
// Base palette constants (defaults / fallbacks)
// ---------------------------------------------------------------------------
const LEAF  = "#4f9d69";
const STONE = "#b9b0a2";
const SOIL  = "#6b4f3a";
const WOOD  = "#a9763f";

// ---------------------------------------------------------------------------
// Season + Biome system
// ---------------------------------------------------------------------------
type Season = "spring" | "summer" | "autumn" | "winter";
type Biome  = "oak" | "pine" | "birch";

interface BiomePalette { leaf: string; leafDark: string; trunk: string }

const BIOME_PALETTES: Record<Biome, BiomePalette> = {
  oak:   { leaf: "#4f9d69", leafDark: "#3f8f5a", trunk: "#7a5230" },
  pine:  { leaf: "#2d7a50", leafDark: "#1f5f3a", trunk: "#6b4226" },
  birch: { leaf: "#74c27c", leafDark: "#5aac62", trunk: "#b0a898" },
};

const SEASON_SKY: Record<Season, { sky: string; fog: string; sunIntensity: number }> = {
  spring: { sky: "#c5e9f5", fog: "#cfeaf4", sunIntensity: 1.3 },
  summer: { sky: "#6ec9f0", fog: "#9ad4ef", sunIntensity: 1.7 },
  autumn: { sky: "#d4b896", fog: "#d4c9b0", sunIntensity: 0.9 },
  winter: { sky: "#c0d8e8", fog: "#c4dce8", sunIntensity: 0.6 },
};

function getCurrentSeason(): Season {
  const m = new Date().getMonth(); // 0-11
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "autumn";
  return "winter";
}

function getBiome(username: string): Biome {
  let h = 7;
  for (const ch of username) h = (h * 33 + ch.charCodeAt(0)) % 997;
  const biomes: Biome[] = ["oak", "pine", "birch"];
  return biomes[h % 3];
}

function computePalette(season: Season, biome: Biome): BiomePalette {
  const base = BIOME_PALETTES[biome];
  if (season === "autumn") return { ...base, leaf: "#d08040", leafDark: "#c06830" };
  if (season === "winter") return { ...base, leaf: "#7a9880", leafDark: "#5a7862" };
  return base;
}

// ---------------------------------------------------------------------------
// Plant primitives
// ---------------------------------------------------------------------------

function Leaf({ position, rotation, scale = 1, color = LEAF }: { position: Vec3; rotation?: Vec3; scale?: number; color?: string }) {
  return (
    <mesh position={position} rotation={rotation} scale={[0.3 * scale, 0.1 * scale, 0.18 * scale]} castShadow>
      <sphereGeometry args={[1, 12, 8]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}

function Blob({ position, r, color = LEAF }: { position: Vec3; r: number; color?: string }) {
  return (
    <mesh position={position} castShadow>
      <sphereGeometry args={[r, 16, 16]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}

function Flowers({ points }: { points: Vec3[] }) {
  return (
    <>
      {points.map((p, i) => (
        <group key={i} position={p}>
          {[0, 1, 2, 3, 4].map((k) => {
            const a = (k / 5) * Math.PI * 2;
            return (
              <mesh key={k} position={[Math.cos(a) * 0.07, 0, Math.sin(a) * 0.07]}>
                <sphereGeometry args={[0.05, 8, 8]} />
                <meshStandardMaterial color={i % 2 ? "#ff9ec4" : "#ffd166"} roughness={0.7} toneMapped={false} />
              </mesh>
            );
          })}
          <mesh>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshStandardMaterial color="#ffec99" emissive="#ffd34d" emissiveIntensity={0.4} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Petals drifting down — only while the plant is blooming. */
function Petals({ count = 16 }: { count?: number }) {
  const ref = useRef<THREE.Group>(null);
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() * 2 - 1) * 2.4,
        z: (Math.random() * 2 - 1) * 2.4,
        y: 0.5 + Math.random() * 3,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.5,
        sway: 0.5 + Math.random() * 0.9,
      })),
    [count],
  );
  useFrame((state, delta) => {
    const g = ref.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const d = Math.min(delta, 0.05);
    g.children.forEach((child, i) => {
      const s = seeds[i];
      child.position.y -= s.speed * d;
      if (child.position.y < 0.15) child.position.y = 3.6;
      child.position.x = s.x + Math.sin(t * s.sway + s.phase) * 0.3;
      child.rotation.z = t * s.sway + s.phase;
      child.rotation.x = t * 0.7 + s.phase;
    });
  });
  return (
    <group ref={ref}>
      {seeds.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, s.z]}>
          <planeGeometry args={[0.12, 0.18]} />
          <meshStandardMaterial color="#ff9ec4" side={THREE.DoubleSide} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/** Autumn: orange and amber leaves drifting and spinning. */
function FallingLeaves({ count = 18 }: { count?: number }) {
  const ref = useRef<THREE.Group>(null);
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() * 2 - 1) * 6,
        z: (Math.random() * 2 - 1) * 6,
        y: 0.3 + Math.random() * 5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.25 + Math.random() * 0.4,
        sway: 0.3 + Math.random() * 0.7,
        rotSpd: (Math.random() - 0.5) * 3.5,
      })),
    [count],
  );
  const AUTUMN_COLS = ["#d4843a", "#c87028", "#e8a850", "#b85a1c", "#de9840"];
  useFrame((state, delta) => {
    const g = ref.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const d = Math.min(delta, 0.05);
    g.children.forEach((child, i) => {
      const s = seeds[i];
      child.position.y -= s.speed * d;
      if (child.position.y < 0.1) child.position.y = 5;
      child.position.x = s.x + Math.sin(t * s.sway + s.phase) * 0.7;
      child.rotation.z += s.rotSpd * d;
      child.rotation.x += s.rotSpd * 0.5 * d;
    });
  });
  return (
    <group ref={ref}>
      {seeds.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, s.z]}>
          <planeGeometry args={[0.18, 0.14]} />
          <meshStandardMaterial color={AUTUMN_COLS[i % AUTUMN_COLS.length]} side={THREE.DoubleSide} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

/** Winter: gentle snowfall. */
function Snowflakes({ count = 50 }: { count?: number }) {
  const ref = useRef<THREE.Group>(null);
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() * 2 - 1) * 12,
        z: (Math.random() * 2 - 1) * 12,
        y: Math.random() * 9,
        phase: Math.random() * Math.PI * 2,
        speed: 0.06 + Math.random() * 0.12,
        sway: 0.2 + Math.random() * 0.5,
      })),
    [count],
  );
  useFrame((state, delta) => {
    const g = ref.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const d = Math.min(delta, 0.05);
    g.children.forEach((child, i) => {
      const s = seeds[i];
      child.position.y -= s.speed * d;
      if (child.position.y < 0) child.position.y = 9;
      child.position.x = s.x + Math.sin(t * s.sway + s.phase) * 0.5;
    });
  });
  return (
    <group ref={ref}>
      {seeds.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, s.z]}>
          <sphereGeometry args={[0.035, 6, 6]} />
          <meshStandardMaterial color="#f0f6ff" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// The growing plant — silhouette changes with stage, colors with biome
// ---------------------------------------------------------------------------

function Foliage({ stage, palette = BIOME_PALETTES.oak }: { stage: Stage; palette?: BiomePalette }) {
  const { leaf, leafDark, trunk } = palette;
  switch (stage) {
    case "seed":
      return <mesh position={[0, 0.06, 0]} castShadow><sphereGeometry args={[0.12, 14, 12]} /><meshStandardMaterial color="#caa46a" roughness={0.85} /></mesh>;
    case "sprout":
      return (
        <group>
          <mesh position={[0, 0.26, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.05, 0.55, 8]} />
            <meshStandardMaterial color={leafDark} roughness={0.7} />
          </mesh>
          <Leaf position={[0.12, 0.46, 0]} rotation={[0, 0, -0.7]} scale={0.8} color={leaf} />
          <Leaf position={[-0.12, 0.4, 0]} rotation={[0, Math.PI, 0.7]} scale={0.8} color={leaf} />
        </group>
      );
    case "sapling":
      return (
        <group>
          <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.07, 1.0, 8]} />
            <meshStandardMaterial color={trunk} roughness={0.7} />
          </mesh>
          <Leaf position={[0.18, 0.55, 0]} rotation={[0, 0, -0.6]} color={leaf} />
          <Leaf position={[-0.18, 0.72, 0.05]} rotation={[0, Math.PI, 0.6]} color={leaf} />
          <Leaf position={[0.12, 0.9, -0.05]} rotation={[0.2, 0, -0.5]} scale={0.9} color={leaf} />
          <Blob position={[0, 1.05, 0]} r={0.22} color={leaf} />
        </group>
      );
    case "bush":
      return (
        <group>
          <mesh position={[0, 0.35, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.1, 0.7, 8]} />
            <meshStandardMaterial color={trunk} roughness={0.7} />
          </mesh>
          <Blob position={[0, 0.95, 0]} r={0.5} color={leaf} />
          <Blob position={[-0.38, 0.78, 0.1]} r={0.34} color={leafDark} />
          <Blob position={[0.4, 0.8, -0.05]} r={0.36} color={leaf} />
          <Blob position={[0.05, 1.15, 0.2]} r={0.3} color={leafDark} />
        </group>
      );
    case "tree":
      return (
        <group>
          <mesh position={[0, 0.7, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.2, 1.5, 10]} />
            <meshStandardMaterial color={trunk} roughness={0.75} />
          </mesh>
          <Blob position={[0, 1.85, 0]} r={0.78} color={leaf} />
          <Blob position={[-0.6, 1.6, 0.1]} r={0.5} color={leafDark} />
          <Blob position={[0.62, 1.62, -0.05]} r={0.52} color={leaf} />
          <Blob position={[0.1, 2.2, 0.25]} r={0.45} color={leafDark} />
        </group>
      );
    case "blooming":
      return (
        <group>
          <mesh position={[0, 0.75, 0]} castShadow>
            <cylinderGeometry args={[0.13, 0.22, 1.6, 10]} />
            <meshStandardMaterial color={trunk} roughness={0.75} />
          </mesh>
          <Blob position={[0, 2.0, 0]} r={0.85} color={leaf} />
          <Blob position={[-0.65, 1.72, 0.1]} r={0.55} color={leafDark} />
          <Blob position={[0.68, 1.74, -0.05]} r={0.56} color={leaf} />
          <Blob position={[0.1, 2.4, 0.25]} r={0.5} color={leafDark} />
          <Flowers
            points={[
              [0, 2.55, 0.4],
              [-0.6, 2.0, 0.5],
              [0.6, 2.05, 0.45],
              [0.3, 2.35, -0.4],
              [-0.4, 2.3, -0.35],
              [0.8, 1.7, 0.2],
              [-0.8, 1.75, -0.1],
            ]}
          />
        </group>
      );
  }
}

function Plant3D({ stage, growth, palette }: { stage: Stage; growth: number; palette: BiomePalette }) {
  const sway = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!sway.current) return;
    const t = state.clock.elapsedTime;
    sway.current.rotation.z = Math.sin(t * 1.3) * 0.04;
    sway.current.rotation.x = Math.cos(t * 1.0) * 0.02;
  });
  const scale = 0.92 + (growth / 100) * 0.18;
  return (
    <group position={[0, 0.32, 0]}>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[1.05, 1.05, 0.12, 28]} />
        <meshStandardMaterial color={SOIL} roughness={0.95} />
      </mesh>
      <group ref={sway} position={[0, 0.08, 0]} scale={scale}>
        <Foliage stage={stage} palette={palette} />
      </group>
      {stage === "blooming" && <Petals />}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Garden surroundings
// ---------------------------------------------------------------------------

function Ground() {
  const tex = useMemo(() => grassTexture(), []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial map={tex} roughness={1} />
    </mesh>
  );
}

function Plot() {
  return (
    <group>
      <mesh position={[0, 0.16, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[1.4, 1.5, 0.32, 28]} />
        <meshStandardMaterial color={STONE} roughness={0.9} />
      </mesh>
      {Array.from({ length: 16 }).map((_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.6, 0.08, Math.sin(a) * 1.6]} castShadow>
            <sphereGeometry args={[0.16, 10, 8]} />
            <meshStandardMaterial color={i % 2 ? "#a59b8c" : "#c7bdac"} roughness={0.95} />
          </mesh>
        );
      })}
    </group>
  );
}

function StonePath() {
  const stones: Vec3[] = [
    [0, 0.03, 3.2],
    [0.3, 0.03, 4.4],
    [-0.25, 0.03, 5.6],
    [0.2, 0.03, 6.8],
    [-0.1, 0.03, 8.0],
  ];
  return (
    <>
      {stones.map((p, i) => (
        <mesh key={i} position={p} rotation={[-Math.PI / 2, 0, i * 0.5]} receiveShadow>
          <cylinderGeometry args={[0.55, 0.55, 0.06, 18]} />
          <meshStandardMaterial color="#cfc6b6" roughness={0.95} />
        </mesh>
      ))}
    </>
  );
}

function PicketFence({ length, position, rotation }: { length: number; position: Vec3; rotation?: Vec3 }) {
  const n = Math.floor(length / 0.7);
  const gap = length / n;
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[length, 0.08, 0.05]} />
        <meshStandardMaterial color={WOOD} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[length, 0.08, 0.05]} />
        <meshStandardMaterial color={WOOD} roughness={0.7} />
      </mesh>
      {Array.from({ length: n + 1 }).map((_, i) => (
        <group key={i} position={[-length / 2 + i * gap, 0, 0]}>
          <mesh position={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[0.1, 0.8, 0.06]} />
            <meshStandardMaterial color="#c08a4e" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.82, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[0.075, 0.12, 4]} />
            <meshStandardMaterial color="#c08a4e" roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Decor({ flowers, palette }: { flowers: Vec3[]; palette: BiomePalette }) {
  const { leaf, leafDark } = palette;
  return (
    <group>
      <Flowers points={flowers} />
      <group position={[-5.5, 0, 4.5]}>
        <Blob position={[0, 0.5, 0]} r={0.55} color={leaf} />
        <Blob position={[0.4, 0.4, 0.2]} r={0.38} color={leafDark} />
      </group>
      <group position={[5.8, 0, 3.6]}>
        <Blob position={[0, 0.5, 0]} r={0.5} color={leaf} />
        <Blob position={[-0.4, 0.42, -0.1]} r={0.36} color={leafDark} />
      </group>
      {/* watering can near the plot */}
      <group position={[2.0, 0, 1.6]} rotation={[0, -0.6, 0]}>
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.26, 0.42, 16]} />
          <meshStandardMaterial color="#6fae9b" metalness={0.3} roughness={0.5} />
        </mesh>
        <mesh position={[0.32, 0.36, 0]} rotation={[0, 0, -0.5]} castShadow>
          <cylinderGeometry args={[0.04, 0.06, 0.5, 10]} />
          <meshStandardMaterial color="#6fae9b" metalness={0.3} roughness={0.5} />
        </mesh>
        <mesh position={[-0.18, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.12, 0.025, 8, 16]} />
          <meshStandardMaterial color="#5c9a88" metalness={0.3} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

function Sun() {
  return (
    <group position={[-10, 12, -12]}>
      <mesh>
        <sphereGeometry args={[1.6, 24, 24]} />
        <meshBasicMaterial color="#fff3c4" toneMapped={false} />
      </mesh>
    </group>
  );
}

function Clouds() {
  const puffs: { p: Vec3; r: number }[] = [
    { p: [-6, 9, -6], r: 1.2 },
    { p: [-5, 9.2, -6.5], r: 1.5 },
    { p: [-4, 9, -6], r: 1.1 },
    { p: [7, 10, -8], r: 1.3 },
    { p: [8.2, 10.3, -8.4], r: 1.6 },
  ];
  return (
    <group>
      {puffs.map((c, i) => (
        <mesh key={i} position={c.p}>
          <sphereGeometry args={[c.r, 16, 16]} />
          <meshStandardMaterial color="#ffffff" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Butterfly({ center, radius, height, speed, phase, color }: { center: Vec3; radius: number; height: number; speed: number; phase: number; color: string }) {
  const ref = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Mesh>(null);
  const wingR = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime * speed + phase;
    const g = ref.current;
    if (g) {
      g.position.set(center[0] + Math.cos(t) * radius, height + Math.sin(t * 2) * 0.4, center[2] + Math.sin(t) * radius);
      g.rotation.y = -t + Math.PI / 2;
    }
    const flap = Math.sin(state.clock.elapsedTime * 18 + phase) * 0.8;
    if (wingL.current) wingL.current.rotation.y = flap;
    if (wingR.current) wingR.current.rotation.y = -flap;
  });
  return (
    <group ref={ref}>
      <mesh ref={wingL} position={[-0.02, 0, 0]}>
        <planeGeometry args={[0.18, 0.13]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.6} />
      </mesh>
      <mesh ref={wingR} position={[0.02, 0, 0]}>
        <planeGeometry args={[0.18, 0.13]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.6} />
      </mesh>
    </group>
  );
}

function Signpost({ garden }: { garden: GardenState | null }) {
  const title = garden ? garden.user : "Pianta il tuo giardino";
  const sub = garden ? STAGE_LABEL[garden.stage] : "cerca un username";
  return (
    <group position={[-1.9, 0, 1.7]} rotation={[0, 0.5, 0]}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 1.2, 8]} />
        <meshStandardMaterial color={WOOD} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[0.9, 0.4, 0.06]} />
        <meshStandardMaterial color="#caa46a" roughness={0.7} />
      </mesh>
      <Html position={[0, 1.05, 0.05]} center distanceFactor={9} pointerEvents="none" zIndexRange={[20, 0]}>
        <div className="pointer-events-none select-none whitespace-nowrap text-center">
          <div className="text-[12px] font-bold text-[#5a3d28]">{title}</div>
          <div className="text-[9px] text-[#7a5230]">{sub}</div>
        </div>
      </Html>
    </group>
  );
}

const MINI_STAGE: Record<Stage, number> = { seed: 0.3, sprout: 0.4, sapling: 0.5, bush: 0.6, tree: 0.7, blooming: 0.8 };

function MiniGarden({ g, x, onSelectUser }: { g: GardenState; x: number; onSelectUser: (u: string) => void }) {
  const miniPalette = BIOME_PALETTES[getBiome(g.user)];
  return (
    <group position={[x, 0, -6.5]}>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[0.7, 0.78, 0.16, 20]} />
        <meshStandardMaterial color={STONE} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.18, 0]} receiveShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.08, 20]} />
        <meshStandardMaterial color={SOIL} roughness={0.95} />
      </mesh>
      <group position={[0, 0.22, 0]} scale={MINI_STAGE[g.stage]}>
        <Foliage stage={g.stage} palette={miniPalette} />
      </group>
      <Html position={[0, 1.7, 0]} center distanceFactor={11} zIndexRange={[30, 10]}>
        <button
          onClick={() => onSelectUser(g.user)}
          className="pointer-events-auto select-none whitespace-nowrap rounded-full border border-emerald-700/20 bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 shadow-sm transition hover:bg-white"
        >
          {g.user} · {g.waterings}💧
        </button>
      </Html>
    </group>
  );
}

// ---------------------------------------------------------------------------
// The garden Canvas
// ---------------------------------------------------------------------------

export function GardenScene({
  garden,
  board,
  onSelectUser,
}: {
  garden: GardenState | null;
  board: GardenState[];
  onSelectUser: (u: string) => void;
}) {
  const flowers = useMemo<Vec3[]>(
    () =>
      Array.from({ length: 22 }, () => {
        let x = 0;
        let z = 0;
        do {
          x = (Math.random() * 2 - 1) * 8.5;
          z = (Math.random() * 2 - 1) * 8.5;
        } while (Math.hypot(x, z) < 2.4 || z > 7.5);
        return [x, 0.02, z] as Vec3;
      }),
    [],
  );

  const others = useMemo(() => board.filter((g) => !garden || g.user !== garden.user).slice(0, 5), [board, garden]);

  const season = useMemo(() => getCurrentSeason(), []);
  const biome  = useMemo(() => (garden ? getBiome(garden.user) : "oak"), [garden?.user]); // eslint-disable-line react-hooks/exhaustive-deps
  const palette = useMemo(() => computePalette(season, biome), [season, biome]);
  const seasonSky = SEASON_SKY[season];

  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 7, 14], fov: 38 }} gl={{ antialias: true }}>
      <color attach="background" args={[seasonSky.sky]} />
      <fog attach="fog" args={[seasonSky.fog, 28, 64]} />
      <Suspense fallback={null}>
        <hemisphereLight args={["#cfeefc", "#5a9d4a", 0.85]} />
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[-10, 14, -8]}
          intensity={seasonSky.sunIntensity}
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

        {season !== "winter" && <Sun />}
        <Clouds />
        <Ground />
        <StonePath />
        <Plot />
        <Plant3D stage={garden ? garden.stage : "seed"} growth={garden ? garden.growth : 0} palette={palette} />
        <Signpost garden={garden} />
        <Decor flowers={flowers} palette={palette} />

        {/* seasonal effects */}
        {season === "autumn" && <FallingLeaves />}
        {season === "winter" && <Snowflakes />}

        {/* an open-L of fencing behind + to the left */}
        <PicketFence length={19} position={[0, 0, -9.3]} />
        <PicketFence length={19} position={[-9.3, 0, 0]} rotation={[0, Math.PI / 2, 0]} />

        {others.map((g, i) => (
          <MiniGarden key={g.user} g={g} x={-4 + i * 2} onSelectUser={onSelectUser} />
        ))}

        {/* butterflies only in warmer seasons */}
        {season !== "winter" && (
          <>
            <Butterfly center={[1.5, 0, 1]} radius={1.6} height={1.4} speed={0.6} phase={0} color="#ff9ec4" />
            <Butterfly center={[-1.6, 0, 0.5]} radius={2.0} height={1.8} speed={0.45} phase={2} color="#ffd166" />
          </>
        )}
      </Suspense>

      <OrbitControls
        target={[0, 1.4, 0]}
        enablePan={false}
        minDistance={6}
        maxDistance={28}
        maxPolarAngle={1.45}
        minPolarAngle={0.15}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
}
