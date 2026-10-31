export type ArticleType = 'book' | 'character' | 'house' | 'place' | 'event' | 'concept';

/** Light article record from data/index.json (enough for lists, cards and search). */
export interface ArticleMeta {
  slug: string;
  type: ArticleType;
  title: string;
  ru: string;
  aliases: string[];
  summary: string;
  books: string[];
  order: number;
  group: string;
  words: number;
  backlinks: string[];
  /** Reading order of the first and last book the entity appears in (spoiler filter). */
  first: number;
  last: number;
  image: number | null;
  /** Free-form date from the infobox («2 декабря 1775 г.») and its sortable start, when the article has one. */
  when?: string;
  iso?: string;
  /** Books: in-world start and end of the story («1774-03-21», «1774-08»). */
  span?: [string, string];
}

/** Heavy part of an article, loaded on demand from data/a/<slug>.json. */
export interface ArticleBody {
  html: string;
  toc: [string, string][];
  infobox: [string, string][];
  links: string[];
  gallery: number[];
}

export interface WikiImage {
  src: string;
  caption: string;
  credit: string;
  slugs: string[];
}

export interface Chapter {
  n: string;
  h: string;
  pov: string;
  date: string;
  iso: string;
  place: string;
  key: string;
  sum: string;
}

export interface FamilyPerson {
  id: string;
  name: string;
  slug: string;
  spouses: string[];
  parents: string[];
  note: string;
}

export interface Family {
  house: string;
  title: string;
  note: string;
  people: FamilyPerson[];
}

export interface HouseRow {
  slug: string;
  capital: string;
  government: string;
  army: string;
  ending: string;
  society: string;
  color: string;
  notes: string;
}

export interface Relation {
  a: string;
  b: string;
  /** relation type: родня, супруги, любовь, союз, служба, вражда, наставник */
  t: string;
  /** label read as "a is <l> of b" */
  l: string;
  /** reading order of the book where it becomes known */
  o: number;
}

export interface MapPlace {
  x: number;
  y: number;
  kind: 'city' | 'land' | 'site';
  title?: string;
}

export interface MapEvent {
  d: string;
  label: string;
  p: string;
  t: string;
  s?: string[];
  /** Event article that tells this event in full (the chronology shows the article instead). */
  a?: string;
}

export interface WikiExtra {
  chapters: Record<string, Chapter[]>;
  families: Family[];
  houses: HouseRow[];
  relations: Relation[];
  /** Hand-made routes: a hero's stops in order, each tied to a book and possibly a chapter. */
  routes?: Record<string, (Chapter & { book: string })[]>;
  map: { places: Record<string, MapPlace>; events: MapEvent[] };
}

export interface WikiIndex {
  articles: ArticleMeta[];
  images: WikiImage[];
  data: WikiExtra;
}

export const TYPE_LABELS: Record<ArticleType, { one: string; many: string; about: string }> = {
  book: { one: 'Книга', many: 'Книги', about: 'Книги о мире колодцев.' },
  character: { one: 'Персонаж', many: 'Персонажи', about: 'Люди мира колодцев — от писателей и солдат до генералов и каторжников.' },
  house: { one: 'Страна', many: 'Страны и сообщества', about: 'Государства, армии, рода и сообщества мира колодцев.' },
  place: { one: 'Место', many: 'Места', about: 'Страны, города, крепости и реки мира колодцев.' },
  event: { one: 'Событие', many: 'События', about: 'Войны, сражения, заговоры и поворотные моменты.' },
  concept: { one: 'Понятие', many: 'Понятия и мир', about: 'Колодцы, эсферы, браслеты, техника, обычаи и устройство мира.' },
};
