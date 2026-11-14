const assert = require('node:assert/strict');
const cards = require('./load-cards.js');
const hint = c => c.explanation || '';
const word = c => {
  const left = (c.before || '').replace(/\u0301/g, '').match(/[а-яё]+$/i)?.[0] || '';
  const right = (c.after || '').replace(/\u0301/g, '').match(/^[а-яё]+/i)?.[0] || '';
  return left + c.answer + right;
};
const find = text => cards.filter(c => c.task === 12 && word(c) === text);
for (const [text, expected] of [
  ['услышишь', 'Слышать — исключение, II спряжение. В окончании -ишь пишется И.'],
  ['слышим', 'Слышать — исключение, II спряжение. В окончании -им пишется И.'],
  ['слышащий', 'Слышать — исключение, II спряжение. В суффиксе -ащ- пишется А.'],
  ['просмотришь', 'Просмотреть — от смотреть (исключение), II спряжение. В окончании -ишь пишется И.'],
  ['бреешься', 'Бриться — исключение, I спряжение. В окончании -ешь пишется Е.'],
  ['захочешь', 'Захотеть — разноспрягаемый глагол. В окончании -ешь пишется Е.'],
]) {
  const matches = find(text);
  assert(matches.length, text);
  for (const card of matches) assert.equal(hint(card), expected, card.id);
}
for (const text of ['догоняемый', 'обгоняемый', 'рассматривает']) {
  for (const card of find(text)) assert(!/исключение/.test(hint(card)), card.id);
}
for (const card of find('зависевший')) {
  assert.match(hint(card), /гласная инфинитива/);
  assert(!/спряжение/.test(hint(card)));
}
let count = 0;
for (const card of cards.filter(c => c.task === 12)) {
  const h = hint(card);
  if (!/спряжен|спр\.|разноспрягаем/.test(h)) continue;
  count++;
  assert(!/Запомни спряжение|Форма:|или -им-|или -ем-|И \/ Я/.test(h), card.id);
  assert.match(h, /В (?:окончании|суффиксе) -[а-яё]+-? пишется [АЕЁИОУЫЭЮЯ]\.$/, card.id);
}
assert(count >= 300);
console.log(`Conjugation cues: ${count} forms, exceptions, endings vs suffixes, duplicate cards and unchanged keys: OK`);
