/**
 * uiStore — transient view state that doesn't belong in the saved project:
 * which track is selected, which note is selected, whether the mixer drawer is
 * open. Kept separate so the Project JSON stays purely musical.
 */
import { Emitter } from '../../utils/events';

type UiEvents = {
  selection: { trackId: string }; // active track changed
  noteSelection: { noteId: string | null }; // active note changed
  mixer: { open: boolean };
};

class UiStore extends Emitter<UiEvents> {
  selectedTrackId = '';
  selectedNoteId: string | null = null;
  mixerOpen = true;

  selectTrack(trackId: string): void {
    if (trackId === this.selectedTrackId) return;
    this.selectedTrackId = trackId;
    this.selectedNoteId = null;
    this.emit('selection', { trackId });
  }

  selectNote(noteId: string | null): void {
    if (noteId === this.selectedNoteId) return;
    this.selectedNoteId = noteId;
    this.emit('noteSelection', { noteId });
  }

  setMixerOpen(open: boolean): void {
    if (open === this.mixerOpen) return;
    this.mixerOpen = open;
    this.emit('mixer', { open });
  }

  toggleMixer(): void {
    this.setMixerOpen(!this.mixerOpen);
  }
}

export const uiStore = new UiStore();
