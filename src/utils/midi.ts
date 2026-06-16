/** MIDI / note-name helpers. Middle C (MIDI 60) is named C4 here. */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

/** Pitch class 0..11 for any (possibly negative) MIDI number. */
export const pitchClass = (midi: number): number => ((midi % 12) + 12) % 12;

/** e.g. 60 -> "C4", 61 -> "C#4". Used to drive Tone.js synths. */
export const midiToNoteName = (midi: number): string => {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pitchClass(midi)]}${octave}`;
};

/** True for the black keys (C#, D#, F#, G#, A#). */
export const isBlackKey = (midi: number): boolean => BLACK_PITCH_CLASSES.has(pitchClass(midi));

/** True at the start of an octave (C) — handy for drawing keyboard guide lines. */
export const isOctaveRoot = (midi: number): boolean => pitchClass(midi) === 0;

export const NOTE_LETTERS = NOTE_NAMES;
