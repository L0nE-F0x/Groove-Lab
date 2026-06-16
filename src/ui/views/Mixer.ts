/**
 * Mixer — the collapsible bottom drawer. One channel strip per track plus a
 * master strip: fader (with live meter), pan, mute/solo. Meters are refreshed
 * from the shared rAF loop.
 */
import { clear, el } from '../../utils/dom';
import { icon } from '../icons';
import type { Track } from '../../audio/types';
import { engine } from '../../audio/engine';
import { projectStore } from '../state/projectStore';
import { uiStore } from '../state/uiStore';
import { Fader } from '../components/Fader';
import { Knob } from '../components/Knob';
import { onFrame } from '../controller';

interface Strip {
  trackId: string;
  fader: Fader;
  pan: Knob;
  mute: HTMLButtonElement;
  solo: HTMLButtonElement;
}

export class Mixer {
  readonly el: HTMLElement;
  private body!: HTMLElement;
  private strips: Strip[] = [];
  private masterFader!: Fader;

  constructor() {
    this.el = this.build();
    this.render();
    this.wire();
  }

  private build(): HTMLElement {
    this.body = el('div', { class: 'mixer-body' });
    const collapse = el('button', {
      class: 'mixer-collapse', type: 'button', title: 'Show / hide mixer',
      html: icon('chevronDown', 18), onClick: () => uiStore.toggleMixer(),
    });
    const head = el('div', { class: 'mixer-head' }, [
      el('span', { class: 'panel-title' }, [el('span', { html: icon('sliders', 15) }), 'Mixer']),
      collapse,
    ]);
    const drawer = el('section', { class: `mixer-drawer${uiStore.mixerOpen ? ' is-open' : ''}` }, [head, this.body]);
    return drawer;
  }

  private render(): void {
    clear(this.body);
    this.strips = [];
    for (const track of projectStore.current.tracks) {
      this.body.append(this.trackStrip(track));
    }
    this.body.append(this.masterStrip());
  }

  private trackStrip(track: Track): HTMLElement {
    const fader = new Fader({
      value: track.volume, withMeter: true,
      onInput: (v) => projectStore.setTrackMix(track.id, { volume: v }),
    });
    const pan = new Knob({
      label: 'pan', min: -1, max: 1, value: track.pan, default: 0, size: 36,
      format: panLabel,
      onInput: (v) => projectStore.setTrackMix(track.id, { pan: v }),
    });
    const mute = el('button', {
      class: `ms-btn mute${track.muted ? ' is-on' : ''}`, type: 'button', title: 'Mute',
      onClick: () => projectStore.toggleMute(track.id),
    }, ['M']) as HTMLButtonElement;
    const solo = el('button', {
      class: `ms-btn solo${track.solo ? ' is-on' : ''}`, type: 'button', title: 'Solo',
      onClick: () => projectStore.toggleSolo(track.id),
    }, ['S']) as HTMLButtonElement;

    this.strips.push({ trackId: track.id, fader, pan, mute, solo });

    return el('div', { class: 'strip', style: { '--accent': track.color } }, [
      el('div', { class: 'strip-top' }, [
        el('span', { class: 'strip-dot' }),
        el('span', { class: 'strip-name', title: track.name }, [track.name]),
      ]),
      el('div', { class: 'strip-fader' }, [fader.el]),
      pan.el,
      el('div', { class: 'strip-ms' }, [mute, solo]),
    ]);
  }

  private masterStrip(): HTMLElement {
    this.masterFader = new Fader({
      value: projectStore.current.masterVolume, withMeter: true,
      onInput: (v) => projectStore.setMasterVolume(v),
    });
    return el('div', { class: 'strip strip-master' }, [
      el('div', { class: 'strip-top' }, [el('span', { class: 'strip-name' }, ['Master'])]),
      el('div', { class: 'strip-fader' }, [this.masterFader.el]),
      el('div', { class: 'strip-ms-spacer' }),
    ]);
  }

  private wire(): void {
    const rebuild = () => this.render();
    projectStore.on('project:loaded', rebuild);
    projectStore.on('track:added', rebuild);
    projectStore.on('track:removed', rebuild);
    projectStore.on('track:renamed', rebuild);

    projectStore.on('mix', ({ trackId }) => {
      const strip = this.strips.find((s) => s.trackId === trackId);
      const track = projectStore.getTrack(trackId);
      if (!strip || !track) return;
      strip.fader.setValue(track.volume);
      strip.pan.setValue(track.pan);
      strip.mute.classList.toggle('is-on', track.muted);
      strip.solo.classList.toggle('is-on', track.solo);
    });
    projectStore.on('transport', () => this.masterFader?.setValue(projectStore.current.masterVolume));

    uiStore.on('mixer', ({ open }) => this.el.classList.toggle('is-open', open));

    onFrame(() => {
      for (const s of this.strips) s.fader.setMeter(engine.getTrackLevel(s.trackId));
      this.masterFader?.setMeter(engine.getMasterLevel());
    });
  }
}

const panLabel = (v: number): string => {
  if (Math.abs(v) < 0.02) return 'C';
  const amt = Math.round(Math.abs(v) * 100);
  return `${v < 0 ? 'L' : 'R'}${amt}`;
};
