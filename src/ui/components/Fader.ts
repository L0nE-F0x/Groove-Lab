/**
 * Fader — a vertical level control (0..1) driven by pointer drag, with an
 * optional level-meter bar rendered behind the fill. Click anywhere on the
 * track to jump; drag the handle for smooth changes.
 */
import { clamp } from '../../utils/helpers';
import { el } from '../../utils/dom';

export interface FaderOptions {
  value: number; // 0..1
  height?: number;
  withMeter?: boolean;
  format?: (v: number) => string;
  onInput?: (v: number) => void;
  onChange?: (v: number) => void;
}

export class Fader {
  readonly el: HTMLElement;
  private value: number;
  private readonly opts: FaderOptions;
  private track!: HTMLElement;
  private fill!: HTMLElement;
  private handle!: HTMLElement;
  private meter?: HTMLElement;

  constructor(options: FaderOptions) {
    this.opts = options;
    this.value = clamp(options.value, 0, 1);
    this.el = this.build();
    this.render();
  }

  private build(): HTMLElement {
    this.fill = el('div', { class: 'fader-fill' });
    this.handle = el('div', { class: 'fader-handle' });
    const layers: HTMLElement[] = [this.fill];
    if (this.opts.withMeter) {
      this.meter = el('div', { class: 'fader-meter' });
      layers.push(this.meter);
    }
    layers.push(this.handle);
    this.track = el('div', { class: 'fader-track' }, layers);
    this.attachDrag();
    return el('div', { class: 'fader' }, [this.track]);
  }

  private setFromClientY(clientY: number): void {
    const rect = this.track.getBoundingClientRect();
    const t = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
    this.value = t;
    this.render();
    this.opts.onInput?.(t);
  }

  private attachDrag(): void {
    let dragging = false;
    const move = (e: PointerEvent) => dragging && this.setFromClientY(e.clientY);
    const up = () => {
      if (!dragging) return;
      dragging = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('grabbing');
      this.opts.onChange?.(this.value);
    };
    this.track.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dragging = true;
      document.body.classList.add('grabbing');
      this.setFromClientY(e.clientY);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }

  private render(): void {
    const pct = `${(this.value * 100).toFixed(1)}%`;
    this.fill.style.height = pct;
    this.handle.style.bottom = pct;
  }

  setValue(v: number): void {
    this.value = clamp(v, 0, 1);
    this.render();
  }

  /** Update the meter overlay (0..1). No-op if the fader has no meter. */
  setMeter(level: number): void {
    if (this.meter) this.meter.style.height = `${clamp(level, 0, 1) * 100}%`;
  }
}
