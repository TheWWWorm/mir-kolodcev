import { Component, OnDestroy, computed, effect, inject, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Chapter } from '../../core/models';
import { Spoilers } from '../../core/spoilers';
import { WikiData } from '../../core/wiki-data';
import { Stop, byDate, chapterStops, keyStops } from './timeline';
import { SITE } from '../../core/site';

/** One stop of a hero's route: consecutive chapters in the same place are merged. */
export interface RouteStep { key: string; items: { book: string; c: Chapter }[] }

/**
 * The timeline beside a map: playback through key events and dated chapters, or a narrator's route
 * step by step. Both maps draw the current stop, the trail and the route from its public signals.
 */
@Component({
  selector: 'app-timeline-panel',
  imports: [RouterLink],
  templateUrl: './timeline-panel.html',
  styleUrl: './timeline-panel.css',
})
export class TimelinePanel implements OnDestroy {
  protected readonly data = inject(WikiData);
  private readonly spoilers = inject(Spoilers);

  /** The reader moved to another stop or route step; the map should bring this place into view. */
  readonly focus = output<string>();
  /** The place name in the event card was clicked. */
  readonly placeClick = output<string>();

  readonly places = computed(() => this.data.extra().map.places);
  protected readonly onlyKey = signal(false);
  readonly journeySlug = signal('');

  /** Timeline stops the reader may see, sorted by in-world date. */
  readonly stops = computed<Stop[]>(() => {
    const ex = this.data.extra();
    const visibleBook = (slug: string) => this.spoilers.bookVisible(this.data.get(slug)?.order ?? 999);
    const key = keyStops(ex.map.events).filter((e) => this.spoilers.eventVisible(e));
    const chapters = this.onlyKey() ? [] : chapterStops(ex.chapters, (s) => this.data.title(s), (s) => this.data.get(s)?.order ?? 0).filter((s) => (!s.book || visibleBook(s.book)) && this.spoilers.eventVisible(s));
    return [...key, ...chapters].filter((s) => this.places()[s.p]).sort(byDate);
  });
  readonly cur = signal(0);
  readonly stop = computed(() => this.stops()[Math.min(this.cur(), this.stops().length - 1)]);
  /** The few stops just before the current one, drawn as a fading trail. */
  readonly trail = computed(() => this.stops().slice(Math.max(0, this.cur() - 4), this.cur()));
  /** Stops around the current one, for the vertical list. */
  protected readonly nearby = computed(() => {
    const s = this.stops(), c = this.cur();
    const from = Math.max(0, Math.min(c - 4, s.length - 14));
    return s.slice(from, from + 14).map((x, k) => ({ s: x, i: from + k }));
  });
  protected readonly ticks = computed(() => {
    const s = this.stops();
    const marks = SITE.timeline.marks;
    return marks.map((m) => ({ m, i: s.findIndex((x) => x.d >= m) })).filter((t) => t.i > 0)
      .map((t) => ({ i: t.i, left: (t.i / Math.max(s.length - 1, 1)) * 100, label: tickLabel(t.m) }));
  });

  /** Narrators with at least three mapped chapters among the books the reader has read. */
  protected readonly narrators = computed(() => {
    const count = new Map<string, number>();
    for (const b of this.data.books()) {
      if (!this.spoilers.bookVisible(b.order)) continue;
      for (const c of this.data.extra().chapters[b.slug] ?? []) if (c.pov && c.key && this.places()[c.key] && this.spoilers.eventVisible({ d: c.iso })) count.set(c.pov, (count.get(c.pov) ?? 0) + 1);
    }
    for (const [hero, rows] of Object.entries(this.data.extra().routes ?? {}))
      count.set(hero, rows.filter((r) => this.visibleBook(r.book) && this.places()[r.key]).length);
    return [...count.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).map(([slug]) => slug);
  });
  readonly journey = computed<RouteStep[]>(() => {
    const slug = this.journeySlug();
    if (!slug) return [];
    // a hand-made route wins: it follows the hero through other narrators' chapters too
    const own = this.data.extra().routes?.[slug];
    const rows = own
      ? own.filter((r) => this.visibleBook(r.book) && this.spoilers.eventVisible({ d: r.iso })).map((c) => ({ book: c.book, c }))
      : this.data.books().filter((b) => this.spoilers.bookVisible(b.order))
          .flatMap((b) => (this.data.extra().chapters[b.slug] ?? []).filter((c) => c.pov === slug && this.spoilers.eventVisible({ d: c.iso })).map((c) => ({ book: b.slug, c })));
    const pts: RouteStep[] = [];
    for (const it of rows) {
      if (!it.c.key || !this.places()[it.c.key]) continue;
      const last = pts[pts.length - 1];
      if (last && last.key === it.c.key) last.items.push(it);
      else pts.push({ key: it.c.key, items: [it] });
    }
    return pts;
  });
  private visibleBook(slug: string): boolean {
    return this.spoilers.bookVisible(this.data.get(slug)?.order ?? 999);
  }
  readonly step = signal(0);
  /** Folded down to its header; remembered between visits. */
  readonly collapsed = signal(readFolded());
  protected readonly playing = signal(false);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      // Start the timeline at the opening of the first book.
      const s = this.stops();
      untracked(() => this.cur.set(Math.max(0, s.findIndex((x) => x.d >= '1774-03-21'))));
    });
  }

  ngOnDestroy(): void { this.stopPlay(); }

  protected toggle(): void {
    this.collapsed.set(!this.collapsed());
    try { localStorage.setItem(FOLD_KEY, this.collapsed() ? '1' : '0'); } catch { /* storage may be unavailable */ }
  }

  protected title(k: string): string { return this.data.title(k); }

  show(i: number, focus = true): void {
    const n = this.stops().length;
    if (!n) return;
    this.cur.set(Math.max(0, Math.min(n - 1, i)));
    if (focus) this.focus.emit(this.stop().p);
  }
  protected togglePlay(): void {
    if (this.timer) return this.stopPlay();
    if (this.cur() >= this.stops().length - 1) this.show(0);
    this.playing.set(true);
    this.timer = setInterval(() => { if (this.cur() >= this.stops().length - 1) this.stopPlay(); else this.show(this.cur() + 1); }, 2600);
  }
  private stopPlay(): void { if (this.timer) clearInterval(this.timer); this.timer = null; this.playing.set(false); }

  protected setJourney(slug: string): void {
    this.stopPlay();
    this.journeySlug.set(slug);
    this.step.set(0);
    if (slug && this.journey()[0]) this.focus.emit(this.journey()[0].key);
  }
  showStep(i: number): void {
    const j = this.journey();
    if (!j[i]) return;
    this.step.set(i);
    this.focus.emit(j[i].key);
  }
}

const FOLD_KEY = `${SITE.key}.timeline.folded`;
function readFolded(): boolean {
  try { return localStorage.getItem(FOLD_KEY) === '1'; } catch { return false; }
}

function tickLabel(m: string): string {
  if (SITE.spoilers.unit === 'chapters') return 'гл. ' + (+m - 1000);
  const months = ['', 'янв.', 'фев.', 'март', 'апр.', 'май', 'июнь', 'июль', 'авг.', 'сен.', 'окт.', 'нояб.', 'дек.'];
  return m.length > 4 ? `${months[+m.slice(5)]} ${m.slice(0, 4)}` : `${m} г.`;
}
