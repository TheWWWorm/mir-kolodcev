import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SITE } from '../core/site';
import { WikiData } from '../core/wiki-data';

const W0 = SITE.map.w, H0 = SITE.map.h;

/** A crop of the world map framing the given places, with clickable pins. */
@Component({
  selector: 'app-mini-map',
  imports: [RouterLink],
  template: `
    @if (box(); as b) {
      <div class="mm" [style.aspect-ratio]="b.ratio">
        <img [src]="mapImage" alt="" loading="lazy" [style.width.%]="10000 / b.w" [style.left.%]="(-b.x / b.w) * 100" [style.top.%]="(-b.y / b.h) * 100" />
        @for (p of pins(); track p.k) {
          <a class="pin" [class.on]="p.k === focus()" [class.land]="p.kind === 'land'" [routerLink]="'/' + p.k" [attr.aria-label]="p.title"
            [style.left.%]="((p.x - b.x) / b.w) * 100" [style.top.%]="((p.y - b.y) / b.h) * 100"><i></i>@if (labels()) {<span>{{ p.title }}</span>}</a>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .mm { position: relative; overflow: hidden; background: var(--map-bg); }
    img { position: absolute; max-width: none; height: auto; filter: saturate(.85); }
    .pin { position: absolute; transform: translate(-50%, -50%); display: flex; align-items: center; z-index: 1; }
    .pin i { width: 9px; height: 9px; border-radius: 50%; background: var(--wax); border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .5); }
    .pin.land i { border-radius: 2px; background: #24527a; }
    .pin.on i { width: 14px; height: 14px; background: var(--spark); box-shadow: 0 0 0 5px var(--spark-glow); }
    .pin span { position: absolute; left: 12px; padding: 0 5px; white-space: nowrap; background: rgba(248, 249, 245, .92); color: var(--map-ink); font: 500 11.5px/1.5 var(--sans); }
    .pin:hover { text-decoration: none; z-index: 2; }
    .pin:hover span { background: #fff; }
  `,
})
export class MiniMap {
  protected readonly mapImage = SITE.map.image;
  /** Place keys (article slugs or map-only keys) to frame. */
  readonly keys = input.required<string[]>();
  readonly focus = input('');
  readonly labels = input(true);
  /** Minimum frame size in map percent, so a lone place still shows its surroundings. */
  readonly minSpan = input(16);
  private readonly data = inject(WikiData);

  protected readonly pins = computed(() => {
    const places = this.data.extra().map.places;
    return this.keys().filter((k) => places[k]).map((k) => ({ k, ...places[k], title: this.data.title(k) }));
  });

  protected readonly box = computed(() => {
    const ps = this.pins();
    if (!ps.length) return null;
    const xs = ps.map((p) => p.x), ys = ps.map((p) => p.y), min = this.minSpan();
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    let w = Math.max(x1 - x0, min) * 1.3, h = Math.max(y1 - y0, min) * 1.3;
    // keep the frame between portrait 4:5 and landscape 2:1 (in pixels)
    const px = (w * W0) / (h * H0);
    if (px > 2) h = (w * W0) / (2 * H0);
    if (px < 0.8) w = (0.8 * h * H0) / W0;
    w = Math.min(w, 100); h = Math.min(h, 100);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const x = Math.max(0, Math.min(100 - w, cx - w / 2)), y = Math.max(0, Math.min(100 - h, cy - h / 2));
    return { x, y, w, h, ratio: `${w * W0} / ${h * H0}` };
  });
}
