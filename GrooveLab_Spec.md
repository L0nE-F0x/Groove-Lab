# GrooveLab — Vibe-Coded App Specification

**Version:** 1.0  
**Date:** June 16, 2026  
**Created for:** MTGA - BrewLab (vibe coding project)  
**Intended For:** Claude / Gemini / Cursor (or your preferred coding AI)

---

## How to Use This File

**For the best results with Claude (or similar AI):**

1. Upload this entire `.md` file directly into a new Claude chat, **or**
2. Copy everything below the line and paste it as your first message.

This document is optimized as a complete, self-contained handoff prompt.

---

## 🚀 Handoff Prompt for Coding AI (Copy This Block)

```
You are an expert frontend engineer specializing in delightful, high-quality interactive web applications and audio experiences. You excel at rapid prototyping ("vibe coding") while producing clean, well-structured, and polished code.

Implement the application exactly according to the full specification below. 

Start by creating a beautiful, fully functional prototype that captures the core experience and visual vibe perfectly.

Use a modern **Vite + TypeScript + Tailwind CSS + Tone.js** architecture from day one (this is a systems-rich audio + interactive grid project that will grow over many iterations). Provide a clean, modular folder structure with clear separation between audio engine, UI components/views, state management, and utilities.

Key rules:
- Prioritize a working core loop in the first iteration: immediate sound + satisfying editing.
- Pay extreme attention to micro-interactions, visual feedback, responsive audio, and "wow" moments on every click/drag.
- Make it feel premium, welcoming, and fun — not intimidating.
- After the core is working, suggest clear next steps for polish and expansion.
- Write clean, well-commented TypeScript. Make the audio engine and data models easy to extend.

Here is the complete specification:
```

*(Paste the full spec content from "## 1. Vision & Concept" onward when using the block above.)*

---

## 1. Vision & Concept

### Project Name
**GrooveLab**

### One-Liner
A beautiful, browser-based simplified DAW that feels like a welcoming Cubase — designed for someone transitioning from DJing into music production, with instant creative feedback and a rock-solid foundation for long-term growth.

### Full Vision Statement
GrooveLab gives your wife (and future users) a joyful, low-friction space to explore beats, melodies, and mixing. It distills the essence of professional music production tools — tracks, sequencing, sound design, and arrangement — into an approachable experience that rewards tinkering and learning by ear. 

Every change is audible and visual immediately. The interface feels premium and inspiring (dark, vibrant, smooth) without overwhelming beginners. The codebase is deliberately modular and well-documented so you can iteratively add features (multi-pattern song mode, effects, automation, audio recording, MIDI export, Web MIDI controllers, AI-assisted melody ideas, DJ performance view, etc.) as her skills and ambitions grow. It starts delightful on day one and becomes a true personal creative companion over time.

### Target Audience
- Primary: Motivated beginner moving from DJing to production (curious, musical ear already developing, wants to sketch ideas quickly).
- Secondary: Anyone wanting a fun, free, no-install way to learn electronic music creation.
- Assumes zero prior DAW or music theory experience but respects the user’s intelligence.

### Core Emotional Vibe / Aesthetic Direction
**Premium creative sanctuary meets playful studio.**

- **Color Palette**: Deep charcoal `#111113` / rich navy `#1a1f2e` backgrounds. Vibrant electric cyan `#00e5ff` and magenta `#ff2e92` for active/selected elements. Warm amber `#ffb800` accents for creativity and energy. Subtle gradients and soft glows.
- **Typography**: Clean modern sans (Inter/system-ui) for UI. Highly legible at small sizes. Monospace for BPM/numbers where precision matters.
- **Feel**: Generous but purposeful spacing. Crisp grids with gentle contrast. Every interaction has satisfying feedback — notes “pop” into place with a subtle scale + glow animation, faders have smooth spring-like movement, playhead has a soft trailing glow. Feels alive and musical. Dark theme that doesn’t feel cold — warm and inviting.

---

## 2. Core Experience & User Loops

