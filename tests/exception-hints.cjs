const assert = require('node:assert/strict');
const cards = require('./load-cards.js');
const hint = c => c.explanation || '';
const word = c => (c.kind === 'n_count' ? c.before + c.spelling + c.after : c.spelling || c.before + c.answer + c.after);
const matching = (task, text) => cards.filter(c => c.task === task && word(c) === text);
for (const [task, text, expected] of [
  [14, 'восточно-европейской', /географических названиях/],
  [9, 'выгарки', /Запомни.*А без ударения/],
  [9, 'пловец', /Запомни.*исключения с О/],
  [9, 'поровну', /Запомни.*исключение с О/],
  [11, 'потчевать', /я потчую/],
  [15, 'деланный', /исключение.*Запомни/],
  [15, 'деревянный', /Ассоциация — окно/],
  [15, 'стеклянной', /Ассоциация — окно/],
  [15, 'чеканный', /Н основы.*суффикс -Н-.*НН/],
]) {
  const found = matching(task, text);
  assert(found.length, text);
  for (const card of found) assert.match(hint(card), expected, card.id);
}
const geography = hint(matching(14, 'восточно-европейской')[0]);
assert(!/исключени|Запомни|с Восточно- →/.test(geography));
for (const card of matching(11, 'потчевать')) assert(!/Запомни|не определяет/.test(hint(card)));
for (const card of matching(14, 'поближе')) assert(!/Запомни/.test(hint(card)));
for (const card of cards) assert(!/^«[^»]+» — исключение\.$/.test(hint(card)), card.id);
console.log('Exception cues, rule-based explanations, collection duplicates and unchanged answer keys: OK');
