/** Toggle — a small stateful on/off button with an icon and/or label. */
import { el } from '../../utils/dom';
import { icon } from '../icons';

export interface ToggleOptions {
  label?: string;
  iconName?: string;
  active?: boolean;
  title?: string;
  /** Accent class applied when active: 'cyan' | 'magenta' | 'amber'. */
  accent?: 'cyan' | 'magenta' | 'amber';
  onChange: (active: boolean) => void;
}

export class Toggle {
  readonly el: HTMLButtonElement;
  private active: boolean;

  constructor(private opts: ToggleOptions) {
    this.active = opts.active ?? false;
    this.el = el('button', {
      class: 'toggle',
      type: 'button',
      title: opts.title ?? opts.label ?? '',
      'aria-pressed': String(this.active),
      onClick: () => this.set(!this.active, true),
    }) as HTMLButtonElement;
    if (opts.accent) this.el.classList.add(`accent-${opts.accent}`);
    this.el.innerHTML =
      (opts.iconName ? icon(opts.iconName) : '') +
      (opts.label ? `<span>${opts.label}</span>` : '');
    this.sync();
  }

  set(active: boolean, fire = false): void {
    if (active === this.active) {
      if (fire) this.opts.onChange(active);
      return;
    }
    this.active = active;
    this.sync();
    if (fire) this.opts.onChange(active);
  }

  get isActive(): boolean {
    return this.active;
  }

  private sync(): void {
    this.el.classList.toggle('is-active', this.active);
    this.el.setAttribute('aria-pressed', String(this.active));
  }
}