### Primary User Journey (First 60–90 seconds)
1. Opens app → Beautiful landing with “New Groove”, 2–3 genre demo buttons (e.g. “Chill Lo-Fi”, “Driving Techno”, “Groovy House”), and a short friendly welcome.
2. Clicks a demo or New → Instantly hears a musical starter groove. Playhead sweeps across the drum grid in perfect sync.
3. Clicks/taps cells in the drum sequencer → Hears the beat transform live (add/remove kick, hats, etc. with zero latency feel).
4. Switches to the melodic/synth track → Sees piano roll or step grid. Adds a few notes. The melody locks beautifully into the existing drums.
5. Opens the mixer or sound design panel → Drags a fader or turns a cutoff knob. Sound changes instantly and musically.
6. Adjusts global BPM → Entire groove speeds up or slows down perfectly in time.
7. Feels the “I made this” dopamine hit and wants to keep tweaking or save.

### Core Interaction Loop
**Build → Listen (live) → Tweak (notes / sound / mix) → Repeat** in a tight, satisfying feedback loop. The app should make musical experimentation feel effortless and rewarding.

### Key User Stories (MVP)
- As a new producer, I want to create and modify a full groove in under 5 minutes by clicking a visual grid so I feel like I’m actually producing music immediately.
- As someone learning sound design, I want to tweak ADSR and filter controls and hear the effect right away so I understand how synths work.
- As a DJ exploring production, I want tight, musical loops that feel professional enough to inspire or use in my sets.
- As the developer/partner, I want clean modular TypeScript code with clear audio engine boundaries so I can add new instruments, a full arranger, effects, or export features in future focused sessions without refactoring everything.

### Success Metrics for v1 Prototype
- User creates, edits, and saves a complete short track (drums + melody + mix) in their first session with zero frustration.
- All audio/visual feedback feels instantaneous and musical.
- Code is pleasant to read and extend; adding a new track type or simple effect is straightforward.
- Works smoothly on desktop Chrome/Firefox/Edge/Safari (tablet landscape is a bonus).

---

## 3. Feature Breakdown

### MVP Features (Must Have for First Working Version)

| Priority | Feature                  | Description                                                                 | Acceptance Criteria |
|----------|--------------------------|-----------------------------------------------------------------------------|---------------------|
| P0       | Transport & Global Controls | BPM slider + numeric input (60–200), big Play/Stop, Loop toggle, Metronome toggle, Master volume | Audio starts on user gesture. BPM changes affect everything in sync. Loop works cleanly. |
| P0       | Drum Sequencer           | 16-step × 6–8 lane grid (Kick, Snare, Closed Hat, Open Hat, Perc, Clap + 1–2 more). Synthesized sounds via Tone.js. Click to toggle. Live playhead. | Changes are audible immediately while playing. Nice synthesized drum sounds (not beeps). Clear visual distinction per lane type. |
| P0       | Melodic Synth Track      | At least one melodic track with interactive piano roll (canvas). Place, move, lengthen, delete notes. Basic velocity support. | Grid shows 2–3 octaves. Notes are clearly visible and editable. Plays correct pitches in time with drums. |
| P0       | Basic Mixer              | Per-track volume faders, pan, mute/solo. Simple animated level meters. Master fader. | Smooth fader interaction. Meters react to audio. Solo/mute works correctly across tracks. |
| P0       | Sound Design Panel       | For synth track: oscillator type, filter cutoff + resonance, ADSR envelope (4 sliders). Live updates. | Changes affect the playing sound instantly. Good default starting points. |
| P0       | Project Persistence      | Auto-save to localStorage. Named projects, load/save/delete/duplicate. Export as .json download. | Never lose work. Multiple projects supported. JSON is human-readable for easy tweaking. |
| P0       | Demo Content & Onboarding | 2–3 high-quality starter patterns + gentle first-run guidance or contextual tips. | User feels welcomed and knows what to do in <30 seconds. |
| P0       | Keyboard Shortcuts       | Space = Play/Stop, Delete = remove selected note, arrows for navigation where sensible. | Feels pro and fast for power users. |

