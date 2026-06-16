/**
 * ExportModal — bounce the track to an audio file. Choose WAV (lossless) or MP3
 * and how many loops to render, then download. Rendering is done offline via
 * {@link renderProject} so it's faster than real-time and glitch-free.
 */
import { el } from '../../utils/dom';
import { icon } from '../icons';
import { renderProject } from '../../audio/render';
import { audioBufferToMp3, audioBufferToWav, downloadBlob } from '../../utils/audioExport';
import { projectStore } from '../state/projectStore';
import { audio, toast } from '../controller';

let isOpen = false;

const slug = (name: string): string =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'groove';

export function openExport(): void {
  if (isOpen) return;
  isOpen = true;

  let format: 'wav' | 'mp3' = 'wav';
  let loops = 2;
  let rendering = false;

  const close = (): void => {
    overlay.classList.add('is-closing');
    setTimeout(() => {
      overlay.remove();
      isOpen = false;
    }, 200);
  };

  const segmented = <T extends string>(
    options: { value: T; label: string }[],
    initial: T,
    onPick: (v: T) => void,
  ): HTMLElement => {
    const group = el('div', { class: 'segmented' });
    for (const o of options) {
      const btn = el('button', {
        class: `seg-btn${o.value === initial ? ' is-active' : ''}`,
        type: 'button',
        onClick: () => {
          group.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          onPick(o.value);
        },
      }, [o.label]);
      group.append(btn);
    }
    return group;
  };

  const renderBtn = el('button', {
    class: 'btn btn-primary btn-block', type: 'button',
    html: `${icon('download', 16)}<span>Render &amp; download</span>`,
  }) as HTMLButtonElement;

  const doRender = async (): Promise<void> => {
    if (rendering) return;
    rendering = true;
    renderBtn.disabled = true;
    renderBtn.innerHTML = `<span class="spinner"></span><span>Rendering…</span>`;
    try {
      await audio.ensure(); // makes sure any samples are decoded
      const buffer = await renderProject(projectStore.current, { loops });
      const blob = format === 'wav' ? audioBufferToWav(buffer) : audioBufferToMp3(buffer);
      downloadBlob(blob, `${slug(projectStore.current.name)}.${format}`);
      toast(`Exported ${format.toUpperCase()} (${loops} loop${loops > 1 ? 's' : ''})`);
      close();
    } catch (err) {
      console.error('GrooveLab: export failed', err);
      toast('Export failed — please try again.', 'error');
      renderBtn.disabled = false;
      renderBtn.innerHTML = `${icon('download', 16)}<span>Render &amp; download</span>`;
      rendering = false;
    }
  };
  renderBtn.addEventListener('click', () => void doRender());

  const modal = el('div', { class: 'modal modal-sm' }, [
    el('div', { class: 'modal-head' }, [
      el('span', { class: 'modal-title' }, [el('span', { html: icon('download', 18) }), 'Export audio']),
      el('button', { class: 'icon-btn', type: 'button', title: 'Close', html: icon('x', 18), onClick: close }),
    ]),
    el('div', { class: 'export-field' }, [
      el('label', { class: 'modal-label' }, ['Format']),
      segmented(
        [{ value: 'wav', label: 'WAV · lossless' }, { value: 'mp3', label: 'MP3 · smaller' }],
        'wav',
        (v) => (format = v),
      ),
    ]),
    el('div', { class: 'export-field' }, [
      el('label', { class: 'modal-label' }, ['Length']),
      segmented(
        [{ value: '1', label: '1 loop' }, { value: '2', label: '2 loops' }, { value: '4', label: '4 loops' }],
        '2',
        (v) => (loops = Number(v)),
      ),
    ]),
    renderBtn,
    el('p', { class: 'modal-hint' }, ['Tip: the project is also saved as JSON in the Library (folder icon).']),
  ]);

  const overlay = el('div', {
    class: 'modal-overlay',
    onPointerdown: (e: PointerEvent) => {
      if (e.target === overlay && !rendering) close();
    },
  }, [modal]);

  (document.querySelector('.modal-host') ?? document.body).append(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-open'));
}
