/**
 * PianoRoll — canvas-based melodic editor.
 *
 *  - Left gutter is a playable keyboard (click to audition a pitch).
 *  - Click an empty cell to drop a 1-step note; drag its body to move (snaps to
 *    the grid), drag its right edge to change length, double-click to delete.
 *  - Velocity shades the note; the selected note glows and opens the inspector.
 *
 * Everything is drawn each frame it changes (cheap at this size) and the canvas
 * is DPR-aware so it stays crisp.
 */
import { el } from '../../utils/dom';
import { PITCH_MAX, PITCH_MIN, type Note, type Track } from '../../audio/types';
import { isBlackKey, midiToNoteName, pitchClass } from '../../utils/midi';
import { clamp } from '../../utils/helpers';
import { engine } from '../../audio/engine';
import { projectStore } from '../state/projectStore';
import { uiStore } from '../state/uiStore';
import { onStep } from '../controller';

const KEY_W = 56; // left keyboard gutter width (css px)
const ROW_H = 16; // height of one semitone row
const RESIZE_GRAB = 7; // px from a note's right edge that starts a resize
const ROWS = PITCH_MAX - PITCH_MIN + 1;

type DragMode = 'move' | 'resize';
interface Drag {
  mode: DragMode;
  noteId: string;
  originStep: number;
  originPitch: number;
  originDuration: number;
  startStep: number;
  startPitch: number;
  lastPitch: number;
}

export class PianoRoll {
  readonly el: HTMLElement;
  private scroll!: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private trackId = '';
  private cssW = 800;
  private stepW = 40;
  private playStep = -1;
  private drag: Drag | null = null;

  constructor() {
    this.canvas = el('canvas', { class: 'pr-canvas' }) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.scroll = el('div', { class: 'pr-scroll' }, [this.canvas]);
    this.el = el('section', { class: 'pianoroll stage-view' }, [
      el('div', { class: 'seq-head' }, [
        el('span', { class: 'panel-title' }, ['Piano Roll']),
        el('span', { class: 'seq-hint' }, ['Click to add notes · drag to move · drag edge to resize']),
      ]),
      this.scroll,
    ]);

    new ResizeObserver(() => this.resize()).observe(this.scroll);
    this.attachPointer();
    this.wire();
  }

  setTrack(trackId: string): void {
    const isNew = trackId !== this.trackId;
    this.trackId = trackId;
    this.resize();
    if (isNew) this.centerOnContent();
  }

  private get track(): Track | undefined {
    return projectStore.getTrack(this.trackId);
  }

  // --- sizing -------------------------------------------------------------

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.cssW = Math.max(360, this.scroll.clientWidth);
    const cssH = ROWS * ROW_H;
    const steps = projectStore.current.patternLength;
    this.stepW = (this.cssW - KEY_W) / steps;

