const assert = require('node:assert/strict');
const all = require('./load-cards.js').filter(c => c.task === 13);
const hint = c => c.explanation;
for (const card of all) {
  assert(hint(card).length > 35, card.id);
  assert(!/НЕ образует единое слово|Словарное написание или|признака или понятия|Здесь НЕ выражает отрицание/.test(hint(card)), card.id);
}
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
