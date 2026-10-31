/** Russian plural form: plural(3, 'статья', 'статьи', 'статей') → 'статьи'. */
export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
}

export const byTitle = <T extends { title: string }>(a: T, b: T) => a.title.localeCompare(b.title, 'ru');
