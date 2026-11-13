import type { WebGLRenderer } from "three";

/**
 * In produzione three.js non controlla più i log di compilazione degli shader.
 * Su Windows il compilatore D3D (ANGLE) scrive avvisi innocui come
 * "warning X4000: use of potentially uninitialized variable" e three li stampava
 * in console a ogni avvio. In sviluppo il controllo resta attivo, così un vero
 * errore di shader si vede ancora. Spegnerlo fa anche risparmiare una chiamata
 * sincrona alla GPU per ogni programma compilato.
 */
export function configureRenderer(gl: WebGLRenderer, dev: boolean = import.meta.env.DEV): void {
  gl.debug.checkShaderErrors = dev;
}
