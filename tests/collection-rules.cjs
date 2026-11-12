'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = {window: {}};
for (const file of ['cards.js', 'explanations.js', 'punctuation.js', 'adapted-cards.js', 'collection-cards.js']) {
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context);
}
const cards = context.window.EGE_COLLECTION_CARDS;
const original = JSON.stringify(cards.map(c => [c.id, c.answer, c.options, c.before, c.after, c.context]));
for (const file of ['prefix-explanations.js', 'audited-explanations.js', 'reasoned-explanations.js', 'collection-rule-hints.js']) {
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context);
}
assert.equal(JSON.stringify(cards.map(c => [c.id, c.answer, c.options, c.before, c.after, c.context])), original);
const hint = c => c.explanation || context.window.EGE_HINTS.get(c.id);
for (const card of cards) {
  assert(hint(card)?.trim(), card.id);
  assert(!/Как проверить|Определите тип корня|Найдите главную|Верно: «/.test(hint(card)), card.id);
}
const find = word => cards.find(c => (c.spelling || c.before + c.answer + c.after) === word);
assert.match(hint(find('поближе')), /сравнительной степен/);
assert(!hint(find('поближе')).includes('Друзья даже подошли'));
assert.match(hint(find('пол-лица')), /дефис/);
assert.match(hint(find('полукруглую')), /ПОЛУ-/);
assert.match(hint(find('подчёркивать')), /подчёркиваю/);
assert.match(hint(find('стеклянной')), /исключения/);
for (const word of ['деревья', 'смириться', 'берёзовый']) {
  const card = find(word);
  if (card) assert(!/перед суффиксом -а-|без -а-/.test(hint(card)), word);
}
console.log('Collection rules, concrete examples, ambiguous roots and preserved card content: OK');
