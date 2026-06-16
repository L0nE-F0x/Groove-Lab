/**
 * sampleActions — orchestrates turning an imported file or a recording into a
 * usable sound. After a sample is decoded + registered, a small chooser asks
 * whether to play it melodically (sampler track) or drop it into the beat grid
 * as a one-shot lane.
 */
import { el } from '../utils/dom';
import { addSample } from '../audio/sampleLibrary';
import type { Sample } from '../audio/types';
import { projectStore } from './state/projectStore';
import { uiStore } from './state/uiStore';
import { audio, toast } from './controller';

const cleanName = (filename: string): string => filename.replace(/\.[^.]+$/, '').slice(0, 28) || 'Sample';

const recordingCount = (): number =>
  projectStore.current.samples.filter((s) => s.source === 'recorded').length + 1;

async function registerAndUse(name: string, source: Sample['source'], blob: Blob): Promise<Sample> {
  const sample = await addSample(name, source, blob); // decodes (throws if invalid)
  projectStore.addSample(sample);
  await chooseUsage(sample);
  return sample;
}

export async function importSampleFromFile(file: File): Promise<void> {
  try {
    const sample = await registerAndUse(cleanName(file.name), 'imported', file);
    toast(`Imported “${sample.name}”`);
  } catch {
    toast('Could not import that audio file — is it a valid sound?', 'error');
  }
}

export async function useRecordedBlob(blob: Blob): Promise<void> {
  try {
    await registerAndUse(`Recording ${recordingCount()}`, 'recorded', blob);
  } catch {
    toast('Could not process the recording', 'error');
  }
}

/** Ask how to use a freshly added sample. Resolves once a track/lane is made. */
function chooseUsage(sample: Sample): Promise<void> {
  return new Promise((resolve) => {
    const finish = async (mode: 'melodic' | 'drum'): Promise<void> => {
      overlay.classList.add('is-closing');
      setTimeout(() => overlay.remove(), 200);
      if (mode === 'melodic') {
        const track = projectStore.addSamplerTrack(sample.id, sample.name);
        await audio.ensure();
        uiStore.selectTrack(track.id);
      } else {
        const drums = projectStore.drumsTrack;
        if (drums) {
          projectStore.addSampleLane(drums.id, sample.id, sample.name);
          uiStore.selectTrack(drums.id);
        }
        await audio.ensure();
      }
      resolve();
    };

    const choice = (emoji: string, title: string, sub: string, mode: 'melodic' | 'drum') =>
      el('button', { class: 'use-choice', type: 'button', onClick: () => void finish(mode) }, [
        el('span', { class: 'use-emoji' }, [emoji]),
        el('span', { class: 'use-title' }, [title]),
        el('span', { class: 'use-sub' }, [sub]),
      ]);

    const modal = el('div', { class: 'modal modal-sm' }, [
      el('div', { class: 'modal-head' }, [el('span', { class: 'modal-title' }, [`Use “${sample.name}”`])]),
      el('p', { class: 'modal-hint' }, ['How would you like to play this sound?']),
      el('div', { class: 'use-choices' }, [
        choice('🎹', 'Play melodically', 'Pitch it across the piano roll', 'melodic'),
        choice('🥁', 'Drum one-shot', 'Add it as a lane in the beat grid', 'drum'),
      ]),
    ]);

    const overlay = el('div', {
      class: 'modal-overlay',
      onPointerdown: (e: PointerEvent) => {
        if (e.target === overlay) void finish('melodic');
      },
    }, [modal]);

    (document.querySelector('.modal-host') ?? document.body).append(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));
  });
}
