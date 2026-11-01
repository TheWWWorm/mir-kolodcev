import { Injectable, computed, inject, signal } from '@angular/core';
import { ArticleMeta, MapEvent } from './models';
import { SITE } from './site';
import { WikiData } from './wiki-data';

const KEY = `${SITE.key}.read-up-to`;
export const ALL_BOOKS = 99;
const BY_CHAPTER = SITE.spoilers.unit === 'chapters';

/**
 * "Прочитано до …": hides content from parts of the work the reader has not reached yet.
 * A part is a book of the cycle, or a chapter when the wiki covers one novel (then in-world dates
 * are chapter-based: a chapter's iso is 1000 + its number). ALL_BOOKS means everything is shown.
 */
@Injectable({ providedIn: 'root' })
export class Spoilers {
  private readonly data = inject(WikiData);
  private readonly revealed = signal<Set<string>>(new Set());
  readonly level = signal<number>(readStored());
  /** The reader has picked a level at least once (otherwise we ask on first visit). */
  readonly chosen = signal<boolean>(hasStored());
  readonly active = computed(() => this.level() < ALL_BOOKS);

  setLevel(n: number): void {
    this.level.set(n);
    this.chosen.set(true);
    try { localStorage.setItem(KEY, String(n)); } catch { /* private mode */ }
  }

  reveal(slug: string): void {
    this.revealed.update((s) => new Set(s).add(slug));
  }

  /** The whole article belongs to an unread part. */
  hidden(a: ArticleMeta | undefined): boolean {
    return !!a && this.active() && a.first > this.level() && !this.revealed().has(a.slug);
  }

  /** The article mentions events from an unread part somewhere. */
  partly(a: ArticleMeta | undefined): boolean {
    return !!a && this.active() && a.last > this.level();
  }

  /** Parts of the work in reading order, offered in «Прочитано до». */
  readonly parts = computed(() =>
    BY_CHAPTER
      ? Object.values(this.data.extra().chapters).flat().filter((c) => +c.n > 0).map((c) => ({ order: +c.n, title: c.h }))
      : this.data.books().map((b) => ({ order: b.order, title: b.title })),
  );

  /** The last part: columns about the end of the work stay blurred until it is read. */
  readonly lastPart = computed(() => Math.max(0, ...this.parts().map((p) => p.order)));

  /** A part as the texts name it: «Title», or «Title» (гл. N) for a chapter. */
  bookTitle(order: number): string {
    const c = this.parts().find((p) => p.order === order);
    if (BY_CHAPTER) return c ? `«${c.title}» (гл. ${order})` : `гл. ${order}`;
    return `«${c?.title ?? order}»`;
  }

  /** «до главы «Title» (гл. N)» / «до «Title»»: how far the reader got. */
  upTo(order: number): string {
    return (BY_CHAPTER ? SITE.spoilers.word.gen + ' ' : '') + this.bookTitle(order);
  }

  /** Latest in-world date the reader has reached. */
  readonly cutoff = computed(() => {
    if (!this.active()) return '9999';
    if (BY_CHAPTER) return String(1000 + this.level());
    // max chapter date of the books read
    let max = '0000';
    const chapters = this.data.extra().chapters;
    for (const b of this.data.books()) {
      if (b.order > this.level()) continue;
      for (const c of chapters[b.slug] ?? []) if (c.iso && c.iso > max) max = c.iso;
    }
    return max;
  });

  eventVisible(ev: { d: string }): boolean {
    if (!this.active()) return true;
    // events before the cycle starts are told in later books
    const start = SITE.spoilers.cycleStart;
    if (start && ev.d < start) return (SITE.spoilers.revealedIn?.[ev.d] ?? 1) <= this.level();
    return ev.d <= this.cutoff();
  }

  bookVisible(order: number): boolean {
    return !this.active() || order <= this.level();
  }
}

function readStored(): number {
  try { return Number(localStorage.getItem(KEY)) || ALL_BOOKS; } catch { return ALL_BOOKS; }
}

function hasStored(): boolean {
  try { return localStorage.getItem(KEY) !== null; } catch { return true; }
}

export type { MapEvent };
