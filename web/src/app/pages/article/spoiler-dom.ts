import { SITE } from '../../core/site';

/**
 * Folds article sections about books after `level` and blurs sections that are not tied to a book.
 * Headings carry data-book="<reading order>" (set by build.py when the heading names a book).
 */
export function applySpoilers(body: HTMLElement, level: number, bookTitle: (order: number) => string): void {
  let hideLevel = 0;
  let bucket: HTMLElement[] = [];
  let h2ok = false;
  let current = false;
  let hidden = 0;

  const fold = (book: number, heading: HTMLElement) => {
    const ph = document.createElement('div');
    ph.className = 'spoil-ph';
    ph.innerHTML = `<b></b><span></span><button class="btn" type="button">Показать</button>`;
    ph.querySelector('b')!.textContent = heading.textContent;
    ph.querySelector('span')!.textContent = `Скрыто: события ${SITE.spoilers.word.gen} ${bookTitle(book)}, которую вы ещё не прочитали.`;
    heading.before(ph);
    const items: HTMLElement[] = [];
    ph.querySelector('button')!.addEventListener('click', () => { items.forEach((x) => (x.hidden = false)); ph.remove(); });
    return items;
  };

  for (const el of Array.from(body.children) as HTMLElement[]) {
    const m = /^H([234])$/.exec(el.tagName);
    if (m) {
      const lvl = +m[1];
      const book = Number(el.dataset['book'] ?? 0);
      if (hideLevel && lvl > hideLevel) { el.hidden = true; bucket.push(el); continue; }
      hideLevel = 0;
      if (lvl === 2) { h2ok = book > 0 && book <= level; current = h2ok; } else current = book ? book <= level : h2ok;
      if (book > level) { hideLevel = lvl; bucket = fold(book, el); el.hidden = true; bucket.push(el); hidden++; }
      continue;
    }
    if (hideLevel) { el.hidden = true; bucket.push(el); continue; }
    if (!current) el.classList.add('spoil-blur');
  }

  const note = document.createElement('p');
  note.className = 'spoil-note';
  note.textContent = `Защита от спойлеров: ${hidden ? `${hidden} разд. о непрочитанных ${SITE.spoilers.word.prepPl} свёрнуто, ` : ''}общие разделы размыты. Нажмите на размытый текст, чтобы прочитать его.`;
  body.prepend(note);
}
