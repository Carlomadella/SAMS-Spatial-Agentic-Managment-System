import { RoundedBox } from "@react-three/drei";
import { useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { rugTexture } from "./textures";

type Vec3 = [number, number, number];

interface PropProps {
  position?: Vec3;
  rotation?: Vec3;
  children?: ReactNode;
}

// --- shared warm-home palette ----------------------------------------------
const WALNUT = "#5a3d28";
const OAK = "#9c7048";
const OAK_LIGHT = "#b78a5a";
const METAL = "#9aa2ad";
const BRASS = "#c8a15a";
const LINEN = "#e7ddcd";
const SCREEN = "#0c1118";

// ---------------------------------------------------------------------------
// Seating
// ---------------------------------------------------------------------------

export function Sofa({ position = [0, 0, 0], rotation = [0, 0, 0] }: PropProps) {
  const FABRIC = "#b07a5e"; // terracotta
  const CUSHION = "#caa07f";
  return (
    <group position={position} rotation={rotation}>
      {/* base */}
      <RoundedBox args={[2.9, 0.45, 1.15]} radius={0.14} smoothness={4} position={[0, 0.4, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={FABRIC} roughness={0.95} />
      </RoundedBox>
      {/* seat cushions */}
      {[-0.92, 0, 0.92].map((x, i) => (
        <RoundedBox key={i} args={[0.86, 0.22, 1.0]} radius={0.1} smoothness={4} position={[x, 0.62, 0.04]} castShadow>
          <meshStandardMaterial color={CUSHION} roughness={0.95} />
        </RoundedBox>
      ))}
      {/* backrest */}
      <RoundedBox args={[2.9, 0.7, 0.28]} radius={0.12} smoothness={4} position={[0, 0.82, -0.46]} castShadow>
        <meshStandardMaterial color={FABRIC} roughness={0.95} />
      </RoundedBox>
      {/* back cushions */}
      {[-0.92, 0, 0.92].map((x, i) => (
        <RoundedBox key={i} args={[0.82, 0.5, 0.18]} radius={0.1} smoothness={4} position={[x, 0.84, -0.34]} castShadow>
          <meshStandardMaterial color={CUSHION} roughness={0.95} />
        </RoundedBox>
      ))}
      {/* arms */}
      {[-1.36, 1.36].map((x, i) => (
        <RoundedBox key={i} args={[0.26, 0.62, 1.15]} radius={0.1} smoothness={4} position={[x, 0.62, 0]} castShadow>
          <meshStandardMaterial color={FABRIC} roughness={0.95} />
        </RoundedBox>
      ))}
      {/* throw pillows */}
      {[[-0.95, "#6b8f8a"], [1.0, "#d8b15e"]].map(([x, c], i) => (
        <RoundedBox key={i} args={[0.46, 0.46, 0.16]} radius={0.08} smoothness={4} position={[x as number, 0.86, -0.18]} rotation={[0, 0, 0.2 - i * 0.4]} castShadow>
          <meshStandardMaterial color={c as string} roughness={0.9} />
        </RoundedBox>
      ))}
      {/* feet */}
      {[[-1.3, -0.45], [1.3, -0.45], [-1.3, 0.45], [1.3, 0.45]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.09, z]} castShadow>
          <cylinderGeometry args={[0.06, 0.05, 0.18, 10]} />
          <meshStandardMaterial color={WALNUT} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

export function Armchair({ position = [0, 0, 0], rotation = [0, 0, 0] }: PropProps) {
  const FABRIC = "#6b8f8a"; // muted teal
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[1.05, 0.42, 1.0]} radius={0.14} smoothness={4} position={[0, 0.4, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={FABRIC} roughness={0.95} />
      </RoundedBox>
      <RoundedBox args={[0.82, 0.2, 0.86]} radius={0.1} smoothness={4} position={[0, 0.61, 0.04]} castShadow>
        <meshStandardMaterial color="#7ba099" roughness={0.95} />
      </RoundedBox>
      <RoundedBox args={[1.05, 0.7, 0.24]} radius={0.12} smoothness={4} position={[0, 0.82, -0.4]} castShadow>
        <meshStandardMaterial color={FABRIC} roughness={0.95} />
      </RoundedBox>
      {[-0.5, 0.5].map((x, i) => (
        <RoundedBox key={i} args={[0.22, 0.56, 1.0]} radius={0.09} smoothness={4} position={[x, 0.6, 0]} castShadow>
          <meshStandardMaterial color={FABRIC} roughness={0.95} />
        </RoundedBox>
      ))}
      {[[-0.45, -0.4], [0.45, -0.4], [-0.45, 0.4], [0.45, 0.4]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.09, z]} castShadow>
          <cylinderGeometry args={[0.05, 0.04, 0.18, 10]} />
          <meshStandardMaterial color={WALNUT} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export function CoffeeTable({ position = [0, 0, 0], rotation = [0, 0, 0] }: PropProps) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[1.7, 0.12, 0.95]} radius={0.05} smoothness={4} position={[0, 0.46, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={OAK} roughness={0.45} />
      </RoundedBox>
      <RoundedBox args={[1.5, 0.06, 0.8]} radius={0.04} smoothness={4} position={[0, 0.24, 0]} castShadow>
        <meshStandardMaterial color={OAK_LIGHT} roughness={0.5} />
      </RoundedBox>
      {[[-0.75, -0.4], [0.75, -0.4], [-0.75, 0.4], [0.75, 0.4]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.23, z]} castShadow>
          <boxGeometry args={[0.08, 0.46, 0.08]} />
          <meshStandardMaterial color={WALNUT} roughness={0.5} />
        </mesh>
      ))}
      {/* a stack of books */}
      {["#b5544e", "#3f6e8c", "#d8b15e"].map((c, i) => (
        <mesh key={i} position={[-0.35, 0.55 + i * 0.05, -0.05]} rotation={[0, 0.2 - i * 0.15, 0]} castShadow>
          <boxGeometry args={[0.42, 0.05, 0.3]} />
          <meshStandardMaterial color={c} roughness={0.7} />
        </mesh>
      ))}
      {/* coffee mug */}
      <mesh position={[0.45, 0.57, 0.1]} castShadow>
        <cylinderGeometry args={[0.08, 0.07, 0.12, 16]} />
        <meshStandardMaterial color="#f3ede2" roughness={0.4} />
      </mesh>
      {/* small succulent */}
      <mesh position={[0.55, 0.55, -0.25]}>
        <cylinderGeometry args={[0.08, 0.06, 0.1, 12]} />
        <meshStandardMaterial color="#c98a5a" roughness={0.7} />
      </mesh>
      <mesh position={[0.55, 0.64, -0.25]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial color="#4f9d69" roughness={0.8} />
      </mesh>
    </group>
  );
}

export function SideTable({ position = [0, 0, 0], rotation = [0, 0, 0] }: PropProps) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.34, 0.08, 24]} />
        <meshStandardMaterial color={OAK} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.27, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.55, 12]} />
        <meshStandardMaterial color={WALNUT} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.26, 0.04, 24]} />
        <meshStandardMaterial color={WALNUT} roughness={0.5} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Storage / media
