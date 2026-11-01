#!/usr/bin/env python3
"""Build web/public/data/ (index.json + one JSON per article) from content/**/*.md and data/.

Entry format:
    ---
    title: English title
    ru: Русское название
    type: character | place | event | concept | house | book
    aliases: Comma, Separated, Names
    summary: One-sentence summary.
    books: b1, b2          (book ids from content/book/*.md; wikis whose spoiler unit is the book)
    chapters: 2, 6, 14     (chapters of the novel; wikis whose spoiler unit is the chapter)
    image: optional
    infobox:
    - Key: value (may contain [[links]])
    ---
    Markdown body. Links: [[slug]] or [[slug|text]].

Usage: build.py [site folder]   (default: the folder of this script, as in a published site repo)
The site's web/src/site.json says how spoilers are counted (spoilers.unit: books | chapters).
"""
import html, json, os, re, sys, glob

ROOT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
CONFIG = json.load(open(os.path.join(ROOT, 'web', 'src', 'site.json'), encoding='utf-8'))
BY_CHAPTER = CONFIG['spoilers']['unit'] == 'chapters'
TITLES = {}
TYPES = ['book', 'character', 'house', 'place', 'event', 'concept']


def parse(path):
    raw = open(path, encoding='utf-8').read().replace('\r\n', '\n')
    m = re.match(r'^---\n(.*?)\n---\n?(.*)$', raw, re.S)
    if not m:
        raise ValueError(f'{path}: missing frontmatter')
    meta, body = {}, m.group(2)
    info, in_info = [], False
    for line in m.group(1).split('\n'):
        if not line.strip():
            continue
        if in_info and re.match(r'^\s*-\s', line):
            k, _, v = line.strip()[2:].partition(':')
            info.append([k.strip(), v.strip()])
            continue
        in_info = False
        k, _, v = line.partition(':')
        k, v = k.strip(), v.strip()
        if k == 'infobox':
            in_info = True
        else:
            meta[k] = v
    meta['infobox'] = info
    return meta, body


def inline(text, links, slugs, missing):
    text = html.escape(text, quote=False)

    def link(m):
        target, _, label = m.group(1).partition('|')
        target = target.strip()
        label = (label or TITLES.get(target, target)).strip()
        if target in slugs:
            links.add(target)
            return f'<a href="/{target}" class="wl">{label}</a>'
        missing.add(target)
        return f'<span class="wl-missing" title="No article yet">{label}</span>'

    text = re.sub(r'\[\[([^\]]+)\]\]', link, text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])', r'<em>\1</em>', text)
    text = re.sub(r'(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)', r'<em>\1</em>', text)
    return text


# Book mentioned in a heading -> reading order of that book (used by the spoiler filter).
BOOK_PATTERNS = [(o, rx) for o, rx in CONFIG.get('build', {}).get('bookPatterns', [])]
# When spoiler units are chapters of one novel, a heading that ends with "(гл. 3–7)" belongs to chapter 7.
BOOK = CONFIG.get('build', {}).get('book', '')


MONTHS = {'январ': 1, 'феврал': 2, 'март': 3, 'апрел': 4, 'ма': 5, 'июн': 6, 'июл': 7, 'август': 8, 'сентябр': 9, 'октябр': 10, 'ноябр': 11, 'декабр': 12}


def when_iso(when):
    """Sortable 'YYYY-MM-DD' (or shorter) for the start of a free-form Russian date such as '2 декабря 1775 г.'."""
    y = re.search(r'\b(1[0-9]{3}|[5-9][0-9]{2})\b', when)
    if not y:
        c = re.search(r'\b(X{0,2}(?:IX|IV|V?I{0,3}))\s+век', when)
        roman = {'I': 1, 'V': 5, 'X': 10}
        if c and c.group(1):
            v = 0
            for i, ch in enumerate(c.group(1)):
                n = roman[ch]
                v += -n if i + 1 < len(c.group(1)) and roman[c.group(1)[i + 1]] > n else n
            return f'{(v - 1) * 100 + 50:04d}'
        return '0000' if re.search(r'\bгод 0\b', when) else ''
    head = when[:y.start()].lower()
    stems = '|'.join(sorted(MONTHS, key=len, reverse=True))
    m = re.search(r'(?:(\d{1,2})(?:\s*[,и–—-]\s*\d{1,2})*\s+)?(?<![а-я])(' + stems + r')[а-я]*', head)
    if not m:
        season = re.search(r'(?<![а-я])(зим|весн|лет|осен)', head)
        return y.group(1) + ({'зим': '-12' if when[y.end():y.end() + 1] == '/' else '-01', 'весн': '-03', 'лет': '-06', 'осен': '-09'}[season.group(1)] if season else '')
    mon = next(n for st, n in sorted(MONTHS.items(), key=lambda x: -len(x[0])) if m.group(2).startswith(st))
    d = int(m.group(1)) if m.group(1) and int(m.group(1)) <= 31 else 0
    return f'{y.group(1)}-{mon:02d}' + (f'-{d:02d}' if d else '')


