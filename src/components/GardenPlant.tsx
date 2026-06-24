import type { Stage } from "../lib/garden";

const GREEN = "#3aa657";
const GREEN_D = "#2c7d43";
const SOIL = "#6b4f3a";
const POT = "#c2724a";

function Leaf({ x, y, dir, scale = 1 }: { x: number; y: number; dir: number; scale?: number }) {
  return (
    <path
      d={`M${x} ${y} q ${18 * dir} -10 ${30 * dir} 2 q -${14 * dir} 12 -${30 * dir} -2 Z`}
      fill={GREEN}
      style={{ transform: `scale(${scale})`, transformOrigin: `${x}px ${y}px` }}
    />
  );
}

function Foliage({ stage }: { stage: Stage }) {
  switch (stage) {
    case "seed":
      return (
        <>
          <ellipse cx="120" cy="190" rx="9" ry="6" fill={SOIL} />
          <circle cx="120" cy="188" r="3.2" fill="#caa46a" />
        </>
      );
    case "sprout":
      return (
        <>
          <rect x="117" y="170" width="6" height="26" rx="3" fill={GREEN_D} />
          <Leaf x={120} y={176} dir={1} scale={0.8} />
          <Leaf x={120} y={176} dir={-1} scale={0.8} />
        </>
      );
    case "sapling":
      return (
        <>
          <rect x="117" y="142" width="6" height="54" rx="3" fill={GREEN_D} />
          <Leaf x={120} y={168} dir={1} />
          <Leaf x={120} y={156} dir={-1} />
          <Leaf x={120} y={146} dir={1} scale={0.9} />
        </>
      );
    case "bush":
      return (
        <>
          <rect x="117" y="156" width="6" height="40" rx="3" fill={GREEN_D} />
          <circle cx="120" cy="150" r="30" fill={GREEN} />
          <circle cx="98" cy="162" r="20" fill={GREEN} />
          <circle cx="142" cy="162" r="20" fill={GREEN} />
        </>
      );
    case "tree":
      return (
        <>
          <rect x="114" y="120" width="12" height="78" rx="5" fill="#7a5230" />
          <circle cx="120" cy="110" r="44" fill={GREEN} />
          <circle cx="90" cy="128" r="26" fill={GREEN} />
          <circle cx="150" cy="128" r="26" fill={GREEN} />
        </>
      );
    case "blooming":
      return (
        <>
          <rect x="114" y="120" width="12" height="78" rx="5" fill="#7a5230" />
          <circle cx="120" cy="108" r="46" fill={GREEN} />
          <circle cx="88" cy="126" r="28" fill={GREEN} />
          <circle cx="152" cy="126" r="28" fill={GREEN} />
          {[
            [120, 92],
            [96, 116],
            [146, 116],
            [120, 130],
            [108, 104],
            [134, 104],
          ].map(([fx, fy], i) => (
            <g key={i}>
              <circle cx={fx} cy={fy} r="6" fill="#ff7eb6" />
              <circle cx={fx} cy={fy} r="2.4" fill="#ffd34d" />
            </g>
          ))}
        </>
      );
  }
}

export function GardenPlant({ stage, size = 240 }: { stage: Stage; size?: number }) {
  return (
    <svg viewBox="0 0 240 240" width={size} height={size} role="img" aria-label={`pianta: ${stage}`}>
      <rect width="240" height="240" rx="18" fill="#eaf6ef" />
      <path d="M86 196 L154 196 L146 224 L94 224 Z" fill={POT} />
      <ellipse cx="120" cy="196" rx="34" ry="8" fill={SOIL} />
      <g className="cg-sway">
        <Foliage stage={stage} />
      </g>
    </svg>
  );
}
