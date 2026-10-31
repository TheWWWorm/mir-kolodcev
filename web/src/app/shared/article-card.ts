import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArticleMeta, TYPE_LABELS } from '../core/models';
import { Spoilers } from '../core/spoilers';
import { WikiData } from '../core/wiki-data';

@Component({
  selector: 'app-article-card',
  imports: [RouterLink],
  template: `
    @let a = article();
    <a class="card" [routerLink]="'/' + a.slug">
      @if (img(); as src) {
        <img class="thumb" [src]="src" alt="" loading="lazy" />
      }
      <span class="copy"
        ><span class="t">{{ a.title }}</span>
        @if (a.ru) {
          <span class="ru">{{ a.ru }}</span>
        }
        @if (spoilers.hidden(a)) {
          <span class="sum muted">Появляется в главе {{ spoilers.bookTitle(a.first) }}</span>
        } @else {
          <span class="sum">{{
            spoilers.partly(a) ? 'Часть сведений скрыта с учётом выбранной книги.' : a.summary
          }}</span>
        }
        @if (showType()) {
          <span class="type">{{ types[a.type].one }}</span>
        }
      </span>
    </a>
  `,
  styleUrl: './article-card.css',
})
export class ArticleCard {
  readonly article = input.required<ArticleMeta>();
  readonly showType = input(false);
  protected readonly spoilers = inject(Spoilers);
  private readonly data = inject(WikiData);
  protected readonly types = TYPE_LABELS;
  protected readonly img = computed(() => this.data.imageSrc(this.article()));
}
