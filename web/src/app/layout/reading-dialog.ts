import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { ALL_BOOKS, Spoilers } from '../core/spoilers';
import { WikiData } from '../core/wiki-data';
import { SITE } from '../core/site';

/** First visit: ask which book the reader has finished, so spoilers are hidden from the start. */
@Component({
  selector: 'app-reading-dialog',
  template: `
    <dialog #dlg aria-labelledby="reading-title" (cancel)="pick(all)">
      <button type="button" class="x" (click)="pick(all)" [attr.aria-label]="'Закрыть — показывать весь ' + site.work.acc" title="Закрыть">×</button>
      <h2 id="reading-title">{{ site.spoilers.question }}</h2>
      <p>Вики скроет события и персонажей из {{ site.spoilers.word.genPl }}, до которых вы ещё не добрались. Выбор можно изменить в любой момент в поле «Прочитано до» вверху страницы.</p>
      <button type="button" class="all" (click)="pick(all)">Прочитал всё — показывать весь {{ site.work.acc }}</button>
      <ol>
        @for (b of spoilers.parts(); track b.order) {
          <li>
            <button type="button" (click)="pick(b.order)">
              <span class="n">{{ b.order }}</span>{{ b.title }}
            </button>
          </li>
        }
      </ol>
    </dialog>
  `,
  styles: `
    dialog {
      width: min(560px, calc(100vw - 24px));
      max-height: calc(100dvh - 24px);
      padding: 24px;
      border: 1px solid var(--rule);
      border-radius: 8px;
      background: var(--sheet);
      color: var(--ink);
      font: var(--fs-ui)/1.45 var(--sans);
      overflow-y: auto;
    }
    dialog::backdrop {
      background: var(--backdrop);
    }
    h2 {
      margin: 0 0 8px;
      font: 400 1.6rem/1.2 var(--serif);
    }
    p {
      margin: 0 0 16px;
      color: var(--ink-2);
    }
    ol {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 6px;
    }
    li {
      display: flex;
    }
    li button {
      width: 100%;
      height: 100%;
      min-height: 44px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 10px 6px 8px;
      border: 1px solid var(--rule);
      border-radius: 5px;
      background: var(--sheet-2);
      color: var(--ink);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    li button:hover,
    li button:focus-visible {
      border-color: var(--azure-2);
    }
    .n {
      flex: none;
      width: 26px;
      height: 26px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--sheet);
      color: var(--ink-3);
      font-size: var(--fs-small);
    }
    dialog {
      position: fixed;
    }
    .x {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 40px;
      height: 40px;
      border: 0;
      border-radius: 50%;
      background: var(--sheet-2);
      color: var(--ink);
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
    }
    .x:hover {
      background: var(--rule);
    }
    h2 {
      padding-right: 40px;
    }
    .all {
      width: 100%;
      min-height: 48px;
      margin-bottom: 20px;
      border: 0;
      border-radius: 5px;
      background: #b3262e;
      color: #fff;
      font: 600 0.95rem/1.3 var(--sans);
      cursor: pointer;
    }
    .all:hover,
    .all:focus-visible {
      background: #cf2f38;
    }
    @media (max-width: 520px) {
      dialog {
        padding: 18px 16px;
      }
      h2 {
        font-size: 1.35rem;
      }
      ol {
        grid-template-columns: 1fr 1fr;
      }
      li button {
        gap: 6px;
        padding: 6px;
        font-size: 0.8rem;
        line-height: 1.25;
      }
      .n {
        width: 20px;
        height: 20px;
        font-size: 0.68rem;
      }
    }
  `,
})
export class ReadingDialog {
  protected readonly site = SITE;
  protected readonly data = inject(WikiData);
  private readonly spoilers = inject(Spoilers);
  protected readonly all = ALL_BOOKS;
  private readonly dlg = viewChild<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    effect(() => {
      const d = this.dlg()?.nativeElement;
      if (d && !this.spoilers.chosen() && this.spoilers.parts().length && !d.open) d.showModal();
    });
  }

  protected pick(order: number): void {
    this.spoilers.setLevel(order);
    this.dlg()?.nativeElement.close();
  }
}
