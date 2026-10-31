import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { byTitle } from '../../core/format';
import { WikiData } from '../../core/wiki-data';

@Component({
  selector: 'app-all-articles-page',
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="crumbs"><a routerLink="/">Заглавная</a></div>
      <h1 class="page-title">Все статьи</h1>
      <p class="page-sub">{{ data.articles().length }} статей по алфавиту.</p>
      <nav class="letters ui">@for (l of letters(); track l.letter) {<a href="/all" (click)="jump($event, l.letter)">{{ l.letter }}</a>}</nav>
      <div class="az">
        @for (l of letters(); track l.letter) {
          <h2 [id]="'l-' + l.letter">{{ l.letter }}</h2>
          @for (a of l.items; track a.slug) {<a [routerLink]="'/' + a.slug">{{ a.title }}@if (a.ru) {<span>{{ a.ru }}</span>}</a>}
        }
      </div>
    </div>
  `,
  styles: `
    .letters { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-bottom: 18px; font-size: 1.05rem; }
    .az { columns: 3 260px; column-gap: 36px; }
    h2 { font-size: 1.5rem; margin: 14px 0 4px; break-after: avoid; color: var(--azure); }
    .az a { display: block; padding: 2px 0; break-inside: avoid; }
    .az span { display: block; color: var(--ink-3); font: italic .88rem/1.2 var(--serif); }
  `,
})
export class AllArticlesPage {
  protected readonly data = inject(WikiData);
  protected readonly letters = computed(() => {
    const m = new Map<string, ReturnType<WikiData['articles']>>();
    for (const a of [...this.data.articles()].sort(byTitle)) {
      const l = a.title[0].toUpperCase();
      m.set(l, [...(m.get(l) ?? []), a]);
    }
    return [...m.entries()].map(([letter, items]) => ({ letter, items }));
  });
  protected jump(ev: Event, letter: string): void {
    ev.preventDefault();
    document.getElementById('l-' + letter)?.scrollIntoView({ behavior: 'smooth' });
  }
}
