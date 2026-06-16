/**
 * Project JSON import/export. Exports embed each sample's bytes (as a data URL
 * under `sampleData`) so a shared `.json` is fully self-contained; imports
 * restore those bytes into IndexedDB.
 */
import type { Project } from '../audio/types';
import { getSampleDataUrl } from '../audio/sampleLibrary';

/** A project file may carry its samples inline for portability. */
export type ProjectFile = Project & { sampleData?: Record<string, string> };

const slug = (name: string): string =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'groove';

/** Build a self-contained JSON string (project + embedded sample bytes). */
export async function buildProjectFileJson(project: Project): Promise<string> {
  const sampleData: Record<string, string> = {};
  for (const sample of project.samples) {
    const url = await getSampleDataUrl(sample.id);
    if (url) sampleData[sample.id] = url;
  }
  const file: ProjectFile = { ...project };
  if (Object.keys(sampleData).length) file.sampleData = sampleData;
  return JSON.stringify(file, null, 2);
}

/** Download the current project as `<name>.groovelab.json`. */
export async function downloadProject(project: Project): Promise<void> {
  const blob = new Blob([await buildProjectFileJson(project)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug(project.name)}.groovelab.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Read and parse a `.json` File into a project (throws on invalid JSON). */
export async function readProjectFile(file: File): Promise<ProjectFile> {
  const text = await file.text();
  const data = JSON.parse(text) as ProjectFile;
  if (!data || typeof data !== 'object' || !Array.isArray(data.tracks)) {
    throw new Error('That file does not look like a GrooveLab project.');
  }
  return data;
}
