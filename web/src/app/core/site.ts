import RAW from '../../site.json';

/**
 * Everything that differs between the wikis built on this engine: names, texts, spoiler units,
 * navigation. Each site keeps its own src/site.json (scripts/pages.mjs and build.py read it too).
 */
export interface SiteConfig {
  url: string;
  /** Full name, used in page titles: «Статья · {name}». */
  name: string;
  /** Short name in the header. */
  brand: string;
  brandIcon: 'star' | 'rings';
  /** Prefix of localStorage keys. */
  key: string;
  about: string;
  /** The whole work, as in «весь цикл», «прочитали цикл», «вопросы касаются всего цикла». */
  work: { acc: string; gen: string };
  spoilers: {
    /** books: the reader picks a book; chapters: the wiki covers one novel and counts its chapters. */
    unit: 'books' | 'chapters';
    word: { gen: string; prep: string; genPl: string; prepPl: string; acc: string };
    question: string;
    /** Option of «Прочитано до»: {n} is the number, {title} the title. */
    option: string;
    /** books: events before cycleStart are told in later books; revealedIn maps their dates to that book. */
    cycleStart?: string;
    revealedIn?: Record<string, number>;
  };
  types: Record<string, { one: string; many: string; about: string }>;
  nav: { title: string; links: [string, string][] }[];
  /** Fixed pages of the app for the prerender: [path, title, description]. */
  sections: [string, string, string][];
  features: { families: boolean };
  regions: string[];
  houses: {
    title: string;
    aria: string;
    first: string;
    /** Columns: k is the field of houses.tsv, sub a second field shown under it, spoil marks the end-of-work column. */
    cols: { h: string; k: string; sub?: string; spoil?: boolean }[];
  };
  roster: { features: string[]; primary: string[] };
  home: {
    title: string;
    byline: string;
    tagline: string;
    description: string;
    mapImage: { src: string; w: number; h: number; alt: string; label: string; aria: string };
    readingHint: string;
    booksTitle: string;
    booksLink: [string, string];
    novels: number;
    side: { title: string; bookGroup?: string; count?: number; links?: [string, string][]; all: [string, string] };
    houses: [string, string];
    chronology: string;
    references: [string, string][];
  };
  map: { title: string; sub: string; image: string; w: number; h: number; alt: string };
  timeline: { marks: string[]; minIso: string };
  chronology: { full: string };
  gallery: { sub: string };
  quiz: { subject: string };
  /** Read by build.py only. */
  build?: { book?: string; bookPatterns?: [number, string][] };
}

export const SITE = RAW as unknown as SiteConfig;

/** Fills {name} placeholders of a site text. */
export function fmt(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** Page title with the site name. */
export const pageTitle = (t: string) => `${t} · ${SITE.name}`;