// ---------------------------------------------------------------------------

const SHELF_BOOKS: { color: string; w: number }[] = [
  { color: "#b5544e", w: 0.1 }, { color: "#3f6e8c", w: 0.08 }, { color: "#d8b15e", w: 0.12 },
  { color: "#6b8f8a", w: 0.09 }, { color: "#8a5a3c", w: 0.1 }, { color: "#caa07f", w: 0.08 },
  { color: "#4f6e8c", w: 0.11 }, { color: "#9c5a4e", w: 0.09 },
];

export function Bookshelf({ position = [0, 0, 0], rotation = [0, 0, 0] }: PropProps) {
  const shelves = [0.5, 1.18, 1.86, 2.54];
  return (
    <group position={position} rotation={rotation}>
      {/* carcass */}
      <RoundedBox args={[2.4, 2.9, 0.5]} radius={0.04} smoothness={4} position={[0, 1.45, -0.02]} castShadow receiveShadow>
        <meshStandardMaterial color={OAK} roughness={0.55} />
      </RoundedBox>
      {/* back panel (darker, recessed) */}
      <mesh position={[0, 1.45, -0.18]}>
        <boxGeometry args={[2.2, 2.7, 0.04]} />
        <meshStandardMaterial color={WALNUT} roughness={0.6} />
      </mesh>
      {shelves.map((y, s) => (
        <group key={s}>
          <mesh position={[0, y, 0.0]} castShadow>
            <boxGeometry args={[2.2, 0.05, 0.46]} />
            <meshStandardMaterial color={OAK_LIGHT} roughness={0.5} />
          </mesh>
          {/* books standing on the shelf */}
          {s < 3 &&
            (() => {
              let x = -1.02;
              return SHELF_BOOKS.map((b, i) => {
                const bx = x + b.w / 2;
                x += b.w + 0.015;
                const h = 0.5 + ((i * 7 + s * 3) % 5) * 0.03;
                return (
                  <mesh key={i} position={[bx, y + 0.03 + h / 2, 0.02]} castShadow>
                    <boxGeometry args={[b.w, h, 0.34]} />
                    <meshStandardMaterial color={b.color} roughness={0.75} />
                  </mesh>
                );
              });
            })()}
        </group>
      ))}
      {/* a small plant on top */}
      <mesh position={[0.7, 2.74, 0.05]} castShadow>
        <cylinderGeometry args={[0.12, 0.09, 0.16, 12]} />
        <meshStandardMaterial color="#c98a5a" roughness={0.7} />
      </mesh>
      <mesh position={[0.7, 2.9, 0.05]} castShadow>
        <sphereGeometry args={[0.16, 14, 14]} />
        <meshStandardMaterial color="#4f9d69" roughness={0.8} />
      </mesh>
    </group>
  );
}

