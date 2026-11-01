// Runs after `ng build`: writes a static copy of index.html for every article and section
// (<slug>.html, served by Cloudflare at /<slug>) with its own title, description and link-preview tags,
// plus the article text inside <app-root>, so crawlers read it in the page source (Angular replaces it on start);
// then sitemap.xml and robots.txt.
// index.html changes here, so the build regenerates the service worker manifest (ngsw.json) afterwards.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// names, sections and types of the wiki (src/site.json, the same config the app uses)
const CONFIG = JSON.parse(readFileSync(join(ROOT, 'src', 'site.json'), 'utf8'));
const SITE = CONFIG.url;
const NAME = CONFIG.name;
const OUT = join(ROOT, 'dist', 'web', 'browser');

const shell = readFileSync(join(OUT, 'index.html'), 'utf8');
const { articles, images } = JSON.parse(readFileSync(join(OUT, 'data', 'index.json'), 'utf8'));
const about = shell.match(/<meta\s+name="description"\s+content="([^"]*)"/)[1];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TYPES = Object.fromEntries(Object.entries(CONFIG.types).map(([t, l]) => [t, [l.many, l.about]]));
// sections of the app with fixed addresses (the titles match app.routes.ts)
const SECTIONS = [
  ...CONFIG.sections,
  ...Object.entries(TYPES).map(([t, [many, text]]) => [`c/${t}`, many, text]),
];

function page({ path, title, description, image, type = 'website', body = '' }) {
  const url = SITE + '/' + path;
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:site_name" content="${NAME}" />`,
    `<meta property="og:locale" content="ru_RU" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:title" content="${esc(title.replace(` · ${NAME}`, ''))}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    image ? `<meta property="og:image" content="${esc(SITE + '/' + image)}" />` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
  ].filter(Boolean).join('\n    ');
  return shell
    .replace(/<title>[^<]*<\/title>/, '')
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, '')
    .replace(/<link rel="canonical"[^>]*>/, '')
    .replace('</head>', `    ${head}\n  </head>`)
    .replace(/<div class="boot">[^<]*<\/div>/, (boot) => body || boot);
}

function write(path, html) {
  const file = join(OUT, path + '.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

for (const a of articles) {
  const { html, infobox } = JSON.parse(readFileSync(join(OUT, 'data', 'a', a.slug + '.json'), 'utf8'));
  const description = a.summary || TYPES[a.type][1];
  const facts = infobox.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('');
  const crumbs = `<nav><a href="/">${NAME}</a> › <a href="/c/${a.type}">${TYPES[a.type][0]}</a></nav>`;
  const body = `<main class="boot">${crumbs}<article><h1>${esc(a.title)}</h1><p>${esc(description)}</p>${facts ? `<dl>${facts}</dl>` : ''}${html}</article></main>`;
  write(a.slug, page({ path: a.slug, title: `${a.title} · ${NAME}`, description, image: images[a.image]?.src, type: 'article', body }));
}
for (const [path, title, description] of SECTIONS) write(path, page({ path, title: `${title} · ${NAME}`, description }));
// the home page keeps index.html; it only gains the preview tags
writeFileSync(join(OUT, 'index.html'), page({ path: '', title: NAME, description: about, image: images.find((i) => /map/.test(i.src))?.src }));

const urls = ['', ...SECTIONS.map(([p]) => p), ...articles.map((a) => a.slug)];
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}/${u}</loc></url>`).join('\n')}
</urlset>
`);
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *
Allow: /
Disallow: /search/

Sitemap: ${SITE}/sitemap.xml
`);
console.log(`pages: ${articles.length} articles, ${SECTIONS.length} sections, sitemap with ${urls.length} addresses`);
