/** Encode an AudioBuffer to WAV (16-bit PCM) or MP3, and trigger a download. */
import { Mp3Encoder } from '@breezystack/lamejs';

/** Interleaved 16-bit PCM WAV — lossless, plays everywhere. */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const len = buffer.length;
  const blockAlign = numCh * 2;
  const dataSize = len * blockAlign;
  const arr = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arr);

  let p = 0;
  const str = (s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(p++, s.charCodeAt(i)); };
  const u32 = (v: number) => { view.setUint32(p, v, true); p += 4; };
  const u16 = (v: number) => { view.setUint16(p, v, true); p += 2; };

  str('RIFF'); u32(36 + dataSize); str('WAVE');
  str('fmt '); u32(16); u16(1); u16(numCh); u32(sampleRate); u32(sampleRate * blockAlign); u16(blockAlign); u16(16);
  str('data'); u32(dataSize);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      p += 2;
    }
  }
  return new Blob([arr], { type: 'audio/wav' });
}

/** MP3 via lamejs. `kbps` defaults to a clean 192. */
export function audioBufferToMp3(buffer: AudioBuffer, kbps = 192): Blob {
  const numCh = Math.min(2, buffer.numberOfChannels);
  const encoder = new Mp3Encoder(numCh, buffer.sampleRate, kbps);
  const left = floatToInt16(buffer.getChannelData(0));
  const right = numCh > 1 ? floatToInt16(buffer.getChannelData(1)) : left;

  const blockSize = 1152;
  const parts: BlobPart[] = [];
  for (let i = 0; i < left.length; i += blockSize) {
    const l = left.subarray(i, i + blockSize);
    const r = right.subarray(i, i + blockSize);
    const chunk = numCh > 1 ? encoder.encodeBuffer(l, r) : encoder.encodeBuffer(l);
    if (chunk.length) parts.push(new Uint8Array(chunk));
  }
  const end = encoder.flush();
  if (end.length) parts.push(new Uint8Array(end));
  return new Blob(parts, { type: 'audio/mpeg' });
}

function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
