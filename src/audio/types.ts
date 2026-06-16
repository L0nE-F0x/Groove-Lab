/**
 * Core data models for GrooveLab.
 *
 * The `Project` object is the single source of truth for the whole app and it
 * serialises cleanly to human-readable JSON (for localStorage + export).
 * Everything the audio engine and UI need is derivable from here.
 */

/** Oscillator shapes the melodic synth supports (mirrors Tone.js basic types). */
export type OscType = 'sine' | 'square' | 'sawtooth' | 'triangle';

/** Synthesized drum voices available in the kit (plus 'sample' one-shots). */
export type DrumSoundType = 'kick' | 'snare' | 'clap' | 'closedHat' | 'openHat' | 'perc' | 'sample';

export type TrackType = 'drums' | 'melodic';

/**
 * An imported or recorded audio sample. The raw bytes live in IndexedDB (keyed
 * by `id`); only this lightweight metadata is kept in the Project JSON. On
 * export the bytes are re-embedded so a shared `.json` is self-contained.
 */
export interface Sample {
  id: string;
  name: string;
  source: 'imported' | 'recorded';
  duration: number; // seconds
  createdAt: string;
}

/** A single melodic note placed on the piano roll. */
export interface Note {
  id: string;
  step: number; // start step (0-based, counted in 16th notes)
  pitch: number; // MIDI note number (60 = C4)
  duration: number; // length in steps (min 1)
  velocity: number; // 0.3 – 1.0
}

/** One lane (row) of the drum sequencer, e.g. the kick row. */
export interface DrumLane {
  id: string;
  name: string;
  soundType: DrumSoundType;
  steps: boolean[]; // length === Project.patternLength
  volume: number; // 0 – 1, per-lane level
  /** When set (soundType 'sample'), the lane plays this one-shot instead of a synth. */
  sampleId?: string;
}

/** Live-tweakable parameters for the melodic synth (Sound Design panel). */
export interface InstrumentParams {
  oscillatorType: OscType;
  filterCutoff: number; // Hz, 20 – 18000
  filterQ: number; // resonance, 0 – 18
  attack: number; // seconds
  decay: number; // seconds
  sustain: number; // 0 – 1 level
  release: number; // seconds
}

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  color: string; // accent colour used for this track across the UI
  volume: number; // 0 – 1
  pan: number; // -1 (L) – 1 (R)
  muted: boolean;
  solo: boolean;
  lanes?: DrumLane[]; // drums only
  notes?: Note[]; // melodic only
  instrumentParams?: InstrumentParams; // melodic only
  /** When set, this melodic track is a Sampler playing this sample (pitched). */
  sampleId?: string;
  /** MIDI note at which the sample plays back at original pitch (default 60 = C4). */
  sampleRoot?: number;
}

export interface Project {
  id: string;
  name: string;
  bpm: number; // 60 – 200
  patternLength: number; // number of steps (16, 32, ...)
  swing: number; // 0 – 1 (delays off-beat 16ths). Default 0.
  masterVolume: number; // 0 – 1
  tracks: Track[];
  samples: Sample[]; // imported / recorded sample library
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/** Lightweight project descriptor for the load/save browser. */
export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Sensible defaults & constants (easy to tweak as the app grows).
// ---------------------------------------------------------------------------

export const DEFAULT_PATTERN_LENGTH = 16;
export const BPM_MIN = 60;
export const BPM_MAX = 200;

/** Piano-roll pitch window: C2 (36) up to B5 (83) — three full octaves. */
export const PITCH_MIN = 36;
export const PITCH_MAX = 83;

export const FILTER_MIN = 80;
export const FILTER_MAX = 16000;

/** MIDI note a sample plays at its original pitch by default (C4). */
export const DEFAULT_SAMPLE_ROOT = 60;

export const DEFAULT_INSTRUMENT_PARAMS: InstrumentParams = {
  oscillatorType: 'sawtooth',
  filterCutoff: 2400,
  filterQ: 2,
  attack: 0.01,
  decay: 0.22,
  sustain: 0.5,
  release: 0.4,
};

/** Friendly display names + default per-lane mix for the standard kit. */
export const DRUM_LANE_PRESETS: ReadonlyArray<{
  name: string;
  soundType: DrumSoundType;
  volume: number;
}> = [
  { name: 'Kick', soundType: 'kick', volume: 0.95 },
  { name: 'Snare', soundType: 'snare', volume: 0.8 },
  { name: 'Clap', soundType: 'clap', volume: 0.7 },
  { name: 'Closed Hat', soundType: 'closedHat', volume: 0.55 },
  { name: 'Open Hat', soundType: 'openHat', volume: 0.5 },
  { name: 'Perc', soundType: 'perc', volume: 0.6 },
];

/** Track accent colours, cycled as new tracks are added. */
export const TRACK_COLORS = ['#00e5ff', '#ff2e92', '#ffb800', '#7c5cff', '#1fd1a5'];
