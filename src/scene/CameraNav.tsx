import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Rect } from "../lib/pathfind";
import { easeToward, wheelPixels, zoomGoal, zoomTowards } from "./zoomMath";
import { clampTarget, isSceneKeyTarget, keyToAction, movedBeyond, smoothFactor, type NavAction, type RoomShortcut } from "./viewNav";

/** Spostamento da tastiera: unità al secondo a distanza 20 (più lontano = più veloce). */
const MOVE_SPEED = 12;
/** Rotazione da tastiera, radianti al secondo. */
const ROTATE_SPEED = 1.6;
/** Zoom da tastiera: frazione della distanza al secondo. */
const ZOOM_SPEED = 1.2;
/** Distanza a cui si arriva saltando a una stanza. */
const ROOM_DISTANCE = 14;
/** Quota del centro della visuale quando si salta a una stanza. */
const ROOM_Y = 0.8;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Controls = any; // OrbitControls di three-stdlib (target, minDistance, maxDistance, eventi)

interface Flight {
  dest: THREE.Vector3;
  distance: number;
}

/**
 * Comandi della visuale condivisi da casa e giardino: tastiera (WASD/frecce, Q/E, +/−,
 * 1–9, H, F), volo morbido verso una stanza e confini per il centro della visuale.
 * `onManual` scatta a ogni movimento dell'utente (mouse, touch, rotella, tastiera).
 * Va montato dentro il `<Canvas>`, accanto a `<OrbitControls ref={controlsRef}>`.
 */
