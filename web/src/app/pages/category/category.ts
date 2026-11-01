import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { byTitle } from '../../core/format';
import { ArticleMeta, ArticleType, TYPE_LABELS } from '../../core/models';
import { norm } from '../../core/search';
import { SITE, pageTitle } from '../../core/site';
import { WikiData } from '../../core/wiki-data';
import { ArticleCard } from '../../shared/article-card';
import { HousesTable } from '../../shared/houses-table';
import { Atlas, Lexicon, Shelf } from './views';
import { Roster } from './roster';
import { Chronicle } from './chronicle';

/** Regions from north to south, then the rest; catch-all groups go last. */
const REGIONS = SITE.regions;
const weight = (xs: ArticleMeta[]) => xs.reduce((n, a) => n + a.backlinks.length, 0);
const rank = (g: string) => (/^Проч/.test(g) ? 99 : REGIONS.includes(g) ? REGIONS.indexOf(g) : 50);

@Component({
  selector: 'app-category-page',
  imports: [RouterLink, ArticleCard, HousesTable, Roster, Atlas, Chronicle, Lexicon, Shelf],
  template: `
    @if (label(); as l) {
      <div class="page" [class.directory-page]="type() === 'character' || type() === 'event'">
        <div class="crumbs"><a routerLink="/">Заглавная</a></div>
        <h1 class="page-title">{{ type() === 'event' ? 'Хронология' : l.many }}</h1>
        <p class="page-sub">{{ l.about }} Статей: {{ list().length }}.</p>
        @if (type() === 'house') {
          <h2 class="section-title">{{ site.houses.title }}</h2>
          <app-houses-table />
          @if (site.features.families) {
            <p class="ui"><a routerLink="/families">Родословные древа главных родов</a></p>
          }
        }
        @if (type() !== 'character' && type() !== 'event') {
          <input
            class="field filter"
            type="search"
            placeholder="Отфильтровать по имени"
            aria-label="Фильтр"
            (input)="filter.set($any($event.target).value)"
          />
        }
        @switch (type()) {
          @case ('character') {
            <app-roster [groups]="groups()" />
          }
          @case ('place') {
            <app-atlas [groups]="groups()" />
          }
          @case ('event') {
            <app-chronicle [items]="flat()" />
          }
          @case ('concept') {
            <app-lexicon [items]="flat()" />
          }
          @case ('book') {
            <app-shelf [items]="flat()" />
          }
          @default {
            @for (g of groups(); track g.name) {
              <section>
                @if (groups().length > 1) {
                  <h2 class="group">{{ g.name }}</h2>
                }
                <div class="grid">
                  @for (a of g.items; track a.slug) {
                    <app-article-card [article]="a" />
                  }
                </div>
              </section>
            }
          }
        }
        @if (!flat().length) {
          <p class="muted">Ничего не найдено — сократите запрос.</p>
        }
      </div>
    } @else {
      <div class="page">
        <h1 class="page-title">Раздела нет</h1>
        <p><a routerLink="/">На заглавную</a></p>
      </div>
    }
  `,
  styles: `
    .directory-page > .page-title {
      font-size: clamp(2.6rem, 5vw, 4.5rem);
      line-height: 1.1;
    }
    .directory-page > .page-sub {
      font-size: 1rem;
      margin-bottom: 18px;
    }
    .filter {
      width: min(360px, 100%);
      margin: 20px 0 6px;
    }
    .group {
      font-size: var(--fs-h3);
      margin: 30px 0 10px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 10px;
      margin-inline: -16px;
    }
  `,
})
export class CategoryPage {
  protected readonly site = SITE;
  readonly type = input.required<string>();
  private readonly data = inject(WikiData);
  protected readonly filter = signal('');
  protected readonly label = computed(() => TYPE_LABELS[this.type() as ArticleType]);
  protected readonly list = computed(() => this.data.ofType(this.type() as ArticleType));

  protected readonly flat = computed(() => {
    const f = norm(this.filter());
    return this.list().filter(
      (a) => !f || norm(a.title + ' ' + a.ru + ' ' + a.aliases.join(' ')).includes(f),
    );
  });

  protected readonly groups = computed(() => {
    const items = [...this.flat()];
    if (this.type() === 'book')
      return [{ name: 'Книги', items: items.sort((a, b) => a.order - b.order) }];
    const map = new Map<string, ArticleMeta[]>();
    for (const a of items)
      map.set(a.group || 'Прочее', [...(map.get(a.group || 'Прочее') ?? []), a]);
    return (
      [...map.entries()]
        .sort(
          (a, b) =>
            (this.type() === 'place'
              ? rank(a[0]) - rank(b[0])
              : (/^Проч/.test(a[0]) ? 1 : 0) - (/^Проч/.test(b[0]) ? 1 : 0)) ||
            weight(b[1]) - weight(a[1]) ||
            a[0].localeCompare(b[0], 'ru'),
        )
        // characters: the most referenced first; everything else alphabetically
        .map(([name, xs]) => ({
          name,
          items: xs.sort(
            this.type() === 'character'
              ? (a, b) => b.backlinks.length - a.backlinks.length || byTitle(a, b)
              : byTitle,
          ),
        }))
    );
  });

  constructor() {
    const title = inject(Title);
    effect(() =>
      title.setTitle(
        pageTitle(this.type() === 'event' ? 'Хронология' : (this.label()?.many ?? 'Раздел')),
      ),
    );
  }
}
