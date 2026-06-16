/**
 * AudioEngine — the one place that talks to Tone.js / the Web Audio clock.
 *
 * Design notes:
 *  - The engine holds a *reference* to the live Project object and reads it on
 *    every 16th-note tick, so edits made while playing are heard immediately
 *    with zero rebuild.
 *  - Each track gets a Tone.Channel (volume/pan/mute/solo) + a Meter tap.
 *    Solo is handled by Tone's shared solo bus; the master is a plain Gain so
 *    soloing a track never mutes the master output.
 *  - Visual playhead updates are scheduled through Tone.Draw so they line up
 *    with what you actually hear.
 */
import * as Tone from 'tone';
import { createDrumVoice, MelodicInstrument, type DrumVoice } from './instruments';
import type { Project, Track } from './types';
import { midiToNoteName } from '../utils/midi';
import { meterToLevel } from './utils';
import { clamp } from '../utils/helpers';

interface DrumNodes {
  kind: 'drums';
  channel: Tone.Channel;
  meter: Tone.Meter;
  voices: Map<string, DrumVoice>; // keyed by lane id
}
interface MelodicNodes {
  kind: 'melodic';
  channel: Tone.Channel;
  meter: Tone.Meter;
  instrument: MelodicInstrument;
}
type TrackNodes = DrumNodes | MelodicNodes;

export class AudioEngine {
  private project: Project | null = null;
  private nodes = new Map<string, TrackNodes>();

  private masterGain!: Tone.Gain;
  private masterMeter!: Tone.Meter;
  private limiter!: Tone.Limiter;
  private metronome!: Tone.Synth;
  private repeatId: number | null = null;
  private step = 0;
  private started = false;

  loopEnabled = true;
  metronomeEnabled = false;

  /** Fired (via Tone.Draw) on each step while playing; -1 means "stopped". */
  onStep: (step: number) => void = () => {};
  onPlayStateChange: (playing: boolean) => void = () => {};

  get isReady(): boolean { return this.started; }
  get isPlaying(): boolean { return this.started && Tone.getTransport().state === 'started'; }

