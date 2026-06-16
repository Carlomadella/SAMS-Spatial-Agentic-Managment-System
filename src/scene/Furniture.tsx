import { RoundedBox } from "@react-three/drei";
import type { ReactNode } from "react";

type Vec3 = [number, number, number];

interface PropProps {
  position?: Vec3;
  rotation?: Vec3;
  children?: ReactNode;
}

// --- shared materials (kept light & clean to read as a bright diorama) ------
const WOOD = "#7b5a3f";
const WOOD_DARK = "#4f3a28";
const METAL = "#aab4c0";
const PANEL = "#eef2f8";
const SCREEN = "#0e1726";

export function Desk({ position = [0, 0, 0], rotation = [0, 0, 0] }: PropProps) {
  return (
    <group position={position} rotation={rotation}>
      {/* top */}
      <RoundedBox args={[2.6, 0.12, 1.2]} radius={0.05} smoothness={4} position={[0, 0.92, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={WOOD} roughness={0.6} />
      </RoundedBox>
      {/* legs */}
      {[
        [-1.15, -0.5],
        [1.15, -0.5],
        [-1.15, 0.5],
        [1.15, 0.5],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.46, z]} castShadow>
          <boxGeometry args={[0.1, 0.9, 0.1]} />
          <meshStandardMaterial color={WOOD_DARK} roughness={0.7} />
        </mesh>
      ))}
      {/* dual monitors */}
      {[-0.55, 0.55].map((x, i) => (
        <group key={i} position={[x, 1.36, -0.25]}>
          <mesh castShadow>
            <boxGeometry args={[0.92, 0.56, 0.05]} />
            <meshStandardMaterial color="#11151f" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.03]}>
            <planeGeometry args={[0.84, 0.48]} />
            <meshStandardMaterial color={SCREEN} emissive="#1d4ed8" emissiveIntensity={0.35} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.4, 0]}>
            <cylinderGeometry args={[0.05, 0.08, 0.26, 12]} />
            <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* chair */}
      <group position={[0, 0, 0.95]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[0.6, 0.1, 0.6]} />
          <meshStandardMaterial color="#1f2735" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.85, 0.28]} castShadow>
          <boxGeometry args={[0.6, 0.7, 0.1]} />
          <meshStandardMaterial color="#1f2735" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.4, 10]} />
          <meshStandardMaterial color={METAL} metalness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

