import type { Vec2 } from "../types";

/** An axis-aligned rectangle footprint on the floor plane (world units). */
export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface PathOpts {
  /** Walkable bounds; defaults to the office room. */
  bounds?: Rect;
  /** Grid cell size in world units. */
  cell?: number;
  /** Agent clearance radius — obstacles are inflated by this much. */
  radius?: number;
}

// Defaults mirror ROOM in data/world.ts (kept here to avoid a circular import).
const DEFAULT_BOUNDS: Rect = { minX: -13, maxX: 13, minZ: -9, maxZ: 9 };
const DEFAULT_CELL = 0.5;
const DEFAULT_RADIUS = 0.55;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Liang–Barsky: does the segment a→b touch the (already inflated) rect? */
function segHitsRect(ax: number, az: number, bx: number, bz: number, r: Rect): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  const p = [-dx, dx, -dz, dz];
  const q = [ax - r.minX, r.maxX - ax, az - r.minZ, r.maxZ - az];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false; // parallel and outside this slab
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return t0 <= t1;
}

/** True when the straight segment a→b clears every (inflated) obstacle. */
function lineClear(a: Vec2, b: Vec2, inflated: Rect[]): boolean {
  return !inflated.some((r) => segHitsRect(a[0], a[1], b[0], b[1], r));
}

/** True when a point is at least `radius` away from every obstacle footprint. */
export function isPointClear(p: Vec2, obstacles: Rect[], radius = DEFAULT_RADIUS): boolean {
  return !obstacles.some(
    (r) => p[0] >= r.minX - radius && p[0] <= r.maxX + radius && p[1] >= r.minZ - radius && p[1] <= r.maxZ + radius,
  );
}

/** Drop intermediate waypoints that a straight line-of-sight can skip (funnel). */
function stringPull(pts: Vec2[], inflated: Rect[]): Vec2[] {
  if (pts.length <= 2) return pts;
  const out: Vec2[] = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    for (; j > i + 1; j--) {
      if (lineClear(pts[i], pts[j], inflated)) break;
    }
    out.push(pts[j]);
    i = j;
  }
  return out;
}

/**
 * Find a walking path from `start` to `goal` that steers around the given
 * obstacle footprints. Returns the list of waypoints to walk through, the last
 * of which is always `goal`. When the straight line is already clear (or no path
 * is found) it returns just `[goal]`, so the caller can always move toward the
 * destination. Pure — no allocations leak out — so it can be unit-tested.
 */
export function findPath(start: Vec2, goal: Vec2, obstacles: Rect[], opts: PathOpts = {}): Vec2[] {
  const bounds = opts.bounds ?? DEFAULT_BOUNDS;
  const cell = opts.cell ?? DEFAULT_CELL;
  const radius = opts.radius ?? DEFAULT_RADIUS;
  const inflated = obstacles.map((r) => ({
    minX: r.minX - radius,
    maxX: r.maxX + radius,
    minZ: r.minZ - radius,
    maxZ: r.maxZ + radius,
  }));

  // Fast path: nothing in the way.
  if (lineClear(start, goal, inflated)) return [goal];

  const cols = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cell));
  const rows = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / cell));
  const cx = (i: number) => bounds.minX + (i + 0.5) * cell;
  const cz = (j: number) => bounds.minZ + (j + 0.5) * cell;
  const toCol = (x: number) => clamp(Math.floor((x - bounds.minX) / cell), 0, cols - 1);
  const toRow = (z: number) => clamp(Math.floor((z - bounds.minZ) / cell), 0, rows - 1);
  const blockedAt = (i: number, j: number): boolean => {
    const x = cx(i);
    const z = cz(j);
    return inflated.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
  };

  const startCol = toCol(start[0]);
  const startRow = toRow(start[1]);
  const goalCol = toCol(goal[0]);
  const goalRow = toRow(goal[1]);
  const idx = (i: number, j: number) => j * cols + i;
  const startK = idx(startCol, startRow);
  const goalK = idx(goalCol, goalRow);

  // A* over the grid (8-connected, no corner cutting).
  const open: number[] = [startK];
  const gScore = new Map<number, number>([[startK, 0]]);
  const fScore = new Map<number, number>([[startK, 0]]);
  const came = new Map<number, number>();
  const closed = new Set<number>();
  const h = (i: number, j: number) => Math.hypot(i - goalCol, j - goalRow);

  let found = false;
  let guard = cols * rows + 1;
  while (open.length && guard-- > 0) {
    // pop the lowest fScore (small grids → linear scan is fine)
    let best = 0;
    for (let k = 1; k < open.length; k++) {
      if ((fScore.get(open[k]) ?? Infinity) < (fScore.get(open[best]) ?? Infinity)) best = k;
    }
    const current = open.splice(best, 1)[0];
    if (current === goalK) {
      found = true;
      break;
    }
    closed.add(current);
    const ci = current % cols;
    const cj = Math.floor(current / cols);
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (di === 0 && dj === 0) continue;
        const ni = ci + di;
        const nj = cj + dj;
        if (ni < 0 || ni >= cols || nj < 0 || nj >= rows) continue;
        const nk = idx(ni, nj);
        if (closed.has(nk)) continue;
        // a blocked cell is only allowed if it's the goal cell (so we can reach
        // a destination tucked against a piece of furniture)
        if (blockedAt(ni, nj) && nk !== goalK) continue;
        // no diagonal corner cutting
        if (di !== 0 && dj !== 0 && (blockedAt(ci + di, cj) || blockedAt(ci, cj + dj))) continue;
        const step = di !== 0 && dj !== 0 ? Math.SQRT2 : 1;
        const tentative = (gScore.get(current) ?? Infinity) + step;
        if (tentative < (gScore.get(nk) ?? Infinity)) {
          came.set(nk, current);
          gScore.set(nk, tentative);
          fScore.set(nk, tentative + h(ni, nj));
          if (!open.includes(nk)) open.push(nk);
        }
      }
    }
  }

  if (!found) return [goal]; // unreachable on the grid — fall back to a straight line

  // reconstruct grid cells, then snap to the real start/goal and simplify
  const cells: Vec2[] = [];
  let k: number | undefined = goalK;
  while (k !== undefined) {
    const i = k % cols;
    const j = Math.floor(k / cols);
    cells.unshift([cx(i), cz(j)]);
    k = came.get(k);
  }
  const pts: Vec2[] = [start, ...cells, goal];
  const pulled = stringPull(pts, inflated);
  // drop the start point; guarantee the path ends exactly on the goal
  const waypoints = pulled.slice(1);
  if (waypoints.length === 0 || waypoints[waypoints.length - 1] !== goal) {
    waypoints.push(goal);
  }
  return waypoints;
}
