/**
 * Knob — a rotary control driven by vertical pointer drag (up = increase).
 * Hold Shift for fine adjustment; double-click to reset to the default.
 * Supports a linear or exponential response curve (exp feels right for Hz).
 */
import { clamp, expMap, expUnmap, lerp } from '../../utils/helpers';
import { el } from '../../utils/dom';

export interface KnobOptions {
  label: string;
  min: number;
  max: number;
  value: number;
  default?: number;
  size?: number;
  curve?: 'linear' | 'exp';
  /** Round the output to this step (e.g. 1 for integers). */
  step?: number;
  format?: (v: number) => string;
  onInput?: (v: number) => void; // continuous, while dragging
  onChange?: (v: number) => void; // committed, on release
}

const START_ANGLE = -135;
const SWEEP = 270;

const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
};

const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number): string => {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

export class Knob {
  readonly el: HTMLElement;
  private value: number;
  private readonly opts: Required<Pick<KnobOptions, 'min' | 'max' | 'curve' | 'size'>> & KnobOptions;
  private fillPath!: SVGPathElement;
  private pointer!: SVGLineElement;
  private valueEl!: HTMLElement;

  constructor(options: KnobOptions) {
    this.opts = { curve: 'linear', size: 46, ...options };
    this.value = clamp(options.value, options.min, options.max);
    this.el = this.build();
    this.render();
  }

  // --- value <-> normalised position (0..1) ---
  private toNorm(v: number): number {
    return this.opts.curve === 'exp'
      ? expUnmap(v, this.opts.min, this.opts.max)
      : (v - this.opts.min) / (this.opts.max - this.opts.min);
  }
  private fromNorm(t: number): number {
    const raw =
      this.opts.curve === 'exp'
        ? expMap(t, this.opts.min, this.opts.max)
        : lerp(this.opts.min, this.opts.max, t);
    return this.opts.step ? Math.round(raw / this.opts.step) * this.opts.step : raw;
  }

  private build(): HTMLElement {
    const s = this.opts.size;
    const svg = `
      <svg class="knob-dial" width="${s}" height="${s}" viewBox="0 0 48 48">
        <path class="knob-track" d="${arcPath(24, 24, 18, START_ANGLE, START_ANGLE + SWEEP)}" />
        <path class="knob-fill" d="" />
        <line class="knob-pointer" x1="24" y1="24" x2="24" y2="6" />
      </svg>`;
    const dial = el('div', { class: 'knob-dial-wrap', html: svg });
    this.valueEl = el('div', { class: 'knob-value' });
    const root = el('div', { class: 'knob', title: this.opts.label }, [
      dial,
      el('div', { class: 'knob-label' }, [this.opts.label]),
      this.valueEl,
    ]);
    this.fillPath = dial.querySelector('.knob-fill')!;
    this.pointer = dial.querySelector('.knob-pointer')!;

    this.attachDrag(dial);
    dial.addEventListener('dblclick', () => {
      if (this.opts.default !== undefined) {
        this.setValue(this.opts.default);
        this.opts.onChange?.(this.value);
      }
    });
    return root;
  }

  private attachDrag(target: HTMLElement): void {
    let startY = 0;
    let startNorm = 0;
    let dragging = false;

    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const range = e.shiftKey ? 520 : 170; // px for full travel
      const t = clamp(startNorm + (startY - e.clientY) / range, 0, 1);
      this.value = clamp(this.fromNorm(t), this.opts.min, this.opts.max);
      this.render();
      this.opts.onInput?.(this.value);
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('grabbing');
      this.opts.onChange?.(this.value);
    };
    target.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dragging = true;
      startY = e.clientY;
      startNorm = this.toNorm(this.value);
      document.body.classList.add('grabbing');
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }

  /** Update the dial graphics + readout from the current value. */
  private render(): void {
    const t = clamp(this.toNorm(this.value), 0, 1);
    const angle = START_ANGLE + SWEEP * t;
    this.fillPath.setAttribute('d', t < 0.001 ? '' : arcPath(24, 24, 18, START_ANGLE, angle));
    const [x1, y1] = polar(24, 24, 7, angle);
    const [x2, y2] = polar(24, 24, 17, angle);
    this.pointer.setAttribute('x1', x1.toFixed(2));
    this.pointer.setAttribute('y1', y1.toFixed(2));
    this.pointer.setAttribute('x2', x2.toFixed(2));
    this.pointer.setAttribute('y2', y2.toFixed(2));
    this.valueEl.textContent = this.opts.format
      ? this.opts.format(this.value)
      : String(Math.round(this.value));
  }

  /** Set value programmatically (e.g. when a preset is loaded). */
  setValue(v: number): void {
    this.value = clamp(v, this.opts.min, this.opts.max);
    this.render();
  }

  getValue(): number {
    return this.value;
  }
}
