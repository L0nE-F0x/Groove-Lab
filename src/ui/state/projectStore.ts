/**
 * projectStore — the single source of truth.
 *
 * Everything mutating the song goes through here. Each mutation updates the
 * live Project object in place (so the audio engine, which holds a reference,
 * hears it instantly), bumps `updatedAt`, emits a precise event for the UI to
 * react to, and schedules a debounced localStorage save.
 */
import {
  BPM_MAX,
  BPM_MIN,
  DEFAULT_INSTRUMENT_PARAMS,
  DEFAULT_SAMPLE_ROOT,
  PITCH_MAX,
  PITCH_MIN,
  TRACK_COLORS,
  type DrumLane,
  type InstrumentParams,
  type Note,
  type Project,
  type ProjectSummary,
  type Sample,
  type Track,
} from '../../audio/types';
import { Emitter } from '../../utils/events';
import { clamp, debounce, uid } from '../../utils/helpers';
import { putSampleDataUrl, removeSample } from '../../audio/sampleLibrary';
import { buildDemoProject, buildStarterProject } from './demoProjects';

const STORAGE_PREFIX = 'groovelab:project:';
const INDEX_KEY = 'groovelab:index';
const LAST_KEY = 'groovelab:last';

type StoreEvents = {
  'project:loaded': Project; // whole project swapped (new/demo/load)
  structure: Project; // pattern length changed (grid dimensions)
  transport: Project; // bpm / master volume / swing
  drums: { trackId: string }; // a drum lane changed
  notes: { trackId: string }; // melodic notes changed
  mix: { trackId: string }; // volume / pan / mute / solo
  instrument: { trackId: string }; // sound-design params
  'track:added': { track: Track };
  'track:removed': { trackId: string };
  'track:renamed': { trackId: string };
  'track:rebuilt': { trackId: string }; // sampler instrument must be rebuilt (sample/root)
  lanes: { trackId: string }; // a drum lane was added/removed (grid + engine rebuild)
  samples: Project; // sample library changed
  meta: Project; // project name or saved-project list changed
};

class ProjectStore extends Emitter<StoreEvents> {
  private project: Project;
  private readonly scheduleSave = debounce(() => this.persist(), 450);

  constructor() {
    super();
    this.project = this.loadLastOrStarter();
  }

  get current(): Project {
    return this.project;
  }

  // --- Lookups ------------------------------------------------------------

  getTrack(trackId: string): Track | undefined {
    return this.project.tracks.find((t) => t.id === trackId);
  }

  private getLane(trackId: string, laneId: string): DrumLane | undefined {
    return this.getTrack(trackId)?.lanes?.find((l) => l.id === laneId);
  }

  private touch(): void {
    this.project.updatedAt = new Date().toISOString();
    this.scheduleSave();
  }

  // --- Transport / global -------------------------------------------------

  setBpm(bpm: number): void {
    this.project.bpm = clamp(Math.round(bpm), BPM_MIN, BPM_MAX);
    this.emit('transport', this.project);
    this.touch();
  }

  setMasterVolume(v: number): void {
    this.project.masterVolume = clamp(v, 0, 1);
    this.emit('transport', this.project);
    this.touch();
  }

  setSwing(v: number): void {
    this.project.swing = clamp(v, 0, 1);
    this.emit('transport', this.project);
    this.touch();
  }

  setPatternLength(steps: number): void {
    const len = clamp(Math.round(steps), 4, 64);
    this.project.patternLength = len;
    for (const track of this.project.tracks) {
      track.lanes?.forEach((lane) => {
        const next = lane.steps.slice(0, len);
        while (next.length < len) next.push(false);
        lane.steps = next;
      });
      if (track.notes) track.notes = track.notes.filter((n) => n.step < len);
    }
    this.emit('structure', this.project);
    this.touch();
  }

  // --- Drum lanes ---------------------------------------------------------

  /** Toggle a step and return its new value (so the UI can preview the hit). */
  toggleStep(trackId: string, laneId: string, step: number): boolean {
    const lane = this.getLane(trackId, laneId);
    if (!lane) return false;
    const next = !lane.steps[step];
    lane.steps[step] = next;
    this.emit('drums', { trackId });
    this.touch();
    return next;
  }

  setStep(trackId: string, laneId: string, step: number, on: boolean): void {
    const lane = this.getLane(trackId, laneId);
    if (!lane || lane.steps[step] === on) return;
    lane.steps[step] = on;
    this.emit('drums', { trackId });
    this.touch();
  }