export function TVUnit({ position = [0, 0, 0], rotation = [0, 0, 0] }: PropProps) {
  return (
    <group position={position} rotation={rotation}>
      {/* media console */}
      <RoundedBox args={[3.0, 0.55, 0.55]} radius={0.05} smoothness={4} position={[0, 0.34, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={WALNUT} roughness={0.5} />
      </RoundedBox>
      {/* cabinet doors */}
      {[-0.75, 0.75].map((x, i) => (
        <mesh key={i} position={[x, 0.34, 0.29]}>
          <planeGeometry args={[1.35, 0.42]} />
          <meshStandardMaterial color={OAK} roughness={0.55} />
        </mesh>
      ))}
      {[-0.05, 0.05].map((x, i) => (
        <mesh key={i} position={[x, 0.34, 0.31]}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshStandardMaterial color={BRASS} metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      {/* wall TV */}
      <group position={[0, 1.75, -0.18]}>
        <RoundedBox args={[2.7, 1.55, 0.08]} radius={0.03} smoothness={4} castShadow>
          <meshStandardMaterial color="#0a0d13" roughness={0.4} />
        </RoundedBox>
        <mesh position={[0, 0, 0.05]}>
          <planeGeometry args={[2.55, 1.4]} />
          <meshStandardMaterial color={SCREEN} emissive="#2b4a8a" emissiveIntensity={0.5} roughness={0.2} toneMapped={false} />
        </mesh>
        {/* abstract "now playing" color bands */}
        {[["#f0894e", -0.45], ["#5aa0d8", -0.1], ["#d8b15e", 0.25]].map(([c, y], i) => (
          <mesh key={i} position={[0, y as number, 0.06]}>
            <planeGeometry args={[2.2, 0.18]} />
            <meshBasicMaterial color={c as string} transparent opacity={0.55} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* soundbar */}
      <RoundedBox args={[1.8, 0.1, 0.12]} radius={0.04} smoothness={4} position={[0, 0.92, 0.18]} castShadow>
        <meshStandardMaterial color="#1c1f26" roughness={0.5} />
      </RoundedBox>
    </group>
  );
}

export function Sideboard({ position = [0, 0, 0], rotation = [0, 0, 0] }: PropProps) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[2.0, 0.9, 0.55]} radius={0.05} smoothness={4} position={[0, 0.55, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={OAK} roughness={0.5} />
      </RoundedBox>
      {[-0.5, 0.5].map((x, i) => (
        <mesh key={i} position={[x, 0.55, 0.29]}>
          <planeGeometry args={[0.85, 0.72]} />
          <meshStandardMaterial color={OAK_LIGHT} roughness={0.55} />
        </mesh>
      ))}
      {[-0.5, 0.5].map((x, i) => (
        <mesh key={i} position={[x, 0.55, 0.31]}>
          <boxGeometry args={[0.16, 0.03, 0.03]} />
          <meshStandardMaterial color={BRASS} metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      {/* legs */}
      {[[-0.85, -0.22], [0.85, -0.22], [-0.85, 0.22], [0.85, 0.22]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.06, z]} castShadow>
          <cylinderGeometry args={[0.04, 0.03, 0.12, 8]} />
          <meshStandardMaterial color={WALNUT} roughness={0.5} />
        </mesh>
      ))}
      {/* decor: vase + framed photo */}
      <mesh position={[-0.55, 1.12, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.14, 0.34, 16]} />
        <meshStandardMaterial color="#cdd6dd" roughness={0.4} />
      </mesh>
      <mesh position={[0.45, 1.14, 0]} castShadow>
        <boxGeometry args={[0.5, 0.36, 0.03]} />
        <meshStandardMaterial color={WALNUT} roughness={0.5} />
      </mesh>
      <mesh position={[0.45, 1.14, 0.02]}>
        <planeGeometry args={[0.42, 0.28]} />
        <meshStandardMaterial color="#9bbcd0" roughness={0.3} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Work nook (a desk still belongs in a modern living room)
// ---------------------------------------------------------------------------

export function Desk({ position = [0, 0, 0], rotation = [0, 0, 0] }: PropProps) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[2.4, 0.1, 1.05]} radius={0.04} smoothness={4} position={[0, 0.92, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={OAK} roughness={0.5} />
      </RoundedBox>
      {[[-1.05, -0.42], [1.05, -0.42], [-1.05, 0.42], [1.05, 0.42]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.46, z]} castShadow>
          <boxGeometry args={[0.08, 0.9, 0.08]} />
          <meshStandardMaterial color={WALNUT} roughness={0.5} />
        </mesh>
      ))}
      {/* single monitor */}
      <group position={[0, 1.34, -0.28]}>
        <mesh castShadow>
          <boxGeometry args={[1.0, 0.6, 0.05]} />
          <meshStandardMaterial color="#15181f" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.03]}>
          <planeGeometry args={[0.92, 0.52]} />
          <meshStandardMaterial color={SCREEN} emissive="#1d6fe0" emissiveIntensity={0.4} roughness={0.2} />
        </mesh>
        <mesh position={[0, -0.42, 0.05]}>
          <cylinderGeometry args={[0.05, 0.08, 0.28, 12]} />
          <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.4} />
        </mesh>
      </group>
      {/* keyboard + mug */}
      <mesh position={[0, 0.98, 0.12]} castShadow>
        <boxGeometry args={[0.7, 0.03, 0.22]} />
        <meshStandardMaterial color="#2a2f3a" roughness={0.6} />
      </mesh>
      <mesh position={[0.7, 1.04, 0.05]} castShadow>
        <cylinderGeometry args={[0.07, 0.06, 0.12, 14]} />
        <meshStandardMaterial color="#b5544e" roughness={0.5} />
      </mesh>
      {/* chair */}
      <group position={[0, 0, 0.85]}>
        <RoundedBox args={[0.58, 0.12, 0.58]} radius={0.06} smoothness={4} position={[0, 0.5, 0]} castShadow>
          <meshStandardMaterial color="#6b8f8a" roughness={0.9} />
        </RoundedBox>
        <RoundedBox args={[0.58, 0.62, 0.1]} radius={0.06} smoothness={4} position={[0, 0.82, 0.26]} castShadow>
          <meshStandardMaterial color="#6b8f8a" roughness={0.9} />
        </RoundedBox>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.42, 10]} />
          <meshStandardMaterial color={METAL} metalness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Lighting fixtures (with real warm light)
// ---------------------------------------------------------------------------

export function FloorLamp({ position = [0, 0, 0], rotation = [0, 0, 0] }: PropProps) {
  return (
    <group position={position} rotation={rotation}>
      {/* base */}
      <mesh position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.26, 0.08, 24]} />
        <meshStandardMaterial color={WALNUT} roughness={0.5} />
      </mesh>
      {/* pole */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 1.95, 12]} />
        <meshStandardMaterial color={BRASS} metalness={0.7} roughness={0.3} />
      </mesh>
      {/* shade */}
      <mesh position={[0, 2.0, 0]} castShadow>
        <coneGeometry args={[0.42, 0.5, 24, 1, true]} />
        <meshStandardMaterial color={LINEN} emissive="#ffd9a0" emissiveIntensity={0.35} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      {/* warm glow */}
      <pointLight position={[0, 1.85, 0]} color="#ffce8a" intensity={6} distance={7} decay={2} castShadow={false} />
      <mesh position={[0, 1.92, 0]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshBasicMaterial color="#fff0d0" toneMapped={false} />
      </mesh>
    </group>
  );
}

