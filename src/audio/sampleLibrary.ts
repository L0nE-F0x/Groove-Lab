/**
 * sampleLibrary — decodes sample blobs into AudioBuffers and caches them so the
 * engine (and the offline renderer) can build instruments synchronously once a
 * sample is loaded. Also handles base64 round-tripping for portable JSON.
 */
import * as Tone from 'tone';
import { uid } from '../utils/helpers';
import type { Sample } from './types';
import { deleteSampleBlob, getSampleBlob, putSampleBlob } from './sampleStore';

const buffers = new Map<string, AudioBuffer>();

/** Decode raw bytes. Tone's underlying context decodes fine while suspended. */
async function decode(blob: Blob): Promise<AudioBuffer> {
  const arr = await blob.arrayBuffer();
  return Tone.getContext().rawContext.decodeAudioData(arr);
}

/** Synchronous cache lookup (undefined until {@link ensureLoaded} resolves). */
export function getBuffer(id: string): AudioBuffer | undefined {
  return buffers.get(id);
}

export async function ensureLoaded(id: string): Promise<AudioBuffer | undefined> {
  const cached = buffers.get(id);
  if (cached) return cached;
  const blob = await getSampleBlob(id);
  if (!blob) return undefined;
  try {
    const buffer = await decode(blob);
    buffers.set(id, buffer);
    return buffer;
  } catch (err) {
    console.warn('GrooveLab: failed to decode sample', id, err);
    return undefined;
  }
}

/** Preload several samples in parallel (used before building the audio graph). */
export async function ensureMany(ids: Iterable<string>): Promise<void> {
  await Promise.all([...new Set(ids)].map((id) => ensureLoaded(id)));
}

/**
 * Store a brand new sample: decode (to validate + measure duration), cache the
 * buffer, and persist the original blob. Returns the metadata for the Project.
 */
export async function addSample(name: string, source: Sample['source'], blob: Blob): Promise<Sample> {
  const id = uid('smp');
  const buffer = await decode(blob); // throws on undecodable audio — caller toasts
  buffers.set(id, buffer);
  await putSampleBlob(id, blob);
  return { id, name, source, duration: buffer.duration, createdAt: new Date().toISOString() };
}

export async function removeSample(id: string): Promise<void> {
  buffers.delete(id);
  await deleteSampleBlob(id);
}

// --- base64 (data URL) round-trip for self-contained .json export ----------

export async function getSampleDataUrl(id: string): Promise<string | undefined> {
  const blob = await getSampleBlob(id);
  return blob ? blobToDataUrl(blob) : undefined;
}

/** Restore a sample from an exported data URL, keeping its original id. */
export async function putSampleDataUrl(id: string, dataUrl: string): Promise<void> {
  const blob = await (await fetch(dataUrl)).blob();
  await putSampleBlob(id, blob);
  buffers.delete(id); // force re-decode on next use
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
