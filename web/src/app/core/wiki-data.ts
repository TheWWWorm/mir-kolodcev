import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ArticleBody, ArticleMeta, ArticleType, WikiExtra, WikiImage, WikiIndex } from './models';

/** Set while a failed article load has reloaded the page, so it happens once. */
const RELOADED = 'wiki.reloaded';
const mark = (on: boolean) => { try { if (on) sessionStorage.setItem(RELOADED, '1'); else sessionStorage.removeItem(RELOADED); } catch { /* storage blocked */ } };
const marked = () => { try { return !!sessionStorage.getItem(RELOADED); } catch { return true; } };

/** Loads the wiki index once at startup, article bodies on demand, search snippets and hero routes right after. */
@Injectable({ providedIn: 'root' })
export class WikiData {
  private readonly http = inject(HttpClient);
  private readonly bodies = new Map<string, Promise<ArticleBody>>();

  readonly articles = signal<ArticleMeta[]>([]);
  readonly images = signal<WikiImage[]>([]);
  /** Plain-text start of every article for full-text search; empty until data/search.json arrives. */
  readonly texts = signal<Record<string, string>>({});
  readonly extra = signal<WikiExtra>({ chapters: {}, families: [], houses: [], relations: [], map: { places: {}, events: [] } });

  readonly bySlug = computed(() => new Map(this.articles().map((a) => [a.slug, a])));
  readonly books = computed(() => this.articles().filter((a) => a.type === 'book').sort((a, b) => a.order - b.order));

  async load(): Promise<void> {
    const idx = await firstValueFrom(this.http.get<WikiIndex>('data/index.json'));
    this.articles.set(idx.articles);
    this.images.set(idx.images);
    this.extra.set(idx.data);
    // not needed for the first screen: fetch without holding up startup
    this.http.get<Record<string, string>>('data/search.json').subscribe((t) => this.texts.set(t));
    this.http.get<WikiExtra['routes']>('data/routes.json').subscribe((routes) => this.extra.update((x) => ({ ...x, routes })));
  }

  get(slug: string): ArticleMeta | undefined {
    return this.bySlug().get(slug);
  }

  title(slug: string): string {
    return this.get(slug)?.title ?? this.extra().map.places[slug]?.title ?? slug;
  }

  ofType(type: ArticleType): ArticleMeta[] {
    return this.articles().filter((a) => a.type === type);
  }

  body(slug: string): Promise<ArticleBody> {
    let p = this.bodies.get(slug);
    if (!p) {
      p = firstValueFrom(this.http.get<ArticleBody>(`data/a/${slug}.json`)).catch((e) => {
        this.bodies.delete(slug);
        // a tab still on the previous build asks for an article file that a new deploy has changed:
        // the service worker refuses it, and only a reload into the new build helps (once, so offline does not loop)
        if (navigator.onLine && !marked()) {
          mark(true);
          location.reload();
        }
        throw e;
      });
      p.then(() => mark(false), () => {});
      this.bodies.set(slug, p);
    }
    return p;
  }

  imageSrc(a: ArticleMeta | undefined): string {
    return a && a.image != null ? this.images()[a.image]?.src ?? '' : '';
  }
}
