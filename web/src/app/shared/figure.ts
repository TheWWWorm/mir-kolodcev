import { Component, computed, inject, input } from '@angular/core';
import { Lightbox } from '../core/lightbox';
import { WikiData } from '../core/wiki-data';

/** An illustration with caption; click opens the lightbox. */
@Component({
  selector: 'app-figure',
  template: `
    @if (img(); as im) {
      <figure>
        <button type="button" (click)="lightbox.open(index())" [attr.aria-label]="'Увеличить: ' + im.caption">
          <img [src]="im.src" [alt]="im.caption" loading="lazy" />
        </button>
        <figcaption>{{ im.caption }}@if (im.credit) {<small>{{ im.credit }}</small>}</figcaption>
      </figure>
    }
  `,
  styles: `
    :host { display: block; }
    figure { margin: 0; display: flex; flex-direction: column; height: 100%; background: var(--sheet); border: 1px solid var(--rule); }
    button { flex: 1; display: grid; place-items: center; padding: 0; border: 0; background: var(--fig-bg, transparent); cursor: zoom-in; }
    /* Grids keep a fixed box height; single images (--fig-img-h: auto) take their own proportions, capped by --fig-h. */
    img { display: block; width: 100%; height: var(--fig-img-h, var(--fig-h, 220px)); max-height: var(--fig-h, 220px); object-fit: contain; }
    figcaption { padding: 7px 10px 9px; font: var(--fs-small)/1.4 var(--sans); color: var(--ink-2); border-top: 1px solid var(--rule); }
    small { display: block; color: var(--ink-3); font-style: italic; }
  `,
})
export class Figure {
  readonly index = input.required<number>();
  protected readonly lightbox = inject(Lightbox);
  private readonly data = inject(WikiData);
  protected readonly img = computed(() => this.data.images()[this.index()]);
}
