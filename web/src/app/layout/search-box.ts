import { Component, ElementRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TYPE_LABELS } from '../core/models';
import { Search } from '../core/search';

@Component({
  selector: 'app-search-box',
  host: { '(document:click)': 'outside($event)', '(document:keydown./)': 'focusKey($event)' },
  template: `
    <div class="box">
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" /><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
      <input #q type="search" placeholder="Поиск: имя, прозвище, место" autocomplete="off" aria-label="Поиск по вики"
        [value]="query()" (input)="query.set(q.value); open.set(true); active.set(-1)" (focus)="open.set(true)" (keydown)="key($event)" />
    </div>
    @if (open() && query().trim()) {
      <ul class="suggest" role="listbox">
        @for (r of results(); track r.slug; let i = $index) {
          <li [class.on]="i === active()"><a [href]="'/' + r.slug" (click)="open.set(false)"><b>{{ r.title }}</b><span>{{ types[r.type].one }}</span></a></li>
        }
        <li class="all" [class.on]="active() === results().length"><a [href]="'/search/' + enc(query().trim())" (click)="open.set(false)">
          {{ results().length ? 'Все результаты' : 'Искать в тексте статей' }}: «{{ query().trim() }}»</a></li>
      </ul>
    }
  `,
  styleUrl: './search-box.css',
})
export class SearchBox {
  private readonly search = inject(Search);
  private readonly router = inject(Router);
  private readonly el = inject(ElementRef<HTMLElement>);
  protected readonly types = TYPE_LABELS;
  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly active = signal(-1);
  protected readonly results = computed(() => this.search.find(this.query(), 8));
  protected readonly enc = encodeURIComponent;

  protected key(ev: KeyboardEvent): void {
    const n = this.results().length + 1;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.active.set((this.active() + (ev.key === 'ArrowDown' ? 1 : -1) + n) % n);
    } else if (ev.key === 'Enter') {
      const r = this.results()[this.active()];
      this.router.navigateByUrl(r ? '/' + r.slug : '/search/' + encodeURIComponent(this.query().trim()));
      this.open.set(false);
      (ev.target as HTMLInputElement).blur();
    } else if (ev.key === 'Escape') this.open.set(false);
  }

  protected outside(ev: Event): void {
    if (!this.el.nativeElement.contains(ev.target as Node)) this.open.set(false);
  }

  protected focusKey(ev: Event): void {
    const t = ev.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
    ev.preventDefault();
    this.el.nativeElement.querySelector('input')?.focus();
  }
}