export function TableLamp({ position = [0, 0, 0], rotation = [0, 0, 0] }: PropProps) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.03, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.14, 0.06, 20]} />
        <meshStandardMaterial color={BRASS} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 10]} />
        <meshStandardMaterial color={BRASS} metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.4, 0]} castShadow>
        <coneGeometry args={[0.2, 0.26, 20, 1, true]} />
        <meshStandardMaterial color={LINEN} emissive="#ffd9a0" emissiveIntensity={0.45} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[0, 0.36, 0]} color="#ffce8a" intensity={2.4} distance={4.5} decay={2} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Walls: window with daylight, framed art
// ---------------------------------------------------------------------------

export function Window({ position = [0, 0, 0], rotation = [0, 0, 0] }: PropProps) {
  return (
    <group position={position} rotation={rotation}>
      {/* frame */}
      <mesh castShadow>
        <boxGeometry args={[2.3, 2.6, 0.14]} />
        <meshStandardMaterial color="#f3ece0" roughness={0.6} />
      </mesh>
      {/* glowing sky */}
      <mesh position={[0, 0, 0.05]}>
        <planeGeometry args={[2.0, 2.3]} />
        <meshBasicMaterial color="#ffe9c2" toneMapped={false} />
      </mesh>
      {/* gradient hint: a softer lower band */}
      <mesh position={[0, -0.6, 0.06]}>
        <planeGeometry args={[2.0, 1.0]} />
        <meshBasicMaterial color="#cfe4d6" transparent opacity={0.5} toneMapped={false} />
      </mesh>
      {/* muntins */}
      <mesh position={[0, 0, 0.07]}>
        <boxGeometry args={[0.06, 2.3, 0.03]} />
        <meshStandardMaterial color="#f3ece0" />
      </mesh>
      <mesh position={[0, 0, 0.07]}>
        <boxGeometry args={[2.0, 0.06, 0.03]} />
        <meshStandardMaterial color="#f3ece0" />
      </mesh>
      {/* curtains */}
      {[-1.28, 1.28].map((x, i) => (
        <mesh key={i} position={[x, 0, 0.18]} castShadow>
          <boxGeometry args={[0.42, 2.8, 0.12]} />
          <meshStandardMaterial color="#d9c7b0" roughness={0.95} />
        </mesh>
      ))}
      {/* warm daylight pouring in */}
      <pointLight position={[0, 0.2, 1.2]} color="#ffe3b0" intensity={5} distance={10} decay={2} />
    </group>
  );
}

