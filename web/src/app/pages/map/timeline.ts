import { Chapter, MapEvent } from '../../core/models';
import { SITE } from '../../core/site';

const BY_CHAPTER = SITE.spoilers.unit === 'chapters';

/** One stop on the map timeline: a curated key event or a dated chapter. */
export interface Stop {
  d: string;
  label: string;
  p: string;
  html: string;
  links: string[];
  key: boolean;
  pov?: string;
  book?: string;
}

const MONTHS = ['', 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function keyStops(events: MapEvent[]): Stop[] {
  return events.map((e) => ({ d: e.d, label: e.label, p: e.p, html: escapeHtml(e.t), links: e.s ?? [], key: true }));
}

export function chapterStops(chapters: Record<string, Chapter[]>, bookTitle: (slug: string) => string, bookOrder: (slug: string) => number): Stop[] {
  const out: Stop[] = [];
  for (const [book, rows] of Object.entries(chapters)) {
    for (const c of rows) {
      if (!c.iso || !c.key || c.iso < SITE.timeline.minIso) continue;
      out.push({
        d: c.iso, label: c.date || isoLabel(c.iso), p: c.key, key: false, pov: c.pov, book,
        html: BY_CHAPTER
          ? `<i>Глава ${escapeHtml(c.n)}. ${escapeHtml(c.h)}.</i> ${c.sum}`
          : `<i>«${escapeHtml(bookTitle(book))}», ${escapeHtml(c.h)}.</i> ${c.sum}`,
        links: c.pov ? [c.pov] : [],
      });
    }
    void bookOrder;
  }
  return out;
}

export function isoLabel(iso: string): string {
  if (BY_CHAPTER && /^1\d\d\d$/.test(iso) && +iso < 1100) return `глава ${+iso - 1000}`;
  const [y, m, d] = iso.split('-').map(Number);
  if (!m) return `${y} г.`;
  return d && d !== 15 && d !== 1 && d !== 25 ? `${d} ${MONTHS[m]} ${y}` : `${MONTHS[m].replace(/я$/, 'ь').replace(/а$/, '')} ${y}`;
}

export const byDate = (a: Stop, b: Stop) => (a.d < b.d ? -1 : a.d > b.d ? 1 : (a.key ? -1 : 0) - (b.key ? -1 : 0));
