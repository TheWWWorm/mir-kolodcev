import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WikiData } from '../../core/wiki-data';
import { FamilyTree } from '../../shared/family-tree';

@Component({
  selector: 'app-families-page',
  imports: [RouterLink, FamilyTree],
  template: `
    <div class="page">
      <div class="crumbs"><a routerLink="/">Заглавная</a></div>
      <h1 class="page-title">Родословные</h1>
      <p class="page-sub">Семейные древа по данным книг. ⚭ — брак; дети, рождённые вне брака, подписаны именем второго родителя. Ветви, чья связь с основной линией в книгах не названа, показаны отдельно.</p>
      <nav class="jump ui">@for (f of data.extra().families; track f.house; let i = $index) {<a href="/families" (click)="go($event, i)">{{ f.title }}</a>}</nav>
      @for (f of data.extra().families; track f.house; let i = $index) {
        <section [id]="'fam-' + i">
          <h2 class="section-title">{{ f.title }}@if (data.get(f.house)) { <a class="art ui" [routerLink]="'/' + f.house">статья о роде</a> }</h2>
          @if (f.note) { <p class="muted note">{{ f.note }}</p> }
          <app-family-tree [family]="f" />
        </section>
      }
    </div>
  `,
  styles: `
    .jump { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: var(--fs-ui); }
    .art { margin-left: 10px; font-size: var(--fs-ui); }
    .note { max-width: var(--measure); font-size: .98rem; }
    section { scroll-margin-top: calc(var(--anchor-gap) + 70px); }
  `,
})
export class FamiliesPage {
  protected readonly data = inject(WikiData);
  protected go(ev: Event, i: number): void {
    ev.preventDefault();
    document.getElementById('fam-' + i)?.scrollIntoView({ behavior: 'smooth' });
  }
}
