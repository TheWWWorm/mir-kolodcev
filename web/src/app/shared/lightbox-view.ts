import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Lightbox } from '../core/lightbox';
import { WikiData } from '../core/wiki-data';

@Component({
  selector: 'app-lightbox-view',
  imports: [RouterLink],
  host: { '(document:keydown.escape)': 'lightbox.close()' },
  template: `
    @if (img(); as im) {
      <div class="veil" (click)="lightbox.close()">
        <div class="inner" role="dialog" [attr.aria-label]="im.caption" (click)="$event.stopPropagation()">
          <button class="x" (click)="lightbox.close()" aria-label="Закрыть">×</button>
          <img [src]="im.src" [alt]="im.caption" />
          <p><b>{{ im.caption }}</b>@if (im.credit) {<span>{{ im.credit }}</span>}</p>
          @if (im.slugs.length) {
            <p class="arts">@for (s of im.slugs; track s) {<a [routerLink]="'/' + s" (click)="lightbox.close()">{{ data.title(s) }}</a>}</p>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .veil { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 16px; background: var(--veil); }
    .inner { position: relative; max-width: min(1100px, 100%); text-align: center; color: var(--veil-ink); font: var(--fs-ui)/1.4 var(--sans); }
    img { max-height: calc(100vh - 150px); background: #fff; }
    p { margin: 8px 0 0; } span { display: block; color: var(--veil-ink-2); font-style: italic; }
    .arts a { color: #9fd0f5; margin: 0 8px; }
    .x { position: absolute; top: -8px; right: -8px; width: 36px; height: 36px; border: 0; border-radius: 50%; background: rgba(255,255,255,.15); color: #fff; font-size: 22px; cursor: pointer; }
  `,
})
export class LightboxView {
  protected readonly lightbox = inject(Lightbox);
  protected readonly data = inject(WikiData);
  protected readonly img = computed(() => { const i = this.lightbox.current(); return i == null ? null : this.data.images()[i]; });
}
