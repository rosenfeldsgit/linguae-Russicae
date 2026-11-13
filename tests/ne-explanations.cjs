'use strict';
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const ctx = {window: {}};
for (const file of ['cards.js', 'explanations.js', 'punctuation.js', 'adapted-cards.js', 'collection-cards.js', 'prefix-explanations.js', 'audited-explanations.js', 'reasoned-explanations.js', 'collection-rule-hints.js']) {
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx);
}
const all = [...ctx.window.EGE_CARDS, ...ctx.window.EGE_ADAPTED_CARDS, ...ctx.window.EGE_COLLECTION_CARDS];
const original = JSON.stringify(all.map(c => [c.id, c.answer, c.options, c.before, c.after, c.context, c.spelling]));
const hint = c => c.explanation || ctx.window.EGE_HINTS.get(c.id) || '';
const previous = new Map(all.map(c => [c.id, hint(c)]));
vm.runInNewContext(fs.readFileSync('ne-explanations.js', 'utf8'), ctx);
assert.equal(JSON.stringify(all.map(c => [c.id, c.answer, c.options, c.before, c.after, c.context, c.spelling])), original);
let changed = 0;
for (const card of all) {
  if (card.task !== 13) { assert.equal(hint(card), previous.get(card.id), card.id); continue; }
  assert(hint(card).length > 35, card.id);
  assert.equal(hint(card), ctx.window.EGE_HINTS.get(card.id), card.id);
  assert(!/НЕ образует единое слово|Словарное написание или|признака или понятия|Здесь НЕ выражает отрицание/.test(hint(card)), card.id);
  if (hint(card) !== previous.get(card.id)) changed++;
}
assert.equal(changed, 507);
const find = (word, context = '') => all.filter(c => c.task === 13 && (c.spelling || c.answer) === word && (!context || (c.before + c.after + c.context).includes(context)));
function check(word, expected, unwanted, context) {
  const cards = find(word, context);
  assert(cards.length, word);
  for (const card of cards) {
    assert.match(hint(card), expected, card.id);
    if (unwanted) assert(!unwanted.test(hint(card)), card.id);
  }
}
check('неограниченно', /Краткое прилагательное|краткое прилагательное/, /Это наречие|Это причастие/);
check('несомненное', /прилагательное/, /^Полное причастие/);
check('незабываемое', /прилагательное/, /Полное причастие/);
check('не скрытое', /облаками/);
check('не замеченные', /врагами|никем/i);
check('не исправленная', /вовремя/);
check('не к кому', /местоимением.*предлог/, /с существительным/);
check('не поздоровится', /Запомни.*исключение/);
check('ненавидящий', /ненавидеть.*Без НЕ/);
check('недосмотрел', /НЕДО-.*плохо присматривал/);
check('не досмотрел', /не посмотрели до конца/);
check('не высшей', /Едва ли не|Едва ли|едва ли не/);
check('необставленной', /противопоставляют помещения/);
check('не спеша', /деепричастие/);
const html = fs.readFileSync('index.html', 'utf8');
assert(html.indexOf('ne-explanations.js') > html.indexOf('collection-rule-hints.js'));
assert(html.indexOf('ne-explanations.js') < html.indexOf('app.js'));
console.log(`NE/NI: ${changed} context-specific hints, parts of speech, dependencies and unchanged cards: OK`);
