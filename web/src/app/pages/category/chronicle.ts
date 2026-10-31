import { Component, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArticleMeta } from '../../core/models';
import { norm } from '../../core/search';
import { Spoilers } from '../../core/spoilers';
import { WikiData } from '../../core/wiki-data';
import { SpoilerSelect } from '../../layout/spoiler-select';

const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];
const SHORT_MONTHS = [
  'Янв',
  'Фев',
  'Мар',
  'Апр',
  'Май',
  'Июн',
  'Июл',
  'Авг',
  'Сен',
  'Окт',
  'Ноя',
  'Дек',
];
const ANCIENT = 'Древность';
const UNDATED = 'Без даты';

/** One line of the chronology: an event article or a key event from the map timeline. */
interface Entry {
  id: string;
  iso: string;
  when: string;
  title: string;
  summary: string;
  group: string;
  /** the event article, when the entry is one */
  article?: ArticleMeta;
  /** article the entry opens: the event itself, or the place / first related article of a key event */
  open: string;
  links: string[];
}

/** A book, or one story of a collection, placed on the chronology by its in-world span. */
interface Story {
  id: string;
  slug: string;
  title: string;
  group: string;
  from: string;
  to: string;
}

function bucket(iso: string): string {
  return !iso ? UNDATED : +iso.slice(0, 4) < 1700 ? ANCIENT : iso.slice(0, 4);
}
const bucketKey = (b: string) => (b === ANCIENT ? '0' : b === UNDATED ? 'z' : b);
/** Inclusive month range of a story: «1774-08» … «1775-01». */
const monthFrom = (iso: string) => (iso.length >= 7 ? iso.slice(0, 7) : iso + '-01');
const monthTo = (iso: string) => (iso.length >= 7 ? iso.slice(0, 7) : iso + '-12');
const titleOf = (t: string) => {
  const i = t.indexOf(': ');
  return i > 0 && i < 48 ? [t.slice(0, i), t.slice(i + 2)] : [t.replace(/\.$/, ''), ''];
};

