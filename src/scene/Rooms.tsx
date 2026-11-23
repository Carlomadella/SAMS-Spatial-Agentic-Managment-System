// Stanze iconiche (23/11): le sei stanze della casa, ognuna con il suo oggetto simbolo
// che reagisce al lavoro degli agenti. Gli ingombri dei mobili vengono da
// `house().furniture` (world.ts), così quello che si vede è quello che il pathfinder evita.
//
//   Biblioteca (lampade accese)  | Officina (monitor con il file) | Laboratorio (semaforo)
//   Salotto (pausa, caffè)       | Reparto revisioni (schermo)    | Camera (6 letti)

import { useEffect, useState } from "react";
import { Html, RoundedBox } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import {
  Armchair,
  Bed,
  Bench,
  Bookshelf,
  CoffeeMachine,
  CoffeeTable,
  Desk,
  FloorLamp,
  FrontDoor,
  LabBench,
  Plant,
  ReadingTable,
  Rug,
  ServerRack,
  Sideboard,
  Sofa,
  TrafficLamp,
  TVUnit,
  WallArt,
  WallClock,
  WallSconce,
  Window,
} from "./Furniture";
import { house } from "../data/world";
import { useStore } from "../store/useStore";
import type { RoomId } from "../lib/roomFor";
import type { Rect } from "../lib/pathfind";
import type { Agent } from "../types";
import { labLamp, pendingCount, ROOM_SIGNS } from "./roomSigns";
import { getArrangement } from "../lib/officeLayout";

/** Centro del gruppo divano-tavolino-poltrona (per ruotarlo attorno a sé stesso). */
const LOUNGE_CENTER: [number, number] = [-15, 4.7];

type V3 = [number, number, number];
/** Avvolge un mobile spostabile a mano (il `Movable` della scena). */
type Movable = (id: string, position: V3, child: React.ReactNode, rotation?: V3) => React.ReactNode;

const centre = (r: Rect): [number, number] => [(r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2];
const inside = (a: Agent, r: Rect) => a.position[0] >= r.minX && a.position[0] <= r.maxX && a.position[1] >= r.minZ && a.position[1] <= r.maxZ;

/** Pavimento colorato di ogni stanza: si distinguono anche dall'alto. */
const FLOOR_TINT: Record<RoomId, string> = {
  biblioteca: "#7b5a3c",
  officina: "#4d5d70",
  laboratorio: "#c9d3de",
  salotto: "#a3765a",
  revisioni: "#8c1d24",
  camera: "#6b7f99",
};

/** Mezzo spessore + un filo: la faccia di un muro di fondo, verso l'interno della stanza. */
const BACK_WALL_Z = { back: -9 + 0.2, front: 0.16 + 0.04 };

function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Cartello della stanza sulla parete di fondo: icona e nome. Cliccato, manda lì l'agente selezionato. */
function RoomSign({ id }: { id: RoomId }) {
  const L = house();
  const [cx, cz] = centre(L.rooms[id]);
  const z = cz < 0 ? BACK_WALL_Z.back : BACK_WALL_Z.front;
  const sign = ROOM_SIGNS[id];
  const onClick = () => {
    const { selectedAgentId, sendToZone } = useStore.getState();
    if (selectedAgentId) sendToZone(selectedAgentId, id);
  };
  return (
    <Html position={[cx, 2.75, z]} center distanceFactor={11} zIndexRange={[16, 0]}>
      <button
        type="button"
        onClick={onClick}
        title="Con un agente selezionato: mandalo qui"
        className="select-none whitespace-nowrap rounded-md border border-black/20 bg-white/90 px-2 py-0.5 text-[12px] font-semibold text-slate-800 shadow-sm"
      >
        <span aria-hidden>{sign.icon}</span> {sign.label}
      </button>
    </Html>
  );
}

function RoomFloor({ id }: { id: RoomId }) {
  const r = house().rooms[id];
  const [cx, cz] = centre(r);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.011, cz]} receiveShadow>
      <planeGeometry args={[r.maxX - r.minX + 1, r.maxZ - r.minZ + 1]} />
      <meshStandardMaterial color={FLOOR_TINT[id]} transparent opacity={id === "revisioni" ? 0.95 : 0.4} roughness={0.95} />
    </mesh>
  );
}

const at = (r: Rect, y = 0): V3 => [(r.minX + r.maxX) / 2, y, (r.minZ + r.maxZ) / 2];

