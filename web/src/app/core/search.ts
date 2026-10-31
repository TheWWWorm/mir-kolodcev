import { Injectable, computed, inject } from '@angular/core';
import { ArticleMeta } from './models';
import { WikiData } from './wiki-data';

export const norm = (s: string) => String(s).toLowerCase().replace(/ё/g, 'е');

/** Damerau-free Levenshtein, capped for speed. */
function distance(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}

interface Entry { a: ArticleMeta; names: string[]; words: string[]; sum: string; text: string; }

/** Title/alias search tolerant to grammatical endings and small typos («деймонл» → Деймон). */
@Injectable({ providedIn: 'root' })
export class Search {
  private readonly data = inject(WikiData);
  private readonly index = computed<Entry[]>(() => {
    const texts = this.data.texts();
    return this.data.articles().map((a) => {
      const names = [a.title, a.ru, ...a.aliases].filter(Boolean).map(norm);
      return { a, names, words: names.flatMap((n) => n.split(/[\s\-«»"(),]+/).filter((w) => w.length > 2)), sum: norm(a.summary), text: norm(texts[a.slug] ?? '') };
    });
  });

  find(query: string, limit = 1e9): ArticleMeta[] {
    const q = norm(query.trim());
    if (!q) return [];
    const qw = q.split(/\s+/);
    const out: [number, ArticleMeta][] = [];
    for (const e of this.index()) {
      let s = 0;
      for (const n of e.names) {
        if (n === q) s = Math.max(s, 100);
        else if (n.startsWith(q)) s = Math.max(s, 80);
        else if (n.includes(q)) s = Math.max(s, 55);
      }
      if (!s && qw.every((w) => e.words.some((x) => x.startsWith(w) || (w.length > 4 && x.startsWith(w.slice(0, -2)))))) s = 60;
      if (!s && q.length >= 4) {
        const cap = q.length > 6 ? 2 : 1;
        if (qw.every((w) => e.words.some((x) => distance(w, x.slice(0, w.length + 1), cap) <= cap || distance(w, x, cap) <= cap))) s = 40;
      }
      if (!s && qw.every((w) => e.sum.includes(w))) s = 25;
      if (!s && qw.every((w) => e.text.includes(w))) s = 10;
      if (s) out.push([s + Math.min(e.a.backlinks.length, 40) / 10, e.a]);
    }
    return out.sort((x, y) => y[0] - x[0]).slice(0, limit).map((x) => x[1]);
  }
}
