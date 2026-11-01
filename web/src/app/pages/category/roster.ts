import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArticleMeta } from '../../core/models';
import { norm } from '../../core/search';
import { Spoilers } from '../../core/spoilers';
import { WikiData } from '../../core/wiki-data';
import type { Group } from './views';
import { SITE } from '../../core/site';

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

  constructor() {
    if (typeof matchMedia === 'undefined') return;
    const two = matchMedia('(max-width: 1250px)'), one = matchMedia('(max-width: 700px)');
    const update = () => this.cols.set(one.matches ? 1 : two.matches ? 2 : 3);
    update();
    two.addEventListener('change', update);
    one.addEventListener('change', update);
    inject(DestroyRef).onDestroy(() => { two.removeEventListener('change', update); one.removeEventListener('change', update); });
  }
  /** The two groups with their own buttons; the rest are in the select. */
  protected readonly primary = SITE.roster.primary;
  protected readonly query = signal('');
  protected readonly group = signal('');
  protected readonly letter = signal('');
  protected readonly items = computed(() => this.groups().flatMap((g) => g.items));
  protected readonly features = computed(() =>
    SITE.roster.features
      .map((slug) => this.items().find((a) => a.slug === slug))
      .filter((a): a is ArticleMeta => !!a && !!this.data.imageSrc(a) && !this.spoilers.hidden(a)),
  );
  protected readonly letters = computed(() =>
    [...new Set(this.items().map((a) => a.title[0].toLocaleUpperCase('ru')))].sort((a, b) =>
      a.localeCompare(b, 'ru'),
    ),
  );
  protected readonly otherGroups = computed(() =>
    this.groups().filter((g) => !this.primary.includes(g.name)),
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
  /** Number of columns the groups are laid out in, following the breakpoints in roster.css. */
  private readonly cols = signal(3);
  /** Each group goes under the column that is shortest so far, so a short column never leaves a hole. */
  protected readonly columns = computed(() => {
    const res = this.results();
    const cols = Array.from({ length: this.cols() }, () => ({ h: 0, groups: [] as typeof res }));
    for (const g of res) {
      const c = cols.reduce((a, b) => (b.h < a.h ? b : a));
      c.groups.push(g);
      c.h += g.items.length + 1.5;
    }
    return cols.map((c) => c.groups).filter((c) => c.length);
  });
  protected readonly count = computed(() => this.results().reduce((n, g) => n + g.items.length, 0));
  protected summary(a: ArticleMeta): string {
    return this.spoilers.hidden(a)
      ? `Появляется в поздних ${SITE.spoilers.word.prepPl}.`
      : this.spoilers.partly(a)
        ? `Часть сведений скрыта с учётом выбранной ${SITE.spoilers.word.gen}.`
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
