/** Small, dependency-free helpers used across GrooveLab. */

/** Reasonably unique id for tracks, lanes, notes, projects. */
export const uid = (prefix = 'id'): string =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Re-map a value from one numeric range to another (no clamping). */
export const mapRange = (
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number => outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin);

export const round = (v: number, decimals = 0): number => {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
};

/**
 * Exponential mapping for "musical" controls like filter cutoff — equal knob
 * travel feels equal to the ear. `t` is 0..1, returns a value in [min, max].
 */
export const expMap = (t: number, min: number, max: number): number =>
  min * (max / min) ** clamp(t, 0, 1);

/** Inverse of {@link expMap}: value -> 0..1 knob position. */
export const expUnmap = (v: number, min: number, max: number): number =>
  Math.log(clamp(v, min, max) / min) / Math.log(max / min);

/** Trailing-edge debounce, used for localStorage auto-save. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let timer: number | undefined;
  return (...args: A): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), ms);
  };
}