def heading_book(title):
    """Spoiler unit of a heading: the latest book it names, or the largest chapter in "(гл. N)" / "(главы N–M)"; else 0."""
    if not BY_CHAPTER:
        t = title.lower().replace('ё', 'е')
        found = [o for o, rx in BOOK_PATTERNS if re.search(rx.replace('ё', 'е'), t)]
        return max(found) if found else 0
    nums = [int(n) for p in re.findall(r'\((?:гл\.|глав[аы])\s*([^)]*)\)', title) for n in re.findall(r'\d+', p)]
    return max(nums) if nums else 0


def chapter_iso(n):
    """In-world 'date' of chapter n when the novel names no years: the timeline orders events by chapter."""
    return str(1000 + int(n)) if BY_CHAPTER and str(n).isdigit() else ''


def render(md, slugs, missing):
    links, out, toc = set(), [], []
    para, lst, quote = [], None, []

    def flush():
        nonlocal para, lst, quote
        if para:
            out.append('<p>' + inline(' '.join(para), links, slugs, missing) + '</p>')
            para = []
        if lst:
            tag, items = lst
            out.append(f'<{tag}>' + ''.join(f'<li>{inline(i, links, slugs, missing)}</li>' for i in items) + f'</{tag}>')
            lst = None
        if quote:
            out.append('<blockquote>' + inline(' '.join(quote), links, slugs, missing) + '</blockquote>')
            quote = []

    for line in md.split('\n'):
        s = line.rstrip()
        h = re.match(r'^(#{2,4})\s+(.*)$', s)
        ul = re.match(r'^\s*[-*]\s+(.*)$', s)
        ol = re.match(r'^\s*\d+[.)]\s+(.*)$', s)
        if not s.strip():
            flush()
        elif h:
            flush()
            lvl = len(h.group(1))
            title = h.group(2).strip()
            anchor = 'h-' + re.sub(r'[^\w]+', '-', title.lower()).strip('-')
            if lvl == 2:
                toc.append([anchor, title])
            bk = heading_book(title)
            out.append(f'<h{lvl} id="{anchor}"{f" data-book={chr(34)}{bk}{chr(34)}" if bk else ""}>{inline(title, links, slugs, missing)}</h{lvl}>')
        elif s.startswith('>'):
            if para or lst:
                flush()
            quote.append(s.lstrip('> '))
        elif ul or ol:
            if para or quote:
                flush()
            tag = 'ul' if ul else 'ol'
            if lst and lst[0] != tag:
                flush()
            if not lst:
                lst = (tag, [])
            lst[1].append((ul or ol).group(1))
        elif lst and line.startswith('  '):
            lst[1][-1] += ' ' + s.strip()
        else:
            if lst or quote:
                flush()
            para.append(s.strip())
    flush()
    return '\n'.join(out), sorted(links), toc


def load_images():
    """images.tsv: file, articles ("slug" or "slug:role", comma-separated), caption, credit."""
    path = os.path.join(ROOT, 'images.tsv')
    images, by_slug = [], {}
    if not os.path.exists(path):
        return images, by_slug
    for line in open(path, encoding='utf-8'):
        if not line.strip() or line.startswith('#'):
            continue
        cols = line.rstrip('\n').split('\t') + ['', '', '']
        fn, arts, caption, credit = cols[:4]
        if not os.path.exists(os.path.join(ROOT, 'web', 'public', 'img', fn)):
            print(f'warning: images.tsv: missing file {fn}', file=sys.stderr)
            continue
        img = dict(src='img/' + fn, caption=caption, credit=credit, slugs=[])
        for a in arts.split(','):
            slug, _, role = a.strip().partition(':')
            if slug:
                img['slugs'].append(slug)
                by_slug.setdefault(slug, []).append((role or 'gallery', len(images)))
        images.append(img)
    return images, by_slug


