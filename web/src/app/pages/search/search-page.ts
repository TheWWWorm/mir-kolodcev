import { t } from '../../core/locale';
import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TYPE_LABELS } from '../../core/models';
import { Search } from '../../core/search';
import { Spoilers } from '../../core/spoilers';

@Component({
  selector: 'app-search-page',
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="crumbs"><a routerLink="/">{{ t('Заглавная', 'Home') }}</a></div>
      <h1 class="page-title">{{ t('Поиск', 'Search') }}</h1>
      <p class="page-sub">{{ t('Результаты для', 'Results for') }} «{{ q() }}»: {{ results().length }}.</p>
      <ol class="results">
        @for (r of results(); track r.slug) {
          <li>
            <a [routerLink]="'/' + r.slug">{{ r.title }}</a> <span class="ui muted">{{ types[r.type].one }}</span>
            <p [class.spoil-blur]="spoilers.partly(r)">{{ r.summary }}</p>
          </li>
        } @empty {
          <li class="empty">{{ t('Ничего не нашлось. Проверьте написание или попробуйте имя без отчества.', 'No results. Check the spelling or try a shorter search.') }}</li>
        }
      </ol>
    </div>
  `,
  styles: `
    .results { list-style: none; padding: 0; max-width: var(--measure); }
    li { padding: 12px 0; border-bottom: 1px solid var(--rule); }
    li > a { font: 500 1.15rem/1.3 var(--serif); margin-right: .5em; }
    p { margin: 4px 0 0; color: var(--ink-2); font-size: .98rem; }
  `,
})
export class SearchPage {
  protected readonly t = t;
  readonly q = input.required<string>();
  private readonly search = inject(Search);
  protected readonly spoilers = inject(Spoilers);
  protected readonly types = TYPE_LABELS;
  protected readonly results = computed(() => this.search.find(this.q()));
}