export function CameraNav({
  controlsRef,
  bounds,
  home,
  rooms,
  enabled = true,
  onManual,
  onFollow,
}: {
  controlsRef: React.RefObject<Controls>;
  bounds: Rect;
  home: { x: number; y: number; z: number; distance: number };
  rooms?: RoomShortcut[];
  /** Falso quando un'altra vista sta sopra questa (es. il giardino sopra la casa). */
  enabled?: boolean;
  onManual?: () => void;
  /** Tasto F: torna a seguire l'agente. Assente dove non c'è niente da seguire. */
  onFollow?: () => void;
}) {
  const { camera } = useThree();
  // Tasti tenuti premuti, per codice fisico: così il rilascio torna anche se Shift cambia `key`.
  const held = useRef(new Map<string, NavAction>());
  const flight = useRef<Flight | null>(null);
  // Zoom morbido: distanza-meta e punto del pavimento sotto il cursore da tenere fermo.
  const zoom = useRef<{ goal: number; point: [number, number] | null } | null>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const floorHit = useMemo(() => new THREE.Vector3(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  // I valori che cambiano a ogni render passano da un ref, così i listener non si rimontano.
  const latest = useRef({ home, rooms, enabled, onManual, onFollow });
  latest.current = { home, rooms, enabled, onManual, onFollow };

  useEffect(() => {
    const heldKeys = held.current;
    const onKeyDown = (e: KeyboardEvent) => {
      const { enabled: on, home: h, rooms: rs, onManual: manual, onFollow: follow } = latest.current;
      // Con Cmd premuto il Mac non manda il rilascio degli altri tasti: si azzera tutto.
      if (e.metaKey) heldKeys.clear();
      if (!on || e.ctrlKey || e.metaKey || e.altKey || !isSceneKeyTarget(e.target)) return;
      const action = keyToAction(e.key);
      if (!action) return;
      if (action.kind === "follow") {
        if (!follow) return;
        e.preventDefault();
        flight.current = null;
        follow();
        return;
      }
      if (action.kind === "room") {
        const room = rs?.[action.index];
        if (!room) return;
        e.preventDefault();
        zoom.current = null;
        flight.current = { dest: new THREE.Vector3(room.x, ROOM_Y, room.z), distance: ROOM_DISTANCE };
        manual?.();
        return;
      }
      if (action.kind === "home") {
        e.preventDefault();
        zoom.current = null;
        flight.current = { dest: new THREE.Vector3(h.x, h.y, h.z), distance: h.distance };
        manual?.();
        return;
      }
      e.preventDefault();
      heldKeys.set(e.code || e.key, action);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      heldKeys.delete(e.code || e.key);
    };
    const clear = () => heldKeys.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clear);
      heldKeys.clear();
    };
  }, []);

  // Mouse, touch e rotella: conta come movimento manuale solo un vero trascinamento (oltre 6 px)
  // o la rotella. Un clic fermo (selezionare un agente, mandarlo sul pavimento) non sgancia il segui.
  const { gl } = useThree();
  useEffect(() => {
    const el = gl.domElement;
    let down: { x: number; y: number } | null = null;
    const manual = () => {
      flight.current = null;
      latest.current.onManual?.();
    };
    const onDown = (e: PointerEvent) => {
      down = controlsRef.current?.enabled === false ? null : { x: e.clientX, y: e.clientY };
    };
    const onMove = (e: PointerEvent) => {
      if (down && movedBeyond(down.x, down.y, e.clientX, e.clientY)) {
        down = null;
        zoom.current = null;
        manual();
      }
    };
    const onUp = () => {
      down = null;
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    // La rotella (e il pizzico del trackpad, che arriva come rotella con Ctrl) la gestiamo noi:
    // la intercettiamo sul contenitore prima che arrivi a OrbitControls, che zoomerebbe a scatti.
    // Il pizzico a due dita su touch resta a OrbitControls.
    const host = el.parentElement ?? el;
    const onWheel = (e: WheelEvent) => {
      const controls: Controls = controlsRef.current;
      if (!controls || controls.enabled === false) return;
      e.preventDefault();
      e.stopPropagation();
      const px = wheelPixels(e.deltaY, e.deltaMode, e.ctrlKey);
      if (px === 0) return;
      const dist = camera.position.distanceTo(controls.target);
      const goal = zoomGoal(zoom.current?.goal ?? dist, px, controls.minDistance, controls.maxDistance);
      // Il punto del pavimento (alla quota del centro) sotto il cursore.
      const rect = el.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -controls.target.y);
      const hit = raycaster.ray.intersectPlane(plane, floorHit);
      zoom.current = { goal, point: hit ? [hit.x, hit.z] : null };
      manual();
    };
    host.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      host.removeEventListener("wheel", onWheel, { capture: true });
    };
  }, [gl, controlsRef, camera, ndc, raycaster, floorHit]);

  useFrame((_, delta) => {
    const controls: Controls = controlsRef.current;
    if (!controls) return;
    if (!latest.current.enabled) held.current.clear();
    const d = Math.min(delta, 0.05);
    const target: THREE.Vector3 = controls.target;

    if (held.current.size > 0) {
      flight.current = null;
      zoom.current = null;
      offset.copy(camera.position).sub(target);
      let dist = offset.length() || 1;
      forward.set(-offset.x, 0, -offset.z).normalize();
      right.crossVectors(forward, up).normalize();
      for (const a of held.current.values()) {
        if (a.kind === "move") {
          const step = MOVE_SPEED * (dist / 20) * d;
          const v = a.dir === "forward" || a.dir === "back" ? forward : right;
          const sign = a.dir === "back" || a.dir === "left" ? -1 : 1;
          target.addScaledVector(v, step * sign);
        } else if (a.kind === "rotate") {
          offset.applyAxisAngle(up, a.dir * ROTATE_SPEED * d);
        } else if (a.kind === "zoom") {
          dist = THREE.MathUtils.clamp(dist * (1 + a.dir * ZOOM_SPEED * d), controls.minDistance, controls.maxDistance);
          offset.setLength(dist);
        }
      }
      camera.position.copy(target).add(offset);
      latest.current.onManual?.();
    } else if (zoom.current) {
      const z = zoom.current;
      offset.copy(camera.position).sub(target);
      const dist = offset.length() || 1;
      const next = easeToward(dist, z.goal, d);
      if (z.point) {
        const [tx, tz] = zoomTowards([target.x, target.z], z.point, dist, next);
        target.x = tx;
        target.z = tz;
      }
      offset.setLength(next);
      camera.position.copy(target).add(offset);
      if (Math.abs(next - z.goal) < 0.01) zoom.current = null;
    } else if (flight.current) {
      const f = flight.current;
      offset.copy(camera.position).sub(target);
      const dist = offset.length() || 1;
      const goal = THREE.MathUtils.clamp(f.distance, controls.minDistance, controls.maxDistance);
      // La meta resta dentro i confini anche se la casa si è ristretta durante il volo.
      const [dx, dz] = clampTarget(f.dest.x, f.dest.z, bounds);
      f.dest.x = dx;
      f.dest.z = dz;
      const k = smoothFactor(d);
      const nextDist = THREE.MathUtils.lerp(dist, goal, k);
      target.lerp(f.dest, k);
      offset.setLength(nextDist);
      camera.position.copy(target).add(offset);
      if (target.distanceTo(f.dest) < 0.05 && Math.abs(nextDist - goal) < 0.05) flight.current = null;
    }

    // Il centro della visuale non esce dalla casa (o dal giardino): si sposta tutto insieme.
    const [cx, cz] = clampTarget(target.x, target.z, bounds);
    if (cx !== target.x || cz !== target.z) {
      camera.position.x += cx - target.x;
      camera.position.z += cz - target.z;
      target.x = cx;
      target.z = cz;
    }
  });

  return null;
}
