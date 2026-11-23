/**
 * Calcoli puri dello zoom morbido: rotella, trackpad e pizzico diventano una distanza-meta
 * che la telecamera raggiunge con un'andatura uguale a ogni frequenza dello schermo.
 */

/** Uno scatto di rotella non sposta mai più di così (alcune rotelle mandano valori enormi). */
const MAX_WHEEL_PX = 250;
/** Il pizzico del trackpad arriva come rotella con Ctrl e passi molto piccoli: va amplificato. */
const PINCH_GAIN = 8;
/** Sensibilità: 100 px di rotella cambiano la distanza di circa il 16%. */
const ZOOM_PER_PX = 0.0015;
/** Velocità con cui la distanza raggiunge la meta. */
const EASE_RATE = 14;

/** Il movimento della rotella in pixel, qualunque sia l'unità dell'evento. */
export function wheelPixels(deltaY: number, deltaMode: number, pinch: boolean): number {
  let px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 800 : deltaY;
  if (pinch) px *= PINCH_GAIN;
  return Math.max(-MAX_WHEEL_PX, Math.min(MAX_WHEEL_PX, px));
}

/** La nuova distanza-meta: proporzionale (stesso passo avanti e indietro), dentro i limiti. */
export function zoomGoal(goal: number, px: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, goal * Math.exp(px * ZOOM_PER_PX)));
}

/** Il centro della visuale dopo uno zoom da `from` a `to`, tenendo fermo il punto sotto il cursore. */
export function zoomTowards(
  target: [number, number],
  point: [number, number],
  from: number,
  to: number,
): [number, number] {
  const r = to / from;
  return [point[0] + (target[0] - point[0]) * r, point[1] + (target[1] - point[1]) * r];
}

/** Un passo morbido da `value` verso `goal` in `delta` secondi. */
export function easeToward(value: number, goal: number, delta: number): number {
  return value + (goal - value) * (1 - Math.exp(-EASE_RATE * delta));
}
