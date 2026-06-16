/**
 * main.ts — app bootstrap.
 *
 * Builds the DOM shell, mounts the views, and wires the store's events to the
 * audio engine (the single place that synchronises data -> sound) and to the
 * stage view switching. Audio itself only starts on the first user gesture
 * (handled by the Landing overlay / Play button via the controller).
 */
import './styles/globals.css';

import { el, mustQuery } from './utils/dom';
import { engine } from './audio/engine';
import { projectStore } from './ui/state/projectStore';
import { uiStore } from './ui/state/uiStore';
import { togglePlay } from './ui/controller';

import { TransportBar } from './ui/views/TransportBar';
import { Sidebar } from './ui/views/Sidebar';
import { DrumSequencer } from './ui/views/DrumSequencer';
import { PianoRoll } from './ui/views/PianoRoll';
import { Mixer } from './ui/views/Mixer';
import { SoundDesignPanel } from './ui/views/SoundDesignPanel';
import { Landing } from './ui/views/Landing';

function boot(): void {
  const root = mustQuery<HTMLElement>('#app');

  // --- views ---
  const transport = new TransportBar();
  const sidebar = new Sidebar();
  const drumSeq = new DrumSequencer();
  const pianoRoll = new PianoRoll();
  const inspector = new SoundDesignPanel();
  const mixer = new Mixer();

  const stage = el('div', { class: 'stage' }, [drumSeq.el, pianoRoll.el]);
  const shell = el('div', { class: 'app-shell' }, [
    transport.el,
    el('div', { class: 'workspace' }, [sidebar.el, stage, inspector.el]),
    mixer.el,
  ]);

  root.append(shell, el('div', { class: 'modal-host' }));

  // --- stage view switching (drums -> sequencer, melodic -> piano roll) ---
  const showTrack = (trackId: string): void => {
    const track = projectStore.getTrack(trackId);
    if (!track) return;
    const drums = track.type === 'drums';
    drumSeq.el.classList.toggle('is-active', drums);
    pianoRoll.el.classList.toggle('is-active', !drums);
    if (drums) drumSeq.setTrack(trackId);
    else pianoRoll.setTrack(trackId);
  };
  uiStore.on('selection', ({ trackId }) => showTrack(trackId));

  // --- data -> audio synchronisation ---
  wireEngine();

  // --- keyboard shortcuts ---
  installShortcuts();

  // --- first selection + welcome ---
  selectFirstTrack();
  const landing = new Landing(() => selectFirstTrack());
  root.append(landing.el);
}

/** Keep the audio engine in lock-step with project mutations. */
function wireEngine(): void {
  projectStore.on('transport', (p) => {
    engine.setBpm(p.bpm);
    engine.setMasterVolume(p.masterVolume);
    engine.applyLoop();
  });
  projectStore.on('structure', () => engine.applyLoop());
  projectStore.on('mix', ({ trackId }) => {
    const t = projectStore.getTrack(trackId);
    if (t) engine.updateTrackMix(t);
  });
  projectStore.on('instrument', ({ trackId }) => {
    const t = projectStore.getTrack(trackId);
    if (t) engine.updateInstrument(t);
  });
  // A sampler's sound/root changed, or a sample lane was added/removed —
  // rebuild just that track's audio nodes.
  const rebuild = ({ trackId }: { trackId: string }) => {
    const t = projectStore.getTrack(trackId);
    if (t) void engine.rebuildTrack(t);
  };
  projectStore.on('track:rebuilt', rebuild);
  projectStore.on('lanes', rebuild);
  projectStore.on('track:added', ({ track }) => void engine.addTrack(track));
  projectStore.on('track:removed', ({ trackId }) => {
    engine.removeTrack(trackId);
    if (uiStore.selectedTrackId === trackId) selectFirstTrack();
  });
  projectStore.on('project:loaded', (p) => {
    void engine.loadProject(p);
    selectFirstTrack();
  });
}

function selectFirstTrack(): void {
  const first = projectStore.current.tracks[0];
  if (!first) return;
  // Force a fresh selection even if the id matches a stale one.
  if (uiStore.selectedTrackId === first.id) {
    uiStore.emit('selection', { trackId: first.id });
  } else {
    uiStore.selectTrack(first.id);
  }
}

function installShortcuts(): void {
  window.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement | null;
    const typing =
      !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    if (typing) return;

    if (e.code === 'Space') {
      e.preventDefault();
      void togglePlay();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      const noteId = uiStore.selectedNoteId;
      if (noteId) {
        e.preventDefault();
        projectStore.deleteNote(uiStore.selectedTrackId, noteId);
        uiStore.selectNote(null);
      }
    }
  });
}

boot();
