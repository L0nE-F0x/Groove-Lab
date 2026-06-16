/**
 * Instrument factories — everything here is pure Tone.js synthesis (no samples).
 *
 * Drum voices are deliberately small recipes so they're easy to tune by ear:
 * each returns a {@link DrumVoice} with a single `output` node you can route
 * into a mixer channel. The melodic instrument is a polyphonic subtractive
 * synth (oscillator -> amp envelope -> filter) that maps 1:1 onto the Sound
 * Design panel's controls.
 */
import * as Tone from 'tone';
import type { DrumSoundType, InstrumentParams } from './types';

export interface DrumVoice {
  /** Fire the sound at a precise transport time, scaled by velocity (0..1). */
  trigger(time: number, velocity: number): void;
  /** Route this voice's output into a mixer channel (or any Tone node). */
  connect(destination: Tone.InputNode): void;
  dispose(): void;
}

// --- Individual drum recipes ----------------------------------------------

/** Deep, punchy kick: a quickly-pitch-dropping sine "thud". */
function createKick(): DrumVoice {
  const synth = new Tone.MembraneSynth({
    pitchDecay: 0.032,
    octaves: 6,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.42, sustain: 0.008, release: 1.0, attackCurve: 'exponential' },
  });
  const out = new Tone.Gain(0.9);
  synth.connect(out);
  return {
    trigger: (time, v) => synth.triggerAttackRelease('C1', '8n', time, v),
    connect: (d) => out.connect(d),
    dispose: () => { synth.dispose(); out.dispose(); },
  };
}

/** Snare: a noise crack layered with a short tonal body. */
function createSnare(): DrumVoice {
  const noise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.16, sustain: 0 },
  });
  const noiseHP = new Tone.Filter(1700, 'highpass');
  const body = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.11, sustain: 0, release: 0.02 },
  });
  const out = new Tone.Gain(0.7);
  noise.chain(noiseHP, out);
  body.connect(out);
  return {
    trigger: (time, v) => {
      noise.triggerAttackRelease('16n', time, v);
      body.triggerAttackRelease('G3', '32n', time, v * 0.6);
    },
    connect: (d) => out.connect(d),
    dispose: () => { noise.dispose(); noiseHP.dispose(); body.dispose(); out.dispose(); },
  };
}

/** Hi-hats from filtered white noise. `open` lengthens the decay. */
function createHat(open: boolean): DrumVoice {
  const noise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: open ? 0.34 : 0.045, sustain: 0, release: open ? 0.12 : 0.02 },
  });
  const hp = new Tone.Filter(8200, 'highpass');
  const sparkle = new Tone.Filter({ type: 'peaking', frequency: 11000, Q: 1.2, gain: 6 });
  const out = new Tone.Gain(open ? 0.24 : 0.3);
  noise.chain(hp, sparkle, out);
  return {
    trigger: (time, v) => noise.triggerAttackRelease(open ? '8n' : '32n', time, v * 0.7),
    connect: (d) => out.connect(d),
    dispose: () => { noise.dispose(); hp.dispose(); sparkle.dispose(); out.dispose(); },
  };
}

/** Hand-clap: band-passed noise with a few micro-retriggers for "spread". */
function createClap(): DrumVoice {
  const noise = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.12 },
  });
  const bp = new Tone.Filter({ type: 'bandpass', frequency: 1100, Q: 1.1 });
  const out = new Tone.Gain(0.5);
  noise.chain(bp, out);
  return {
    trigger: (time, v) => {
      noise.triggerAttackRelease(0.045, time, v * 0.8);
      noise.triggerAttackRelease(0.045, time + 0.013, v * 0.6);
      noise.triggerAttackRelease(0.18, time + 0.026, v);
    },
    connect: (d) => out.connect(d),
    dispose: () => { noise.dispose(); bp.dispose(); out.dispose(); },
  };
}

/** Tuned percussion blip (tom/rim flavour). */
function createPerc(): DrumVoice {
  const synth = new Tone.MembraneSynth({
    pitchDecay: 0.02,
    octaves: 4,
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.1 },
  });
  const out = new Tone.Gain(0.55);
  synth.connect(out);
  return {
    trigger: (time, v) => synth.triggerAttackRelease('A2', '16n', time, v),
    connect: (d) => out.connect(d),
    dispose: () => { synth.dispose(); out.dispose(); },
  };
}

/** Factory: build the right drum voice for a lane's sound type. */
export function createDrumVoice(type: DrumSoundType): DrumVoice {
  switch (type) {
    case 'kick': return createKick();
    case 'snare': return createSnare();
    case 'clap': return createClap();
    case 'closedHat': return createHat(false);
    case 'openHat': return createHat(true);
    case 'perc': return createPerc();
  }
}

// --- Melodic synth ---------------------------------------------------------

/**
 * Polyphonic subtractive synth: oscillator + amp ADSR (per voice) feeding a
 * shared resonant low-pass filter. Every field of {@link InstrumentParams}
 * maps onto a control in the Sound Design panel and updates live.
 */
export class MelodicInstrument {
  readonly synth: Tone.PolySynth<Tone.Synth>;
  readonly filter: Tone.Filter;
  readonly output: Tone.Gain;

  constructor(params: InstrumentParams) {
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: params.oscillatorType },
      envelope: {
        attack: params.attack,
        decay: params.decay,
        sustain: params.sustain,
        release: params.release,
      },
    });
    this.synth.maxPolyphony = 24;
    this.filter = new Tone.Filter({
      type: 'lowpass',
      frequency: params.filterCutoff,
      Q: params.filterQ,
      rolloff: -24,
    });
    this.output = new Tone.Gain(0.8);
    this.synth.chain(this.filter, this.output);
  }

  /** Apply live parameter changes (called from the Sound Design panel). */
  setParams(p: InstrumentParams): void {
    this.synth.set({
      oscillator: { type: p.oscillatorType },
      envelope: { attack: p.attack, decay: p.decay, sustain: p.sustain, release: p.release },
    });
    this.filter.frequency.rampTo(p.filterCutoff, 0.04);
    this.filter.Q.rampTo(p.filterQ, 0.04);
  }

  triggerNote(note: string, duration: number, time: number, velocity: number): void {
    this.synth.triggerAttackRelease(note, duration, time, velocity);
  }

  connect(destination: Tone.InputNode): void {
    this.output.connect(destination);
  }

  dispose(): void {
    this.synth.dispose();
    this.filter.dispose();
    this.output.dispose();
  }
}