export function Whiteboard({ position = [0, 0, 0], rotation = [0, 0, 0] }: PropProps) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[2.6, 1.5, 0.08]} radius={0.04} smoothness={4} position={[0, 1.7, 0]} castShadow>
        <meshStandardMaterial color={PANEL} roughness={0.5} />
      </RoundedBox>
      {/* frame */}
      <mesh position={[0, 1.7, -0.05]}>
        <boxGeometry args={[2.74, 1.64, 0.04]} />
        <meshStandardMaterial color={METAL} metalness={0.4} roughness={0.4} />
      </mesh>
      {/* sketch marks */}
      {[
        [-0.7, 2.0, 0.9, 0.06, "#3b82f6"],
        [-0.5, 1.78, 1.3, 0.05, "#1f2735"],
        [0.45, 1.95, 0.7, 0.05, "#22c55e"],
        [0.4, 1.6, 1.1, 0.05, "#1f2735"],
      ].map(([x, y, w, h, c], i) => (
        <mesh key={i} position={[x as number, y as number, 0.05]}>
          <planeGeometry args={[w as number, h as number]} />
          <meshStandardMaterial color={c as string} />
        </mesh>
      ))}
      {/* legs */}
      {[-1.1, 1.1].map((x, i) => (
        <mesh key={i} position={[x, 0.5, 0]}>
          <boxGeometry args={[0.06, 1.0, 0.06]} />
          <meshStandardMaterial color={METAL} metalness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

const KANBAN_COLS: { color: string; notes: number }[] = [
  { color: "#94a3b8", notes: 3 },
  { color: "#38bdf8", notes: 2 },
  { color: "#fbbf24", notes: 2 },
  { color: "#34d399", notes: 3 },
];

export function KanbanWall({ position = [0, 0, 0], rotation = [0, 0, 0] }: PropProps) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[3.4, 2.0, 0.1]} radius={0.05} smoothness={4} position={[0, 1.6, 0]} castShadow>
        <meshStandardMaterial color="#f5f7fb" roughness={0.6} />
      </RoundedBox>
      {KANBAN_COLS.map((col, c) => {
        const x = -1.27 + c * 0.85;
        return (
          <group key={c}>
            {/* column header */}
            <mesh position={[x, 2.42, 0.06]}>
              <planeGeometry args={[0.72, 0.12]} />
              <meshStandardMaterial color={col.color} />
            </mesh>
            {Array.from({ length: col.notes }).map((_, n) => (
              <mesh key={n} position={[x, 2.16 - n * 0.42, 0.06]} castShadow>
                <boxGeometry args={[0.66, 0.34, 0.03]} />
                <meshStandardMaterial color={col.color} roughness={0.7} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

export function Vault({ position = [0, 0, 0], rotation = [0, 0, 0] }: PropProps) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[1.6, 1.7, 1.3]} radius={0.08} smoothness={4} position={[0, 0.85, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#6b7686" metalness={0.6} roughness={0.4} />
      </RoundedBox>
      {/* door */}
      <mesh position={[0, 0.9, 0.66]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.52, 0.52, 0.08, 32]} />
        <meshStandardMaterial color="#8895a6" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* dial */}
      <mesh position={[0, 0.9, 0.72]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.06, 24]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.cos((i * Math.PI) / 2) * 0.16, 0.9 + Math.sin((i * Math.PI) / 2) * 0.16, 0.76]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

export function SecurityGate({ position = [0, 0, 0], rotation = [0, 0, 0] }: PropProps) {
  return (
    <group position={position} rotation={rotation}>
      {/* posts */}
      {[-0.9, 0.9].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <RoundedBox args={[0.4, 1.1, 1.4]} radius={0.06} smoothness={4} position={[0, 0.55, 0]} castShadow>
            <meshStandardMaterial color="#dbe2ec" roughness={0.5} />
          </RoundedBox>
          {/* status light */}
          <mesh position={[0, 1.12, 0]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={1.6} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* glowing access field */}
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[1.4, 1.2, 1.2]} />
        <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={0.5} transparent opacity={0.16} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function LoungeSofa({ position = [0, 0, 0], rotation = [0, 0, 0] }: PropProps) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[2.2, 0.4, 0.9]} radius={0.12} smoothness={4} position={[0, 0.35, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#cfd8e6" roughness={0.8} />
      </RoundedBox>
      <RoundedBox args={[2.2, 0.6, 0.25]} radius={0.1} smoothness={4} position={[0, 0.7, -0.32]} castShadow>
        <meshStandardMaterial color="#cfd8e6" roughness={0.8} />
      </RoundedBox>
      {[-0.95, 0.95].map((x, i) => (
        <RoundedBox key={i} args={[0.25, 0.5, 0.9]} radius={0.08} smoothness={4} position={[x, 0.55, 0]} castShadow>
          <meshStandardMaterial color="#bcc7d8" roughness={0.8} />
        </RoundedBox>
      ))}
    </group>
  );
}

export function Plant({ position = [0, 0, 0] }: PropProps) {
  return (
    <group position={position}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.16, 0.5, 16]} />
        <meshStandardMaterial color="#b08968" roughness={0.7} />
      </mesh>
      {[
        [0, 0.75, 0, 0.3],
        [0.18, 0.95, 0.05, 0.26],
        [-0.16, 0.92, -0.06, 0.24],
        [0.05, 1.12, -0.04, 0.2],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]} castShadow>
          <sphereGeometry args={[r as number, 16, 16]} />
          <meshStandardMaterial color={i % 2 ? "#2f9e63" : "#34a853"} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}
