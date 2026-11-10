import { Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Lightbox } from '../core/lightbox';
import { WikiData } from '../core/wiki-data';
import { Spoilers } from '../core/spoilers';
import { unlocalized } from '../core/locale';

@Component({
  selector: 'app-lightbox-view',
  imports: [RouterLink],
  host: {
    '(document:keydown.escape)': 'lightbox.close()',
    '(document:keydown.arrowleft)': 'keyMove($event, -1)',
    '(document:keydown.arrowright)': 'keyMove($event, 1)',
    '(document:keydown.tab)': 'trapFocus($event)',
  },
  template: `
    @if (img(); as im) {
      <div class="veil" (click)="lightbox.close()">
        <div class="inner" #dialog role="dialog" aria-modal="true" [attr.aria-label]="im.caption" (click)="$event.stopPropagation()">
          <button class="x" #closeButton (click)="lightbox.close()" aria-label="Закрыть">×</button>
          <img [src]="im.src" [alt]="im.caption" (pointerdown)="startSwipe($event)" (pointerup)="endSwipe($event)" (pointercancel)="cancelSwipe()" />
          @if (indices().length > 1) {
            <div class="controls">
              <button type="button" (click)="move(-1)" aria-label="Предыдущий портрет">←</button>
              <span aria-live="polite" aria-atomic="true">{{ position() + 1 }} / {{ indices().length }}</span>
              <button type="button" (click)="move(1)" aria-label="Следующий портрет">→</button>
            </div>
          }
          <p aria-live="polite">@if (im.period) {<strong>{{ im.period }}</strong>}<b>{{ im.caption }}</b>@if (im.credit) {<span>{{ im.credit }}</span>}</p>
          @if (im.slugs.length) {
            <p class="arts">@for (s of im.slugs; track s) {<a [routerLink]="'/' + s" [replaceUrl]="true" (click)="follow($event, '/' + s)">{{ data.title(s) }}</a>}</p>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .veil { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 16px; background: var(--veil); }
    .inner { position: relative; max-width: min(1100px, 100%); max-height: 100%; overflow-y: auto; padding: 8px; text-align: center; color: var(--veil-ink); font: var(--fs-ui)/1.4 var(--sans); }
    img { max-width: 100%; max-height: calc(100dvh - 260px); object-fit: contain; background: #fff; touch-action: pan-y; }
    p { margin: 8px 0 0; } span { display: block; color: var(--veil-ink-2); font-style: italic; }
    .arts a { color: #9fd0f5; margin: 0 8px; }
    strong { display: block; margin-bottom: 3px; }
    .x { position: sticky; display: block; margin: 0 0 -44px auto; top: 0; z-index: 1; width: 44px; height: 44px; border: 0; border-radius: 50%; background: rgba(0,0,0,.7); color: #fff; font-size: 22px; cursor: pointer; }
    .controls { display: flex; align-items: center; justify-content: center; gap: 24px; margin-top: 8px; }
    .controls button { width: 44px; height: 44px; background: rgba(255,255,255,.12); color: #fff; border: 1px solid rgba(255,255,255,.3); border-radius: 50%; cursor: pointer; font-size: 22px; }
    .controls span { color: var(--veil-ink); font-style: normal; font-variant-numeric: tabular-nums; }
    button:focus-visible, a:focus-visible { outline: 2px solid #9fd0f5; outline-offset: 2px; }
  `,
})
export class LightboxView {
  protected readonly lightbox = inject(Lightbox);
  protected readonly data = inject(WikiData);
  private readonly spoilers = inject(Spoilers);
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  protected readonly indices = computed(() => this.lightbox.sequence().filter((i) => {
    const im = this.data.images()[i];
    return im && this.spoilers.bookVisible(im.from ?? 0);
  }));
  protected readonly position = computed(() => this.indices().indexOf(this.lightbox.current() ?? -1));
  private swipe: { x: number; y: number } | null = null;

  constructor() {
    effect((onCleanup) => {
      const button = this.closeButton()?.nativeElement;
      if (!button) return;
      const previous = document.activeElement as HTMLElement | null;
      button.focus({ preventScroll: true });
      onCleanup(() => previous?.isConnected && previous.focus({ preventScroll: true }));
    });
  }

  protected move(step: number): void {
    const images = this.indices();
    if (this.lightbox.current() === null || images.length < 2) return;
    this.lightbox.open(images[(this.position() + step + images.length) % images.length], images);
  }

  protected keyMove(event: Event, step: number): void {
    if (this.lightbox.current() === null || this.indices().length < 2) return;
    event.preventDefault();
    this.move(step);
  }

  protected trapFocus(event: Event): void {
    if (!(event instanceof KeyboardEvent)) return;
    const elements = this.dialog()?.nativeElement.querySelectorAll<HTMLElement>('button, a[href]');
    if (!elements?.length) return;
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  protected startSwipe(event: PointerEvent): void {
    this.swipe = event.pointerType === 'touch' ? { x: event.clientX, y: event.clientY } : null;
  }

  protected endSwipe(event: PointerEvent): void {
    if (!this.swipe) return;
    const dx = event.clientX - this.swipe.x, dy = event.clientY - this.swipe.y;
    this.swipe = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) this.move(dx < 0 ? 1 : -1);
  }

  protected cancelSwipe(): void { this.swipe = null; }
  /**
   * A link from the image replaces the image's history entry, so back from that page returns to the one
   * underneath. A link to the page already on screen just closes the image.
   */
  protected follow(ev: MouseEvent, path: string): void {
    if (ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    if (unlocalized(location.pathname) === path) this.lightbox.close();
    else this.lightbox.current.set(null);
  }
  protected readonly img = computed(() => { const i = this.lightbox.current(); return i == null || !this.indices().includes(i) ? null : this.data.images()[i]; });
}
