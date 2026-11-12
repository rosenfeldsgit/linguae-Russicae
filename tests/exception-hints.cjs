'use strict';
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const context = {window: {}};
const sources = ['cards.js', 'explanations.js', 'punctuation.js', 'adapted-cards.js', 'collection-cards.js'];
for (const file of sources) vm.runInNewContext(fs.readFileSync(file, 'utf8'), context);
const cards = [...context.window.EGE_CARDS, ...context.window.EGE_ADAPTED_CARDS, ...context.window.EGE_COLLECTION_CARDS];
const answers = JSON.stringify(cards.map(c => [c.id, c.answer, c.spelling, c.options]));
for (const file of ['prefix-explanations.js', 'audited-explanations.js', 'reasoned-explanations.js', 'collection-rule-hints.js']) {
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context);
}
assert.equal(JSON.stringify(cards.map(c => [c.id, c.answer, c.spelling, c.options])), answers);
const hint = c => c.explanation || context.window.EGE_HINTS.get(c.id) || '';
const word = c => c.spelling || c.before + c.answer + c.after;
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
  [15, 'чеканный', /Н основы и Н суффикса/],
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
