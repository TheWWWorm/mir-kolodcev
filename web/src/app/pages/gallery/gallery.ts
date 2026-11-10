import { t } from '../../core/locale';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WikiImage } from '../../core/models';
import { WikiData } from '../../core/wiki-data';
import { Figure } from '../../shared/figure';
import { SITE } from '../../core/site';
import { Spoilers } from '../../core/spoilers';

const FAN = t('Читательский фан-арт', 'Fan art');

/** `character` tells whether an article is about a character. */
const KINDS: [string, (im: WikiImage, character: (slug: string) => boolean) => boolean][] = [
  // portraits drawn as such (Мир колодцев); fragments cut out of scenes stay out of the gallery page
  [t('Портреты', 'Portraits'), (im, character) => im.src.includes('/portrait-') && im.slugs.some(character)],
  [t('Священные Предметы', 'Sacred Objects'), (im) => im.src.includes('/po-')],
  [t('Гербы', 'Coats of arms'), (im) => im.src.includes('/gerb')],
  [t('Обложки', 'Covers'), (im) => im.src.includes('/cover-')],
  [t('Карты', 'Maps'), (im) => im.src.includes('/map')],
  [FAN, (im) => im.src.includes('/fan-')],
  [t('Иллюстрации к изданиям', 'Book illustrations'), () => true],
];

@Component({
  selector: 'app-gallery-page',
  imports: [RouterLink, Figure],
  template: `
    <div class="page">
      <div class="crumbs"><a routerLink="/">{{ t('Заглавная', 'Home') }}</a></div>
      <h1 class="page-title">{{ t('Иллюстрации', 'Gallery') }}</h1>
      <p class="page-sub">{{ site.gallery.sub }}</p>
      @for (g of groups(); track g.name) {
        <h2 class="section-title">{{ g.name }}</h2>
        @if (g.name === fan) {
          <p class="note">{{ t('Роман Суржиков намеренно не вводил канонических портретов персонажей и оставил внешность героев на волю читательской фантазии. Эти картинки в основном прислали читатели. Автору они нравятся, но это не утверждённый канон: «железобетонного канона внешности в Полари вообще нет».', 'Roman Surzhikov left the characters’ appearance to readers’ imaginations. Readers contributed most of these pictures. The author likes them, but they are not official portraits.') }}</p>
        }
        <div class="grid">@for (i of g.items; track i) {<app-figure [index]="i" />}</div>
      }
      <p class="credits ui">{{ t('Права на иллюстрации принадлежат их авторам и издательствам; в подписях указан художник, если он известен.', 'Illustration rights belong to the artists and publishers. Captions name the artist where known.') }}</p>
    </div>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
    .note { max-width: 46rem; margin: 0 0 16px; color: var(--ink-2); }
    .credits { margin-top: 32px; color: var(--ink-3); font-size: var(--fs-ui); }
  `,
})
export class GalleryPage {
  protected readonly t = t;
  protected readonly site = SITE;
  private readonly data = inject(WikiData);
  private readonly spoilers = inject(Spoilers);
  protected readonly fan = FAN;
  protected readonly groups = computed(() => {
    const taken = new Set<number>();
    const ch = (slug: string) => this.data.get(slug)?.type === 'character';
    return KINDS.map(([name, test]) => {
      const items = this.data.images().map((im, i) => ({ im, i })).filter(({ im, i }) => !taken.has(i) && !im.crop && this.spoilers.bookVisible(im.from ?? 0) && test(im, ch)).map(({ i }) => i);
      items.forEach((i) => taken.add(i));
      return { name, items };
    }).filter((g) => g.items.length);
  });
}