### Phase 2 / Nice-to-Have (Next 1–2 iterations)
- Multi-pattern support + simple song chain / arranger view (place pattern blocks on a timeline).
- Per-track simple effects (reverb, delay, filter) with wet/dry and decay controls.
- Note velocity editing + basic quantization options.
- Better piano roll interactions (multi-select, copy/paste, drag-to-draw).
- On-screen piano keyboard for live playing + step recording.
- Randomize buttons per track/lane for happy accidents and inspiration.
- Subtle swing/groove control.
- Improved onboarding with optional “Learn” mode that explains concepts contextually (e.g., “This filter makes the sound brighter or darker”).

### Future / Stretch Goals (You can add these over time)
- Full multi-track arranger with clip launching or linear arrangement.
- User sample upload + simple sampler instrument.
- Audio recording (mic/line-in) into a track.
- MIDI file import/export + Web MIDI controller support.
- Automation lanes (volume, cutoff, etc. over time).
- DJ Performance view (two virtual decks, crossfader, instant loops, sync visuals).
- WAV export (master + stems) using Tone.Offline.
- Cloud sync (optional Supabase later).
- AI-assisted features (generate variations, suggest chords, auto-mix suggestions).

---

## 4. Technical Architecture & Stack

### Recommended Stack & Rationale
**Vite + TypeScript + Tailwind CSS + Tone.js (latest stable)**

**Why this stack?**
- Tone.js is the gold standard for browser music apps — it handles timing, scheduling, and Web Audio API complexities elegantly so you can focus on musical logic and UX.
- TypeScript + clean modular architecture makes long-term iteration (your main goal) pleasant and safe.
- Vite gives instant dev feedback and easy deployment (Netlify/Vercel like your other projects).
- Tailwind enables rapid, consistent, beautiful styling.
- Canvas for piano roll and custom visualizations (playhead, waveforms, meters) for performance and full creative control.
- No heavy framework (React/Svelte) in v1 keeps the audio engine and timing logic easy to reason about and debug. You can add a thin UI layer later if desired.

This is the sweet spot between “fast delightful prototype” and “excellent long-term foundation.”

### High-Level Architecture
```
src/
├── main.ts                 # App bootstrap, Tone init on first gesture
├── audio/
│   ├── engine.ts           # Core Tone.Transport wrapper, master chain, scheduling coordinator
│   ├── instruments.ts      # Drum kit factory (synthesized), Synth factory with params
│   ├── types.ts            # All interfaces (Project, Track, Note, DrumLane, etc.)
│   └── utils.ts            # Quantization, MIDI note helpers, etc.
├── ui/
│   ├── components/         # Reusable: Knob, Fader, Toggle, Button, Icon (inline SVGs)
│   ├── views/
│   │   ├── TransportBar.ts
│   │   ├── DrumSequencer.ts   # Canvas + controls
│   │   ├── PianoRoll.ts       # Canvas + interaction logic + note inspector
│   │   ├── Mixer.ts
│   │   └── SoundDesignPanel.ts
│   └── state/
│       ├── projectStore.ts    # Current project, auto-save, serialization
│       └── uiStore.ts         # Selected track, selected notes, current view mode
├── utils/
│   ├── midi.ts
│   └── export.ts           # JSON + future WAV export
├── styles/
│   └── globals.css         # Tailwind + custom DAW styles (glows, animations)
└── index.html
```

### State Management Approach
Lightweight module-based state with simple pub/sub (or custom event emitter) between audio engine and UI. Project state is the single source of truth. UI reacts to changes. Keep it simple and explicit — no over-engineered global store needed at this stage.

### Data Models / Key Entities
```ts
export interface Note {
  step: number;
  pitch: number;      // MIDI note number (60 = C4)
  duration: number;   // in steps
  velocity: number;   // 0.3 – 1.0
}

export interface DrumLane {
  id: string;
  name: string;
  soundType: 'kick' | 'snare' | 'closedHat' | 'openHat' | 'perc' | 'clap';
  steps: boolean[];   // or number[] for per-step velocity later
  volume: number;
}

export interface Track {
  id: string;
  name: string;
  type: 'drums' | 'melodic';
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  lanes?: DrumLane[];     // for drums
  notes?: Note[];         // for melodic
  instrumentParams?: {    // for melodic synth
    oscillatorType: OscillatorType;
    filterCutoff: number;
    filterQ: number;
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
}

export interface Project {
  id: string;
  name: string;
  bpm: number;
  patternLength: number; // 16, 32, etc.
  tracks: Track[];
  masterVolume: number;
  createdAt: string;
  updatedAt: string;
}
```

