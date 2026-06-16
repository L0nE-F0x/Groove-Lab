/**
 * RecorderModal — record a sound from the mic. Shows a live input meter and an
 * elapsed timer; on stop the recording is handed to the sample chooser.
 */
import { el } from '../../utils/dom';
import { icon } from '../icons';
import { Recorder } from '../../audio/recorder';
import { toast } from '../controller';
import { useRecordedBlob } from '../sampleActions';

let isOpen = false;

export function openRecorder(): void {
  if (isOpen) return;
  isOpen = true;

  const recorder = new Recorder();
  let raf = 0;
  let startTime = 0;
  let recording = false;

  const meterFill = el('div', { class: 'rec-meter-fill' });
  const timer = el('div', { class: 'rec-timer mono' }, ['0.0s']);
  const status = el('p', { class: 'modal-hint' }, ['Click record, make a sound, then stop. Great for vocal chops, claps, found sounds…']);

  const recBtn = el('button', { class: 'rec-button', type: 'button', html: icon('mic', 22) });
  const recLabel = el('span', { class: 'rec-label' }, ['Record']);

  const close = (): void => {
    cancelAnimationFrame(raf);
    recorder.cancel();
    overlay.classList.add('is-closing');
    setTimeout(() => {
      overlay.remove();
      isOpen = false;
    }, 200);
  };

  const tick = (): void => {
    meterFill.style.transform = `scaleX(${recorder.getLevel().toFixed(3)})`;
    timer.textContent = `${((performance.now() - startTime) / 1000).toFixed(1)}s`;
    raf = requestAnimationFrame(tick);
  };

  const startRecording = async (): Promise<void> => {
    try {
      await recorder.start();
    } catch {
      toast('Microphone access was blocked. Allow mic access to record.', 'error');
      return;
    }
    recording = true;
    startTime = performance.now();
    recBtn.classList.add('is-recording');
    recBtn.innerHTML = icon('stop', 20);
    recLabel.textContent = 'Stop';
    status.textContent = 'Recording… click stop when you’re done.';
    tick();
  };

  const stopRecording = async (): Promise<void> => {
    cancelAnimationFrame(raf);
    recording = false;
    const blob = await recorder.stop();
    overlay.classList.add('is-closing');
    setTimeout(() => {
      overlay.remove();
      isOpen = false;
    }, 200);
    await useRecordedBlob(blob);
  };

  recBtn.addEventListener('click', () => void (recording ? stopRecording() : startRecording()));

  const modal = el('div', { class: 'modal modal-sm' }, [
    el('div', { class: 'modal-head' }, [
      el('span', { class: 'modal-title' }, [el('span', { html: icon('mic', 18) }), 'Record a sound']),
      el('button', { class: 'icon-btn', type: 'button', title: 'Close', html: icon('x', 18), onClick: close }),
    ]),
    status,
    el('div', { class: 'rec-stage' }, [
      recBtn,
      el('div', { class: 'rec-meter' }, [meterFill]),
      timer,
    ]),
    el('div', { class: 'rec-label-wrap' }, [recLabel]),
  ]);

  const overlay = el('div', {
    class: 'modal-overlay',
    onPointerdown: (e: PointerEvent) => {
      if (e.target === overlay && !recording) close();
    },
  }, [modal]);

  (document.querySelector('.modal-host') ?? document.body).append(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-open'));
}
