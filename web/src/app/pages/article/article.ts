import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { byTitle, plural } from '../../core/format';
import { TYPE_LABELS } from '../../core/models';
import { Spoilers } from '../../core/spoilers';
import { WikiData } from '../../core/wiki-data';
import { ScrollMemory } from '../../core/scroll-memory';
import { ChapterTable } from '../../shared/chapter-table';
import { FamilyTree } from '../../shared/family-tree';
import { Figure } from '../../shared/figure';
import { HousesTable } from '../../shared/houses-table';
import { SpoilerSelect } from '../../layout/spoiler-select';
import { MiniMap } from '../../shared/mini-map';
import { applySpoilers } from './spoiler-dom';
import { SITE, pageTitle } from '../../core/site';

/** Infobox fields that hold stable facts rather than plot outcomes. */
const SAFE_ROW = /^(полное имя|имя|дом|род|род \(праматерь\)|родители|отец|мать|первое появление|тип|вид|что это|расположение|место|место действия|климат|экономика|столица|крупнейшие города|население|герб|девиз|цвета|народ|святыни|достопримечательности|дороги|соседи|внешность|возраст|номер в цикле|предыдущая книга|следующая книга|главные герои|дата|действие|хронология)$/i;
/** Words that give away a fate or a hidden truth. */
const FATE = /убит|убил|погиб|умер|умерл|казн[её]н|казнил|смерт|мёртв|мертв|гибел|отравл|свергн|призрак|на (самом )?деле|в действительности|по крови|урожд|втайне|тайн(ый|ая|ое|о|ые)\b|оказал|оказыва|позже|позднее|впоследствии|в итоге/i;
/** A small button at the end of every section heading of the article text: report a mistake in this section. */
function addReportButtons(body: HTMLElement): void {
  for (const h of Array.from(body.querySelectorAll('h2, h3'))) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'report';
    b.title = 'Сообщить об ошибке в этом разделе';
    b.setAttribute('aria-label', `Сообщить об ошибке в разделе «${h.textContent?.trim()}»`);
    h.append(b);
  }
}

/** The heading of the section an element is in: the nearest h2/h3 before it in the article text. */
function sectionOf(el: Element): Element | null {
  let n: Element | null = el.closest('.prose > *');
  while (n && !/^H[23]$/.test(n.tagName)) n = n.previousElementSibling;
  return n;
}

const headingText = (h: Element) => (h.textContent ?? '').trim();

