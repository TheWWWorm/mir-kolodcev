import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { WikiData } from '../../core/wiki-data';
import { Spoilers } from '../../core/spoilers';
import { SpoilerSelect } from '../../layout/spoiler-select';
import { SITE } from '../../core/site';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, SpoilerSelect],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class HomePage {
  protected readonly site = SITE;
  protected readonly home = SITE.home;
  protected readonly data = inject(WikiData);
  protected readonly spoilers = inject(Spoilers);
  private readonly router = inject(Router);
  protected readonly novels = computed(() =>
    this.data
      .books()
      .filter((b) => /Роман/.test(b.group))
      .slice(0, SITE.home.novels),
  );
  /** The box beside the novels: books of a group (interludes) or fixed links to articles. */
  protected readonly sideLinks = computed<[string, string][]>(() => {
    const side = SITE.home.side;
    if (!side.bookGroup) return side.links ?? [];
    return this.data
      .books()
      .filter((b) => b.group.includes(side.bookGroup!))
      .slice(0, side.count ?? 3)
      .map((b) => [b.slug, b.title]);
  });
  protected search(event: Event, query: string): void {
    event.preventDefault();
    if (query.trim()) this.router.navigate(['/search', query.trim()]);
  }
}
