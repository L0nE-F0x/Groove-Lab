/**
 * DrumSequencer — the step grid. DOM-based (one button per cell) so the "pop"
 * micro-interaction, per-lane colours and accessibility come for free, and 16×6
 * cells are trivially cheap. Click to toggle, drag to paint a run of steps.
 */
import { clear, el } from '../../utils/dom';
import { icon } from '../icons';
import type { DrumLane, DrumSoundType, Track } from '../../audio/types';
import { engine } from '../../audio/engine';
import { projectStore } from '../state/projectStore';
import { uiStore } from '../state/uiStore';
import { audio, onStep } from '../controller';
import { Knob } from '../components/Knob';

const LANE_COLORS: Record<DrumSoundType, string> = {
  kick: '#ff2e92',
  snare: '#ff6b35',
  clap: '#ffb800',
  closedHat: '#00e5ff',
  openHat: '#1fd1a5',
  perc: '#7c5cff',
};

export class DrumSequencer {
  readonly el: HTMLElement;
  private grid!: HTMLElement;
  private trackId = '';
  /** cells[laneIndex][step] for fast class syncing. */
  private cells: HTMLButtonElement[][] = [];
  private currentColumn = -1;

  // drag-paint state
  private painting = false;
  private paintValue = false;
  private paintLaneId = '';

  constructor() {
    this.el = el('section', { class: 'sequencer stage-view' }, [
      el('div', { class: 'seq-head' }, [
        el('span', { class: 'panel-title' }, ['Drum Sequencer']),
        el('span', { class: 'seq-hint' }, ['Click to add hits · drag to paint']),
      ]),
      (this.grid = el('div', { class: 'seq-grid' })),
    ]);
    this.attachPaintHandlers();
    this.wire();
  }

  setTrack(trackId: string): void {
    this.trackId = trackId;
    this.build();
  }

  private get track(): Track | undefined {
    return projectStore.getTrack(this.trackId);
  }

  // --- build the grid -----------------------------------------------------

  private build(): void {
    const track = this.track;
    clear(this.grid);
    this.cells = [];
    if (!track?.lanes) return;
    const steps = projectStore.current.patternLength;
    this.grid.style.setProperty('--steps', String(steps));

    track.lanes.forEach((lane, laneIndex) => {
      const color = LANE_COLORS[lane.soundType];
      this.grid.append(this.laneControls(lane, color));

      const rowCells: HTMLButtonElement[] = [];
      const stepsWrap = el('div', { class: 'lane-steps', style: { '--lane': color } });
      for (let s = 0; s < steps; s++) {
        const cell = el('button', {
          class: `step-cell${s % 4 === 0 ? ' beat-start' : ''}${lane.steps[s] ? ' is-on' : ''}`,
          type: 'button',
          dataset: { lane: lane.id, step: String(s), li: String(laneIndex) },
          'aria-label': `${lane.name} step ${s + 1}`,
          'aria-pressed': String(lane.steps[s]),
        }) as HTMLButtonElement;
        rowCells.push(cell);
        stepsWrap.append(cell);
      }
      this.cells.push(rowCells);
      this.grid.append(stepsWrap);
    });
  }

  private laneControls(lane: DrumLane, color: string): HTMLElement {
    const vol = new Knob({
      label: 'vol', min: 0, max: 1, value: lane.volume, size: 34, default: lane.volume,
      format: (v) => `${Math.round(v * 100)}`,
      onInput: (v) => projectStore.setLaneVolume(this.trackId, lane.id, v),
    });
    const clearBtn = el('button', {
      class: 'lane-btn', type: 'button', title: `Clear ${lane.name}`, html: icon('x', 13),
      onClick: () => projectStore.clearLane(this.trackId, lane.id),
    });
    const randBtn = el('button', {
      class: 'lane-btn', type: 'button', title: `Randomize ${lane.name}`, html: icon('shuffle', 13),
      onClick: () => { projectStore.randomizeLane(this.trackId, lane.id); engine.previewDrum(this.trackId, lane.id); },
    });
    return el('div', { class: 'lane-controls', style: { '--lane': color } }, [
      el('span', { class: 'lane-swatch' }),
      el('button', {
        class: 'lane-name', type: 'button', title: 'Preview',
        onClick: () => engine.previewDrum(this.trackId, lane.id),
      }, [lane.name]),
      el('div', { class: 'lane-actions' }, [vol.el, randBtn, clearBtn]),
    ]);
  }

  // --- interaction --------------------------------------------------------

  private attachPaintHandlers(): void {
    const cellFrom = (t: EventTarget | null): HTMLButtonElement | null =>
      (t instanceof Element ? t.closest('.step-cell') : null) as HTMLButtonElement | null;

    this.grid.addEventListener('pointerdown', (e) => {
      const cell = cellFrom(e.target);
      if (!cell) return;
      e.preventDefault();
      const laneId = cell.dataset.lane!;
      const step = Number(cell.dataset.step);
      const next = projectStore.toggleStep(this.trackId, laneId, step);
      this.painting = true;
      this.paintValue = next;
      this.paintLaneId = laneId;
      if (next && !audio.playing) engine.previewDrum(this.trackId, laneId);
    });

    this.grid.addEventListener('pointerover', (e) => {
      if (!this.painting) return;
      const cell = cellFrom(e.target);
      if (!cell || cell.dataset.lane !== this.paintLaneId) return;
      projectStore.setStep(this.trackId, this.paintLaneId, Number(cell.dataset.step), this.paintValue);
    });

    window.addEventListener('pointerup', () => (this.painting = false));
  }

  // --- live updates -------------------------------------------------------

  /** Sync cell on/off classes from the data (cheap; no rebuild). */
  private syncCells(): void {
    const track = this.track;
    if (!track?.lanes) return;
    track.lanes.forEach((lane, li) => {
      const row = this.cells[li];
      if (!row) return;
      lane.steps.forEach((on, s) => {
        const cell = row[s];
        if (cell) {
          cell.classList.toggle('is-on', on);
          cell.setAttribute('aria-pressed', String(on));
        }
      });
    });
  }

  private highlightColumn(step: number): void {
    if (step === this.currentColumn) return;
    for (const row of this.cells) {
      row[this.currentColumn]?.classList.remove('col-now');
      if (step >= 0) row[step]?.classList.add('col-now');
    }
    this.currentColumn = step;
  }

  private wire(): void {
    projectStore.on('drums', ({ trackId }) => {
      if (trackId === this.trackId) this.syncCells();
    });
    projectStore.on('structure', () => this.build());
    projectStore.on('project:loaded', () => {
      // Re-bind to the (new) drums track if ours no longer exists.
      if (!this.track) {
        const drums = projectStore.current.tracks.find((t) => t.type === 'drums');
        if (drums) this.trackId = drums.id;
      }
      this.build();
    });
    onStep((step) => this.highlightColumn(step));
  }
}
