/**
 * ProjectMenu — the "Project Library" modal. Browse saved projects (stored in
 * localStorage), load / duplicate / delete them, rename the current one, and
 * import/export `.json`. Opened from the transport bar's folder button.
 */
import { clear, el } from '../../utils/dom';
import { icon } from '../icons';
import { projectStore } from '../state/projectStore';
import { downloadProject, readProjectFile } from '../../utils/export';
import { toast } from '../controller';

let openOverlay: HTMLElement | null = null;

export function openLibrary(): void {
  if (openOverlay) return;

  const list = el('div', { class: 'modal-list' });

  const close = () => {
    openOverlay?.classList.add('is-closing');
    setTimeout(() => {
      openOverlay?.remove();
      openOverlay = null;
    }, 200);
  };

  const renderList = () => {
    clear(list);
    const projects = projectStore.listProjects();
    if (!projects.length) {
      list.append(el('div', { class: 'modal-empty' }, ['No saved projects yet.']));
      return;
    }
    for (const p of projects) {
      const isCurrent = p.id === projectStore.current.id;
      const row = el('div', { class: `lib-row${isCurrent ? ' is-current' : ''}` }, [
        el('div', { class: 'lib-info' }, [
          el('div', { class: 'lib-name' }, [p.name, isCurrent ? el('span', { class: 'lib-badge' }, ['current']) : '']),
          el('div', { class: 'lib-date' }, [new Date(p.updatedAt).toLocaleString()]),
        ]),
        el('div', { class: 'lib-actions' }, [
          el('button', {
            class: 'btn btn-ghost btn-sm', type: 'button',
            disabled: isCurrent, title: 'Load project', html: `${icon('folder', 14)}<span>Load</span>`,
            onClick: () => { projectStore.loadProject(p.id); toast(`Loaded “${p.name}”`); close(); },
          }),
          el('button', {
            class: 'icon-btn sm', type: 'button', title: 'Delete', html: icon('trash', 15),
            onClick: () => {
              if (confirm(`Delete “${p.name}”? This cannot be undone.`)) {
                projectStore.deleteProject(p.id);
                renderList();
                toast('Project deleted');
              }
            },
          }),
        ]),
      ]);
      list.append(row);
    }
  };

  // Current-project name + quick actions.
  const nameInput = el('input', {
    class: 'modal-name', value: projectStore.current.name, spellcheck: 'false',
    onChange: () => projectStore.renameProject(nameInput.value),
  }) as HTMLInputElement;

  const fileInput = el('input', {
    type: 'file', accept: 'application/json,.json', style: { display: 'none' },
    onChange: async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        projectStore.importProject(await readProjectFile(file));
        toast('Project imported');
        renderList();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Could not import file', 'error');
      }
      fileInput.value = '';
    },
  }) as HTMLInputElement;

  const current = el('div', { class: 'modal-section' }, [
    el('label', { class: 'modal-label' }, ['Current project']),
    el('div', { class: 'modal-current' }, [
      nameInput,
      el('button', {
        class: 'btn btn-ghost btn-sm', type: 'button', title: 'Duplicate',
        html: `${icon('copy', 14)}<span>Duplicate</span>`,
        onClick: () => { const c = projectStore.duplicateProject(); renderList(); toast(`Duplicated as “${c.name}”`); },
      }),
      el('button', {
        class: 'btn btn-ghost btn-sm', type: 'button', title: 'Export JSON',
        html: `${icon('download', 14)}<span>Export</span>`,
        onClick: () => { downloadProject(projectStore.current); toast('Exported project JSON'); },
      }),
    ]),
  ]);

  const head = el('div', { class: 'modal-head' }, [
    el('span', { class: 'modal-title' }, [el('span', { html: icon('folder', 18) }), 'Project Library']),
    el('button', { class: 'icon-btn', type: 'button', title: 'Close', html: icon('x', 18), onClick: close }),
  ]);

  const foot = el('div', { class: 'modal-foot' }, [
    el('button', {
      class: 'btn btn-ghost', type: 'button', html: `${icon('upload', 15)}<span>Import .json</span>`,
      onClick: () => fileInput.click(),
    }),
    el('button', {
      class: 'btn btn-primary', type: 'button', html: `${icon('plus', 15)}<span>New groove</span>`,
      onClick: () => { projectStore.newProject(); toast('Started a new groove'); close(); },
    }),
  ]);

  const modal = el('div', { class: 'modal' }, [
    head,
    current,
    el('div', { class: 'modal-section' }, [el('label', { class: 'modal-label' }, ['Saved projects']), list]),
    foot,
    fileInput,
  ]);

  openOverlay = el('div', {
    class: 'modal-overlay',
    onPointerdown: (e: PointerEvent) => { if (e.target === openOverlay) close(); },
  }, [modal]);

  // Esc to close.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { close(); window.removeEventListener('keydown', onKey); }
  };
  window.addEventListener('keydown', onKey);

  renderList();
  (document.querySelector('.modal-host') ?? document.body).append(openOverlay);
  requestAnimationFrame(() => openOverlay?.classList.add('is-open'));
}
