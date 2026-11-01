import { Component, computed, inject, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ArticleMeta } from '../../core/models';
import { plural } from '../../core/format';
import { WikiData } from '../../core/wiki-data';
import { ArticleCard } from '../../shared/article-card';

/** An entry of data/changes.json, written by build.py from its ledger data/changes.tsv. */
interface Change {
  slug: string;
  date: string;
  kind: 'new' | 'more';
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/** «Что нового»: new and expanded articles, latest first, grouped by the day of the build. */
@Component({
  selector: 'app-changes-page',
  imports: [RouterLink, ArticleCard],
  template: `
    <div class="page">
      <div class="crumbs"><a routerLink="/">Заглавная</a></div>
      <h1 class="page-title">Что нового</h1>
      <p class="page-sub">Новые статьи и статьи, которые заметно дополнились. Мелкие правки здесь не отмечаются.</p>
      @if (log.isLoading()) {
        <p class="muted" role="status">Загрузка…</p>
      } @else if (log.error()) {
        <p role="alert">Не удалось загрузить список изменений.</p>
        <button class="btn" (click)="log.reload()">Повторить</button>
      } @else if (!days().length) {
        <p class="muted">Пока ничего: изменения начнут отмечаться со следующего обновления вики.</p>
      }
      @for (d of days(); track d.date) {
        <section>
          <h2 class="day">{{ d.label }}</h2>
          @if (d.added.length) {
            <h3 class="kind ui">{{ d.added.length }} {{ count(d.added.length, 'новая статья', 'новые статьи', 'новых статей') }}</h3>
            <div class="grid">
              @for (a of d.added; track a.slug) {
                <app-article-card [article]="a" [showType]="true" />
              }
            </div>
          }
          @if (d.expanded.length) {
            <h3 class="kind ui">{{ d.expanded.length }} {{ count(d.expanded.length, 'статья дополнена', 'статьи дополнены', 'статей дополнено') }}</h3>
            <div class="grid">
              @for (a of d.expanded; track a.slug) {
                <app-article-card [article]="a" [showType]="true" />
              }
            </div>
          }
        </section>
      }
    </div>
  `,
  styles: `
    .day { font-size: var(--fs-h3); margin: 30px 0 4px; }
    .kind { font-size: .85rem; font-weight: 600; color: var(--ink-3); text-transform: uppercase; letter-spacing: .06em; margin: 14px 0 8px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 10px;
      margin-inline: -16px;
    }
  `,
})
export class ChangesPage {
  private readonly http = inject(HttpClient);
  private readonly data = inject(WikiData);
  protected readonly log = resource({ loader: () => firstValueFrom(this.http.get<Change[]>('data/changes.json')) });

  protected readonly days = computed(() => {
    const byDay = new Map<string, { added: ArticleMeta[]; expanded: ArticleMeta[] }>();
    for (const c of this.log.hasValue() ? this.log.value() : []) {
      const a = this.data.get(c.slug);
      if (!a) continue;
      const d = byDay.get(c.date) ?? { added: [], expanded: [] };
      (c.kind === 'new' ? d.added : d.expanded).push(a);
      byDay.set(c.date, d);
    }
    return [...byDay].sort(([a], [b]) => b.localeCompare(a)).map(([date, d]) => ({ date, label: dayLabel(date), ...d }));
  });

  protected count(n: number, one: string, few: string, many: string): string {
    return plural(n, one, few, many);
  }
}

function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
