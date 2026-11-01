import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WikiImage } from '../../core/models';
import { WikiData } from '../../core/wiki-data';
import { Figure } from '../../shared/figure';
import { SITE } from '../../core/site';

const FAN = 'Читательский фан-арт';

const KINDS: [string, (im: WikiImage) => boolean][] = [
  ['Портреты', (im) => /\/portrait-|-(melnikov|alfa|garnets|lamzina)\.jpg$/.test(im.src) && !/vomak|ervin|dzhemis/.test(im.src)],
  ['Священные Предметы', (im) => im.src.includes('/po-')],
  ['Гербы', (im) => im.src.includes('/gerb')],
  ['Обложки', (im) => im.src.includes('/cover-')],
  ['Карты', (im) => im.src.includes('/map')],
  [FAN, (im) => im.src.includes('/fan-')],
  ['Иллюстрации к изданиям', () => true],
];

@Component({
  selector: 'app-gallery-page',
  imports: [RouterLink, Figure],
  template: `
    <div class="page">
      <div class="crumbs"><a routerLink="/">Заглавная</a></div>
      <h1 class="page-title">Иллюстрации</h1>
      <p class="page-sub">{{ site.gallery.sub }}</p>
      @for (g of groups(); track g.name) {
        <h2 class="section-title">{{ g.name }}</h2>
        @if (g.name === fan) {
          <p class="note">Роман Суржиков намеренно не вводил канонических портретов персонажей и оставил внешность героев на волю читательской фантазии. Эти картинки в основном прислали читатели. Автору они нравятся, но это не утверждённый канон: «железобетонного канона внешности в Полари вообще нет».</p>
        }
        <div class="grid">@for (i of g.items; track i) {<app-figure [index]="i" />}</div>
      }
      <p class="credits ui">Права на иллюстрации принадлежат их авторам и издательствам; в подписях указан художник, если он известен.</p>
    </div>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
    .note { max-width: 46rem; margin: 0 0 16px; color: var(--ink-2); }
    .credits { margin-top: 32px; color: var(--ink-3); font-size: var(--fs-ui); }
  `,
})
export class GalleryPage {
  protected readonly site = SITE;
  private readonly data = inject(WikiData);
  protected readonly fan = FAN;
  protected readonly groups = computed(() => {
    const taken = new Set<number>();
    return KINDS.map(([name, test]) => {
      const items = this.data.images().map((im, i) => ({ im, i })).filter(({ im, i }) => !taken.has(i) && test(im)).map(({ i }) => i);
      items.forEach((i) => taken.add(i));
      return { name, items };
    }).filter((g) => g.items.length);
  });
}