### Persistence Strategy
- Primary: `localStorage` with auto-save on every meaningful change (debounced).
- Export: Download current project as clean `.json`.
- Future: Optional “Save to cloud” button (you can add Supabase or similar later).

---

## 5. User Interface & Interaction Design

### Overall Layout & Screens/Views
Single-page app with persistent top transport bar.

**Recommended layout (desktop-first):**
- **Top bar** (always visible): Logo + project name (editable), Transport controls (big glowing Play button), BPM control, Loop + Metronome toggles, Master volume + meter, Settings / Save buttons.
- **Left sidebar**: Track list / selector (click to load that track’s editor into main area). Mini fader overview optional.
- **Main canvas area** (center, largest): Switches between Drum Sequencer view and Piano Roll view based on selected track. Beautiful, high-contrast grid with clear playhead.
- **Right sidebar** (contextual): Sound Design panel when melodic track selected, or lane settings when drums selected. Note inspector when a note is selected in piano roll.
- **Bottom or collapsible drawer**: Full Mixer console with nice faders, pans, meters, and mute/solo.

Make panels feel “dockable” or at least resizable in spirit (even if fixed ratios initially). Use generous padding and subtle borders.

### Visual Design Language
- Dark premium theme as described.
- Active elements glow softly in cyan/magenta.
- Notes in piano roll: rounded rectangles, color varies slightly by pitch class or velocity for visual interest.
- Playhead: thin glowing vertical line with soft trailing effect.
- Animations: subtle spring/ease for faders and note placement. 60fps target for playhead and meters.
- Icons: Clean inline SVGs (lucide or custom) — play, stop, loop, etc. Consistent stroke weight.

### Key Screens / Components (Detailed)

**Drum Sequencer**
- Large interactive grid.
- Left column: Lane labels + small volume knob or fader per lane.
- Cells: Color-coded by sound type. Active steps brighter with subtle inner glow.
- Interaction: Click = toggle. Click + drag = paint multiple steps. Playhead animates smoothly across columns.
- Extras: Clear lane, Randomize lane, Solo/mute per lane.

**Piano Roll (Melodic Track)**
- Left: Visual piano keyboard (2–3 octaves, white/black keys). Clicking a key previews the note.
- Main grid: Horizontal time (steps), vertical pitch. Clear beat divisions (stronger lines on beats).
- Notes: Rounded rects spanning their duration. Easy to see and grab.
- Interactions (precise):
  - Empty cell click → place default 1-step note.
  - Click existing note → select (outline + inspector opens).
  - Drag note body → move in time and/or pitch (quantized to grid).
  - Drag right edge → change duration (snaps to steps, min 1).
  - Delete key or button → remove selected.
- Playhead highlights current column.

**Mixer**
- Clean vertical or horizontal strips.
- Fader with dB scale or 0–100%.
- Small pan knob or slider.
- Mute (red) / Solo (yellow) buttons.
- Animated level meter bars (use Tone.Analyser or simple smoothed values).

### Accessibility & Inclusivity Notes
- High contrast text and interactive elements.
- All controls have clear labels and ARIA attributes where practical.
- Keyboard support for transport and basic navigation.
- Note: Full canvas accessibility is advanced — prioritize excellent mouse/touch + keyboard shortcuts first. Add screen-reader friendly alternatives or descriptions later if needed.
- Color is never the only indicator (use icons + labels too).

---

## 6. Implementation Roadmap

### Phase 1: Core Prototype (Target: 1–3 focused sessions)
- [ ] Vite + TS + Tailwind + Tone.js scaffold + basic audio context start on gesture
- [ ] Transport bar + BPM + Play/Stop/Loop working with simple test sound
- [ ] Drum Sequencer (canvas grid + Tone drum synthesis) fully functional and live-editable
- [ ] One melodic track with basic piano roll (canvas) or strong step-note alternative
- [ ] Basic mixer + sound design panel with live parameter changes
- [ ] Project save/load in localStorage + JSON export
- [ ] 2–3 demo starter grooves
- [ ] Beautiful styling + micro-interactions + responsive foundation