export function WallArt({ position = [0, 0, 0], rotation = [0, 0, 0], color = "#c97f63" }: PropProps & { color?: string }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[0.86, 1.1, 0.05]} />
        <meshStandardMaterial color={WALNUT} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[0.72, 0.96]} />
        <meshStandardMaterial color="#f3ece0" roughness={0.6} />
      </mesh>
      {/* abstract shapes */}
      <mesh position={[-0.1, 0.12, 0.04]}>
        <circleGeometry args={[0.2, 24]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <mesh position={[0.16, -0.18, 0.04]}>
        <planeGeometry args={[0.26, 0.4]} />
        <meshStandardMaterial color="#6b8f8a" roughness={0.6} />
      </mesh>
    </group>
  );
}

export function WallSconce({ position = [0, 0, 0], rotation = [0, 0, 0] }: PropProps) {
  return (
    <group position={position} rotation={rotation}>
      {/* backplate */}
      <mesh castShadow>
        <boxGeometry args={[0.14, 0.3, 0.05]} />
        <meshStandardMaterial color={BRASS} metalness={0.6} roughness={0.3} />
      </mesh>
      {/* shade opening upward */}
      <mesh position={[0, 0.2, 0.12]} castShadow>
        <coneGeometry args={[0.16, 0.26, 18, 1, true]} />
        <meshStandardMaterial color={LINEN} emissive="#ffd9a0" emissiveIntensity={0.5} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      {/* bulb glow */}
      <mesh position={[0, 0.22, 0.13]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color="#fff0d0" toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0.3, 0.5]} color="#ffce8a" intensity={3} distance={6} decay={2} />
    </group>
  );
}

