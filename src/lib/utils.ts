import { clsx, type ClassValue } from "clsx";

/** Tailwind-friendly className combiner. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

let _seq = 0;
/** Short, collision-resistant id good enough for client-side entities. */
export function uid(prefix = "id"): string {
  _seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${_seq.toString(36)}`;
}

/** Format an epoch timestamp as HH:MM:SS for the event log. */
export function clock(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-GB", { hour12: false });
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
