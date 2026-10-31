import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { plural } from '../core/format';
import { WikiData } from '../core/wiki-data';

@Component({
  selector: 'app-chapter-table',
  imports: [RouterLink],
  template: `
    @if (rows().length) {
      <h2 id="h-glavy">Указатель глав</h2>
      <p class="muted ui" role="status">
        {{
          filtered().length === rows().length
            ? rows().length
            : filtered().length + ' из ' + rows().length
        }}
        {{ word() }}
      </p>
      <div class="filters ui">
        <label for="chapter-query"
          >Найти главу<input
            id="chapter-query"
            class="field"
            type="search"
            placeholder="Название, место или герой"
            [value]="query()"
            (input)="query.set($any($event.target).value)" /></label
        ><label for="chapter-narrator"
          >Рассказчик<select
            id="chapter-narrator"
            class="field"
            [value]="narrator()"
            (change)="narrator.set($any($event.target).value)"
          >
            <option value="">Все рассказчики</option>
            @for (p of narrators(); track p) {
              <option [value]="p">{{ data.title(p) }}</option>
            }
          </select></label
        >
      </div>
      @if (!filtered().length) {
        <p class="muted" role="status">Ничего не найдено. Измените запрос или рассказчика.</p>
      }
      <div
        class="table-wrap desktop"
        tabindex="0"
        aria-label="Указатель глав, доступна горизонтальная прокрутка"
      >
        <table class="table">
          <thead>
            <tr>
              <th>Глава</th>
              <th>Когда и где</th>
              <th>Что происходит</th>
            </tr>
          </thead>
          <tbody>
            @for (r of filtered(); track r.n) {
              <tr>
                <td>
                  <b>{{ r.h }}</b>
                  @if (r.pov) {
                    <a class="sub" [routerLink]="'/' + r.pov">{{ data.title(r.pov) }}</a>
                  }
                </td>
                <td>
                  {{ r.date }}<span class="sub" [innerHTML]="r.place"></span>
                  @if (r.key && data.extra().map.places[r.key]) {
                    <a class="sub" routerLink="/map" [queryParams]="{ p: r.key }"
                      >Показать на карте</a
                    >
                  }
                </td>
                <td [innerHTML]="r.sum"></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="mobile">
        @for (r of filtered(); track r.n) {
          <details>
            <summary>
              {{ r.h }}<span>{{ data.title(r.pov) }}</span>
            </summary>
            <div class="chapter-body">
              <p>{{ r.date }}</p>
              <p [innerHTML]="r.place"></p>
              <p [innerHTML]="r.sum"></p>
              @if (r.key && data.extra().map.places[r.key]) {
                <a routerLink="/map" [queryParams]="{ p: r.key }">Показать на карте</a>
              }
            </div>
          </details>
        }
      </div>
    }
  `,
  styles: `
    h2 {
      font-size: 2rem;
      margin: 0 0 10px;
    }
    .table tbody tr:nth-child(even) {
      background: var(--sheet-2);
    }
    .table td:first-child {
      width: 24%;
    }
    .table td:nth-child(2) {
      width: 28%;
    }
    .table-wrap {
      border-color: var(--rule);
    }
    :host {
      display: block;
    }
    .filters {
      display: flex;
      gap: 18px;
      margin: 22px 0;
    }
    .filters label {
      display: flex;
      flex-direction: column;
      gap: 7px;
      font-size: 0.8rem;
      color: var(--ink-2);
    }
    .filters label:first-child {
      flex: 1;
    }
    .field {
      width: 100%;
    }
    td:first-child {
      min-width: 10em;
    }
    td:nth-child(2) {
      min-width: 11em;
      color: var(--ink-2);
    }
    .mobile {
      display: none;
    }
    details {
      margin: 12px 0;
      border: 1px solid var(--rule);
      border-radius: 5px;
      background: var(--sheet-2);
    }
    summary {
      padding: 15px;
      line-height: 1.5;
    }
    summary span {
      display: block;
      font-size: 0.75rem;
      color: var(--ink-2);
      margin-top: 4px;
    }
    .chapter-body {
      padding: 0 16px 18px;
      font: 1rem/1.65 var(--serif);
    }
    @media (max-width: 599px) {
      .desktop {
        display: none;
      }
      .mobile {
        display: block;
      }
      .filters {
        flex-direction: column;
      }
    }
  `,
})
export class ChapterTable {
  readonly book = input.required<string>();
  protected readonly data = inject(WikiData);
  protected readonly query = signal('');
  protected readonly narrator = signal('');
  protected readonly rows = computed(() => this.data.extra().chapters[this.book()] ?? []);
  protected readonly narrators = computed(() => [
    ...new Set(
      this.rows()
        .map((r) => r.pov)
        .filter(Boolean),
    ),
  ]);
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLocaleLowerCase('ru');
    return this.rows().filter(
      (r) =>
        (!this.narrator() || r.pov === this.narrator()) &&
        (!q ||
          `${r.h} ${r.date} ${r.place} ${this.data.title(r.pov)}`
            .toLocaleLowerCase('ru')
            .includes(q)),
    );
  });
  protected readonly word = computed(() => plural(this.rows().length, 'глава', 'главы', 'глав'));
}
