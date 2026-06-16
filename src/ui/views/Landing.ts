/**
 * Landing — the welcoming first-run overlay. It doubles as the user gesture
 * that unlocks the AudioContext: every button here starts audio and plays.
 */
import { el } from '../../utils/dom';
import { icon } from '../icons';
import { projectStore } from '../state/projectStore';
import { demoTemplates } from '../state/demoProjects';
import { play } from '../controller';

export class Landing {
  readonly el: HTMLElement;

  constructor(private onEnter: () => void) {
    this.el = this.build();
  }

  private async choose(mutate: () => void): Promise<void> {
    mutate(); // swap in the chosen project first…
    this.el.classList.add('is-hiding');
    await play(); // …then unlock audio + start it on this same gesture
    this.onEnter();
    setTimeout(() => this.el.remove(), 480);
  }

  private build(): HTMLElement {
    const demos = demoTemplates.map((t) =>
      el(
        'button',
        {
          class: 'demo-card',
          type: 'button',
          onClick: () => this.choose(() => projectStore.loadDemo(t.key)),
        },
        [
          el('span', { class: 'demo-emoji' }, [t.emoji]),
          el('span', { class: 'demo-name' }, [t.label]),
          el('span', { class: 'demo-blurb' }, [t.blurb]),
        ],
      ),
    );

    const newBtn = el(
      'button',
      { class: 'btn btn-primary btn-lg', type: 'button', onClick: () => this.choose(() => projectStore.newProject()) },
      [el('span', { class: 'btn-ico', html: icon('sparkles', 20) }), 'New Groove'],
    );

    const skip = el(
      'button',
      { class: 'landing-skip', type: 'button', onClick: () => this.choose(() => {}) },
      ['Open the studio with my last project →'],
    );

    return el('div', { class: 'landing' }, [
      el('div', { class: 'landing-glow' }),
      el('div', { class: 'landing-inner' }, [
        el('div', { class: 'landing-brand' }, [
          el('span', { class: 'brand-mark', html: icon('flask', 26) }),
          el('span', { class: 'brand-name' }, ['GrooveLab']),
        ]),
        el('h1', { class: 'landing-title' }, ['Make a beat in seconds.']),
        el('p', { class: 'landing-sub' }, [
          'A tiny, friendly studio. Pick a vibe to start jamming, or build one from scratch — every change you make is heard instantly.',
        ]),
        el('div', { class: 'landing-actions' }, [newBtn]),
        el('div', { class: 'landing-or' }, ['or start from a groove']),
        el('div', { class: 'demo-grid' }, demos),
        skip,
      ]),
    ]);
  }
}
