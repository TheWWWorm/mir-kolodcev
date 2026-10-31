import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Spoilers } from '../core/spoilers';
import { WikiData } from '../core/wiki-data';

@Component({
  selector: 'app-houses-table',
  imports: [RouterLink],
  template: `
    <div
      class="table-wrap"
      tabindex="0"
      aria-label="Сравнение стран, доступна горизонтальная прокрутка"
    >
      <table class="table">
        <thead>
          <tr>
            <th>Страна</th>
            <th>Столица и города</th>
            <th>Власть</th>
            <th>Армия и полководцы</th>
            <th>В конце романа</th>
            <th>Общество</th>
            <th>На карте</th>
          </tr>
        </thead>
        <tbody>
          @for (h of data.extra().houses; track h.slug) {
            <tr>
              <td>
                <b>
                  @if (data.get(h.slug)) {
                    <a [routerLink]="'/' + h.slug">{{ data.title(h.slug) }}</a>
                  } @else {
                    {{ h.slug }}
                  }</b
                ><span class="sub" [innerHTML]="h.notes"></span>
              </td>
              <td [innerHTML]="h.capital"></td>
              <td [innerHTML]="h.government"></td>
              <td [innerHTML]="h.army"></td>
              <td
                [innerHTML]="h.ending"
                [class.spoil-blur]="spoilers.active() && spoilers.level() < lastChapter()"
              ></td>
              <td [innerHTML]="h.society"></td>
              <td [innerHTML]="h.color"></td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    td {
      min-width: 8.5em;
    }
  `,
})
export class HousesTable {
  protected readonly data = inject(WikiData);
  protected readonly spoilers = inject(Spoilers);
  /** The end-of-novel column draws on the last chapter. */
  protected readonly lastChapter = computed(() => Math.max(0, ...Object.values(this.data.extra().chapters).flat().map((c) => +c.n || 0)));
}