export function WallClock({ position = [0, 0, 0], rotation = [0, 0, 0] }: PropProps) {
  return (
    <group position={position} rotation={rotation}>
      {/* wooden rim */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.34, 0.06, 36]} />
        <meshStandardMaterial color={WALNUT} roughness={0.5} />
      </mesh>
      {/* face */}
      <mesh position={[0, 0, 0.035]}>
        <circleGeometry args={[0.3, 36]} />
        <meshStandardMaterial color="#f7f1e6" roughness={0.6} />
      </mesh>
      {/* hour ticks */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.25, Math.cos(a) * 0.25, 0.045]} rotation={[0, 0, -a]}>
            <boxGeometry args={[0.02, i % 3 === 0 ? 0.06 : 0.035, 0.01]} />
            <meshStandardMaterial color="#3a3027" />
          </mesh>
        );
      })}
      {/* hands */}
      <group rotation={[0, 0, -Math.PI * 0.62]}>
        <mesh position={[0, 0.09, 0.05]}>
          <boxGeometry args={[0.026, 0.17, 0.01]} />
          <meshStandardMaterial color="#2a2018" />
        </mesh>
      </group>
      <group rotation={[0, 0, Math.PI * 0.16]}>
        <mesh position={[0, 0.12, 0.055]}>
          <boxGeometry args={[0.02, 0.25, 0.01]} />
          <meshStandardMaterial color="#2a2018" />
        </mesh>
      </group>
      <mesh position={[0, 0, 0.06]}>
        <circleGeometry args={[0.028, 16]} />
        <meshStandardMaterial color={BRASS} metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Rug + greenery
// ---------------------------------------------------------------------------

export function Rug({ position = [0, 0, 0], rotation = [0, 0, 0], size = [5.2, 3.6] as [number, number] }: PropProps & { size?: [number, number] }) {
  const tex = useMemo(() => rugTexture(), []);
  return (
    <mesh position={[position[0], 0.015, position[2]]} rotation={[-Math.PI / 2, 0, rotation[1] ?? 0]} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial map={tex} roughness={0.95} />
    </mesh>
  );
}

export function Plant({ position = [0, 0, 0] }: PropProps) {
  return (
    <group position={position}>
      {/* woven basket pot */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.24, 0.6, 20]} />
        <meshStandardMaterial color="#b78a5a" roughness={0.85} />
      </mesh>
      {/* trunk */}
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 0.5, 8]} />
        <meshStandardMaterial color="#6b4a30" roughness={0.7} />
      </mesh>
      {/* fronds */}
      {[
        [0, 1.15, 0, 0.42],
        [0.28, 1.32, 0.08, 0.34],
        [-0.24, 1.28, -0.1, 0.32],
        [0.08, 1.55, -0.06, 0.28],
        [-0.12, 1.5, 0.14, 0.26],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]} castShadow>
          <sphereGeometry args={[r as number, 16, 16]} />
          <meshStandardMaterial color={i % 2 ? "#3f8f5a" : "#4f9d69"} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Entry: front door + mat (the open side of the room reads as the way in)
// ---------------------------------------------------------------------------

export function FrontDoor({ position = [0, 0, 0], rotation = [0, 0, 0] }: PropProps) {
  return (
    <group position={position} rotation={rotation}>
      {/* door slab */}
      <RoundedBox args={[1.3, 2.5, 0.12]} radius={0.03} smoothness={4} position={[0, 1.25, 0]} castShadow>
        <meshStandardMaterial color={WALNUT} roughness={0.5} />
      </RoundedBox>
      {/* panels */}
      {[0.65, -0.05, -0.75].map((y, i) => (
        <mesh key={i} position={[0, 1.25 + y, 0.07]}>
          <planeGeometry args={[0.95, 0.5]} />
          <meshStandardMaterial color={OAK} roughness={0.55} />
        </mesh>
      ))}
      {/* handle */}
      <mesh position={[0.5, 1.2, 0.1]} castShadow>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color={BRASS} metalness={0.8} roughness={0.25} />
      </mesh>
      {/* doormat */}
      <mesh position={[0, 0.02, 0.85]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.2, 0.7]} />
        <meshStandardMaterial color="#8a6f4e" roughness={0.95} />
      </mesh>
    </group>
  );
}
