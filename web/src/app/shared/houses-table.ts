import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE } from '../core/site';
import { Spoilers } from '../core/spoilers';
import { WikiData } from '../core/wiki-data';

@Component({
  selector: 'app-houses-table',
  imports: [RouterLink],
  template: `
    <div
      class="table-wrap"
      tabindex="0"
      [attr.aria-label]="site.houses.aria + ', доступна горизонтальная прокрутка'"
    >
      <table class="table">
        <thead>
          <tr>
            <th>{{ site.houses.first }}</th>
            @for (c of site.houses.cols; track c.k) {
              <th>{{ c.h }}</th>
            }
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
              @for (c of site.houses.cols; track c.k) {
                <td [class.spoil-blur]="c.spoil && spoilers.active() && spoilers.level() < spoilers.lastPart()">
                  <span [innerHTML]="h[c.k]"></span>
                  @if (c.sub) {
                    <span class="sub" [innerHTML]="h[c.sub]"></span>
                  }
                </td>
              }
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
  protected readonly site = SITE;
  protected readonly data = inject(WikiData);
  protected readonly spoilers = inject(Spoilers);
}
