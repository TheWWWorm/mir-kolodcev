import { Injectable, computed, inject, signal } from '@angular/core';
import { ArticleMeta, MapEvent } from './models';
import { WikiData } from './wiki-data';

const KEY = 'kolodcy.read-up-to';
export const ALL_BOOKS = 99;

/**
 * "Прочитано до главы N": hides content from chapters after N (the wiki covers one novel, so the
 * reading order counts chapters, not books). ALL_BOOKS means the reader wants everything shown.
 * In-world dates are chapter-based: a chapter's iso is 1000 + its number.
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

  /** The whole article belongs to an unread book. */
  hidden(a: ArticleMeta | undefined): boolean {
    return !!a && this.active() && a.first > this.level() && !this.revealed().has(a.slug);
  }

  /** The article mentions events from an unread book somewhere. */
  partly(a: ArticleMeta | undefined): boolean {
    return !!a && this.active() && a.last > this.level();
  }

  /** Chapters of the novel in reading order, offered in «Прочитано до». */
  readonly parts = computed(() =>
    Object.values(this.data.extra().chapters).flat().filter((c) => +c.n > 0).map((c) => ({ order: +c.n, title: c.h })),
  );

  bookTitle(order: number): string {
    const c = this.parts().find((p) => p.order === order);
    return c ? `«${c.title}» (гл. ${order})` : `гл. ${order}`;
  }

  /** Latest in-world date the reader has reached. */
  readonly cutoff = computed(() => (this.active() ? String(1000 + this.level()) : '9999'));

  eventVisible(ev: { d: string }): boolean {
    if (!this.active()) return true;
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