    this.canvas.width = Math.round(this.cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  private centerOnContent(): void {
    const notes = this.track?.notes ?? [];
    const avgPitch = notes.length
      ? notes.reduce((s, n) => s + n.pitch, 0) / notes.length
      : 60; // C4
    const row = PITCH_MAX - Math.round(avgPitch);
    this.scroll.scrollTop = clamp(row * ROW_H - this.scroll.clientHeight / 2, 0, ROWS * ROW_H);
  }

  // --- coordinate helpers -------------------------------------------------

  private xToStep(x: number): number {
    return Math.floor((x - KEY_W) / this.stepW);
  }
  private yToPitch(y: number): number {
    return PITCH_MAX - Math.floor(y / ROW_H);
  }
  private noteRect(n: Note): { x: number; y: number; w: number; h: number } {
    return {
      x: KEY_W + n.step * this.stepW,
      y: (PITCH_MAX - n.pitch) * ROW_H,
      w: n.duration * this.stepW,
      h: ROW_H,
    };
  }
  private hitTest(x: number, y: number): { note: Note; onEdge: boolean } | null {
    const notes = this.track?.notes ?? [];
    // Reverse so topmost (last drawn) wins.
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      const r = this.noteRect(n);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        return { note: n, onEdge: x >= r.x + r.w - RESIZE_GRAB && r.w > RESIZE_GRAB * 1.5 };
      }
    }
    return null;
  }

  // --- pointer interaction ------------------------------------------------

  private localXY(e: PointerEvent): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  private attachPointer(): void {
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.track?.type !== 'melodic') return;
      const [x, y] = this.localXY(e);
      const pitch = clamp(this.yToPitch(y), PITCH_MIN, PITCH_MAX);

      // Keyboard gutter → audition the pitch only.
      if (x < KEY_W) {
        engine.previewNote(this.trackId, pitch);
        return;
      }
      e.preventDefault();
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic or already-released pointer — safe to ignore */
      }
      const step = clamp(this.xToStep(x), 0, projectStore.current.patternLength - 1);
      const hit = this.hitTest(x, y);

      if (hit) {
        uiStore.selectNote(hit.note.id);
        this.beginDrag(hit.onEdge ? 'resize' : 'move', hit.note, step, pitch);
      } else {
        // Empty cell → create a note, select it, and allow an immediate drag.
        const created = projectStore.addNote(this.trackId, { step, pitch, duration: 1, velocity: 0.8 });
        if (created) {
          engine.previewNote(this.trackId, pitch);
          uiStore.selectNote(created.id);
          this.beginDrag('move', created, step, pitch);
        }
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      const [x, y] = this.localXY(e);
      if (this.drag) this.updateDrag(x, y);
      else this.updateCursor(x, y);
    });

    const end = (e: PointerEvent) => {
      if (this.drag) {
        this.drag = null;
        this.canvas.releasePointerCapture?.(e.pointerId);
      }
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);

    this.canvas.addEventListener('dblclick', (e) => {
      const [x, y] = this.localXY(e as unknown as PointerEvent);
      const hit = this.hitTest(x, y);
      if (hit) {
        projectStore.deleteNote(this.trackId, hit.note.id);
        uiStore.selectNote(null);
      }
    });
  }

  private beginDrag(mode: DragMode, note: Note, startStep: number, startPitch: number): void {
    this.drag = {
      mode,
      noteId: note.id,
      originStep: note.step,
      originPitch: note.pitch,
      originDuration: note.duration,
      startStep,
      startPitch,
      lastPitch: note.pitch,
    };
  }

  private updateDrag(x: number, y: number): void {
    const d = this.drag!;
    const curStep = this.xToStep(x);
    const curPitch = clamp(this.yToPitch(y), PITCH_MIN, PITCH_MAX);
    if (d.mode === 'resize') {
      const duration = Math.max(1, curStep - d.originStep + 1);
      projectStore.updateNote(this.trackId, d.noteId, { duration });
    } else {
      const step = d.originStep + (curStep - d.startStep);
      const pitch = d.originPitch + (curPitch - d.startPitch);
      projectStore.updateNote(this.trackId, d.noteId, { step, pitch });
      if (pitch !== d.lastPitch) {
        engine.previewNote(this.trackId, clamp(pitch, PITCH_MIN, PITCH_MAX), 0.6);
        d.lastPitch = pitch;
      }
    }
  }

  private updateCursor(x: number, y: number): void {
    let cursor = 'cell';
    if (x < KEY_W) cursor = 'pointer';
    else {
      const hit = this.hitTest(x, y);
      if (hit) cursor = hit.onEdge ? 'ew-resize' : 'grab';
    }
    this.canvas.style.cursor = cursor;
  }

  // --- rendering ----------------------------------------------------------

  private draw(): void {
    const ctx = this.ctx;
    const track = this.track;
    const steps = projectStore.current.patternLength;
    const gridW = this.cssW - KEY_W;
    const h = ROWS * ROW_H;
    ctx.clearRect(0, 0, this.cssW, h);

    // Row backgrounds (black keys slightly darker).
    for (let r = 0; r < ROWS; r++) {
      const pitch = PITCH_MAX - r;
      ctx.fillStyle = isBlackKey(pitch) ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.04)';
      ctx.fillRect(KEY_W, r * ROW_H, gridW, ROW_H);
      if (pitchClass(pitch) === 0) {
        // Octave boundary line (above each C).
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(KEY_W, r * ROW_H, gridW, 1);
      }
    }

    // Vertical step / beat / bar lines.
    for (let s = 0; s <= steps; s++) {
      const x = KEY_W + s * this.stepW;
      const onBeat = s % 4 === 0;
      ctx.fillStyle = onBeat ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(Math.round(x), 0, onBeat ? 1.5 : 1, h);
    }

    // Playhead column.
    if (this.playStep >= 0) {
      const px = KEY_W + this.playStep * this.stepW;
      ctx.fillStyle = 'rgba(0,229,255,0.10)';
      ctx.fillRect(px, 0, this.stepW, h);
      ctx.fillStyle = 'rgba(0,229,255,0.85)';
      ctx.fillRect(px, 0, 2, h);
    }

    // Notes.
    const color = track?.color ?? '#ff2e92';
    const selectedId = uiStore.selectedNoteId;
    for (const n of track?.notes ?? []) {
      const r = this.noteRect(n);
      const alpha = 0.45 + n.velocity * 0.5;
      this.roundRect(r.x + 1, r.y + 1.5, Math.max(4, r.w - 2), r.h - 3, 4);
      ctx.fillStyle = hexAlpha(color, alpha);
      ctx.fill();
      ctx.lineWidth = n.id === selectedId ? 2 : 1;
      ctx.strokeStyle = n.id === selectedId ? '#ffffff' : hexAlpha(color, 0.95);
      ctx.stroke();
      if (n.id === selectedId) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.restore();
      }
    }

    this.drawKeyboard(ctx, h);
  }

  private drawKeyboard(ctx: CanvasRenderingContext2D, h: number): void {
    // Gutter background + keys.
    ctx.fillStyle = '#16161b';
    ctx.fillRect(0, 0, KEY_W, h);
    for (let r = 0; r < ROWS; r++) {
      const pitch = PITCH_MAX - r;
      const black = isBlackKey(pitch);
      ctx.fillStyle = black ? '#0c0c10' : '#23232b';
      ctx.fillRect(0, r * ROW_H, KEY_W - 1, ROW_H - 0.5);
      if (pitchClass(pitch) === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '600 9px "JetBrains Mono", monospace';
        ctx.textBaseline = 'middle';
        ctx.fillText(midiToNoteName(pitch), 6, r * ROW_H + ROW_H / 2 + 0.5);
      }
    }
    ctx.fillStyle = 'rgba(0,229,255,0.25)';
    ctx.fillRect(KEY_W - 1, 0, 1, h);
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  private wire(): void {
    projectStore.on('notes', ({ trackId }) => trackId === this.trackId && this.draw());
    projectStore.on('instrument', () => this.draw());
    projectStore.on('structure', () => this.resize());
    projectStore.on('project:loaded', () => this.resize());
    uiStore.on('noteSelection', () => this.draw());
    onStep((step) => {
      this.playStep = step;
      this.draw();
    });
  }
}

// --- small colour helper ---------------------------------------------------

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
