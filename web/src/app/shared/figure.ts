import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Lightbox } from '../core/lightbox';
import { Spoilers } from '../core/spoilers';
import { WikiData } from '../core/wiki-data';

/** An illustration with caption; click opens the lightbox. */
@Component({
  selector: 'app-figure',
  template: `
    @if (img(); as im) {
      <figure role="group" [attr.aria-roledescription]="indices().length > 1 ? 'карусель' : null"
        [attr.aria-label]="indices().length > 1 ? 'Портреты персонажа' : null"
        (keydown.arrowleft)="keyMove($event, -1)" (keydown.arrowright)="keyMove($event, 1)"
        (pointerdown)="startSwipe($event)" (pointerup)="endSwipe($event)" (pointercancel)="cancelSwipe()">
        <button class="enlarge" type="button" (click)="open()" [attr.aria-label]="'Увеличить: ' + im.caption">
          <img [src]="im.src" [alt]="im.caption" loading="lazy" />
        </button>
        @if (indices().length > 1) {
          <div class="controls">
            <button type="button" (click)="move(-1)" aria-label="Предыдущий портрет">←</button>
            <span aria-live="polite" aria-atomic="true">{{ position() + 1 }} / {{ indices().length }}</span>
            <button type="button" (click)="move(1)" aria-label="Следующий портрет">→</button>
          </div>
        }
        <figcaption aria-live="polite">@if (im.period) {<strong>{{ im.period }}</strong>}{{ im.caption }}@if (im.credit) {<small>{{ im.credit }}</small>}</figcaption>
      </figure>
    }
  `,
  styles: `
    :host { display: block; }
    figure { margin: 0; display: flex; flex-direction: column; height: 100%; background: var(--sheet); border: 1px solid var(--rule); }
    .enlarge { flex: 1; display: grid; place-items: center; padding: 0; border: 0; background: var(--fig-bg, transparent); cursor: zoom-in; touch-action: pan-y; }
    /* Grids keep a fixed box height; single images (--fig-img-h: auto) take their own proportions, capped by --fig-h. */
    img { display: block; width: 100%; height: var(--fig-img-h, var(--fig-h, 220px)); max-height: var(--fig-h, 220px); object-fit: contain; }
    figcaption { padding: 7px 10px 9px; font: var(--fs-small)/1.4 var(--sans); color: var(--ink-2); border-top: 1px solid var(--rule); }
    small { display: block; color: var(--ink-3); font-style: italic; }
    strong { display: block; color: var(--ink); font-weight: 600; margin-bottom: 3px; }
    .controls { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--rule); background: var(--sheet-2); }
    .controls button { width: 44px; height: 44px; border: 0; background: transparent; color: var(--ink); font: 1.2rem var(--sans); cursor: pointer; }
    .controls button:hover { background: var(--sheet); color: var(--azure); }
    .controls span { color: var(--ink-2); font: var(--fs-small)/1.4 var(--sans); font-variant-numeric: tabular-nums; }
    button:focus-visible { outline: 2px solid var(--azure); outline-offset: -3px; }
  `,
})
export class Figure {
  readonly index = input.required<number>();
  readonly variants = input<number[]>([]);
  protected readonly lightbox = inject(Lightbox);
  private readonly data = inject(WikiData);
  private readonly spoilers = inject(Spoilers);
  protected readonly indices = computed(() => {
    const candidates = this.variants().length ? this.variants() : [this.index()];
    return [...new Set(candidates)].filter((i) => {
      const im = this.data.images()[i];
      return im && this.spoilers.bookVisible(im.from ?? 0);
    });
  });
  protected readonly position = linkedSignal(() => { this.indices(); return 0; });
  protected readonly img = computed(() => this.data.images()[this.indices()[this.position()]]);
  private swipe: { x: number; y: number } | null = null;
  private swiped = false;

  protected move(step: number): void {
    const count = this.indices().length;
    if (count > 1) this.position.update((p) => (p + step + count) % count);
  }

  protected keyMove(event: Event, step: number): void {
    if (this.indices().length < 2) return;
    event.preventDefault();
    event.stopPropagation();
    this.move(step);
  }

  protected open(): void {
    if (this.swiped) { this.swiped = false; return; }
    const index = this.indices()[this.position()];
    if (index !== undefined) this.lightbox.open(index, this.indices());
  }

  protected startSwipe(event: PointerEvent): void {
    this.swiped = false;
    this.swipe = event.pointerType === 'touch' && !(event.target as Element).closest('.controls')
      ? { x: event.clientX, y: event.clientY } : null;
  }

  protected endSwipe(event: PointerEvent): void {
    if (!this.swipe) return;
    const dx = event.clientX - this.swipe.x, dy = event.clientY - this.swipe.y;
    this.swipe = null;
    if (this.indices().length > 1 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      this.swiped = true;
      this.move(dx < 0 ? 1 : -1);
    }
  }

  protected cancelSwipe(): void { this.swipe = null; }
}
