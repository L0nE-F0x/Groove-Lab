/**
 * Sidebar — the track list / selector. Click a track to load its editor into
 * the main stage. Per-track mute/solo live here too, plus "add synth track".
 */
import { clear, el } from '../../utils/dom';
import { icon } from '../icons';
import type { Track } from '../../audio/types';
import { projectStore } from '../state/projectStore';
import { uiStore } from '../state/uiStore';

export class Sidebar {
  readonly el: HTMLElement;
  private list!: HTMLElement;

  constructor() {
    this.el = this.build();
    this.render();
    this.wire();
  }

  private build(): HTMLElement {
    this.list = el('div', { class: 'track-list' });
    const addBtn = el(
      'button',
      { class: 'add-track', type: 'button', title: 'Add a synth track', onClick: () => this.addSynth() },
      [el('span', { html: icon('plus', 16) }), 'Add synth'],
    );
    return el('aside', { class: 'sidebar' }, [
      el('div', { class: 'sidebar-head' }, [el('span', { class: 'panel-title' }, ['Tracks'])]),
      this.list,
      addBtn,
    ]);
  }

  private addSynth(): void {
    const track = projectStore.addMelodicTrack();
    uiStore.selectTrack(track.id);
  }

  private render(): void {
    clear(this.list);
    for (const track of projectStore.current.tracks) {
      this.list.append(this.row(track));
    }
  }

  private row(track: Track): HTMLElement {
    const selected = track.id === uiStore.selectedTrackId;
    const typeIcon = track.type === 'drums' ? 'grid' : 'music';

    const mute = el('button', {
      class: `chip-btn mute${track.muted ? ' is-on' : ''}`, type: 'button', title: 'Mute',
      onClick: (e: Event) => { e.stopPropagation(); projectStore.toggleMute(track.id); },
    }, ['M']);
    const solo = el('button', {
      class: `chip-btn solo${track.solo ? ' is-on' : ''}`, type: 'button', title: 'Solo',
      onClick: (e: Event) => { e.stopPropagation(); projectStore.toggleSolo(track.id); },
    }, ['S']);

    const children: (HTMLElement | string)[] = [
      el('span', { class: 'track-dot', style: { background: track.color } }),
      el('span', { class: 'track-ico', html: icon(typeIcon, 16) }),
      el('span', { class: 'track-name' }, [track.name]),
      el('div', { class: 'track-chips' }, [mute, solo]),
    ];

    // Removable only if it isn't the last remaining track.
    if (projectStore.current.tracks.length > 1) {
      children.push(
        el('button', {
          class: 'track-remove', type: 'button', title: 'Delete track',
          html: icon('x', 14),
          onClick: (e: Event) => { e.stopPropagation(); projectStore.removeTrack(track.id); },
        }),
      );
    }

    return el('div', {
      class: `track-row${selected ? ' is-selected' : ''}`,
      style: selected ? { '--accent': track.color } : {},
      onClick: () => uiStore.selectTrack(track.id),
    }, children);
  }

  private wire(): void {
    const rerender = () => this.render();
    uiStore.on('selection', rerender);
    projectStore.on('mix', rerender);
    projectStore.on('track:added', rerender);
    projectStore.on('track:removed', rerender);
    projectStore.on('track:renamed', rerender);
    projectStore.on('project:loaded', rerender);
  }
}
