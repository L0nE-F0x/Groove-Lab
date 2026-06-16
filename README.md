# 🎛️ GrooveLab

A beautiful, browser-based mini studio — a welcoming, low-friction space to sketch
beats, melodies and mixes with **instant** sound. Every change is audible and visual
immediately. Built to be delightful on day one and a solid foundation to grow on.

> Vibe-coded from [`GrooveLab_Spec.md`](./GrooveLab_Spec.md).

## ✨ Features (v1)

- **Transport** — play/stop (Space), loop, metronome, tempo (60–200 BPM), master volume + live meter.
- **Drum sequencer** — 6 synthesized lanes (kick, snare, clap, hats, perc). Click to toggle, drag to paint, per-lane volume / randomize / clear, sweeping playhead.
- **Piano roll** — canvas editor with a playable keyboard. Click to add notes, drag to move, drag the edge to resize, double-click / `Delete` to remove. Velocity shading + note inspector.
- **Mixer** — per-track fader with live meter, pan, mute/solo, master strip.
- **Sound design** — oscillator, resonant filter and ADSR envelope with quick presets — all live.
- **Projects** — auto-saved to `localStorage`, multi-project library (load / duplicate / delete / rename), JSON import & export.
- **Onboarding** — welcome screen with three starter grooves: Groovy House, Driving Techno, Chill Lo-Fi.

## 🧱 Stack

[Vite](https://vitejs.dev/) · [TypeScript](https://www.typescriptlang.org/) · [Tailwind CSS v4](https://tailwindcss.com/) · [Tone.js](https://tonejs.github.io/) — no UI framework, so the audio engine and timing logic stay easy to reason about.

## 🚀 Getting started

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check + production build into dist/
npm run preview  # preview the production build locally
```

## 🌐 Deploy (Netlify)

This repo includes [`netlify.toml`](./netlify.toml), so connecting it to Netlify needs
no manual config:

- **Build command:** `npm run build`
- **Publish directory:** `dist`

Push to `main` → Netlify auto-deploys.

## 🗂️ Project structure

```
src/
├── audio/      engine, instruments (synthesis), data types, helpers
├── ui/
│   ├── components/   Knob · Fader · Toggle
│   ├── views/        TransportBar · Sidebar · DrumSequencer · PianoRoll · Mixer · SoundDesignPanel · ProjectMenu · Landing
│   ├── state/        projectStore (single source of truth) · uiStore · demoProjects
│   ├── controller.ts audio bootstrap + step/meter broadcast + toasts
│   └── icons.ts
├── utils/      events · helpers · midi · dom · export
└── styles/globals.css
```

The `Project` object is the single source of truth and serialises to clean,
human-readable JSON. The audio engine holds a live reference to it, so edits are
heard immediately.

## 🛣️ Roadmap (next)

Velocity-per-step · on-screen keyboard + step recording · per-track reverb/delay ·
multi-pattern song chaining · WAV export via `Tone.Offline`.

---

🤖 Bootstrapped with [Claude Code](https://claude.com/claude-code).
