import { Component, computed, inject, signal } from '@angular/core';
import { SITE } from '../core/site';
import { WikiData } from '../core/wiki-data';

const KEY = `${SITE.key}.offline`;
/** Files the pages load besides the articles (the index itself is kept by the service worker from the start). */
const EXTRA = ['data/search.json', 'data/routes.json', 'data/quiz.json', 'data/changes.json'];
const PARALLEL = 6;

type Saved = '' | 'texts' | 'all';

/**
 * «Читать без сети»: loads every article (and, if asked, every illustration) once, so the service worker
 * keeps them and the whole wiki opens without a connection. Without it only the pages already visited are kept.
 * A new deploy refreshes what was kept; articles added since are fetched quietly on the next visit.
 */
@Component({
  selector: 'app-offline-save',
  template: `
    @if (supported) {
      <section class="offline" aria-labelledby="offline-title">
        <div class="group-title" id="offline-title">Без сети</div>
        @if (busy()) {
          <p class="note" role="status">
            Сохраняется: {{ done() }} из {{ total() }}
            <progress [value]="done()" [max]="total()"></progress>
          </p>
        } @else {
          @if (failed()) {
            <p class="note" role="alert">{{ failed() }}</p>
          }
          @if (saved() === '') {
            <button class="act" (click)="save(false)">Сохранить статьи для чтения без сети</button>
            <p class="note">Около {{ size() }}; иллюстрации можно добавить потом.</p>
          } @else {
            <p class="note">Статьи{{ saved() === 'all' ? ' и иллюстрации' : '' }} сохранены и открываются без сети.</p>
            @if (saved() === 'texts') {
              <button class="act" (click)="save(true)">Добавить иллюстрации</button>
            }
          }
        }
      </section>
    }
  `,
  styles: `
    .offline { margin: 22px 0 0; }
    .group-title { font-size: 0.6875rem; color: var(--side-ink-2); margin: 0 14px 8px; }
    .act {
      display: block; width: calc(100% - 4px); margin: 0 2px; padding: 10px 12px; min-height: 2.75rem;
      text-align: left; font: 0.875rem/1.35 var(--sans); color: var(--side-ink);
      background: none; border: 1px solid var(--side-rule); border-radius: 4px; cursor: pointer;
    }
    .act:hover { background: var(--side-2); }
    .note { font-size: 0.75rem; line-height: 1.5; color: var(--side-ink-2); margin: 6px 14px 0; }
    progress { display: block; width: 100%; margin-top: 6px; accent-color: var(--side-mark); }
  `,
})
export class OfflineSave {
  private readonly data = inject(WikiData);
  protected readonly supported = 'serviceWorker' in navigator && !!navigator.serviceWorker;
  protected readonly saved = signal<Saved>(read());
  protected readonly busy = signal(false);
  protected readonly done = signal(0);
  protected readonly total = signal(0);
  protected readonly failed = signal('');
  /** Rough size of the article files: the words of all articles, about 15 bytes each in the JSON (Cyrillic text plus markup). */
  protected readonly size = computed(() => {
    const mb = (this.data.articles().reduce((s, a) => s + a.words, 0) * 15) / 1e6;
    return mb < 1 ? 'одного мегабайта' : `${Math.round(mb)} МБ`;
  });

  constructor() {
    // what was saved before: fetch articles added since (the ones already kept come from the cache)
    const was = this.saved();
    if (this.supported && was) setTimeout(() => void this.run(was === 'all', true), 15000);
  }

  protected save(images: boolean): void {
    void this.run(images, false);
  }

  private async run(images: boolean, quiet: boolean): Promise<void> {
    if (this.busy()) return;
    this.failed.set('');
    if (!(await controlled())) {
      if (!quiet) this.failed.set('Сохранение пока недоступно: обновите страницу и попробуйте ещё раз.');
      return;
    }
    const urls = [...EXTRA, ...this.data.articles().map((a) => `data/a/${a.slug}.json`)];
    if (images) urls.push(...new Set(this.data.images().map((i) => i.src).filter(Boolean)));
    if (!quiet) {
      this.busy.set(true);
      this.done.set(0);
      this.total.set(urls.length);
    }
    let errors = 0, next = 0;
    const worker = async () => {
      while (next < urls.length) {
        const url = urls[next++];
        try {
          const r = await fetch(url);
          if (!r.ok && r.status !== 404) errors++;
          await r.arrayBuffer();
        } catch {
          errors++;
        }
        if (!quiet) this.done.update((n) => n + 1);
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    this.busy.set(false);
    if (quiet) return;
    if (errors) {
      this.failed.set(`Не удалось загрузить ${errors} из ${urls.length} файлов. Проверьте соединение и повторите.`);
      return;
    }
    const value: Saved = images ? 'all' : 'texts';
    this.saved.set(value);
    try { localStorage.setItem(KEY, value); } catch { /* private mode: still cached for this visit */ }
  }
}

function read(): Saved {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'texts' || v === 'all' ? v : '';
  } catch {
    return '';
  }
}

/**
 * The service worker is the one keeping the files, so it has to control the page first. It is registered
 * once the app settles (up to 30 s after the first visit) and takes over the open page right away.
 */
function controlled(): Promise<boolean> {
  const sw = navigator.serviceWorker;
  if (sw.controller) return Promise.resolve(true);
  return new Promise((done) => {
    const t = setTimeout(() => done(false), 35000);
    sw.addEventListener('controllerchange', () => { clearTimeout(t); done(true); }, { once: true });
  });
}
