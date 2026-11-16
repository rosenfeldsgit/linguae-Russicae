'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
// Baselines omit only the two explanation fields; all exercise data is covered.
const baselines = {2026: '511b86a9442f0fd974ba987bd7a3efa11e584c918d6ab78eff0453b483c25773',
  2027: 'a15425257cda4b8cbe6072984cfb51a51f1abeb1591ce4f71ad235ea30da0309'};
for (const year of [2026, 2027]) {
  const data = JSON.parse(fs.readFileSync(`test/doshchinsky-${year}/v3.json`, 'utf8'));
  const covered = data.questions.filter(q => q.task >= 4 && q.task <= 15);
  assert.equal(covered.length, 12);
  for (const q of covered) {
    assert(q.explanation.length > 80, q.id);
    assert(q.answers.some(answer => q.explanation.toLocaleLowerCase('ru').includes(answer.toLocaleLowerCase('ru'))), q.id + ': explain the keyed answer');
    assert(q.explanationSources.length > 0, q.id);
    for (const source of q.explanationSources) {
      assert(source.title.length > 10);
      assert.equal(new URL(source.url).protocol, 'https:');
    }
    if (q.task >= 9 && q.task <= 14) assert(q.explanation.includes('Не подходят:') || q.task === 13, q.id + ': explain rejected options');
    if (q.task === 8) for (const letter of ['А', 'Б', 'В', 'Г', 'Д']) assert(q.explanation.includes(letter + '–'), q.id);
  }
  const q = task => covered.find(q => q.task === task);
  if (year === 2026) {
    assert(q(7).explanation.includes('разговорный вариант'));
    assert(q(12).explanation.includes('стелить — исключение'));
    assert(q(15).explanation.includes('краткое страдательное причастие'));
  } else {
    assert(q(10).explanation.includes('С входит в корень'));
    assert(q(11).explanation.includes('Ковшик → ковшика'));
    assert(q(11).explanation.includes('подразумевать — словарное -ева-'));
    assert(q(15).explanation.includes('Повиноваться — одна Н'));
  }
  for (const question of data.questions) {delete question.explanation; delete question.explanationSources;}
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex'), baselines[year], year + ': exercise content must stay unchanged');
}
console.log('24 sourced explanations, row-by-row decisions, grammar corrections and unchanged variant data OK');
