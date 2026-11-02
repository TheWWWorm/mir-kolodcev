import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { WikiData } from '../../core/wiki-data';
import { SITE } from '../../core/site';

/** An answer gives points to several heroes at once, so no single answer points at one of them. */
interface Option { text: string; to: Record<string, number> }
interface Question { q: string; options: Option[] }
interface Result { slug: string; title?: string; text: string }
interface Persona { title: string; intro: string; questions: Question[]; results: Result[] }

const LAST_KEY = `${SITE.key}.persona-last`;

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

@Component({
  selector: 'app-persona-page',
  imports: [RouterLink],
  template: `
    <div class="page persona">
      <div class="crumbs"><a routerLink="/">Заглавная</a> · <a routerLink="/ispytaniya">Испытания</a></div>
      <h1 class="page-title">{{ p()?.title ?? 'Кто вы из героев?' }}</h1>
      @if (!p()) {
        <p class="muted" role="status">Загрузка вопросов…</p>
      } @else if (!started()) {
        <p class="page-sub">{{ p()!.intro }}</p>
        <p class="ui muted">{{ p()!.questions.length }} вопросов. Правильных ответов нет — выбирайте то, что ближе.</p>
        <button class="btn primary" (click)="start()">Начать</button>
        @if (last(); as l) {
          @if (hero(l); as h) {
            <p class="ui muted last">В прошлый раз вышло: <a [routerLink]="'/' + l">{{ h }}</a></p>
          }
        }
      } @else if (!finished()) {
        @let q = current();
        <div class="bar ui">
          <span>Вопрос {{ index() + 1 }} из {{ order().length }}</span>
          @if (index() > 0) { <button class="link" (click)="back()">← назад</button> }
        </div>
        <div class="progress"><span [style.width.%]="(index() / order().length) * 100"></span></div>
        <h2 class="question">{{ q.q }}</h2>
        <ol class="options">
          @for (o of q.options; track $index; let i = $index) {
            <li><button [class.picked]="picks()[index()] === i" (click)="pick(i)">{{ o.text }}</button></li>
          }
        </ol>
      } @else {
        @let r = ranking();
        @let w = r[0];
        <div class="verdict">
          @if (img(w.slug); as src) { <img [src]="src" alt="" /> }
          <div>
            <p class="ui muted">Вы — </p>
            <h2><a [routerLink]="'/' + w.slug">{{ w.title }}</a></h2>
            <p>{{ w.text }}</p>
          </div>
        </div>
        <h3>Ещё близки вам</h3>
        <ul class="near">
          @for (n of r.slice(1, 4); track n.slug) {
            <li><a [routerLink]="'/' + n.slug">{{ n.title }}</a> <span class="ui muted">{{ n.pct }}%</span></li>
          }
        </ul>
        <div class="actions">
          <button class="btn primary" (click)="start()">Пройти ещё раз</button>
          <a class="btn" routerLink="/ispytaniya">К испытаниям</a>
        </div>
      }
    </div>
  `,
  styles: `
    .persona { max-width: 52rem; }
    .last { margin-top: 14px; }
    .bar { display: flex; justify-content: space-between; gap: 12px; color: var(--ink-3); font-size: var(--fs-small); margin-top: 8px; }
    .link { background: none; border: 0; color: var(--azure); cursor: pointer; font: inherit; padding: 0; }
    .progress { height: 4px; background: var(--rule); border-radius: 2px; margin: 8px 0 22px; overflow: hidden; }
    .progress span { display: block; height: 100%; background: var(--azure); transition: width .2s; }
    .question { font: 500 1.4rem/1.35 var(--serif); margin: 0 0 18px; }
    .options { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
    .options button {
      width: 100%; text-align: left; padding: 12px 16px; border-radius: var(--radius-m);
      border: 1px solid var(--rule); background: var(--sheet); color: var(--ink); font: 1.02rem/1.4 var(--serif); cursor: pointer;
    }
    .options button:hover, .options button.picked { border-color: var(--azure-2); background: var(--sheet-2); }
    .verdict {
      display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap; padding: 24px; margin-top: 12px;
      background: var(--sheet-2); border: 1px solid var(--rule); border-radius: var(--radius-m);
    }
    .verdict img { width: 9rem; max-width: 100%; border-radius: var(--radius-m); object-fit: cover; }
    .verdict > div { flex: 1 1 18rem; }
    .verdict p.muted { margin: 0; }
    .verdict h2 { font: 500 1.8rem/1.25 var(--serif); margin: 2px 0 10px; }
    .verdict p:not(.muted) { font-size: 1.1rem; line-height: 1.6; margin: 0; }
    .near { padding-left: 1.2em; line-height: 1.8; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px; }
  `,
})
export class PersonaPage {
  private readonly data = inject(WikiData);
  protected readonly p = toSignal(inject(HttpClient).get<Persona>('data/persona.json'));