  clearLane(trackId: string, laneId: string): void {
    const lane = this.getLane(trackId, laneId);
    if (!lane) return;
    lane.steps = lane.steps.map(() => false);
    this.emit('drums', { trackId });
    this.touch();
  }

  randomizeLane(trackId: string, laneId: string, density = 0.35): void {
    const lane = this.getLane(trackId, laneId);
    if (!lane) return;
    lane.steps = lane.steps.map(() => Math.random() < density);
    this.emit('drums', { trackId });
    this.touch();
  }

  clearAllDrums(trackId: string): void {
    const track = this.getTrack(trackId);
    if (!track?.lanes) return;
    track.lanes.forEach((l) => (l.steps = l.steps.map(() => false)));
    this.emit('drums', { trackId });
    this.touch();
  }

  setLaneVolume(trackId: string, laneId: string, v: number): void {
    const lane = this.getLane(trackId, laneId);
    if (!lane) return;
    lane.volume = clamp(v, 0, 1);
    this.emit('drums', { trackId });
    this.touch();
  }

  // --- Melodic notes ------------------------------------------------------

  addNote(trackId: string, partial: Omit<Note, 'id'>): Note | undefined {
    const track = this.getTrack(trackId);
    if (track?.type !== 'melodic') return undefined;
    track.notes ??= [];
    const note: Note = {
      id: uid('note'),
      step: clamp(Math.round(partial.step), 0, this.project.patternLength - 1),
      pitch: clamp(Math.round(partial.pitch), PITCH_MIN, PITCH_MAX),
      duration: clamp(Math.round(partial.duration), 1, this.project.patternLength),
      velocity: clamp(partial.velocity, 0.3, 1),
    };
    track.notes.push(note);
    this.emit('notes', { trackId });
    this.touch();
    return note;
  }

  updateNote(trackId: string, noteId: string, patch: Partial<Omit<Note, 'id'>>): void {
    const note = this.getTrack(trackId)?.notes?.find((n) => n.id === noteId);
    if (!note) return;
    if (patch.step !== undefined) note.step = clamp(Math.round(patch.step), 0, this.project.patternLength - 1);
    if (patch.pitch !== undefined) note.pitch = clamp(Math.round(patch.pitch), PITCH_MIN, PITCH_MAX);
    if (patch.duration !== undefined) note.duration = clamp(Math.round(patch.duration), 1, this.project.patternLength);
    if (patch.velocity !== undefined) note.velocity = clamp(patch.velocity, 0.3, 1);
    this.emit('notes', { trackId });
    this.touch();
  }

  deleteNote(trackId: string, noteId: string): void {
    const track = this.getTrack(trackId);
    if (!track?.notes) return;
    const before = track.notes.length;
    track.notes = track.notes.filter((n) => n.id !== noteId);
    if (track.notes.length !== before) {
      this.emit('notes', { trackId });
      this.touch();
    }
  }

  // --- Mixer / instrument -------------------------------------------------

  setTrackMix(trackId: string, patch: Partial<Pick<Track, 'volume' | 'pan' | 'muted' | 'solo'>>): void {
    const track = this.getTrack(trackId);
    if (!track) return;
    if (patch.volume !== undefined) track.volume = clamp(patch.volume, 0, 1);
    if (patch.pan !== undefined) track.pan = clamp(patch.pan, -1, 1);
    if (patch.muted !== undefined) track.muted = patch.muted;
    if (patch.solo !== undefined) track.solo = patch.solo;
    this.emit('mix', { trackId });
    this.touch();
  }

  toggleMute(trackId: string): void {
    const t = this.getTrack(trackId);
    if (t) this.setTrackMix(trackId, { muted: !t.muted });
  }

  toggleSolo(trackId: string): void {
    const t = this.getTrack(trackId);
    if (t) this.setTrackMix(trackId, { solo: !t.solo });
  }

  setInstrumentParams(trackId: string, patch: Partial<InstrumentParams>): void {
    const track = this.getTrack(trackId);
    if (track?.type !== 'melodic') return;
    track.instrumentParams = { ...(track.instrumentParams ?? DEFAULT_INSTRUMENT_PARAMS), ...patch };
    this.emit('instrument', { trackId });
    this.touch();
  }

  // --- Tracks -------------------------------------------------------------

  addMelodicTrack(name?: string): Track {
    const index = this.project.tracks.filter((t) => t.type === 'melodic').length;
    const track: Track = {
      id: uid('trk'),
      name: name ?? `Synth ${index + 1}`,
      type: 'melodic',
      color: TRACK_COLORS[(index + 1) % TRACK_COLORS.length],
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
      instrumentParams: { ...DEFAULT_INSTRUMENT_PARAMS },
      notes: [],
    };
    this.project.tracks.push(track);
    this.emit('track:added', { track });
    this.touch();
    return track;
  }

