import { Component, inject, input } from '@angular/core';
import { ALL_BOOKS, Spoilers } from '../core/spoilers';
import { WikiData } from '../core/wiki-data';
import { SITE, fmt } from '../core/site';

/** Header control: which book the reader has finished. */
@Component({
  selector: 'app-spoiler-select',
  template: `
    <label
      [class.on]="spoilers.active()"
      [title]="'Скрывать события ' + site.spoilers.word.genPl + ', которые вы ещё не прочитали'"
    >
      <span class="lbl">Прочитано до</span>
      <select
        class="field"
        [class.expanded]="expanded()"
        (change)="spoilers.setLevel(+$any($event.target).value)"
        [attr.aria-label]="'Прочитано до ' + site.spoilers.word.gen"
      >
        <option [value]="all" [selected]="spoilers.level() === all">весь {{ site.work.acc }}</option>
        @for (b of spoilers.parts(); track b.order) {
          <option [value]="b.order" [selected]="spoilers.level() === b.order">{{ option(b) }}</option>
        }
      </select>
    </label>
  `,
  styles: `
    label {
      display: flex;
      align-items: center;
      gap: 8px;
      font: var(--fs-ui)/1 var(--sans);
      color: var(--ink-3);
    }
    select {
      max-width: 220px;
      min-width: 0;
    }
    select.expanded {
      max-width: 100%;
    }
    label.on select {
      border-color: var(--wax);
      color: var(--wax);
    }
    @media (max-width: 760px) {
      .lbl {
        display: none;
      }
      select {
        max-width: 118px;
      }
    }
  `,
})
export class SpoilerSelect {
  protected readonly site = SITE;
  protected option(b: { order: number; title: string }): string {
    return fmt(SITE.spoilers.option, { n: b.order, title: b.title });
  }
  readonly expanded = input(false);
  protected readonly spoilers = inject(Spoilers);
  protected readonly data = inject(WikiData);
  protected readonly all = ALL_BOOKS;
}
