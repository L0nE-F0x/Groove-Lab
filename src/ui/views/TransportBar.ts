/**
 * TransportBar — the always-visible top bar: brand + editable project name,
 * play/stop, loop + metronome, tempo, master volume + meter, and the project
 * actions (new / library / export).
 */
import { el } from '../../utils/dom';
import { icon } from '../icons';
import { BPM_MAX, BPM_MIN } from '../../audio/types';
import { engine } from '../../audio/engine';
import { projectStore } from '../state/projectStore';
import { Toggle } from '../components/Toggle';
import { downloadProject } from '../../utils/export';
import { onFrame, onPlayState, togglePlay, toast } from '../controller';
import { openLibrary } from './ProjectMenu';

export class TransportBar {
  readonly el: HTMLElement;
  private playBtn!: HTMLButtonElement;
  private nameInput!: HTMLInputElement;
  private bpmInput!: HTMLInputElement;
  private bpmSlider!: HTMLInputElement;
  private masterSlider!: HTMLInputElement;
  private masterMeter!: HTMLElement;
  private loop!: Toggle;
  private metro!: Toggle;

  constructor() {
    this.el = this.build();
    this.wire();
  }

  private build(): HTMLElement {
    // --- brand + project name (left) ---
    this.nameInput = el('input', {
      class: 'project-name',
      value: projectStore.current.name,
      spellcheck: 'false',
      'aria-label': 'Project name',
      onChange: () => projectStore.renameProject(this.nameInput.value),
      onKeydown: (e: KeyboardEvent) => e.key === 'Enter' && this.nameInput.blur(),
    }) as HTMLInputElement;

    const brand = el('div', { class: 'tb-brand' }, [
      el('span', { class: 'brand-mark sm', html: icon('flask', 18) }),
      el('div', { class: 'tb-brand-text' }, [
        el('span', { class: 'brand-name' }, ['GrooveLab']),
        this.nameInput,
      ]),
    ]);

    // --- transport (center) ---
    this.loop = new Toggle({
      iconName: 'loop', title: 'Loop', accent: 'cyan', active: engine.loopEnabled,
      onChange: (on) => engine.setLoop(on),
    });
    this.metro = new Toggle({
      iconName: 'metronome', title: 'Metronome', accent: 'amber', active: engine.metronomeEnabled,
      onChange: (on) => engine.setMetronome(on),
    });

    this.playBtn = el('button', {
      class: 'play-btn', type: 'button', title: 'Play / Stop (Space)',
      html: icon('play', 26), onClick: () => togglePlay(),
    }) as HTMLButtonElement;

    this.bpmInput = el('input', {
      class: 'bpm-input', type: 'number', min: String(BPM_MIN), max: String(BPM_MAX),
      value: String(projectStore.current.bpm), 'aria-label': 'Tempo (BPM)',
      onChange: () => projectStore.setBpm(Number(this.bpmInput.value)),
    }) as HTMLInputElement;
    this.bpmSlider = el('input', {
      class: 'bpm-slider', type: 'range', min: String(BPM_MIN), max: String(BPM_MAX),
      value: String(projectStore.current.bpm), 'aria-label': 'Tempo slider',
      onInput: () => projectStore.setBpm(Number(this.bpmSlider.value)),
    }) as HTMLInputElement;

    const tempo = el('div', { class: 'tempo' }, [
      el('div', { class: 'tempo-readout' }, [this.bpmInput, el('span', { class: 'tempo-unit' }, ['BPM'])]),
      this.bpmSlider,
    ]);

    const transport = el('div', { class: 'tb-transport' }, [
      this.loop.el, this.playBtn, this.metro.el, tempo,
    ]);

    // --- master + actions (right) ---
    this.masterMeter = el('div', { class: 'master-meter-fill' });
    this.masterSlider = el('input', {
      class: 'master-slider', type: 'range', min: '0', max: '1', step: '0.01',
      value: String(projectStore.current.masterVolume), 'aria-label': 'Master volume',
      onInput: () => projectStore.setMasterVolume(Number(this.masterSlider.value)),
    }) as HTMLInputElement;

    const master = el('div', { class: 'tb-master' }, [
      el('span', { class: 'master-ico', html: icon('volume', 16) }),
      el('div', { class: 'master-slider-wrap' }, [
        el('div', { class: 'master-meter' }, [this.masterMeter]),
        this.masterSlider,
      ]),
    ]);

    const actions = el('div', { class: 'tb-actions' }, [
      this.actionBtn('plus', 'New groove', () => {
        projectStore.newProject();
        toast('Started a new groove');
      }),
      this.actionBtn('folder', 'Project library', () => openLibrary()),
      this.actionBtn('download', 'Export as JSON', () => {
        downloadProject(projectStore.current);
        toast('Exported project JSON');
      }),
    ]);

    return el('header', { class: 'topbar' }, [
      brand,
      transport,
      el('div', { class: 'tb-right' }, [master, actions]),
    ]);
  }

  private actionBtn(iconName: string, title: string, onClick: () => void): HTMLButtonElement {
    return el('button', { class: 'icon-btn', type: 'button', title, html: icon(iconName), onClick }) as HTMLButtonElement;
  }

  private wire(): void {
    onPlayState((p) => {
      this.playBtn.classList.toggle('is-playing', p);
      this.playBtn.innerHTML = icon(p ? 'stop' : 'play', 26);
    });

    // Keep displayed values in sync when the project changes elsewhere.
    const refresh = () => {
      const p = projectStore.current;
      this.nameInput.value = p.name;
      this.bpmInput.value = String(p.bpm);
      this.bpmSlider.value = String(p.bpm);
      this.masterSlider.value = String(p.masterVolume);
      this.loop.set(engine.loopEnabled);
      this.metro.set(engine.metronomeEnabled);
    };
    projectStore.on('transport', refresh);
    projectStore.on('project:loaded', refresh);
    projectStore.on('meta', refresh);

    onFrame(() => {
      this.masterMeter.style.transform = `scaleX(${engine.getMasterLevel().toFixed(3)})`;
    });
  }
}