def strip_src(t):
    """Drop internal source references like (c44:2139) from text shown to readers."""
    return re.sub(r'\s*\((?:[^()]*?\b)?c\d\d(?:\.txt)?:[\d~–\-, ]+[^()]*\)', '', t or '')


def read_tsv(path):
    lines = [l.rstrip('\n') for l in open(path, encoding='utf-8') if l.strip()]
    head = lines[0].split('\t')
    return [dict(zip(head, (l.split('\t') + [''] * len(head))[:len(head)])) for l in lines[1:]]


def load_data(slugs, data):
    """data/: chapters/<book>.tsv, families.json, houses.tsv, relations.tsv -> window.WIKI_DATA."""
    d = os.path.join(ROOT, 'data')
    miss = set()
    html = lambda t: inline(t or '', set(), slugs, miss)
    extra = dict(chapters={}, families=[], houses=[], relations=[])
    for f in sorted(glob.glob(os.path.join(d, 'chapters', '*.tsv'))):
        book = os.path.splitext(os.path.basename(f))[0]
        if book not in data:
            print(f'warning: chapters for unknown book {book}', file=sys.stderr)
            continue
        rows = []
        for r in read_tsv(f):
            rows.append(dict(n=r.get('n', ''), h=r.get('heading', ''), pov=r.get('pov', '') if r.get('pov', '') in slugs else '',
                             date=r.get('date', ''), iso=r.get('iso', '') or chapter_iso(r.get('n', '')), place=html(r.get('place', '')),
                             key=r.get('mapkey', ''), sum=html(r.get('summary', ''))))
        extra['chapters'][book] = rows
    fam = os.path.join(d, 'families.json')
    if os.path.exists(fam):
        try:
            extra['families'] = json.load(open(fam, encoding='utf-8'))
        except ValueError as e:
            print(f'warning: families.json: {e}', file=sys.stderr)
        for h in extra['families']:
            for p in h.get('people', []):
                if p.get('slug') and p['slug'] not in slugs:
                    p['slug'] = ''
                p.pop('src', None)
                p['note'] = html(strip_src(p.get('note', '')))
            h['note'] = strip_src(h.get('note', ''))
    hs = os.path.join(d, 'houses.tsv')
    if os.path.exists(hs):
        for r in read_tsv(hs):
            extra['houses'].append({k: (v if k == 'slug' else html(v)) for k, v in r.items()})
    rel = os.path.join(d, 'relations.tsv')
    if os.path.exists(rel):
        for r in read_tsv(rel):
            if r.get('a') in slugs and r.get('b') in slugs:
                # the relation is revealed in a chapter (column ch) or in a book (column book)
                if BY_CHAPTER:
                    ch = r.get('ch', '')
                    o = int(ch) if ch.isdigit() else 0
                else:
                    o = data.get(r.get('book', ''), {}).get('order', 0)
                    o = o if o != 999 else 0
                extra['relations'].append(dict(a=r['a'], b=r['b'], t=r.get('type', ''), l=r.get('label', ''), o=o))
    # routes.tsv: a hero's travels stop by stop, including chapters told by others; on the maps it
    # replaces the route drawn from the hero's own chapters.
    rt = os.path.join(d, 'routes.tsv')
    extra['routes'] = {}
    if os.path.exists(rt):
        for r in read_tsv(rt):
            hero, book = r.get('hero', ''), r.get('book', '')
            if hero not in slugs or book not in data:
                print(f'warning: routes.tsv: unknown hero or book {hero} / {book}', file=sys.stderr)
                continue
            ch = next((c for c in extra['chapters'].get(book, []) if c['n'] == r.get('n')), None)
            extra['routes'].setdefault(hero, []).append(dict(
                book=book, n=r.get('n', ''), h=ch['h'] if ch else '', pov=hero, date=r.get('date', ''), iso=r.get('iso', '') or chapter_iso(r.get('n', '')),
                place='', key=r.get('mapkey', ''), sum=html(r.get('note', ''))))
    if miss:
        print(f'data files: {len(miss)} missing link targets: {", ".join(sorted(miss)[:12])}')
    return extra


