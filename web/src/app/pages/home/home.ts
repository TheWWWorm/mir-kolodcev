import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { WikiData } from '../../core/wiki-data';
import { Spoilers } from '../../core/spoilers';
import { SpoilerSelect } from '../../layout/spoiler-select';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, SpoilerSelect],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class HomePage {
  protected readonly data = inject(WikiData);
  protected readonly spoilers = inject(Spoilers);
  private readonly router = inject(Router);
  protected readonly novels = computed(() =>
    this.data
      .books()
      .filter((b) => /Роман/.test(b.group))
      .slice(0, 1),
  );
  protected readonly worldLinks = [
    ['kolodets', 'Колодцы'],
    ['esfera', 'Эсферы'],
    ['braslet', 'Браслеты'],
    ['svitok', 'Свиток'],
  ];
  protected search(event: Event, query: string): void {
    event.preventDefault();
    if (query.trim()) this.router.navigate(['/search', query.trim()]);
  }
}
