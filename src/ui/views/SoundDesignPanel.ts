/**
 * SoundDesignPanel — the contextual right-hand inspector. It shows, depending
 * on what's selected:
 *   • a melodic track  -> Sound Design (oscillator, filter, ADSR, presets)
 *   • a selected note  -> Note Inspector (pitch / position / length / velocity)
 *   • a drums track    -> Drum Kit panel (randomize/clear all, swing)
 */
import { clear, el } from '../../utils/dom';
import { icon } from '../icons';
import {
  FILTER_MAX,
  FILTER_MIN,
  type InstrumentParams,
  type Note,
  type OscType,
  type Track,
} from '../../audio/types';
import { midiToNoteName } from '../../utils/midi';
import { projectStore } from '../state/projectStore';
import { uiStore } from '../state/uiStore';
import { Knob } from '../components/Knob';

const OSC_TYPES: { type: OscType; label: string }[] = [
  { type: 'sine', label: 'Sine' },
  { type: 'triangle', label: 'Tri' },
  { type: 'sawtooth', label: 'Saw' },
  { type: 'square', label: 'Square' },
];

const PRESETS: { name: string; params: InstrumentParams }[] = [
  { name: 'Pluck', params: { oscillatorType: 'sawtooth', filterCutoff: 2600, filterQ: 3, attack: 0.005, decay: 0.18, sustain: 0.25, release: 0.25 } },
  { name: 'Pad', params: { oscillatorType: 'triangle', filterCutoff: 1600, filterQ: 1, attack: 0.25, decay: 0.4, sustain: 0.8, release: 1.2 } },
  { name: 'Bass', params: { oscillatorType: 'square', filterCutoff: 700, filterQ: 6, attack: 0.005, decay: 0.2, sustain: 0.2, release: 0.15 } },
  { name: 'Keys', params: { oscillatorType: 'sine', filterCutoff: 3200, filterQ: 0.8, attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.5 } },
];

export class SoundDesignPanel {
  readonly el: HTMLElement;
  private body!: HTMLElement;
  private noteRefresher: (() => void) | null = null;

  constructor() {
    this.body = el('div', { class: 'inspector-body' });
    this.el = el('aside', { class: 'inspector' }, [this.body]);
    this.render();
    this.wire();
  }

  private get trackId(): string {
    return uiStore.selectedTrackId;
  }

  private render(): void {
    clear(this.body);
    this.noteRefresher = null;
    const track = projectStore.getTrack(this.trackId);
    if (!track) {
      this.body.append(el('div', { class: 'inspector-empty' }, ['Select a track to edit its sound.']));
      return;
    }
    if (track.type === 'melodic') {
      const note = uiStore.selectedNoteId ? track.notes?.find((n) => n.id === uiStore.selectedNoteId) : null;
      this.body.append(note ? this.noteInspector(track, note) : this.soundDesign(track));
    } else {
      this.body.append(this.drumPanel(track));
    }
  }

  // --- Sound design (synth) ----------------------------------------------

