/**
 * Starter content — the grooves the landing screen offers.
 *
 * Patterns are written as readable 16-char strings ("x" = hit, "." = rest) so
 * they're easy to tweak by eye. Each demo builds a fresh Project (new ids) so
 * loading a demo never clobbers a saved one.
 */
import {
  DRUM_LANE_PRESETS,
  TRACK_COLORS,
  type DrumLane,
  type DrumSoundType,
  type InstrumentParams,
  type Note,
  type Project,
  type Track,
} from '../../audio/types';
import { uid } from '../../utils/helpers';

const LEN = 16;

interface NoteSpec { step: number; pitch: number; duration: number; velocity?: number }

interface Template {
  key: string;
  label: string;
  emoji: string;
  blurb: string;
  bpm: number;
  swing: number;
  drums: Partial<Record<DrumSoundType, string>>;
  synthName: string;
  synth: InstrumentParams;
  notes: NoteSpec[];
}

function parsePattern(p: string): boolean[] {
  const cells = p
    .replace(/\s/g, '')
    .split('')
    .map((c) => c === 'x' || c === 'X');
  while (cells.length < LEN) cells.push(false);
  return cells.slice(0, LEN);
}

function makeDrumTrack(patterns: Partial<Record<DrumSoundType, string>>): Track {
  const lanes: DrumLane[] = DRUM_LANE_PRESETS.map((preset) => ({
    id: uid('lane'),
    name: preset.name,
    soundType: preset.soundType,
    volume: preset.volume,
    steps: parsePattern(patterns[preset.soundType] ?? ''),
  }));
  return {
    id: uid('trk'),
    name: 'Drums',
    type: 'drums',
    color: TRACK_COLORS[0],
    volume: 0.9,
    pan: 0,
    muted: false,
    solo: false,
    lanes,
  };
}

function makeMelodicTrack(name: string, synth: InstrumentParams, notes: NoteSpec[]): Track {
  const built: Note[] = notes.map((n) => ({
    id: uid('note'),
    step: n.step,
    pitch: n.pitch,
    duration: n.duration,
    velocity: n.velocity ?? 0.8,
  }));
  return {
    id: uid('trk'),
    name,
    type: 'melodic',
    color: TRACK_COLORS[1],
    volume: 0.8,
    pan: 0,
    muted: false,
    solo: false,
    instrumentParams: { ...synth },
    notes: built,
  };
}

function assemble(name: string, t: Pick<Template, 'bpm' | 'swing' | 'drums' | 'synthName' | 'synth' | 'notes'>): Project {
  const now = new Date().toISOString();
  return {
    id: uid('proj'),
    name,
    bpm: t.bpm,
    patternLength: LEN,
    swing: t.swing,
    masterVolume: 0.85,
    tracks: [makeDrumTrack(t.drums), makeMelodicTrack(t.synthName, t.synth, t.notes)],
    samples: [],
    createdAt: now,
    updatedAt: now,
  };
}

// --- The three demo grooves ------------------------------------------------

export const demoTemplates: Template[] = [
  {
    key: 'house',
    label: 'Groovy House',
    emoji: '🏠',
    blurb: 'Four-on-the-floor warmth',
    bpm: 124,
    swing: 0,
    drums: {
      kick: 'x...x...x...x...',
      clap: '....x.......x...',
      closedHat: '..x...x...x...x.',
      perc: '.......x.......x',
    },
    synthName: 'Pluck Lead',
    synth: { oscillatorType: 'sawtooth', filterCutoff: 2600, filterQ: 3, attack: 0.005, decay: 0.18, sustain: 0.25, release: 0.25 },
    notes: [
      { step: 2, pitch: 57, duration: 2, velocity: 0.85 }, // A3
      { step: 6, pitch: 60, duration: 2, velocity: 0.8 }, // C4
      { step: 8, pitch: 64, duration: 2, velocity: 0.85 }, // E4
      { step: 10, pitch: 60, duration: 2, velocity: 0.75 }, // C4
      { step: 14, pitch: 62, duration: 2, velocity: 0.8 }, // D4
    ],
  },
  {
    key: 'techno',
    label: 'Driving Techno',
    emoji: '🌀',
    blurb: 'Hypnotic acid pulse',
    bpm: 132,
    swing: 0,
    drums: {
      kick: 'x...x...x...x...',
      snare: '....x.......x...',
      closedHat: '.x.x.x.x.x.x.x.x',
      openHat: '..x...x...x...x.',
      perc: '.......x.....x..',
    },
    synthName: 'Acid Bass',
    synth: { oscillatorType: 'sawtooth', filterCutoff: 900, filterQ: 9, attack: 0.005, decay: 0.18, sustain: 0.15, release: 0.12 },
    notes: [
      { step: 0, pitch: 45, duration: 1, velocity: 0.9 }, // A2
      { step: 2, pitch: 45, duration: 1, velocity: 0.6 },
      { step: 4, pitch: 48, duration: 1, velocity: 0.85 }, // C3
      { step: 6, pitch: 45, duration: 1, velocity: 0.6 },
      { step: 8, pitch: 52, duration: 1, velocity: 0.85 }, // E3
      { step: 10, pitch: 45, duration: 1, velocity: 0.6 },
      { step: 12, pitch: 50, duration: 1, velocity: 0.8 }, // D3
      { step: 14, pitch: 57, duration: 1, velocity: 0.95 }, // A3 accent
    ],
  },
  {
    key: 'lofi',
    label: 'Chill Lo-Fi',
    emoji: '🌧️',
    blurb: 'Dusty, swung & mellow',
    bpm: 82,
    swing: 0.32,
    drums: {
      kick: 'x.......x..x....',
      snare: '....x.......x...',
      closedHat: 'x.x.x.x.x.x.x.x.',
      openHat: '......x.........',
    },
    synthName: 'Mellow Keys',
    synth: { oscillatorType: 'triangle', filterCutoff: 1500, filterQ: 1, attack: 0.04, decay: 0.4, sustain: 0.6, release: 0.9 },
    notes: [
      // Cmaj7 -> Am7, soft and sustained
      { step: 0, pitch: 60, duration: 8, velocity: 0.55 },
      { step: 0, pitch: 64, duration: 8, velocity: 0.5 },
      { step: 0, pitch: 67, duration: 8, velocity: 0.5 },
      { step: 0, pitch: 71, duration: 8, velocity: 0.45 },
      { step: 8, pitch: 57, duration: 8, velocity: 0.55 },
      { step: 8, pitch: 60, duration: 8, velocity: 0.5 },
      { step: 8, pitch: 64, duration: 8, velocity: 0.5 },
      { step: 8, pitch: 67, duration: 8, velocity: 0.45 },
    ],
  },
];

/** Build a fresh Project from a demo key (defaults to the first template). */
export function buildDemoProject(key: string): Project {
  const t = demoTemplates.find((d) => d.key === key) ?? demoTemplates[0];
  return assemble(t.label, t);
}

/**
 * A clean, simple starter for "New Groove" — already musical (so the user hears
 * something immediately) but sparse enough to make their own.
 */
export function buildStarterProject(): Project {
  return assemble('New Groove', {
    bpm: 120,
    swing: 0,
    drums: {
      kick: 'x...x...x...x...',
      clap: '....x.......x...',
      closedHat: '..x...x...x...x.',
    },
    synthName: 'Lead',
    synth: { oscillatorType: 'sawtooth', filterCutoff: 2400, filterQ: 2, attack: 0.01, decay: 0.22, sustain: 0.5, release: 0.4 },
    notes: [],
  });
}