def main():
    images, img_by_slug = load_images()
    files = sorted(glob.glob(os.path.join(ROOT, 'content', '*', '*.md')))
    entries = {}
    for f in files:
        slug = os.path.splitext(os.path.basename(f))[0]
        meta, body = parse(f)
        t = meta.get('type') or os.path.basename(os.path.dirname(f))
        if t not in TYPES:
            print(f'warning: {f}: unknown type {t}', file=sys.stderr)
        if slug in entries:
            print(f'warning: duplicate slug {slug}', file=sys.stderr)
        entries[slug] = dict(meta=meta, body=body, type=t)

    slugs = set(entries)
    TITLES.update({k: v['meta'].get('title', k) for k, v in entries.items()})
    missing = {}
    data = {}
    for slug, e in entries.items():
        miss = set()
        body_html, links, toc = render(e['body'], slugs, miss)
        info = []
        for k, v in e['meta']['infobox']:
            l2 = set()
            info.append([k, inline(v, l2, slugs, miss)])
            links = sorted(set(links) | l2)
        for m in miss:
            missing.setdefault(m, []).append(slug)
        meta = e['meta']
        text = re.sub(r'<[^>]+>', ' ', body_html)
        data[slug] = dict(
            slug=slug, type=e['type'], title=meta.get('title', slug), ru=meta.get('full', meta.get('ru', '')),
            aliases=[a.strip() for a in meta.get('aliases', '').split(',') if a.strip()],
            summary=re.sub(r'\[\[([^\]|]+)\|?([^\]]*)\]\]', lambda m: m.group(2) or TITLES.get(m.group(1).strip(), m.group(1)), meta.get('summary', '')),
            books=([BOOK] if e['type'] != 'book' and BOOK in entries else []) if BY_CHAPTER else [b.strip() for b in meta.get('books', '').split(',') if b.strip()],
            chapters=sorted({int(c) for c in re.findall(r'\d+', meta.get('chapters', ''))}),
            order=int(meta.get('order', '999') or 999), group=meta.get('group', ''),
            infobox=info, html=body_html, toc=toc, links=links, words=len(text.split()),
            text=' '.join(text.split())[:1200],
        )
        when = next((v for k, v in meta['infobox'] if k in ('Дата', 'Время', 'Год', 'Датировка')), '')
        glava = next((v for k, v in meta['infobox'] if k == 'Глава'), '') if BY_CHAPTER else ''
        if glava and re.search(r'\d+', glava):
            data[slug]['when'] = re.sub(r'\[\[([^\]|]+)\|?([^\]]*)\]\]', lambda m: m.group(2) or TITLES.get(m.group(1).strip(), m.group(1)), 'гл. ' + glava)
            data[slug]['iso'] = chapter_iso(re.search(r'\d+', glava).group(0))
        elif when:
            when = re.sub(r'\[\[([^\]|]+)\|?([^\]]*)\]\]', lambda m: m.group(2) or TITLES.get(m.group(1).strip(), m.group(1)), when)
            data[slug]['when'] = when
            data[slug]['iso'] = when_iso(when)
    orders = {k: v['order'] for k, v in data.items() if v['type'] == 'book'}
    for slug, d in data.items():
        d['backlinks'] = sorted(s for s, o in data.items() if slug in o['links'] and s != slug)
        chapters = d.pop('chapters')
        if BY_CHAPTER:
            # spoiler range: chapters listed in the header plus chapters named in the section headings
            heads = [heading_book(t) for t in re.findall(r'<h[234][^>]*>(.*?)</h[234]>', d['html'])]
            chs = [c for c in chapters + heads if c]
            d['first'] = 0 if d['type'] == 'book' else (min(chs) if chs else 0)
            d['last'] = max(chs) if chs else 0
        else:
            bo = [orders[b] for b in d['books'] if b in orders]
            if d['type'] == 'book':
                bo = [d['order']]
            d['first'] = min(bo) if bo else 0
            d['last'] = max(bo) if bo else 0
        # lead image (portrait/cover/emblem/map) goes to the infobox, the rest to the gallery
        refs = img_by_slug.get(slug, [])
        lead = next((i for r, i in refs if r != 'gallery'), None)
        d['image'] = lead
        d['gallery'] = [i for r, i in refs if i != lead]
    for slug in img_by_slug:
        if slug not in data:
            print(f'warning: images.tsv: unknown article {slug}', file=sys.stderr)
    for img in images:
        img['slugs'] = [s for s in img['slugs'] if s in data]

    extra = load_data(slugs, data)
    # in-world span of each book for the chronology: the infobox «Хронология» line, else its dated chapters
    for slug, d in data.items():
        if d['type'] != 'book':
            continue
        line = next((v for k, v in entries[slug]['meta']['infobox'] if k == 'Хронология'), '')
        line = re.sub(r'\([^)]*\)', '', line.split(';')[0])
        parts = [p for p in re.split(r'\s[—–]\s', line) if p.strip()]
        end = when_iso(parts[-1]) if parts else ''
        start = (when_iso(parts[0]) or when_iso(f'{parts[0]} {end[:4]}')) if end else ''
        isos = sorted(c['iso'] for c in extra['chapters'].get(slug, []) if c['iso'])
        if not start and isos:
            start, end = isos[0], isos[-1]
        if start:
            d['span'] = [start, max(end, start, isos[-1] if isos else '')]

    out_dir = os.path.join(ROOT, 'web', 'public', 'data')
    art_dir = os.path.join(out_dir, 'a')
    os.makedirs(art_dir, exist_ok=True)
    for f in glob.glob(os.path.join(art_dir, '*.json')):
        if os.path.splitext(os.path.basename(f))[0] not in data:
            os.remove(f)
    heavy = ('html', 'toc', 'infobox', 'links', 'gallery')
    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))
    for slug, d in data.items():
        with open(os.path.join(art_dir, slug + '.json'), 'w', encoding='utf-8') as fh:
            fh.write(dump({k: d[k] for k in heavy if k in d}))
    # full-text snippets and hand-made routes are only needed by search and the map: they load after startup
    with open(os.path.join(out_dir, 'search.json'), 'w', encoding='utf-8') as fh:
        fh.write(dump({slug: d['text'] for slug, d in data.items()}))
    with open(os.path.join(out_dir, 'routes.json'), 'w', encoding='utf-8') as fh:
        fh.write(dump(extra.pop('routes', {})))
    heavy += ('text',)
    index = [{k: v for k, v in d.items() if k not in heavy} for d in data.values()]
    # data/quiz.json: questions for the /ispytaniya page, each pointing to an article to read more
    qp = os.path.join(ROOT, 'data', 'quiz.json')
    if os.path.exists(qp):
        quiz = json.load(open(qp, encoding='utf-8'))
        for lv in quiz.get('levels', []):
            for q in lv.get('questions', []):
                if q.get('slug') not in data:
                    print(f'warning: quiz.json: unknown article {q.get("slug")}', file=sys.stderr)
                if not 0 <= q.get('answer', -1) < len(q.get('options', [])):
                    print(f'warning: quiz.json: bad answer in «{q.get("q", "")[:40]}»', file=sys.stderr)
        with open(os.path.join(out_dir, 'quiz.json'), 'w', encoding='utf-8') as fh:
            fh.write(dump(quiz))
    mp = os.path.join(ROOT, 'data', 'map.json')
    extra['map'] = json.load(open(mp, encoding='utf-8')) if os.path.exists(mp) else {'places': {}, 'events': []}
    out = os.path.join(out_dir, 'index.json')
    with open(out, 'w', encoding='utf-8') as fh:
        fh.write(dump(dict(articles=index, images=images, data=extra)))
    words = sum(d['words'] for d in data.values())
    print(f'{len(data)} articles, {words} words -> {os.path.relpath(out, ROOT)}')
    for t in TYPES:
        print(f'  {t}: {sum(1 for d in data.values() if d["type"] == t)}')
    if missing:
        print(f'{len(missing)} missing link targets:')
        for k, v in sorted(missing.items(), key=lambda kv: -len(kv[1])):
            print(f'  {k}  <- {", ".join(sorted(v)[:6])}{" ..." if len(v) > 6 else ""}')


if __name__ == '__main__':
    main()