### Phase 2: Polish & Delight
- [ ] Refined piano roll interactions + velocity
- [ ] Real audio level meters + analyser visuals
- [ ] Onboarding / first-run experience + contextual tips
- [ ] Keyboard shortcuts + better empty states
- [ ] Performance tuning + mobile/tablet improvements
- [ ] More sound design controls + presets

### Phase 3: Expansion (your future iterations)
- Multi-pattern + arranger timeline
- Effects, automation, sample support, export, etc.

---

## 7. Non-Functional Requirements

- **Performance**: Audio must never glitch or drift. UI interactions < 50ms perceived latency. Playhead and animations smooth at 60fps on mid-range hardware.
- **Responsive**: Excellent on desktop (1440px+). Very usable on tablets in landscape. Mobile is secondary (grids are hard on small screens — show a “best on desktop” hint if needed).
- **Browser Support**: Modern evergreen browsers. Handle AudioContext resume properly.
- **Extensibility**: Audio engine and data models must be easy to extend (new instrument types, new track types, new effects). Clear boundaries between audio logic and UI.
- **Error Handling**: Graceful degradation. Clear feedback if audio fails to start. No silent failures.

---

## 8. Assets, Media & Content Strategy
- All icons as inline SVGs (no external icon fonts).
- No heavy image assets in v1. Subtle decorative elements (soft grid backgrounds, gentle waveform SVGs) can be added with Tailwind or simple CSS/SVG.
- Drum sounds: Pure Tone.js synthesis (provide good starting recipes for punchy kick, crisp hats, etc. in comments or instruments.ts). User sample support is a Phase 3+ feature.
- Future: You can generate custom artwork or illustrations with Grok Imagine if you want a unique visual identity.

---

## 9. Edge Cases, Risks & Mitigations

| Risk / Edge Case                    | Mitigation / Handling in Spec |
|-------------------------------------|-------------------------------|
| AudioContext blocked by browser     | Require explicit user gesture (big Play button does this). Clear “Click to start audio” state. |
| Rapid editing while playing         | Efficient scheduling updates in Tone (don’t recreate instruments constantly). Debounce non-critical UI updates. |
| Changing pattern length mid-edit    | Graceful handling: pad or truncate note/step data, notify user. |
| Many notes on screen                | Canvas is performant. Consider simple culling or level-of-detail if needed later. |
| User loses work                     | Aggressive auto-save + visible “Saved” indicator. JSON export always available. |
| Mobile / small screen frustration   | Desktop-first design. Clear guidance. Future responsive refinements. |

---

## 10. Definition of Done for v1

The prototype is considered complete when:
- [ ] User can load a demo or start fresh, edit drums + melody, adjust mix and sound, and hear musical results immediately.
- [ ] Core loop (edit → hear change) feels delightful and responsive.
- [ ] Project can be saved, loaded, and exported as JSON.
- [ ] Visuals and interactions match the described premium-yet-welcoming vibe.
- [ ] Works smoothly on desktop browsers with no major bugs.
- [ ] Code is clean, modular, and well-commented so you can confidently start adding Phase 2/3 features.

---

## 11. Open Questions & Decisions for Later
- Exact number of drum lanes and default sounds (easy to adjust in code).
- Whether to start with a slightly simpler melodic input method (step note chooser) if full piano roll takes longer than expected in first pass — or go straight for canvas piano roll.
- How ambitious the initial sound design panel should be (we can start minimal and expand).
- Any specific genres or reference tracks your wife loves (we can tune the demo presets to her taste).

---

**End of Specification**

---

*This document was generated to maximize first-try success with AI coding assistants. It is ready for direct handoff.*

**Next steps after Claude delivers v1:**
- Test with your wife
- Give feedback
- I can help refine this spec or create Phase 2 specifications as needed

Happy vibe coding! 🎹✨