  protected readonly started = signal(false);
  protected readonly finished = signal(false);
  /** Questions in the order asked, each with its options shuffled. */
  protected readonly order = signal<Question[]>([]);
  protected readonly picks = signal<(number | null)[]>([]);
  protected readonly index = signal(0);
  protected readonly last = signal<string | null>(this.readLast());

  protected readonly current = computed(() => this.order()[this.index()]);

  protected readonly ranking = computed(() => {
    const p = this.p();
    if (!p) return [];
    const score: Record<string, number> = Object.fromEntries(p.results.map((r) => [r.slug, 0]));
    this.order().forEach((q, i) => {
      const k = this.picks()[i];
      if (k == null) return;
      for (const [slug, pts] of Object.entries(q.options[k].to)) if (slug in score) score[slug] += pts;
    });
    // a hero who gets points in few questions must not lose to one who gets them everywhere: compare shares
    const max: Record<string, number> = Object.fromEntries(p.results.map((r) => [r.slug, 0]));
    for (const q of p.questions)
      for (const slug of Object.keys(max)) max[slug] += Math.max(0, ...q.options.map((o) => o.to[slug] ?? 0));
    const share = (slug: string) => score[slug] / Math.max(1, max[slug]);
    const top = Math.max(1e-9, ...p.results.map((r) => share(r.slug)));
    // shuffling first breaks ties differently from one try to the next
    return shuffle(p.results)
      .map((r) => ({ ...r, title: r.title ?? this.hero(r.slug) ?? r.slug, share: share(r.slug) }))
      .sort((a, b) => b.share - a.share)
      .map((r) => ({ ...r, pct: Math.round((r.share / top) * 100) }));
  });

  protected hero(slug: string): string | undefined {
    return this.data.get(slug)?.title;
  }

  protected img(slug: string): string {
    return this.data.imageSrc(this.data.get(slug));
  }

  protected start(): void {
    const p = this.p();
    if (!p) return;
    this.order.set(p.questions.map((q) => ({ ...q, options: shuffle(q.options) })));
    this.picks.set(p.questions.map(() => null));
    this.index.set(0);
    this.finished.set(false);
    this.started.set(true);
    window.scrollTo(0, 0);
  }

  protected pick(i: number): void {
    this.picks.update((ps) => ps.map((v, n) => (n === this.index() ? i : v)));
    if (this.index() + 1 < this.order().length) {
      this.index.update((n) => n + 1);
      return;
    }
    this.finished.set(true);
    const w = this.ranking()[0]?.slug ?? null;
    this.last.set(w);
    try { if (w) localStorage.setItem(LAST_KEY, w); } catch { /* private mode */ }
    window.scrollTo(0, 0);
  }

  protected back(): void {
    this.index.update((n) => Math.max(0, n - 1));
  }

  private readLast(): string | null {
    try { return localStorage.getItem(LAST_KEY); } catch { return null; }
  }
}
