// After ng build, generate article HTML and discovery metadata for each language.
// Unprefixed pages retain their Russian preview and resolve the reader's language on startup.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist', 'web', 'browser');
const read = (base, ...path) => JSON.parse(readFileSync(join(base, ...path), 'utf8'));
const ru = read(ROOT, 'src', 'site.json');
const configs = { ru, en: { ...ru, ...read(ROOT, 'src', 'site.en.json') } };
const index = {
  ru: read(OUT, 'data', 'index.json'),
  en: read(OUT, 'data', 'en', 'index.json'),
};
const shell = readFileSync(join(OUT, 'index.html'), 'utf8');
const russianDescription = shell.match(/<meta\s+name="description"\s+content="([^"]*)"/)[1];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const href = (lang, path) => `/${lang}/${path}`;
const url = (lang, path) => ru.url + href(lang, path);
const urls = [];

function page(lang, { path, title, description, image, type = 'website', body = '', translated = true }) {
  const name = configs[lang].name;
  const canonical = url(translated || lang === 'ru' ? lang : 'ru', path);
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<link rel="alternate" hreflang="ru" href="${esc(url('ru', path))}" />`,
    translated ? `<link rel="alternate" hreflang="en" href="${esc(url('en', path))}" />` : '',
    `<link rel="alternate" hreflang="x-default" href="${esc(ru.url + '/' + path)}" />`,
    `<meta property="og:site_name" content="${esc(name)}" />`,
    `<meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'ru_RU'}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:title" content="${esc(title.replace(` · ${name}`, ''))}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    image ? `<meta property="og:image" content="${esc(ru.url + '/' + image)}" />` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
  ].filter(Boolean).join('\n    ');
  return shell
    .replace(/(<html\s+lang=")ru"/, `$1${lang}"`)
    .replace(/<title>[^<]*<\/title>/, '')
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, '')
    .replace(/<link rel="canonical"[^>]*>/, '')
    .replace('</head>', `    ${head}\n  </head>`)
    .replace(/<div class="boot">[^<]*<\/div>/, () => body || (lang === 'en'
      ? '<div class="boot">Loading the wiki…</div>'
      : '<div class="boot">Вики загружается…</div>'));
}

function write(path, html) {
  const file = join(OUT, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

const translatedSlugs = new Set(index.en.articles.filter((a) => !a.language).map((a) => a.slug));
for (const lang of ['ru', 'en']) {
  const config = configs[lang];
  const { articles, images } = index[lang];
  const dataDir = lang === 'en' ? 'data/en' : 'data';
  const sections = [
    ...config.sections,
    ...Object.entries(config.types).map(([t, l]) => [`c/${t}`, l.many, l.about]),
  ];
  function render(options) {
    const { path, translated } = options;
    const file = path ? path + '.html' : 'index.html';
    const html = page(lang, options);
    write(`${lang}/${file}`, html);
    if (lang === 'ru') write(file, html);
    if (lang === 'ru' || translated !== false) urls.push(url(lang, path));
  }
  for (const a of articles) {
    const { html, infobox } = read(OUT, dataDir, 'a', a.slug + '.json');
    const { many, about } = config.types[a.type];
    const description = a.summary || about;
    const facts = infobox.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('');
    const crumbs = `<nav><a href="${href(lang, '')}">${esc(config.name)}</a> › <a href="${href(lang, 'c/' + a.type)}">${esc(many)}</a></nav>`;
    const body = `<main class="boot">${crumbs}<article lang="${a.language ?? lang}"><h1>${esc(a.title)}</h1><p>${esc(description)}</p>${facts ? `<dl>${facts}</dl>` : ''}${html}</article></main>`;
    render({ path: a.slug, title: `${a.title} · ${config.name}`, description, image: images[a.image]?.src, type: 'article', body, translated: translatedSlugs.has(a.slug) });
  }
  for (const [path, title, description] of sections) render({ path, title: `${title} · ${config.name}`, description });
  render({ path: '', title: config.name, description: lang === 'ru' ? russianDescription : config.about, image: images.find((i) => /map/.test(i.src))?.src });
}

write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}
</urlset>
`);
write('robots.txt', `User-agent: *
Allow: /
Disallow: /search/
Disallow: /ru/search/
Disallow: /en/search/

Sitemap: ${ru.url}/sitemap.xml
`);
console.log(`pages: ${index.ru.articles.length} Russian articles, ${translatedSlugs.size} English translations, sitemap with ${urls.length} addresses`);