@Component({
  selector: 'app-chronicle',
  imports: [RouterLink, SpoilerSelect],
  templateUrl: './chronicle.html',
  styleUrl: './chronicle.css',
})
export class Chronicle {
  readonly items = input.required<ArticleMeta[]>();
  protected readonly data = inject(WikiData);
  protected readonly spoilers = inject(Spoilers);
  protected readonly query = signal('');
  protected readonly months = SHORT_MONTHS;
  protected readonly available = computed<Entry[]>(() => {
    const articles = this.items()
      .filter(
        (a) => !this.spoilers.hidden(a) && (!a.iso || this.spoilers.eventVisible({ d: a.iso })),
      )
      .map((a) => ({
        id: a.slug,
        iso: a.iso ?? '',
        when: (a.when || a.iso || 'Дата не указана').replace(/\s*\(.*$/, '').trim(),
        title: a.title,
        summary: this.spoilers.partly(a) ? 'Часть сведений скрыта с учётом выбранной книги.' : a.summary,
        group: a.group,
        article: a,
        open: a.slug,
        links: [],
      }));
    // key events of the map timeline that have no article of their own fill the gaps
    const keys = this.data
      .extra()
      .map.events.filter((e) => !e.a && this.spoilers.eventVisible(e))
      .map((e, i) => {
        const [title, rest] = titleOf(e.t);
        const links = (e.s ?? []).filter((s) => this.data.get(s));
        return {
          id: `key-${e.d}-${i}`,
          iso: e.d,
          when: e.label,
          title,
          summary: rest,
          group: ['Ключевое событие', this.data.get(e.p) ? this.data.title(e.p) : ''].filter(Boolean).join(' · '),
          open: links[0] ?? (this.data.get(e.p) ? e.p : ''),
          links,
        };
      });
    return [...articles, ...keys].sort(
      (a, b) => (a.iso || '9999').localeCompare(b.iso || '9999') || a.title.localeCompare(b.title, 'ru'),
    );
  });
  /** Books by their in-world span; a collection («Фантазии») is split into its stories. */
  protected readonly stories = computed<Story[]>(() => {
    const out: Story[] = [];
    for (const b of this.data.books()) {
      if (!b.span || !this.spoilers.bookVisible(b.order)) continue;
      const parts = new Map<string, string[]>();
      if (b.group === 'Внецикловое')
        for (const c of this.data.extra().chapters[b.slug] ?? []) {
          if (!c.iso) continue;
          const t = c.h.replace(/\.?\s+Часть\s+\d+$/, '').trim();
          parts.set(t, [...(parts.get(t) ?? []), c.iso]);
        }
      if (!parts.size) {
        out.push({ id: b.slug, slug: b.slug, title: b.title, group: b.group, from: b.span[0], to: b.span[1] });
        continue;
      }
      for (const [t, isos] of parts) {
        isos.sort();
        const [kind, name] = titleOf(t);
        out.push({
          id: `${b.slug}:${t}`,
          slug: b.slug,
          title: name || kind,
          group: name ? `${b.title} · ${kind}` : b.title,
          from: isos[0],
          to: isos[isos.length - 1],
        });
      }
    }
    return out.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  });
  protected readonly years = computed(() => {
    const ys = new Set(this.available().map((e) => bucket(e.iso)));
    for (const s of this.stories())
      for (let y = +s.from.slice(0, 4); y <= +s.to.slice(0, 4); y++) ys.add(bucket(String(y)));
    return [...ys].sort((a, b) => bucketKey(a).localeCompare(bucketKey(b)));
  });
  // the chronology reads from its beginning: the earliest period, the whole year
  protected readonly year = linkedSignal(() => this.years()[0] ?? '');
  protected readonly month = linkedSignal<string, string>({ source: this.year, computation: () => '' });
  protected readonly visible = computed(() => {
    const q = norm(this.query());
    return this.available().filter(
      (e) =>
        bucket(e.iso) === this.year() &&
        (!this.month() || e.iso.slice(5, 7) === this.month()) &&
        (!q || norm(e.title + ' ' + e.group).includes(q)),
    );
  });
  /** Stories whose action takes place in the selected year or month. */
  protected readonly periodStories = computed(() => {
    const y = this.year();
    if (!/^\d{4}$/.test(y)) return [];
    const [lo, hi] = this.month() ? [`${y}-${this.month()}`, `${y}-${this.month()}`] : [`${y}-01`, `${y}-12`];
    return this.stories().filter((s) => monthFrom(s.from) <= hi && monthTo(s.to) >= lo);
  });
  protected readonly selectedId = linkedSignal(() => this.visible()[0]?.id ?? '');
  protected readonly selected = computed(() => this.visible().find((e) => e.id === this.selectedId()));
  protected readonly info = resource({
    params: () => this.selected()?.article?.slug,
    loader: ({ params }) => this.data.body(params),
  });
  protected readonly facts = computed(() =>
    this.info.hasValue() && this.selected()?.article && !this.spoilers.partly(this.selected()?.article)
      ? this.info
          .value()
          .infobox.filter(([k]) => !/дат|врем|тип/i.test(k))
          .slice(0, 4)
      : [],
  );
  protected readonly related = computed(() => {
    const s = this.selected()?.article;
    if (!s) return [];
    const at = (iso: string) => Number((iso || '0000').replaceAll('-', '').padEnd(8, '0'));
    return this.available()
      .filter((e) => e.article && e.id !== s.slug && e.article.books.some((b) => s.books.includes(b)))
      .sort((a, b) => Math.abs(at(a.iso) - at(s.iso ?? '')) - Math.abs(at(b.iso) - at(s.iso ?? '')))
      .slice(0, 3);
  });
  protected readonly monthTitle = computed(() =>
    this.month() ? MONTHS[+this.month() - 1] : 'События',
  );
  protected monthValue(index: number): string {
    return String(index + 1).padStart(2, '0');
  }
  protected hasMonth(index: number): boolean {
    const ym = `${this.year()}-${this.monthValue(index)}`;
    return (
      this.available().some((e) => e.iso.slice(0, 7) === ym) ||
      this.stories().some((s) => monthFrom(s.from) <= ym && monthTo(s.to) >= ym)
    );
  }
  protected chooseYear(year: string): void {
    this.year.set(year);
  }
  protected span(s: Story): string {
    const one = (iso: string) =>
      iso.length >= 7 ? `${MONTHS[+iso.slice(5, 7) - 1].toLowerCase()} ${iso.slice(0, 4)}` : iso.slice(0, 4);
    const [a, b] = [one(s.from), one(s.to)];
    return a === b ? a : a.slice(-4) === b.slice(-4) ? `${a.slice(0, -5)} — ${b}` : `${a} — ${b}`;
  }
  protected dateParts(e: Entry): { day: string; month: string } {
    if (!e.iso || e.iso.length < 7 || +e.iso.slice(0, 4) < 1700) return { day: '', month: e.when };
    const d = +e.iso.slice(8, 10);
    // key events without a known day are stored on the 1st: show the month only
    return { day: d && !(e.article === undefined && d === 1) ? String(d) : '', month: MONTHS[+e.iso.slice(5, 7) - 1] ?? '' };
  }
  protected moveMonth(step: number): void {
    const y = Number(this.year());
    if (!Number.isFinite(y)) return;
    let m = (this.month() ? +this.month() : step > 0 ? 0 : 13) + step;
    let nextY = y;
    if (m < 1) {
      nextY--;
      m = 12;
    } else if (m > 12) {
      nextY++;
      m = 1;
    }
    if (!this.years().includes(String(nextY))) return;
    this.year.set(String(nextY));
    this.month.set(String(m).padStart(2, '0'));
  }
  protected canMove(step: number): boolean {
    const y = Number(this.year());
    if (!Number.isFinite(y)) return false;
    const m = this.month() ? +this.month() : step > 0 ? 0 : 13;
    return (m + step >= 1 && m + step <= 12) || this.years().includes(String(y + step));
  }
}
