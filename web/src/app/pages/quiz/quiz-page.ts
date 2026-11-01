import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { WikiData } from '../../core/wiki-data';
import { SITE } from '../../core/site';

interface Question { q: string; options: string[]; answer: number; explain: string; slug: string }
interface Grade { min: number; title: string; text: string }
interface Level { id: string; title: string; intro: string; questions: Question[]; grades: Grade[] }
/** A question as asked: options shuffled, `answer` points into the shuffled list. */
interface Asked extends Question { picked: number | null }

const PER_TEST = 15;
const BEST_KEY = `${SITE.key}.quiz-best`;

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function readBest(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}'); } catch { return {}; }
}

@Component({
  selector: 'app-quiz-page',
  imports: [RouterLink],
  template: `
    <div class="page quiz">
      <div class="crumbs"><a routerLink="/">Заглавная</a></div>
      <h1 class="page-title">Испытания</h1>
      @if (!level()) {
        <p class="page-sub">Проверьте, насколько хорошо вы знаете {{ site.quiz.subject }}. В каждом испытании {{ perTest }} вопросов, выбранных наугад, и в конце — вердикт.</p>
        <p class="warn ui">Вопросы касаются всего {{ site.work.gen }} и могут раскрывать сюжет.</p>
        @if (levels().length) {
          <div class="levels">
            @for (l of levels(); track l.id; let i = $index) {
              <button class="level" (click)="start(l)">
                <span class="tier ui">{{ tiers[i] ?? '' }}</span>
                <b>{{ l.title }}</b>
                <span>{{ l.intro }}</span>
                @if (best()[l.id] !== undefined) {
                  <span class="best ui">Лучший результат: {{ best()[l.id] }} из {{ perTest }}</span>
                }
              </button>
            }
          </div>
        } @else {
          <p class="muted" role="status">Загрузка вопросов…</p>
        }
      } @else if (!finished()) {
        @let q = current();
        <div class="bar ui">
          <span>{{ level()!.title }}</span>
          <span>Вопрос {{ index() + 1 }} из {{ asked().length }} · верно: {{ score() }}</span>
        </div>
        <div class="progress"><span [style.width.%]="(index() / asked().length) * 100"></span></div>
        <h2 class="question">{{ q.q }}</h2>
        <ol class="options">
          @for (o of q.options; track $index; let i = $index) {
            <li>
              <button
                [disabled]="q.picked !== null"
                [class.right]="q.picked !== null && i === q.answer"
                [class.wrong]="q.picked === i && i !== q.answer"
                (click)="pick(i)"
              >{{ o }}</button>
            </li>
          }
        </ol>
        @if (q.picked !== null) {
          <div class="explain" [class.ok]="q.picked === q.answer">
            <b>{{ q.picked === q.answer ? 'Верно!' : 'Неверно.' }}</b> {{ q.explain }}
            @if (title(q.slug); as t) {
              <a class="ui" [routerLink]="'/' + q.slug">Подробнее: {{ t }}</a>
            }
          </div>
          <button class="btn primary next" (click)="next()">{{ index() + 1 < asked().length ? 'Следующий вопрос' : 'Узнать вердикт' }}</button>
        }
      } @else {
        @let g = grade();
        <div class="verdict">
          <p class="ui muted">{{ level()!.title }} · {{ score() }} из {{ asked().length }}</p>
          <h2>{{ g?.title }}</h2>
          <p>{{ g?.text }}</p>
          <div class="actions">
            <button class="btn primary" (click)="start(level()!)">Пройти ещё раз</button>
            <button class="btn" (click)="level.set(null)">К выбору испытания</button>
          </div>
        </div>
        <h3 class="review-title">Разбор</h3>
        <ol class="review">
          @for (r of asked(); track $index) {
            <li [class.ok]="r.picked === r.answer">
              <b>{{ r.q }}</b>
              <span>
                {{ r.picked === r.answer ? '✓' : '✗ ваш ответ: ' + r.options[r.picked ?? 0] + ' ·' }}
                верно: {{ r.options[r.answer] }}
              </span>
            </li>
          }
        </ol>
      }
    </div>
  `,
  styles: `
    .quiz { max-width: 52rem; }
    .warn { color: var(--ink-3); margin-top: -6px; }
    .levels { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 14px; margin-top: 22px; }
    .level {
      display: flex; flex-direction: column; gap: 8px; text-align: left; padding: 18px;
      background: var(--sheet-2); border: 1px solid var(--rule); border-radius: var(--radius-m); color: var(--ink); cursor: pointer;
      font: 1rem/1.45 var(--serif);
    }
    .level:hover { border-color: var(--azure-2); }
    .level b { font-size: 1.25rem; font-weight: 500; }
    .level span { color: var(--ink-2); }
    .tier { font-size: var(--fs-small); text-transform: uppercase; letter-spacing: .06em; color: var(--ink-3) !important; }
    .best { font-size: var(--fs-small); color: var(--azure) !important; }
    .bar { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; color: var(--ink-3); font-size: var(--fs-small); margin-top: 8px; }
    .progress { height: 4px; background: var(--rule); border-radius: 2px; margin: 8px 0 22px; overflow: hidden; }
    .progress span { display: block; height: 100%; background: var(--azure); transition: width .2s; }
    .question { font: 500 1.4rem/1.35 var(--serif); margin: 0 0 18px; }
    .options { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
    .options button {
      width: 100%; text-align: left; padding: 12px 16px; border-radius: var(--radius-m);
      border: 1px solid var(--rule); background: var(--sheet); color: var(--ink); font: 1.02rem/1.4 var(--serif); cursor: pointer;
    }
    .options button:not(:disabled):hover { border-color: var(--azure-2); background: var(--sheet-2); }
    .options button:disabled { cursor: default; }
    .options button.right { border-color: #3f9a5c; background: color-mix(in srgb, #3f9a5c 16%, var(--sheet)); }
    .options button.wrong { border-color: #c0504d; background: color-mix(in srgb, #c0504d 16%, var(--sheet)); }
    .explain { margin-top: 18px; padding: 14px 16px; border-left: 3px solid #c0504d; background: var(--sheet-2); line-height: 1.55; }
    .explain.ok { border-left-color: #3f9a5c; }
    .explain a { display: block; margin-top: 8px; font-size: var(--fs-ui); }
    .next { margin-top: 18px; }
    .verdict { padding: 24px; margin-top: 12px; background: var(--sheet-2); border: 1px solid var(--rule); border-radius: var(--radius-m); }
    .verdict h2 { font: 500 1.8rem/1.25 var(--serif); margin: 4px 0 10px; }
    .verdict p:not(.muted) { font-size: 1.1rem; line-height: 1.6; margin: 0; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px; }
    .review-title { margin-top: 32px; }
    .review { padding-left: 1.4em; display: grid; gap: 10px; }
    .review li span { display: block; color: #c0504d; font: var(--fs-small)/1.4 var(--sans); margin-top: 2px; }
    .review li.ok span { color: #3f9a5c; }
  `,
})
export class QuizPage {
  protected readonly site = SITE;
  private readonly data = inject(WikiData);
  private readonly quiz = toSignal(inject(HttpClient).get<{ levels: Level[] }>('data/quiz.json'));
  protected readonly levels = computed(() => this.quiz()?.levels ?? []);
  protected readonly perTest = PER_TEST;
  protected readonly tiers = ['Лёгкое', 'Среднее', 'Трудное'];