  removeTrack(trackId: string): void {
    const idx = this.project.tracks.findIndex((t) => t.id === trackId);
    // Keep at least one track around.
    if (idx === -1 || this.project.tracks.length <= 1) return;
    this.project.tracks.splice(idx, 1);
    this.emit('track:removed', { trackId });
    this.pruneSamples();
    this.touch();
  }

  // --- Samples (imported / recorded) -------------------------------------

  get drumsTrack(): Track | undefined {
    return this.project.tracks.find((t) => t.type === 'drums');
  }

  /** Register sample metadata (the bytes are already in IndexedDB). */
  addSample(sample: Sample): void {
    this.project.samples.push(sample);
    this.emit('samples', this.project);
    this.touch();
  }

  /** Create a playable, pitched sampler track from a sample. */
  addSamplerTrack(sampleId: string, name: string): Track {
    const index = this.project.tracks.filter((t) => t.type === 'melodic').length;
    const track: Track = {
      id: uid('trk'),
      name,
      type: 'melodic',
      color: TRACK_COLORS[(index + 1) % TRACK_COLORS.length],
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
      instrumentParams: { ...DEFAULT_INSTRUMENT_PARAMS, attack: 0.004, release: 0.6, filterCutoff: 12000 },
      notes: [],
      sampleId,
      sampleRoot: DEFAULT_SAMPLE_ROOT,
    };
    this.project.tracks.push(track);
    this.emit('track:added', { track });
    this.touch();
    return track;
  }

  /** Add a sample as a one-shot lane in a drums track. */
  addSampleLane(drumTrackId: string, sampleId: string, name: string): void {
    const track = this.getTrack(drumTrackId);
    if (track?.type !== 'drums') return;
    track.lanes ??= [];
    track.lanes.push({
      id: uid('lane'),
      name,
      soundType: 'sample',
      sampleId,
      steps: new Array(this.project.patternLength).fill(false),
      volume: 0.85,
    });
    this.emit('lanes', { trackId: drumTrackId });
    this.touch();
  }

  removeLane(trackId: string, laneId: string): void {
    const track = this.getTrack(trackId);
    if (!track?.lanes || track.lanes.length <= 1) return;
    track.lanes = track.lanes.filter((l) => l.id !== laneId);
    this.emit('lanes', { trackId });
    this.pruneSamples();
    this.touch();
  }

  /** Set the MIDI note at which a sampler plays the sample un-pitched. */
  setSampleRoot(trackId: string, root: number): void {
    const track = this.getTrack(trackId);
    if (!track) return;
    track.sampleRoot = clamp(Math.round(root), PITCH_MIN, PITCH_MAX);
    this.emit('track:rebuilt', { trackId });
    this.touch();
  }

  /** Drop samples no longer referenced by any track/lane (frees IndexedDB). */
  private pruneSamples(): void {
    const used = new Set<string>();
    for (const t of this.project.tracks) {
      if (t.sampleId) used.add(t.sampleId);
      t.lanes?.forEach((l) => l.sampleId && used.add(l.sampleId));
    }
    const orphans = this.project.samples.filter((s) => !used.has(s.id));
    if (!orphans.length) return;
    this.project.samples = this.project.samples.filter((s) => used.has(s.id));
    orphans.forEach((s) => void removeSample(s.id));
    this.emit('samples', this.project);
  }

  renameTrack(trackId: string, name: string): void {
    const track = this.getTrack(trackId);
    if (!track) return;
    track.name = name.trim() || track.name;
    this.emit('track:renamed', { trackId });
    this.touch();
  }

  // --- Project lifecycle --------------------------------------------------

  renameProject(name: string): void {
    this.project.name = name.trim() || 'Untitled';
    this.emit('meta', this.project);
    this.touch();
  }

  /** Swap in a brand new project object and broadcast a full reload. */
  private adopt(project: Project): void {
    this.project = normalizeProject(project);
    this.persist();
    this.emit('project:loaded', this.project);
  }

  newProject(): void {
    this.adopt(buildStarterProject());
  }

  loadDemo(key: string): void {
    this.adopt(buildDemoProject(key));
  }

  loadProject(id: string): void {
    const raw = localStorage.getItem(STORAGE_PREFIX + id);
    if (!raw) return;
    try {
      this.adopt(JSON.parse(raw) as Project);
    } catch {
      /* ignore corrupt entry */
    }
  }

