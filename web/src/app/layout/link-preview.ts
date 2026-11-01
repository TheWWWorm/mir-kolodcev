import { Component, computed, inject, signal } from '@angular/core';
import { NavigationStart, Router, RouterLink } from '@angular/router';
import { ArticleMeta, TYPE_LABELS } from '../core/models';
import { SITE } from '../core/site';
import { Spoilers } from '../core/spoilers';
import { WikiData } from '../core/wiki-data';

/** Links that get a preview: wiki links in article text and infoboxes, the article's backlinks. */
const LINKS = '.prose a[href^="/"], .infobox a[href^="/"], .back a[href^="/"]';
const SHOW_DELAY = 350;
/** Time to move the pointer from the link onto the card before it closes. */
const HIDE_DELAY = 200;
const WIDTH = 340;
const GAP = 8;
const GUTTER = 16;

/**
 * A card with the start of an article, shown when the mouse rests on a link to it.
 * Only for a mouse or the keyboard: on touch a tap simply follows the link. Spoilers are kept back as
 * in the article cards: an article from an unread book shows only where it appears, a later summary is blurred.
 */
@Component({
  selector: 'app-link-preview',
  imports: [RouterLink],
  host: {
    '(document:pointerover)': 'over($event)',
    '(document:pointerout)': 'out($event)',
    '(document:focusin)': 'focus($event)',
    '(document:focusout)': 'out($event)',
    '(document:pointerdown)': 'down($event)',
    '(document:keydown.escape)': 'close()',
    '(window:scroll)': 'close()',
    '(window:resize)': 'close()',
  },
  template: `
    @if (shown(); as a) {
      <div
        class="preview"
        role="tooltip"
        [class.above]="pos().above"
        [style.left.px]="pos().left"
        [style.top.px]="pos().above ? null : pos().top"
        [style.bottom.px]="pos().above ? pos().top : null"
        (pointerenter)="keep()"
        (pointerleave)="out($event)"
      >
        @if (spoilers.hidden(a)) {
          <a class="t" [routerLink]="'/' + a.slug" tabindex="-1">{{ a.title }}</a>
          <p class="sum muted">Появляется в {{ site.spoilers.word.prep }} {{ spoilers.bookTitle(a.first) }}.</p>
        } @else {
          <div class="row">
            @if (img(); as src) {
              <img class="thumb" [src]="src" alt="" />
            }
            <div class="copy">
              <span class="type ui">{{ types[a.type].one }}</span>
              <a class="t" [routerLink]="'/' + a.slug" tabindex="-1">{{ a.title }}</a>
              @if (a.ru && a.ru !== a.title) {
                <span class="ru">{{ a.ru }}</span>
              }
            </div>
          </div>
          @if (a.summary) {
            <p class="sum" [class.spoil-blur]="spoilers.partly(a)">{{ a.summary }}</p>
          }
        }
      </div>
    }
  `,
  styles: `
    .preview {
      position: fixed;
      z-index: 90;
      width: min(${WIDTH}px, calc(100vw - ${2 * GUTTER}px));
      padding: 14px 16px;
      background: var(--sheet);
      color: var(--ink);
      border: 1px solid var(--rule);
      border-radius: var(--radius-m);
      box-shadow: 0 14px 34px var(--popup-shadow);
      animation: appear 0.12s ease-out;
    }
    @keyframes appear { from { opacity: 0; transform: translateY(-3px); } }
    .preview.above { animation-name: appear-up; }
    @keyframes appear-up { from { opacity: 0; transform: translateY(3px); } }
    .row { display: flex; gap: 12px; align-items: start; }
    .thumb { width: 56px; height: 70px; object-fit: contain; background: var(--sheet-2); border-radius: 3px; flex-shrink: 0; }
    .copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .type { font: 0.72rem/1.3 var(--sans); color: var(--wax); text-transform: uppercase; letter-spacing: 0.05em; }
    .t { font: normal 1.2rem/1.25 var(--serif); color: var(--azure); }
    .ru { font: 0.78rem/1.4 var(--sans); color: var(--ink-3); }
    .sum { margin: 10px 0 0; font: 0.85rem/1.55 var(--sans); color: var(--ink-2);
      display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 7; overflow: hidden; }
    @media (prefers-reduced-motion: reduce) { .preview { animation: none; } }
  `,
})
export class LinkPreview {
  protected readonly site = SITE;
  protected readonly types = TYPE_LABELS;
  protected readonly spoilers = inject(Spoilers);
  private readonly data = inject(WikiData);

  protected readonly shown = signal<ArticleMeta | null>(null);
  protected readonly pos = signal({ left: 0, top: 0, above: false });
  protected readonly img = computed(() => this.data.imageSrc(this.shown() ?? undefined));
  private link: Element | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(Router).events.subscribe((e) => { if (e instanceof NavigationStart) this.close(); });
  }

  protected over(ev: PointerEvent): void {
    if (ev.pointerType !== 'mouse') return;
    const a = (ev.target as Element | null)?.closest?.(LINKS);
    if (a && a !== this.link) this.schedule(a, ev.clientY);
    else if (a) this.keep();
  }

  protected focus(ev: FocusEvent): void {
    const a = (ev.target as Element | null)?.closest?.(LINKS);
    if (a?.matches(':focus-visible')) this.schedule(a);
  }

  /** The pointer or focus left a link or the card: close unless it went on to the other one. */
  protected out(ev: Event): void {
    const to = (ev as PointerEvent | FocusEvent).relatedTarget as Element | null;
    if (to && (to.closest('.preview') || (this.link && to.closest(LINKS) === this.link))) return;
    clearTimeout(this.timer);
    if (!this.link) return;
    this.timer = setTimeout(() => this.close(), this.shown() ? HIDE_DELAY : 0);
  }

  /** A press outside the card closes it; inside it may reveal a blurred summary or follow the title. */
  protected down(ev: PointerEvent): void {
    if (!(ev.target as Element | null)?.closest?.('.preview')) this.close();
  }

  protected keep(): void {
    clearTimeout(this.timer);
  }

  close(): void {
    clearTimeout(this.timer);
    this.link = null;
    this.shown.set(null);
  }

  private schedule(a: Element, pointerY?: number): void {
    const meta = this.target(a);
    clearTimeout(this.timer);
    this.shown.set(null);
    this.link = meta ? a : null;
    if (!meta) return;
    this.timer = setTimeout(() => {
      if (!a.isConnected) return this.close();
      this.place(a, pointerY);
      this.shown.set(meta);
    }, SHOW_DELAY);
  }

  /** The article a link leads to, unless it is the article on screen (its own sections, say). */
  private target(a: Element): ArticleMeta | undefined {
    const path = (a.getAttribute('href') ?? '').split(/[?#]/)[0];
    const slug = path.split('/')[1];
    if (!slug || location.pathname.split('/')[1] === slug) return undefined;
    return this.data.get(slug);
  }

  /** Under the link, or above it when the space below is short; for a link that wraps, at the line under the pointer. */
  private place(a: Element, pointerY?: number): void {
    const rects = [...a.getClientRects()];
    const r = (pointerY != null && rects.find((x) => pointerY >= x.top && pointerY <= x.bottom)) || rects[0] || a.getBoundingClientRect();
    const width = Math.min(WIDTH, innerWidth - 2 * GUTTER);
    const left = Math.max(GUTTER, Math.min(r.left, innerWidth - GUTTER - width));
    const above = innerHeight - r.bottom < 260 && r.top > innerHeight - r.bottom;
    this.pos.set({ left, top: above ? innerHeight - r.top + GAP : r.bottom + GAP, above });
  }
}