  protected readonly level = signal<Level | null>(null);
  protected readonly asked = signal<Asked[]>([]);
  protected readonly index = signal(0);
  protected readonly finished = signal(false);
  protected readonly best = signal(readBest());

  protected readonly current = computed(() => this.asked()[this.index()]);
  protected readonly score = computed(() => this.asked().filter((q) => q.picked !== null && q.picked === q.answer).length);
  protected readonly grade = computed(() => {
    const s = this.score();
    return [...(this.level()?.grades ?? [])].sort((a, b) => b.min - a.min).find((g) => s >= g.min);
  });

  protected title(slug: string): string | undefined {
    return this.data.get(slug)?.title;
  }

  protected start(l: Level): void {
    this.asked.set(shuffle(l.questions).slice(0, PER_TEST).map((q) => {
      const order = shuffle(q.options.map((_, i) => i));
      return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer), picked: null };
    }));
    this.index.set(0);
    this.finished.set(false);
    this.level.set(l);
    window.scrollTo(0, 0);
  }

  protected pick(i: number): void {
    this.asked.update((qs) => qs.map((q, n) => (n === this.index() ? { ...q, picked: i } : q)));
  }

  protected next(): void {
    if (this.index() + 1 < this.asked().length) {
      this.index.update((i) => i + 1);
      return;
    }
    this.finished.set(true);
    const id = this.level()!.id;
    if (this.score() > (this.best()[id] ?? -1)) {
      this.best.update((b) => ({ ...b, [id]: this.score() }));
      try { localStorage.setItem(BEST_KEY, JSON.stringify(this.best())); } catch { /* private mode */ }
    }
    window.scrollTo(0, 0);
  }
}