/** Biblioteca: scaffali pieni e un tavolo da lettura le cui lampade si accendono quando qualcuno legge. */
function Biblioteca({ agents }: { agents: Agent[] }) {
  const L = house();
  const [shelfA, shelfB, table] = L.furniture.biblioteca;
  const reading = agents.some((a) => a.status === "working" && inside(a, L.rooms.biblioteca));
  return (
    <group>
      <Bookshelf position={at(shelfA)} />
      <Bookshelf position={at(shelfB)} />
      <Bookshelf position={[-19.2, 0, -5]} rotation={[0, Math.PI / 2, 0]} />
      <ReadingTable position={at(table)} lit={reading} />
      <FloorLamp position={[-8.2, 0, -1.6]} />
      <Plant position={[-7.9, 0, -8.2]} />
    </group>
  );
}

/** Officina: quattro scrivanie; il monitor di chi scrive mostra il file appena scritto. */
function Officina({ agents }: { agents: Agent[] }) {
  const L = house();
  const lastWrite = useStore((s) => s.lastWrite);
  const seats = L.seats.officina;
  return (
    <group>
      {L.furniture.officina.map((desk, i) => {
        const seat = seats[i];
        const who = agents.find(
          (a) => a.status === "working" && Math.hypot(a.position[0] - seat[0], a.position[1] - seat[1]) < 0.8,
        );
        const [x, , z] = at(desk);
        return (
          <group key={i}>
            <Desk position={[x, 0, z]} />
            {who && (
              <Html position={[x, 1.75, z - 0.25]} center distanceFactor={7} zIndexRange={[9, 0]} pointerEvents="none">
                <div className="pointer-events-none select-none whitespace-nowrap rounded-[3px] bg-[#0b0f17] px-1.5 py-0.5 font-mono text-[9px] text-emerald-300 ring-1 ring-sky-900/60">
                  ✎ {lastWrite[who.id] ?? "al lavoro"}
                </div>
              </Html>
            )}
          </group>
        );
      })}
      <WallArt position={[0, 1.9, -8.84]} color="#5b6b7d" />
      <WallSconce position={[-5.5, 2.15, -8.84]} />
      <WallSconce position={[5.5, 2.15, -8.84]} />
    </group>
  );
}

/** Laboratorio: banconi, rack dei server e la grande lampada-semaforo dei test. */
function Laboratorio({ agents }: { agents: Agent[] }) {
  const L = house();
  const [benchA, benchB, island, rack] = L.furniture.laboratorio;
  const labResult = useStore((s) => s.labResult);
  const now = useNow(1000);
  const working = agents.some((a) => a.status === "working" && inside(a, L.rooms.laboratorio));
  return (
    <group>
      <LabBench position={at(benchA)} />
      <LabBench position={at(benchB)} />
      <LabBench position={at(island)} />
      <ServerRack position={at(rack)} />
      <TrafficLamp position={[13, 2.15, -8.62]} color={labLamp(working, labResult, now)} />
      <Plant position={[7.9, 0, -8.2]} />
    </group>
  );
}

/** Salotto: divano, TV con i task in coda, macchinetta del caffè (pausa per tutti). */
function Salotto({ queue, movable }: { queue: React.ReactNode; movable: Movable }) {
  const L = house();
  const [sofa, table, armchair, coffee] = L.furniture.salotto;
  // Disposizione del salotto scelta dall'utente (persistita): il gruppo divano-tavolino-
  // poltrona ruota attorno al proprio centro e si sposta in blocco.
  const lounge = getArrangement(useStore((s) => s.officeLayout));
  const [lx, lz] = LOUNGE_CENTER;
  return (
    <group>
      <group position={[lx + lounge.loungeOffset[0], lounge.loungeOffset[1], lz + lounge.loungeOffset[2]]} rotation={[0, lounge.loungeSpin, 0]}>
        <group position={[-lx, 0, -lz]}>
          <Rug position={[-16, 0, 4.7]} />
          <Sofa position={at(sofa)} />
          <CoffeeTable position={at(table)} />
          <Armchair position={at(armchair)} rotation={[0, -Math.PI / 2, 0]} />
        </group>
      </group>
      <CoffeeMachine position={at(coffee)} rotation={[0, Math.PI / 2, 0]} />
      {movable("salotto-tv", [-19.1, 0, 6.6], <TVUnit />, [0, Math.PI / 2, 0])}
      {queue}
      {movable("salotto-lamp", [-8.2, 0, 1.6], <FloorLamp />)}
      {movable("salotto-plant", [-8.2, 0, 8.2], <Plant />)}
      <WallClock position={[-19.34, 2.1, 3.6]} rotation={[0, Math.PI / 2, 0]} />
      <FrontDoor position={[-11, 0, 8.6]} />
    </group>
  );
}