  /**
   * Import a project (e.g. from a loaded `.json`). Exported files embed their
   * samples as data URLs under `sampleData`; restore those into IndexedDB
   * (keeping ids so references stay valid) before adopting the project.
   */
  async importProject(data: Project & { sampleData?: Record<string, string> }): Promise<void> {
    const { sampleData, ...project } = data;
    if (sampleData) {
      await Promise.all(Object.entries(sampleData).map(([id, url]) => putSampleDataUrl(id, url)));
    }
    const copy = normalizeProject(project as Project);
    copy.id = uid('proj'); // never overwrite an existing project on import
    this.adopt(copy);
  }

  duplicateProject(): Project {
    const copy = normalizeProject(structuredClone(this.project));
    copy.id = uid('proj');
    copy.name = `${this.project.name} copy`;
    copy.createdAt = copy.updatedAt = new Date().toISOString();
    this.writeProject(copy);
    this.emit('meta', this.project);
    return copy;
  }

  deleteProject(id: string): void {
    localStorage.removeItem(STORAGE_PREFIX + id);
    this.writeIndex(this.listProjects().filter((p) => p.id !== id));
    if (id === this.project.id) {
      const next = this.listProjects()[0];
      if (next) this.loadProject(next.id);
      else this.newProject();
    } else {
      this.emit('meta', this.project);
    }
  }

  // --- Persistence --------------------------------------------------------

  listProjects(): ProjectSummary[] {
    try {
      const raw = localStorage.getItem(INDEX_KEY);
      const list = raw ? (JSON.parse(raw) as ProjectSummary[]) : [];
      return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch {
      return [];
    }
  }

  private persist(): void {
    this.writeProject(this.project);
    localStorage.setItem(LAST_KEY, this.project.id);
  }

  private writeProject(project: Project): void {
    try {
      localStorage.setItem(STORAGE_PREFIX + project.id, JSON.stringify(project));
      const index = this.listProjects().filter((p) => p.id !== project.id);
      index.push({ id: project.id, name: project.name, updatedAt: project.updatedAt });
      this.writeIndex(index);
    } catch (err) {
      console.warn('GrooveLab: could not save to localStorage', err);
    }
  }

  private writeIndex(list: ProjectSummary[]): void {
    localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  }

  private loadLastOrStarter(): Project {
    const lastId = localStorage.getItem(LAST_KEY);
    if (lastId) {
      const raw = localStorage.getItem(STORAGE_PREFIX + lastId);
      if (raw) {
        try {
          return normalizeProject(JSON.parse(raw) as Project);
        } catch {
          /* fall through to a fresh starter */
        }
      }
    }
    const starter = buildStarterProject();
    // Persist immediately so first-run users have something in their library.
    try {
      localStorage.setItem(STORAGE_PREFIX + starter.id, JSON.stringify(starter));
      this.writeIndex([{ id: starter.id, name: starter.name, updatedAt: starter.updatedAt }]);
      localStorage.setItem(LAST_KEY, starter.id);
    } catch {
      /* storage may be unavailable; app still works in-memory */
    }
    return starter;
  }
}

/** Backfill any missing fields so older/imported JSON stays valid. */
function normalizeProject(p: Project): Project {
  p.id ??= uid('proj');
  p.swing = clamp(p.swing ?? 0, 0, 1);
  p.masterVolume = clamp(p.masterVolume ?? 0.85, 0, 1);
  p.bpm = clamp(Math.round(p.bpm ?? 120), BPM_MIN, BPM_MAX);
  p.patternLength ||= 16;
  p.createdAt ??= new Date().toISOString();
  p.updatedAt ??= p.createdAt;
  p.samples ??= [];
  p.tracks ??= [];
  p.tracks.forEach((t, i) => {
    t.id ??= uid('trk');
    t.color ??= TRACK_COLORS[i % TRACK_COLORS.length];
    t.volume = clamp(t.volume ?? 0.8, 0, 1);
    t.pan = clamp(t.pan ?? 0, -1, 1);
    t.muted ??= false;
    t.solo ??= false;
    t.lanes?.forEach((l) => {
      l.id ??= uid('lane');
      l.volume = clamp(l.volume ?? 0.7, 0, 1);
    });
    t.notes?.forEach((n) => {
      n.id ??= uid('note');
      n.velocity = clamp(n.velocity ?? 0.8, 0.3, 1);
    });
  });
  return p;
}

export const projectStore = new ProjectStore();
