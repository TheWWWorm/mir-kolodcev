import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArticleMeta } from '../../core/models';
import { norm } from '../../core/search';
import { Spoilers } from '../../core/spoilers';
import { WikiData } from '../../core/wiki-data';
import type { Group } from './views';

@Component({
  selector: 'app-roster',
  imports: [RouterLink],
  templateUrl: './roster.html',
  styleUrl: './roster.css',
})
export class Roster {
  readonly groups = input.required<Group[]>();
  protected readonly data = inject(WikiData);
  protected readonly spoilers = inject(Spoilers);
  protected readonly query = signal('');
  protected readonly group = signal('');
  protected readonly letter = signal('');
  protected readonly items = computed(() => this.groups().flatMap((g) => g.items));
  protected readonly features = computed(() =>
    ['alvaro-da-silva', 'red']
      .map((slug) => this.items().find((a) => a.slug === slug))
      .filter((a): a is ArticleMeta => !!a && !!this.data.imageSrc(a) && !this.spoilers.hidden(a)),
  );
  protected readonly letters = computed(() =>
    [...new Set(this.items().map((a) => a.title[0].toLocaleUpperCase('ru')))].sort((a, b) =>
      a.localeCompare(b, 'ru'),
    ),
  );
  protected readonly otherGroups = computed(() =>
    this.groups().filter((g) => !['Каталия', 'Олландия'].includes(g.name)),
  );
  protected readonly filtering = computed(
    () => !!(this.query().trim() || this.group() || this.letter()),
  );
  protected readonly results = computed(() => {
    const q = norm(this.query());
    return this.groups()
      .filter((g) => !this.group() || g.name === this.group())
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (a) =>
            (!this.letter() || a.title[0].toLocaleUpperCase('ru') === this.letter()) &&
            (!q || norm([a.title, a.ru, ...a.aliases].join(' ')).includes(q)),
        ),
      }))
      .filter((g) => g.items.length);
  });
  protected readonly count = computed(() => this.results().reduce((n, g) => n + g.items.length, 0));
  protected summary(a: ArticleMeta): string {
    return this.spoilers.hidden(a)
      ? 'Появляется в поздних главах.'
      : this.spoilers.partly(a)
        ? 'Часть сведений скрыта с учётом выбранной главы.'
        : a.summary.split(/[;.]/)[0];
  }
  protected credit(a: ArticleMeta): string {
    return a.image == null ? '' : (this.data.images()[a.image]?.credit ?? '');
  }
  protected reset(): void {
    this.query.set('');
    this.group.set('');
    this.letter.set('');
  }
}
