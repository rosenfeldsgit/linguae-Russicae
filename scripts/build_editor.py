"""Build a hidden, browser-local editor from the same chapters as /theory/."""
from html import escape
import json
import re

from build_theory import ROOT, KB, chapter, data


def build():
    chapters = data('chapter-index.json')
    sources = data('sources.json')
    card_tasks = data('data/current-inventory.json')['cardCountsByTask']
    entries = []
    for number, meta in chapters.items():
        rendered = chapter(number, meta, sources, card_tasks, include_practice=False)
        # Keep the exact reference body, including rule IDs, tables and dictionaries.
        body = re.sub(r'^<article[^>]*><a[^>]*>.*?</a>\n', '', rendered)
        body = re.sub(r'<a href="#catalog">← Все задания</a>.*$', '', body, flags=re.S)
        body = body.removesuffix('</article>').strip()
        dictionary_path = {'4': 'data/stress-words.json', '5': 'data/paronym-groups.json'}.get(number)
        entries.append({
            'number': number, 'title': meta['title'],
            'path': 'knowledge-base/' + meta['path'],
            'originalMarkdown': (KB / meta['path']).read_text(encoding='utf-8'),
            'html': body,
            'dictionary': {'path': 'knowledge-base/' + dictionary_path, 'original': data(dictionary_path)} if dictionary_path else None,
        })
    target = ROOT / 'edit'
    target.mkdir(exist_ok=True)
    (target / 'chapters.json').write_text(json.dumps({'schemaVersion': 1, 'chapters': entries}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    options = ''.join(f'<option value="{n}">№ {n}. {escape(meta["title"])}</option>' for n, meta in chapters.items())
    template = (ROOT / 'scripts/editor-template.html').read_text(encoding='utf-8')
    (target / 'index.html').write_text(template.replace('<!--options-->', options), encoding='utf-8', newline='\n')


if __name__ == '__main__':
    build()
