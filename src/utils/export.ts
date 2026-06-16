/** JSON import/export. Projects are saved as clean, human-readable JSON. */
import type { Project } from '../audio/types';

/** Turn a project name into a safe-ish filename slug. */
const slug = (name: string): string =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'groove';

/** Trigger a download of the project as `<name>.groovelab.json`. */
export function downloadProject(project: Project): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug(project.name)}.groovelab.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Read and parse a `.json` File into a Project (throws on invalid JSON). */
export async function readProjectFile(file: File): Promise<Project> {
  const text = await file.text();
  const data = JSON.parse(text) as Project;
  if (!data || typeof data !== 'object' || !Array.isArray((data as Project).tracks)) {
    throw new Error('That file does not look like a GrooveLab project.');
  }
  return data;
}