  private soundDesign(track: Track): HTMLElement {
    const p = track.instrumentParams!;
    const set = (patch: Partial<InstrumentParams>) => projectStore.setInstrumentParams(track.id, patch);

    const oscRow = el(
      'div',
      { class: 'osc-row' },
      OSC_TYPES.map(({ type, label }) =>
        el('button', {
          class: `osc-btn${p.oscillatorType === type ? ' is-active' : ''}`,
          type: 'button',
          dataset: { osc: type },
          onClick: () => { set({ oscillatorType: type }); this.render(); },
        }, [label]),
      ),
    );

    const cutoff = new Knob({
      label: 'Cutoff', min: FILTER_MIN, max: FILTER_MAX, value: p.filterCutoff, curve: 'exp', size: 52,
      format: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`),
      onInput: (v) => set({ filterCutoff: v }),
    });
    const reso = new Knob({
      label: 'Reso', min: 0, max: 18, value: p.filterQ, size: 52,
      format: (v) => v.toFixed(1),
      onInput: (v) => set({ filterQ: v }),
    });

    const env = (label: string, key: keyof InstrumentParams, min: number, max: number, curve: 'exp' | 'linear', fmt: (v: number) => string) =>
      new Knob({ label, min, max, value: p[key] as number, curve, size: 48, format: fmt, onInput: (v) => set({ [key]: v } as Partial<InstrumentParams>) });

    const secs = (v: number) => (v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(1)}s`);
    const attack = env('Attack', 'attack', 0.001, 2, 'exp', secs);
    const decay = env('Decay', 'decay', 0.01, 2, 'exp', secs);
    const sustain = env('Sustain', 'sustain', 0, 1, 'linear', (v) => `${Math.round(v * 100)}%`);
    const release = env('Release', 'release', 0.01, 3, 'exp', secs);

    const presets = el(
      'div',
      { class: 'preset-row' },
      PRESETS.map((preset) =>
        el('button', {
          class: 'preset-btn', type: 'button',
          onClick: () => { projectStore.setInstrumentParams(track.id, preset.params); this.render(); },
        }, [preset.name]),
      ),
    );

    return el('div', { class: 'sd' }, [
      this.header('music', 'Sound Design', track.name),
      this.group('Quick presets', [presets]),
      this.group('Oscillator', [oscRow]),
      this.group('Filter', [el('div', { class: 'knob-row' }, [cutoff.el, reso.el])]),
      this.group('Envelope', [el('div', { class: 'knob-row' }, [attack.el, decay.el, sustain.el, release.el])]),
      el('p', { class: 'inspector-tip' }, ['Tip: click the grid to add notes, then drag them around to find a melody.']),
    ]);
  }

  // --- Note inspector -----------------------------------------------------

  private noteInspector(track: Track, note: Note): HTMLElement {
    const pitchEl = el('span', { class: 'ni-value mono' }, [midiToNoteName(note.pitch)]);
    const stepEl = el('span', { class: 'ni-value mono' }, [String(note.step + 1)]);
    const lenEl = el('span', { class: 'ni-value mono' }, [`${note.duration}`]);
    const velSlider = el('input', {
      class: 'ni-slider', type: 'range', min: '0.3', max: '1', step: '0.01', value: String(note.velocity),
      onInput: () => projectStore.updateNote(track.id, note.id, { velocity: Number(velSlider.value) }),
    }) as HTMLInputElement;
    const velEl = el('span', { class: 'ni-value mono' }, [`${Math.round(note.velocity * 100)}`]);

    const lenStep = (delta: number) =>
      projectStore.updateNote(track.id, note.id, { duration: note.duration + delta });

    // Keep readouts live while the note is dragged on the canvas.
    this.noteRefresher = () => {
      const n = projectStore.getTrack(track.id)?.notes?.find((x) => x.id === note.id);
      if (!n) return;
      pitchEl.textContent = midiToNoteName(n.pitch);
      stepEl.textContent = String(n.step + 1);
      lenEl.textContent = `${n.duration}`;
      velEl.textContent = `${Math.round(n.velocity * 100)}`;
      velSlider.value = String(n.velocity);
    };

    return el('div', { class: 'ni', style: { '--accent': track.color } }, [
      this.header('music', 'Note', track.name),
      this.kv('Pitch', pitchEl),
      this.kv('Step', stepEl),
      el('div', { class: 'ni-len' }, [
        el('span', { class: 'ni-key' }, ['Length']),
        el('div', { class: 'stepper' }, [
          el('button', { class: 'stepper-btn', type: 'button', onClick: () => lenStep(-1) }, ['−']),
          lenEl,
          el('button', { class: 'stepper-btn', type: 'button', onClick: () => lenStep(1) }, ['+']),
        ]),
      ]),
      el('div', { class: 'ni-vel' }, [
        el('span', { class: 'ni-key' }, ['Velocity', velEl]),
        velSlider,
      ]),
      el('button', {
        class: 'btn btn-danger btn-block', type: 'button',
        html: `${icon('trash', 15)}<span>Delete note</span>`,
        onClick: () => { projectStore.deleteNote(track.id, note.id); uiStore.selectNote(null); },
      }),
    ]);
  }

  // --- Drum kit panel -----------------------------------------------------

  private drumPanel(track: Track): HTMLElement {
    const swing = new Knob({
      label: 'Swing', min: 0, max: 0.6, value: projectStore.current.swing, size: 52,
      format: (v) => `${Math.round((v / 0.6) * 100)}%`,
      onInput: (v) => projectStore.setSwing(v),
    });
    return el('div', { class: 'drum-panel' }, [
      this.header('grid', 'Drum Kit', track.name),
      this.group('Groove', [el('div', { class: 'knob-row' }, [swing.el])]),
      this.group('Whole kit', [
        el('div', { class: 'btn-col' }, [
          el('button', {
            class: 'btn btn-ghost btn-block', type: 'button',
            html: `${icon('shuffle', 15)}<span>Randomize all lanes</span>`,
            onClick: () => track.lanes?.forEach((l) => projectStore.randomizeLane(track.id, l.id)),
          }),
          el('button', {
            class: 'btn btn-ghost btn-block', type: 'button',
            html: `${icon('x', 15)}<span>Clear all lanes</span>`,
            onClick: () => projectStore.clearAllDrums(track.id),
          }),
        ]),
      ]),
      el('p', { class: 'inspector-tip' }, ['Each lane has its own volume, randomize and clear. Tap a lane name to preview it.']),
    ]);
  }

  // --- shared bits --------------------------------------------------------

  private header(iconName: string, title: string, sub: string): HTMLElement {
    return el('div', { class: 'inspector-head' }, [
      el('span', { class: 'inspector-ico', html: icon(iconName, 16) }),
      el('div', {}, [
        el('div', { class: 'inspector-title' }, [title]),
        el('div', { class: 'inspector-sub' }, [sub]),
      ]),
    ]);
  }

  private group(title: string, children: HTMLElement[]): HTMLElement {
    return el('div', { class: 'inspector-group' }, [
      el('div', { class: 'group-label' }, [title]),
      ...children,
    ]);
  }

  private kv(key: string, valueEl: HTMLElement): HTMLElement {
    return el('div', { class: 'ni-kv' }, [el('span', { class: 'ni-key' }, [key]), valueEl]);
  }

  private wire(): void {
    uiStore.on('selection', () => this.render());
    uiStore.on('noteSelection', () => this.render());
    projectStore.on('project:loaded', () => this.render());
    projectStore.on('track:renamed', () => this.render());
    projectStore.on('notes', () => this.noteRefresher?.());
  }
}
