const assert = require('node:assert/strict');
const cards = require('./load-cards.js').filter(c => c.id.startsWith('book-') && c.kind !== 'stress');
const hint = c => c.explanation || '';
for (const card of cards) {
  assert(hint(card)?.trim(), card.id);
  assert(!/Как проверить|Определите тип корня|Найдите главную|Верно: «/.test(hint(card)), card.id);
}
const find = word => cards.find(c => ((c.kind === 'n_count' ? c.before + c.spelling + c.after : c.spelling || c.before + c.answer + c.after)) === word);
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
assert.match(hint(find('необитаемый (остров)')), /обитать.*I спряжение/);
// A spelling label alone must not replace the morphological reason.
assert.match(hint(find('набелённые')), /набелить/);
assert.match(hint(find('набелённые')), /совершенного вида/);
assert.match(hint(find('набелённые')), /-ённ-/i);
assert.match(hint(find('рафинированное')), /прилагательное/);
assert.match(hint(find('рафинированное')), /-ированный/i);
assert.match(hint(find('отправленное (письмо)')), /отправить/);
assert.match(hint(find('отправленное (письмо)')), /-енн-/);
assert.match(hint(find('рассеянной')), /прилагательное/);
assert.match(hint(find('картонными')), /Н основы.*суффикс -н-/i);
assert.match(hint(find('нарисована')), /кратких страдательных причастиях всегда одна Н/);
for (const card of cards.filter(c => [12, 15].includes(c.task))) {
  assert(!/полная форма причастия с суффиксом -нн-|У полного страдательного причастия «[^»]+» в суффиксе пишется|В суффиксе -енн-\/-онн- пишутся две Н/.test(hint(card)), card.id);
}
console.log('Collection rules, concrete examples, ambiguous roots and preserved card content: OK');