  /**
   * Boot Tone (must be called from a user gesture) and build the graph for the
   * given project. Safe to call again with a new project; it just reloads.
   */
  async init(project: Project): Promise<void> {
    if (this.started) {
      this.loadProject(project);
      return;
    }
    await Tone.start();

    // Master chain: tracks -> masterGain -> limiter -> meter -> speakers.
    this.masterGain = new Tone.Gain(clamp(project.masterVolume, 0, 1));
    this.limiter = new Tone.Limiter(-1);
    this.masterMeter = new Tone.Meter({ smoothing: 0.8 });
    this.masterGain.chain(this.limiter, this.masterMeter, Tone.getDestination());

    // A short, bright click for the metronome (routed post-master volume).
    this.metronome = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
    });
    this.metronome.volume.value = -8;
    this.metronome.connect(this.masterGain);

    const transport = Tone.getTransport();
    transport.bpm.value = project.bpm;

    // One repeating 16th-note callback drives the entire sequencer.
    this.repeatId = transport.scheduleRepeat((time) => {
      const current = this.step;
      this.triggerStep(current, time);
      Tone.getDraw().schedule(() => this.onStep(current), time);
      this.step = (this.step + 1) % (this.project?.patternLength ?? 16);
    }, '16n');

    this.started = true;
    this.loadProject(project);
  }

  // --- Project graph ------------------------------------------------------

  /** Replace the active project and rebuild all per-track audio nodes. */
  loadProject(project: Project): void {
    this.project = project;
    if (!this.started) return;
    this.disposeTrackNodes();
    for (const track of project.tracks) this.buildTrack(track);
    Tone.getTransport().bpm.value = project.bpm;
    this.setMasterVolume(project.masterVolume);
    this.applyLoop();
    this.refreshSolo();
  }

  private buildTrack(track: Track): void {
    const channel = new Tone.Channel({
      volume: this.toDb(track.volume),
      pan: track.pan,
      mute: track.muted,
    });
    const meter = new Tone.Meter({ smoothing: 0.7 });
    channel.connect(this.masterGain);
    channel.connect(meter);

    if (track.type === 'drums') {
      const voices = new Map<string, DrumVoice>();
      for (const lane of track.lanes ?? []) {
        const voice = createDrumVoice(lane.soundType);
        voice.connect(channel);
        voices.set(lane.id, voice);
      }
      this.nodes.set(track.id, { kind: 'drums', channel, meter, voices });
    } else {
      const instrument = new MelodicInstrument(
        track.instrumentParams ?? {
          oscillatorType: 'sawtooth', filterCutoff: 2400, filterQ: 2,
          attack: 0.01, decay: 0.22, sustain: 0.5, release: 0.4,
        },
      );
      instrument.connect(channel);
      this.nodes.set(track.id, { kind: 'melodic', channel, meter, instrument });
    }
  }

  /** Add a single track's nodes at runtime (no full rebuild). */
  addTrack(track: Track): void {
    if (!this.started || this.nodes.has(track.id)) return;
    this.buildTrack(track);
    this.refreshSolo();
  }

  removeTrack(trackId: string): void {
    const n = this.nodes.get(trackId);
    if (!n) return;
    this.teardown(n);
    this.nodes.delete(trackId);
    this.refreshSolo();
  }

  private disposeTrackNodes(): void {
    for (const n of this.nodes.values()) this.teardown(n);
    this.nodes.clear();
  }

  private teardown(n: TrackNodes): void {
    if (n.kind === 'drums') n.voices.forEach((v) => v.dispose());
    else n.instrument.dispose();
    n.meter.dispose();
    n.channel.dispose();
  }

  // --- Per-step scheduling ------------------------------------------------

  private triggerStep(step: number, time: number): void {
    const project = this.project;
    if (!project) return;
    const sixteenth = Tone.Time('16n').toSeconds();

    // Light swing: nudge off-beat (odd) 16ths slightly later.
    const swing = project.swing > 0 && step % 2 === 1 ? project.swing * sixteenth * 0.5 : 0;
    const t = time + swing;

    for (const track of project.tracks) {
      const n = this.nodes.get(track.id);
      if (!n) continue;
      if (n.kind === 'drums') {
        for (const lane of track.lanes ?? []) {
          if (lane.steps[step]) n.voices.get(lane.id)?.trigger(t, lane.volume);
        }
      } else {
        for (const note of track.notes ?? []) {
          if (note.step === step) {
            n.instrument.triggerNote(
              midiToNoteName(note.pitch),
              note.duration * sixteenth,
              t,
              note.velocity,
            );
          }
        }
      }
    }

    if (this.metronomeEnabled && step % 4 === 0) {
      const accent = step === 0;
      this.metronome.triggerAttackRelease(accent ? 'C6' : 'G5', '32n', time, accent ? 0.9 : 0.5);
    }
  }

  // --- Transport ----------------------------------------------------------

  play(): void {
    if (!this.started) return;
    this.step = 0;
    const transport = Tone.getTransport();
    transport.position = 0;
    transport.start();
    this.onPlayStateChange(true);
  }

  stop(): void {
    if (!this.started) return;
    const transport = Tone.getTransport();
    transport.stop();
    this.step = 0;
    this.onPlayStateChange(false);
    Tone.getDraw().schedule(() => this.onStep(-1), Tone.now());
  }

  togglePlay(): void {
    if (this.isPlaying) this.stop();
    else this.play();
  }

  setBpm(bpm: number): void {
    if (this.started) Tone.getTransport().bpm.value = bpm;
  }

  setLoop(enabled: boolean): void {
    this.loopEnabled = enabled;
    this.applyLoop();
  }

  /** Reapply loop region after pattern-length or loop-toggle changes. */
  applyLoop(): void {
    if (!this.started || !this.project) return;
    const transport = Tone.getTransport();
    transport.loop = this.loopEnabled;
    transport.loopStart = 0;
    // BarsBeatsSixteenths — scales correctly with BPM. Tone normalises >16.
    transport.loopEnd = `0:0:${this.project.patternLength}`;
  }

  setMetronome(enabled: boolean): void {
    this.metronomeEnabled = enabled;
  }

  setMasterVolume(v: number): void {
    if (this.started) this.masterGain.gain.rampTo(clamp(v, 0, 1), 0.02);
  }

  // --- Mixing / live params ----------------------------------------------

  updateTrackMix(track: Track): void {
    const n = this.nodes.get(track.id);
    if (!n) return;
    n.channel.volume.value = this.toDb(track.volume);
    n.channel.pan.value = clamp(track.pan, -1, 1);
    n.channel.mute = track.muted;
    n.channel.solo = track.solo;
    this.refreshSolo();
  }

  updateInstrument(track: Track): void {
    const n = this.nodes.get(track.id);
    if (n?.kind === 'melodic' && track.instrumentParams) {
      n.instrument.setParams(track.instrumentParams);
    }
  }

  /** Keep Tone's solo flags in sync with the project's solo state. */
  private refreshSolo(): void {
    if (!this.project) return;
    for (const track of this.project.tracks) {
      const n = this.nodes.get(track.id);
      if (n) n.channel.solo = track.solo;
    }
  }

  // --- Live preview (clicking keys / steps / lanes) -----------------------

  previewNote(trackId: string, pitch: number, velocity = 0.85): void {
    const n = this.nodes.get(trackId);
    if (n?.kind === 'melodic') {
      n.instrument.triggerNote(midiToNoteName(pitch), 0.3, Tone.now(), velocity);
    }
  }

  previewDrum(trackId: string, laneId: string, velocity = 0.9): void {
    const n = this.nodes.get(trackId);
    if (n?.kind === 'drums') n.voices.get(laneId)?.trigger(Tone.now(), velocity);
  }

  // --- Metering -----------------------------------------------------------

  getTrackLevel(trackId: string): number {
    const n = this.nodes.get(trackId);
    if (!n) return 0;
    return meterToLevel(this.meterValue(n.meter));
  }

  getMasterLevel(): number {
    if (!this.started) return 0;
    return meterToLevel(this.meterValue(this.masterMeter));
  }

  private meterValue(meter: Tone.Meter): number {
    const v = meter.getValue();
    return typeof v === 'number' ? v : Math.max(v[0] ?? -Infinity, v[1] ?? -Infinity);
  }

  private toDb(linear: number): number {
    return linear <= 0.0001 ? -Infinity : Tone.gainToDb(clamp(linear, 0, 1));
  }
}

/** Single shared engine instance for the whole app. */
export const engine = new AudioEngine();
