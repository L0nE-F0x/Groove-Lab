/**
 * controller — the thin layer between the UI and the audio engine.
 *
 * It owns the engine's single callbacks (step + play-state) and re-broadcasts
 * them to any number of views, runs one shared requestAnimationFrame loop for
 * meters, lazily boots the AudioContext on the first user gesture, and exposes
 * a tiny toast helper. Views talk to *this*, never to Tone directly.
 */
import { engine } from '../audio/engine';
import { projectStore } from './state/projectStore';
import { el } from '../utils/dom';

let audioReady = false;
let starting = false;
let playing = false;

const readyListeners = new Set<() => void>();
const playListeners = new Set<(p: boolean) => void>();
const stepListeners = new Set<(step: number) => void>();
const frameListeners = new Set<() => void>();

// The engine exposes exactly one of each callback — fan them out here.
engine.onPlayStateChange = (p) => {
  playing = p;
  playListeners.forEach((fn) => fn(p));
};
engine.onStep = (s) => stepListeners.forEach((fn) => fn(s));

export const audio = {
  get ready() {
    return audioReady;
  },
  get playing() {
    return playing;
  },
  /** Boot Tone from a user gesture. Returns true once audio is live. */
  async ensure(): Promise<boolean> {
    if (audioReady) return true;
    if (starting) return false;
    starting = true;
    try {
      await engine.init(projectStore.current);
      audioReady = true;
      readyListeners.forEach((fn) => fn());
      return true;
    } catch (err) {
      console.error('GrooveLab: audio failed to start', err);
      toast('Audio could not start — click Play to try again.', 'error');
      return false;
    } finally {
      starting = false;
    }
  },
  onReady(fn: () => void): void {
    if (audioReady) fn();
    else readyListeners.add(fn);
  },
};

export const onPlayState = (fn: (p: boolean) => void): (() => void) => {
  playListeners.add(fn);
  return () => playListeners.delete(fn);
};
export const onStep = (fn: (step: number) => void): (() => void) => {
  stepListeners.add(fn);
  return () => stepListeners.delete(fn);
};
export const onFrame = (fn: () => void): (() => void) => {
  frameListeners.add(fn);
  return () => frameListeners.delete(fn);
};

export async function togglePlay(): Promise<void> {
  if (await audio.ensure()) engine.togglePlay();
}
export async function play(): Promise<void> {
  if (await audio.ensure()) engine.play();
}

// One rAF loop drives every meter in the app.
const frameLoop = (): void => {
  frameListeners.forEach((fn) => fn());
  requestAnimationFrame(frameLoop);
};
requestAnimationFrame(frameLoop);

/** Show a transient message bottom-center. */
export function toast(message: string, kind: 'info' | 'error' = 'info'): void {
  let host = document.querySelector<HTMLElement>('.toast-host');
  if (!host) {
    host = el('div', { class: 'toast-host' });
    document.body.append(host);
  }
  const node = el('div', { class: `toast${kind === 'error' ? ' toast-error' : ''}` }, [message]);
  host.append(node);
  requestAnimationFrame(() => node.classList.add('show'));
  setTimeout(() => {
    node.classList.remove('show');
    setTimeout(() => node.remove(), 320);
  }, 2400);
}
