'use strict';

const catalog = document.querySelector('#catalog');
const list = catalog.querySelector('.catalog-list');
const articles = Array.from(document.querySelectorAll('.chapters article'));
const input = document.querySelector('#search');
const results = document.querySelector('#results');
const status = document.querySelector('#search-status');
const normalize = text => text.toLocaleLowerCase('ru').replaceAll('ё', 'е').trim();
const entries = [];

for (const article of articles) {
  const chapter = article.querySelector('h2').textContent;
  const number = article.dataset.number;
  entries.push({id: article.id, label: chapter, text: normalize(chapter), number});
  for (const rule of article.querySelectorAll('.rule')) {
    const label = rule.querySelector('h4').textContent;
    entries.push({id: rule.id, label: '№ ' + number + ' · ' + label, text: normalize(rule.textContent), number});
  }
}

function filter() {
  const query = normalize(input.value);
  results.replaceChildren();
  list.hidden = Boolean(query);
  status.textContent = '';
  if (!query) return;
  const number = /^(?:№\s*)?(\d+)$/.exec(query);
  const matches = entries.filter(entry => number ? entry.number === number[1] : entry.text.includes(query));
  for (const entry of matches) {
    const link = document.createElement('a');
    link.href = '#' + entry.id;
    link.textContent = entry.label;
    const item = document.createElement('li');
    item.append(link);
    results.append(item);
  }
  status.textContent = matches.length ? 'Найдено: ' + matches.length : 'Совпадений нет. Попробуйте другое слово.';
}

function route() {
  const hash = location.hash.slice(1);
  const oldSection = /^(?:S(\d{2})-\d{2}|schemes-(\d+))$/.exec(hash);
  const target = oldSection
    ? document.getElementById('task-' + Number(oldSection[1] || oldSection[2]))
    : document.getElementById(hash);
  const chapter = target?.closest('article');
  for (const article of articles) article.hidden = article !== chapter;
  const essay = document.getElementById('essay-practice');
  essay.hidden = target !== essay;
  catalog.hidden = Boolean(chapter) || !essay.hidden;
  document.title = (chapter ? chapter.querySelector('h2').textContent + ' — ' : '') + 'База знаний — Русский';
  if (target && (chapter || target === catalog || target === essay)) target.scrollIntoView();
}

document.querySelector('#search-box').hidden = false;
input.addEventListener('input', filter);
window.addEventListener('hashchange', route);
route();
