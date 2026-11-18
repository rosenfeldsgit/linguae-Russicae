const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const ctx = {window: {}};
function run(file) {
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx, {filename: file});
}
const html = fs.readFileSync('index.html', 'utf8');
const banks = [...html.matchAll(/src="(cards\/task-\d+\.js)(?:\?[^"\s]*)?"/g)].map(match => match[1]);
assert.deepEqual(banks.slice().sort(), fs.readdirSync('cards').filter(f => f.startsWith('task-')).map(f => 'cards/' + f).sort());
run('cards/catalog.js');
const register = ctx.registerCards;
ctx.registerCards = (task, rows) => {
  assert.equal(new Set(rows.map(c => c.id)).size, rows.length);
  for (const c of rows) {
    assert(Number.isInteger(c.id) && c.id > 0 && c.word.length);
    if (task === 4) {
      assert.equal(c.answer.toLowerCase(), c.word);
      assert.equal(c.answer.match(/[АЕЁИОУЫЭЮЯ]/g).length, 1);
      assert(!('explanation' in c));
    } else {
      assert(c.explanation.trim());
    }
    if (task === 15) {
      assert.deepEqual(Array.from(c.choices), ['Н', 'НН']);
      assert(c.choices.includes(c.answer));
    }
  }
  register(task, rows);
};
banks.forEach(run);
const cards = ctx.window.EGE_TRAINER_CARDS;
assert.equal(new Set(cards.map(c => c.id)).size, cards.length);
for (const card of cards) {
  if (card.task === 15) assert.equal(card.spelling.toUpperCase(), card.answer, card.id);
  if (card.kind === 'punctuation') assert(card.answer.every(i => i >= 0 && i < card.parts.length - 1));
  else if (card.kind !== 'stress') assert(card.options.includes(card.answer), card.id);
}
console.log(banks.length + ' banks, ' + cards.length + ' cards verified');
ctx.registerCards = register;
run('cards/fipi-2027.js');
const demo = cards.filter(card => card.id.startsWith('fipi-2027-demo-card-'));
assert.deepEqual(Array.from(demo, card => card.task).sort((a, b) => a - b), Array.from({length: 27}, (_, i) => i + 1));
for (const card of demo) {
  assert(card.explanation.trim() && card.sourceUrl.startsWith('https://fipi.ru/'));
  if (card.kind === 'punctuation') assert(card.answer.every(i => i >= 0 && i < card.parts.length - 1));
  else if (card.kind === 'stress') assert(Number(card.answer) >= 0 && card.spelling === 'о');
  else assert(card.options.includes(card.answer), card.id);
}
assert.equal(demo.find(card => card.task === 15).spelling.toUpperCase(), 'НН');
assert(demo.filter(card => card.task >= 16 && card.task <= 21).every(card => card.kind === 'punctuation'));
