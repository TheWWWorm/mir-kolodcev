export type WikiLocale = 'ru' | 'en';

const PREFIX = /^\/(ru|en)(?=[/?#]|$)/;
const PREFERENCE = 'wiki.language';

function isLocale(value: unknown): value is WikiLocale {
  return value === 'ru' || value === 'en';
}

export function pathLocale(path: string): WikiLocale | undefined {
  return PREFIX.exec(path)?.[1] as WikiLocale | undefined;
}

export function unlocalized(path: string): string {
  const p = path.replace(PREFIX, '');
  return !p || p.startsWith('?') || p.startsWith('#') ? '/' + p : p;
}

export function localized(path: string, locale: WikiLocale = LOCALE): string {
  return '/' + locale + unlocalized(path);
}

export function entryUrl(url: URL, preferred: string | null, languages: readonly string[]) {
  // Legacy Angular hash routes may contain their own query string and section fragment.
  const hashRoute = /^#\/(?![\/\\])/.test(url.hash) ? new URL(url.hash.slice(1), url.origin) : null;
  const pathname = (hashRoute?.pathname ?? url.pathname).replace(/(?:\/index)?\.html$/, '');
  const locale = pathLocale(pathname) ?? pathLocale(url.pathname)
    ?? (isLocale(preferred) ? preferred : undefined)
    ?? languages.map((tag) => tag.toLowerCase().split('-')[0]).find(isLocale)
    ?? 'ru';
  return {
    locale,
    path: localized(pathname || '/', locale) + (hashRoute?.search || url.search) + (hashRoute?.hash ?? url.hash),
  };
}

function preference(): string | null {
  try { return localStorage.getItem(PREFERENCE); } catch { return null; }
}

export function rememberLocale(locale: WikiLocale): void {
  try { localStorage.setItem(PREFERENCE, locale); } catch { /* storage unavailable */ }
}

export const ENTRY = entryUrl(new URL(location.href), preference(), navigator.languages?.length ? navigator.languages : [navigator.language]);
export const LOCALE = ENTRY.locale;
export const DATA_DIR = LOCALE === 'en' ? 'data/en' : 'data';
export const t = (ru: string, en: string) => LOCALE === 'en' ? en : ru;
