/**
 * Tiny typed pub/sub. The whole app is glued together with this instead of a
 * heavy state library — the audio engine and the UI both listen for the small
 * set of events the stores emit. Keep it explicit and easy to reason about.
 */
export type Listener<T> = (payload: T) => void;

export class Emitter<Events extends Record<string, unknown>> {
  private listeners: { [K in keyof Events]?: Set<Listener<Events[K]>> } = {};

  /** Subscribe. Returns an unsubscribe function for convenience. */
  on<K extends keyof Events>(event: K, fn: Listener<Events[K]>): () => void {
    (this.listeners[event] ??= new Set()).add(fn);
    return () => this.off(event, fn);
  }

  off<K extends keyof Events>(event: K, fn: Listener<Events[K]>): void {
    this.listeners[event]?.delete(fn);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    // Copy to a temp array so listeners can unsubscribe during dispatch safely.
    this.listeners[event] && [...this.listeners[event]!].forEach((fn) => fn(payload));
  }
}
