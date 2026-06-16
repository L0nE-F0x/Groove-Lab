/**
 * Recorder — capture audio from the mic/line-in via getUserMedia +
 * MediaRecorder. Produces a Blob that the sample library can decode like any
 * imported file. Also exposes a live input level (0..1) for a recording meter.
 */
export class Recorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private data: Uint8Array<ArrayBuffer> | null = null;

  get isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  /** Ask for the mic and start recording. Throws if permission is denied. */
  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });

    // Tap a lightweight analyser so the UI can show an input meter.
    this.audioCtx = new AudioContext();
    const src = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 512;
    this.data = new Uint8Array(this.analyser.fftSize);
    src.connect(this.analyser);

    this.chunks = [];
    const mimeType = pickMimeType();
    this.mediaRecorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start();
  }

  /** Stop recording and resolve with the captured audio. */
  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const mr = this.mediaRecorder;
      if (!mr) {
        reject(new Error('Not recording'));
        return;
      }
      mr.onstop = () => {
        const blob = new Blob(this.chunks, { type: mr.mimeType || 'audio/webm' });
        this.cleanup();
        resolve(blob);
      };
      mr.stop();
    });
  }

  /** Abort without producing a sample. */
  cancel(): void {
    try {
      this.mediaRecorder?.stop();
    } catch {
      /* ignore */
    }
    this.cleanup();
  }

  /** Current input level 0..1 (peak), for a recording meter. */
  getLevel(): number {
    if (!this.analyser || !this.data) return 0;
    this.analyser.getByteTimeDomainData(this.data);
    let peak = 0;
    for (let i = 0; i < this.data.length; i++) {
      peak = Math.max(peak, Math.abs(this.data[i] - 128) / 128);
    }
    return peak;
  }

  private cleanup(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioCtx?.close().catch(() => {});
    this.stream = null;
    this.audioCtx = null;
    this.analyser = null;
    this.data = null;
    this.mediaRecorder = null;
  }
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}
