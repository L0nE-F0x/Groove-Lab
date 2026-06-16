/**
 * Offline render — bounce the whole project to an AudioBuffer with Tone.Offline.
 *
 * We rebuild the instrument graph inside the offline context (Tone swaps the
 * global context during the callback, so the same factories work) and schedule
 * every drum hit and note at absolute times across the requested number of
 * loops. Mute/solo and swing are honoured; the metronome is never rendered.
 */
import * as Tone from 'tone';
import {
  createDrumVoice,
  createSampleVoice,
  MelodicInstrument,
  SamplerInstrument,
  type DrumVoice,
  type Instrument,
} from './instruments';
import { DEFAULT_INSTRUMENT_PARAMS, DEFAULT_SAMPLE_ROOT, type Project } from './types';
import { getBuffer } from './sampleLibrary';
import { midiToNoteName } from '../utils/midi';
import { clamp } from '../utils/helpers';

const LEAD = 0.02; // tiny head start so nothing triggers exactly at offline t=0

export interface RenderOptions {
  loops?: number;
  tailSeconds?: number; // extra time for releases/reverb tails
}

export async function renderProject(project: Project, opts: RenderOptions = {}): Promise<AudioBuffer> {
  const loops = Math.max(1, Math.floor(opts.loops ?? 1));
  const tail = opts.tailSeconds ?? 1.5;
  const sixteenth = 60 / project.bpm / 4;
  const totalSteps = project.patternLength * loops;
  const duration = LEAD + totalSteps * sixteenth + tail;
  const soloActive = project.tracks.some((t) => t.solo);

  interface ONodes { drums?: Map<string, DrumVoice>; inst?: Instrument }

  const rendered = await Tone.Offline(() => {
    const master = new Tone.Gain(clamp(project.masterVolume, 0, 1));
    master.chain(new Tone.Limiter(-1), Tone.getDestination());

    const nodes = new Map<string, ONodes>();
    for (const track of project.tracks) {
      const audible = !track.muted && (!soloActive || track.solo);
      if (!audible) continue;
      const channel = new Tone.Channel({
        volume: track.volume <= 0.0001 ? -Infinity : Tone.gainToDb(track.volume),
        pan: clamp(track.pan, -1, 1),
      }).connect(master);

      if (track.type === 'drums') {
        const voices = new Map<string, DrumVoice>();
        for (const lane of track.lanes ?? []) {
          const buf = lane.sampleId ? getBuffer(lane.sampleId) : undefined;
          const voice = buf ? createSampleVoice(buf) : createDrumVoice(lane.soundType);
          voice.connect(channel);
          voices.set(lane.id, voice);
        }
        nodes.set(track.id, { drums: voices });
      } else {
        const params = track.instrumentParams ?? DEFAULT_INSTRUMENT_PARAMS;
        const buf = track.sampleId ? getBuffer(track.sampleId) : undefined;
        const inst: Instrument = buf
          ? new SamplerInstrument(buf, params, track.sampleRoot ?? DEFAULT_SAMPLE_ROOT)
          : new MelodicInstrument(params);
        inst.connect(channel);
        nodes.set(track.id, { inst });
      }
    }

    for (let i = 0; i < totalSteps; i++) {
      const step = i % project.patternLength;
      const swing = project.swing > 0 && step % 2 === 1 ? project.swing * sixteenth * 0.5 : 0;
      const time = LEAD + i * sixteenth + swing;
      for (const track of project.tracks) {
        const n = nodes.get(track.id);
        if (!n) continue;
        if (n.drums) {
          for (const lane of track.lanes ?? []) {
            if (lane.steps[step]) n.drums.get(lane.id)?.trigger(time, lane.volume);
          }
        } else if (n.inst) {
          for (const note of track.notes ?? []) {
            if (note.step === step) {
              n.inst.triggerNote(midiToNoteName(note.pitch), note.duration * sixteenth, time, note.velocity);
            }
          }
        }
      }
    }
  }, duration, 2);

  return (rendered as Tone.ToneAudioBuffer).get() as AudioBuffer;
}