const MONTH_STEMS = ['янв', 'фев', 'мар', 'апр', 'ма', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
/** A year of the cycle's era, optionally preceded by a month («ноября 1774»). */
const DATED = /(?:(январ|феврал|март|апрел|ма[йяе]|июн|июл|август|сентябр|октябр|ноябр|декабр)[а-я]*\s+)?(17[5-9]\d)/gi;

@Component({
  selector: 'app-article-page',
  imports: [RouterLink, Figure, ChapterTable, FamilyTree, HousesTable, MiniMap, SpoilerSelect],
  host: { '(window:resize)': 'updateCompact()' },
  templateUrl: './article.html',
  styleUrl: './article.css',
})
export class ArticlePage {
  protected readonly site = SITE;
  protected readonly compact = signal(matchMedia('(max-width: 700px)').matches);
  protected updateCompact(): void {
    this.compact.set(matchMedia('(max-width: 700px)').matches);
  }
  readonly slug = input.required<string>();
  readonly anchor = input<string>();

  protected readonly data = inject(WikiData);
  protected readonly spoilers = inject(Spoilers);
  private readonly titleSvc = inject(Title);
  private readonly scrollMemory = inject(ScrollMemory);
  protected readonly types = TYPE_LABELS;

  protected readonly meta = computed(() => this.data.get(this.slug()));
  protected readonly body = resource({
    params: () => this.meta()?.slug,
    loader: ({ params }) => this.data.body(params),
  });
  protected readonly articleBody = computed(() =>
    this.body.hasValue() ? this.body.value() : undefined,
  );
  protected readonly chapters = computed(() => this.data.extra().chapters[this.slug()] ?? []);
  /** A book with a chapter table gets the book layout; one without (a special edition) reads as a plain article. */
  protected readonly bookView = computed(() => this.meta()?.type === 'book' && this.chapters().length > 0);
  protected readonly chapterCount = computed(
    () => this.chapters().length + ' ' + plural(this.chapters().length, 'глава', 'главы', 'глав'),
  );
  protected readonly nextBook = computed(() => {
    const books = this.data.books(),
      index = books.findIndex((b) => b.slug === this.slug());
    return index >= 0 ? books[index + 1] : undefined;
  });
  protected readonly bookPlaces = computed(() => [
    ...new Set(
      this.chapters()
        .map((c) => c.key)
        .filter((k) => !!this.data.extra().map.places[k]),
    ),
  ]);
  protected readonly narrators = computed(() =>
    [
      ...new Set(
        this.chapters()
          .map((c) => c.pov)
          .filter(Boolean),
      ),
    ].map((slug) => ({
      slug,
      title: this.data.title(slug),
      chapter:
        this.chapters()
          .find((c) => c.pov === slug)
          ?.h.replace(/^Глава\s+[^.]+\.\s*/, '') ?? '',
    })),
  );
  protected readonly bookYear = computed(() => {
    const dates = this.chapters()
      .map((c) => c.iso)
      .filter(Boolean)
      .sort();
    if (!dates.length) return '';
    const first = dates[0].slice(0, 4),
      last = dates.at(-1)!.slice(0, 4);
    return first === last ? first + ' год' : first + '–' + last + ' годы';
  });
  protected readonly lead = computed(() => this.meta()?.image ?? null);
  protected readonly bookChips = computed(() =>
    (this.meta()?.books ?? [])
      .filter((b) => b !== this.slug() && this.data.get(b))
      .map((b) => this.data.get(b)!),
  );
  protected readonly backlinks = computed(() =>
    (this.meta()?.backlinks ?? [])
      .map((s) => this.data.get(s)!)
      .filter(Boolean)
      .sort(byTitle),
  );
  protected readonly families = computed(() =>
    this.data.extra().families.filter((f) => f.house === this.slug()),
  );
  protected readonly onMap = computed(() => !!this.data.extra().map.places[this.slug()]);
  /** The place itself plus its neighbours that have articles, so the crop shows where it lies. */
  protected readonly mapKeys = computed(() => {
    const places = this.data.extra().map.places,
      me = places[this.slug()];
    if (!me) return [];
    const near = Object.entries(places).filter(
      ([k, p]) =>
        k !== this.slug() &&
        p.kind !== 'land' &&
        this.data.get(k) &&
        Math.hypot(p.x - me.x, (p.y - me.y) * 0.75) < 9,
    );
    return [this.slug(), ...near.map(([k]) => k)];
  });
  protected readonly hasRelations = computed(() =>
    this.data.extra().relations.some((r) => r.a === this.slug() || r.b === this.slug()),
  );
  protected readonly toc = computed(() => {
    const t = [...(this.articleBody()?.toc ?? [])];
    if (this.data.extra().chapters[this.slug()]?.length) t.push(['h-glavy', 'Главы']);
    if (this.families().length) t.push(['h-rod', 'Родословное древо']);
    return t;
  });

  private readonly content = viewChild<ElementRef<HTMLElement>>('content');

  constructor() {
    effect(() => {
      const m = this.meta();
      this.titleSvc.setTitle(pageTitle(m ? m.title : 'Статья не найдена'));
    });
    // The body HTML is produced by build.py from our own markdown, so it is inserted as-is and then
    // post-processed: sections about unread books are folded, general sections are blurred.
    effect(() => {
      const el = this.content()?.nativeElement;
      const b = this.articleBody();
      const m = this.meta();
      const level = this.spoilers.level();
      if (!el || !b || !m) return;
      el.innerHTML = b.html;
      if (this.spoilers.partly(m)) applySpoilers(el, level, (o) => this.spoilers.bookTitle(o));
      if (SITE.issues) addReportButtons(el);
    });
    // Jump to /slug/anchor once the body is in place: smoothly within the article already on screen,
    // at once when arriving from elsewhere. A heading inside a folded spoiler section lands on the fold.
    let shown = '';
    let fallback: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const a = this.anchor(), b = this.articleBody(), slug = this.slug();
      this.spoilers.level();
      if (!b) return;
      const smooth = shown === slug;
      shown = slug;
      // back/forward to a section returns to where the reader was, not to the section's heading
      if (!a || this.scrollMemory.restoring) return;
      queueMicrotask(() => {
        const t = document.getElementById(a);
        const el = t?.closest('details:not([open])') ?? t;
        if (!el) return;
        clearTimeout(fallback);
        const y0 = scrollY;
        el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
        // only the latest click counts; and where smooth scrolling never started (a background tab),
        // finish the jump directly. A scroll that moved, by the animation or by the reader, is left alone.
        if (smooth) fallback = setTimeout(() => { if (Math.abs(scrollY - y0) < 2) el.scrollIntoView(); }, 1000);
      });
    });
  }

  protected tocLink(anchor: string): string {
    return `/${this.slug()}/${anchor}`;
  }

  /**
   * In an article that reaches past the reader's book, an infobox row stays readable only if its field
   * is a stable fact (name, house, place...) and its value names no later date, no death and no unread book.
   */
  protected blurInfo(key: string, value = ''): boolean {
    if (!this.spoilers.partly(this.meta())) return false;
    if (!SAFE_ROW.test(key.trim())) return true;
    const text = key + ' ' + value.replace(/<[^>]+>/g, '');
    if (FATE.test(text)) return true;
    const cut = this.spoilers.cutoff(), cy = +cut.slice(0, 4), cm = +cut.slice(5, 7) || 12;
    for (const [, mon, y] of text.matchAll(DATED)) {
      const m = mon ? MONTH_STEMS.findIndex((st) => mon.toLowerCase().startsWith(st)) + 1 : 1;
      if (+y > cy || (+y === cy && m > cm)) return true;
    }
    return this.unreadTitles().some((re) => re.test(text));
  }
  /** Unread book titles as stem patterns, so «Лишь одной Звезды» matches «Лишь одна звезда». */
  private readonly unreadTitles = computed(() =>
    this.data.books().filter((b) => !this.spoilers.bookVisible(b.order)).map((b) => {
      const words = b.title.toLowerCase().match(/[а-яё]{3,}/g) ?? [b.title.toLowerCase()];
      return new RegExp(words.map((w) => w.slice(0, Math.max(3, w.length - 2))).join('[а-яё]*[\\s,]+(?:[а-яё]{1,2}[\\s,]+)?'), 'i');
    }),
  );

  /** Text the reader selected in the article, caught before a click on a report button can clear it. */
  private selected = '';
  private selectedIn: Element | null = null;

  protected noteSelection(): void {
    const sel = getSelection();
    const text = sel?.toString().trim() ?? '';
    const node = sel?.rangeCount ? sel.getRangeAt(0).startContainer : null;
    const inside = !!node && !!this.content()?.nativeElement.contains(node);
    this.selected = inside ? text : '';
    this.selectedIn = inside ? (node instanceof Element ? node : node!.parentElement) : null;
  }

  /** A report button next to a section heading in the article text (delegated: the text is plain HTML). */
  protected bodyDown(ev: PointerEvent): void {
    if ((ev.target as Element | null)?.closest?.('button.report')) this.noteSelection();
  }

  protected bodyClick(ev: MouseEvent): void {
    const btn = (ev.target as Element | null)?.closest?.('button.report');
    if (!btn) return;
    this.report(btn.closest('h2, h3'));
  }

  /**
   * Opens a new issue in the wiki's public repository, filled in with the article, the section and the
   * selected words if the reader marked any. The section is the one of the button, or the one the selection is in.
   */
  protected report(heading?: Element | null): void {
    const m = this.meta();
    if (!m || !SITE.issues) return;
    // from the keyboard there was no press to catch the selection: it is still in place
    if (getSelection()?.toString().trim()) this.noteSelection();
    heading ??= this.selectedIn ? sectionOf(this.selectedIn) : null;
    const section = heading ? headingText(heading) : '';
    const url = SITE.url + '/' + m.slug + (heading?.id ? '/' + heading.id : '');
    const quote = this.selected.length > 600 ? this.selected.slice(0, 600) + '…' : this.selected;
    const body = [
      `**Статья:** [${m.title}](${url})`,
      section ? `**Раздел:** ${section}` : '',
      quote ? `\n**Фрагмент:**\n${quote.split('\n').map((l) => '> ' + l).join('\n')}` : '',
      '\n**Что не так и как правильно** (если можно — со ссылкой на книгу и главу):\n\n',
    ].filter(Boolean).join('\n');
    const title = `Ошибка: ${m.title}${section ? ' — ' + section : ''}`;
    window.open(`${SITE.issues}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`, '_blank', 'noopener');
    this.selected = '';
    this.selectedIn = null;
  }

  protected unblur(ev: Event): void {
    (ev.currentTarget as HTMLElement).classList.remove('spoil-blur');
  }

}