/** Reparto revisioni: banco con lo schermo grande (quante conferme aspettano) e due panche. */
function Revisioni({ agents }: { agents: Agent[] }) {
  const L = house();
  const [desk, benchA, benchB] = L.furniture.revisioni;
  const openReview = useStore((s) => s.openReview);
  const waiting = pendingCount(agents);
  const open = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    openReview(null);
  };
  const [dx, , dz] = at(desk);
  return (
    <group>
      {/* banco con lo schermo rivolto verso chi aspetta (cliccabile) */}
      <group
        position={[dx, 0, dz]}
        rotation={[0, Math.PI, 0]}
        onClick={open}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "default"; }}
      >
        <RoundedBox args={[3.2, 0.12, 1.2]} radius={0.04} smoothness={4} position={[0, 0.92, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#1c1c1e" roughness={0.5} />
        </RoundedBox>
        {[-1.4, 1.4].map((x) => (
          <mesh key={x} position={[x, 0.45, 0]} castShadow>
            <boxGeometry args={[0.12, 0.9, 1.0]} />
            <meshStandardMaterial color="#2a2a2d" roughness={0.6} />
          </mesh>
        ))}
        <mesh position={[0, 1.75, -0.35]} castShadow>
          <boxGeometry args={[2.4, 1.3, 0.08]} />
          <meshStandardMaterial color="#111" roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.75, -0.3]}>
          <planeGeometry args={[2.2, 1.1]} />
          <meshStandardMaterial color="#f2f2f2" emissive="#c8202b" emissiveIntensity={waiting > 0 ? 0.7 : 0.1} roughness={0.4} />
        </mesh>
      </group>
      <Html position={[dx, 1.75, dz - 0.5]} center distanceFactor={8} zIndexRange={[16, 0]}>
        <button
          type="button"
          onClick={() => openReview(null)}
          className="select-none whitespace-nowrap rounded-md border border-red-700/70 bg-black/85 px-2 py-1 text-center text-[12px] font-semibold text-white shadow-md"
        >
          {waiting > 0 ? `${waiting} in attesa` : "Nessuno in attesa"}
        </button>
      </Html>
      <Bench position={at(benchA)} />
      <Bench position={at(benchB)} />
      <Plant position={[-5.6, 0, 8.2]} />
      <Plant position={[5.6, 0, 8.2]} />
    </group>
  );
}

const BED_COLORS = ["#6b8f8a", "#b07a5e", "#8a6f9e", "#5a8fb0", "#b0975a", "#8aae6a"];

/** Camera: sei letti; le lampade fanno luce calda di notte. */
function Camera({ movable }: { movable: Movable }) {
  const L = house();
  return (
    <group>
      {L.beds.map(([x, z], i) => movable(`camera-bed-${i}`, [x, 0, z], <Bed color={BED_COLORS[i % BED_COLORS.length]} />))}
      {movable("camera-sideboard", [19.1, 0, 1.6], <Sideboard />, [0, -Math.PI / 2, 0])}
      {movable("camera-plant", [7.9, 0, 8.2], <Plant />)}
      <FloorLamp position={[18.8, 0, 8.3]} />
      <Window position={[19.34, 1.5, 5.4]} rotation={[0, -Math.PI / 2, 0]} />
      <Window position={[19.34, 1.5, -4.5]} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}

/**
 * Tutte le stanze. `movable` avvolge i mobili spostabili a mano (Salotto e Camera) con
 * il `Movable` della scena; `queue` è la lavagna dei task in coda, montata sulla TV.
 */
export function Rooms({
  movable,
  queue,
}: {
  movable: Movable;
  queue: React.ReactNode;
}) {
  const agents = useStore((s) => s.agents);
  const ids = Object.keys(house().rooms) as RoomId[];
  return (
    <group>
      {ids.map((id) => (
        <group key={id}>
          <RoomFloor id={id} />
          <RoomSign id={id} />
        </group>
      ))}
      <Biblioteca agents={agents} />
      <Officina agents={agents} />
      <Laboratorio agents={agents} />
      <Salotto queue={queue} movable={movable} />
      <Revisioni agents={agents} />
      <Camera movable={movable} />
    </group>
  );
}
