// ---------------------------------------------------------------------------
// Daylight helpers shared between the day/night cycle and the interior lamps.
//
// The office already dims/warms with the real time of day (see DayNightCycle in
// OfficeScene). The interior lamps, though, used to burn at full intensity even
// at noon — unrealistic and wasteful. These pure helpers derive a 0..1 "dayness"
// from the clock and a lamp-brightness multiplier that is full at night and
// drops to a low floor in bright daylight, so the room glows warm in the evening
// and reads crisp at midday.
// ---------------------------------------------------------------------------

/**
 * Fraction of "daylight" at a given moment: 0 while the sun is below the horizon
 * (night), rising to 1 at solar noon. Mirrors the sun curve the DayNightCycle
 * uses so lamps and sky stay in step.
 */
export function daynessAt(date: Date): number {
  const t = (date.getHours() + date.getMinutes() / 60) / 24; // 0..1 across the day
  const sunY = Math.sin(t * Math.PI * 2 - Math.PI / 2); // -1 midnight … +1 noon
  return Math.max(0, sunY);
}

/**
 * Interior-lamp brightness multiplier for a given dayness. Full (1) at night,
 * easing down to `floor` at full daylight. `floor` keeps a faint warmth so the
 * shades never read as dead even at noon.
 */
export function lampGain(dayness: number, floor = 0.12): number {
  const d = Math.min(1, Math.max(0, dayness));
  return floor + (1 - floor) * (1 - d);
}

/**
 * Frame-shared daylight state. The DayNightCycle writes `dayness` every frame;
 * the lamps read it in their own frame loop to ramp their light. A plain mutable
 * singleton (not React state) so it never triggers re-renders — the standard
 * react-three-fiber pattern for per-frame values.
 */
export const daylight = { dayness: 1 };
