"""Render the published reference from the canonical chapters, using only the standard library."""
from html import escape
from itertools import groupby
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
KB = ROOT / 'knowledge-base'


def data(path):
    return json.loads((KB / path).read_text())


def inline(text):
    return re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', escape(text))


def kind(line):
    if line.startswith('|'):
        return 'table'
    if line.startswith('- '):
        return 'ul'
    if re.match(r'^\d+\. ', line):
        return 'ol'
    return 'text'


def blocks(lines):
    parts = []
    for typ, group in groupby(lines, kind):
        rows = list(group)
        if typ == 'table':
            parts.append('<div class="table-wrap"><table>')
            for i, row in enumerate(rows):
                cells = row.strip().strip('|').split('|')
                if all(re.fullmatch(r'[ :\-]+', cell) for cell in cells):
                    continue
                tag = 'th' if i == 0 else 'td'
                parts.append('<tr>' + ''.join(f'<{tag}>{inline(c.strip())}</{tag}>' for c in cells) + '</tr>')
            parts.append('</table></div>')
        elif typ in ('ul', 'ol'):
            parts.append(f'<{typ}>')
            for row in rows:
                item = re.sub(r'^(?:- |\d+\. )', '', row)
                parts.append(f'<li>{inline(item)}</li>')
            parts.append(f'</{typ}>')
        else:
            for row in rows:
                if row.strip():
                    special = re.match(r'^\*\*(?:Исключени|Запомни|Что запомнить)', row)
                    cls = ' class="exception"' if special else ''
                    parts.append(f'<p{cls}>{inline(row)}</p>')
    return '\n'.join(parts)


def dictionary(number):
    if number == '4':
        words = data('data/stress-words.json')['entries']
        items = [escape(w['form'] + (' · ' + w['context'] if w['context'] else '')) for w in words]
        body = '<ul class="words">' + ''.join(f'<li>{w}</li>' for w in items) + '</ul>'
    elif number == '5':
        pairs = data('data/paronym-groups.json')['groups']
        body = '<dl>' + ''.join('<dt>' + escape(' / '.join(p['forms'])) + '</dt><dd>' +
                                '<br>'.join(map(escape, p['meanings'].splitlines())) + '</dd>' for p in pairs) + '</dl>'
    else:
        return ''
    return ('<details class="dictionary"><summary>Словник из карточек</summary>'
            '<p>Состав тренажёра на 13 ноября 2026 года. Полнота по словарю ЕГЭ 2027 не подтверждена.</p>'
            + body + '</details>')


def chapter(number, meta, sources, card_tasks):
    raw = (KB / meta['path']).read_text().split('## Источники')[0]
    sections = re.split(r'^## (.+)$', raw, flags=re.M)
    title = escape(meta['title'])
    result = [f'<article id="task-{number}" data-number="{number}"><a href="#catalog">← Все задания</a>',
              f'<h2>№ {number}. {title}</h2>']
    for heading, body in zip(sections[1::2], sections[2::2]):
        result.append(f'<h3>{escape(heading)}</h3>')
        pieces = re.split(r'^### ([RS]\d+-\d+)\. (.+)$', body, flags=re.M)
        result.append(blocks(pieces[0].splitlines()))
        for key, name, content in zip(pieces[1::3], pieces[2::3], pieces[3::3]):
            result.extend([f'<section id="{key}" class="rule"><h4><a href="#{key}">{escape(name)}</a></h4>',
                           blocks(content.splitlines()), '</section>'])
    result.extend([dictionary(number), '<h3>Источники</h3><ul>'])
    for key in meta['sourceIds']:
        src = sources['sources'][key]
        url = src['url']
        if src['kind'] == 'project':
            url = 'https://github.com/rosenfeldsgit/linguae-Russicae/blob/main/' + url.removeprefix('../')
        assert url.startswith('https://')
        result.append(f'<li><a href="{escape(url)}">{escape(src["title"])}</a></li>')
    result.append('</ul>')
    source_url = next(sources['sources'][key]['url'] for key in meta['sourceIds'] if key.startswith('RUSTUTORS_') and key.rsplit('_', 1)[-1].isdigit())
    result.append('<details><summary>Темы в статье Рустьюторс</summary><ul>')
    for item in meta['sourceSections']:
        result.append(f'<li><a href="{escape(source_url)}#{escape(item["anchor"])}">{escape(item["title"])}</a></li>')
    result.append('</ul></details>')
    result.append('<p>Дата сверки материалов: 13 ноября 2026 года.</p><a href="#catalog">← Все задания</a>')
    if number == '27':
        destination = '#essay-practice'
    elif number in card_tasks:
        destination = f'../?task={number}'
    else:
        destination = f'../test/?task={number}'
    result.append(f'<p><a class="practice-link" href="{destination}">Перейти к практике</a></p></article>')
    return '\n'.join(result)


def build():
    chapters = data('chapter-index.json')
    sources = data('sources.json')
    template = (ROOT / 'scripts/theory-template.html').read_text()
    links = [f'<li><a href="#task-{n}"><span>№ {n}</span> {escape(meta["title"])}</a></li>'
             for n, meta in chapters.items()]
    card_tasks = data('data/current-inventory.json')['cardCountsByTask']
    articles = [chapter(n, meta, sources, card_tasks) for n, meta in chapters.items()]
    page = template.replace('<!--catalog-->', '\n'.join(links)).replace('<!--chapters-->', '\n'.join(articles))
    (ROOT / 'theory/index.html').write_text(page)


if __name__ == '__main__':
    build()
