'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
let rows;
vm.runInNewContext(fs.readFileSync('cards/task-11.js', 'utf8'), {
  registerCards(task, cards) { assert.equal(task, 11); rows = JSON.parse(JSON.stringify(cards)); }
});
const audit = JSON.parse(fs.readFileSync('knowledge-base/audits/task-11-20261115.json', 'utf8'));
assert.equal(rows.length, 436);
// Preserve prompts, identities, options, answers and contextual distinctions.
const exercises = rows.map(({explanation, ...exercise}) => exercise);
assert.equal(crypto.createHash('sha256').update(JSON.stringify(exercises)).digest('hex'), audit.exerciseSha256);
const covered = Object.values(audit.ruleCardIds).flat().sort((a,b) => a-b);
assert.deepEqual(covered, rows.map(c => c.id));
const chapter = fs.readFileSync('knowledge-base/chapters/11.md', 'utf8');
for (const rule of Object.keys(audit.ruleCardIds)) assert(chapter.includes('### ' + rule + '.'));
const card = id => rows.find(c => c.id === id);
const hint = id => card(id).explanation;
for (const [id, checks] of [
  [312, [/Удва́иваться/, /я удва́иваюсь/, /ударение на первой а/, /-ива- сохраняется/]],
  [301, [/ге́левая/, /безударный/, /-ив-\/-ев-/]],
  [16, [/-ист-/, /всегда и/, /ударение.*не влияет/]],
  [113, [/я потчую/, /-ева-/, /-ую\/-юю/]],
  [110, [/повеле́ть/, /Убираем -ва-/]],
  [277, [/я чествую/, /-ова- с о/]],
  [53, [/нет горошка/, /Гласная выпадает/]],
  [59, [/нет ключика/, /сохраняется/]],
  [49, [/Вишня → вишенка/, /нет -ин-/]],
  [72, [/Пуговица → пуговичка/, /ц меняется на ч/]],
  [55, [/среднего рода/, /перед суффиксом/]],
  [79, [/ударении на окончании/, /-инств-/]],
  [89, [/ударении на корне/, /-енств-/]],
  [40, [/Отрадное/, /-ное, -ный, -но/, /не отдельное исключение/]],
  [138, [/-ён-\/-ённ-/, /под ударением/, /пишется ё/]],
  [175, [/-ён-\/-ённ-/, /пишется ё/]],
  [209, [/Стажёр → стажёрская/, /заимствованный суффикс/]],
  [316, [/досрочный/, /добавлен только суффикс -о/]],
  [377, [/суе́т/, /часть корня/]],
  [351, [/особой краткой форме/, /не применяется/]],
  [433, [/Закашлять → закашлял/, /перед суффиксом.*-л-/]],
]) for (const check of checks) assert.match(hint(id), check, 'card ' + id);
for (const id of [271,297,298,332,425]) {
  assert.match(hint(id), /я .*ваю/);
  assert.match(hint(id), /-ива- сохраняется/);
  assert(!hint(id).includes('-лив-'), 'false adjective suffix: ' + id);
}
for (const id of [153,171,281,318,354,361,429]) assert.match(hint(id), /исключение/);
for (const id of [98,103,413]) assert.match(hint(id), /направлено на кого-то или что-то/);
for (const id of [100,102,418,431]) assert.match(hint(id), /изменение состояния самого/);
for (const id of [258,276,308,414]) assert(!/одна Н|одна н/.test(hint(id)));
for (const c of rows) {
  assert(!/^В слове .*суффикс .*пишется с [а-яё]\.$/.test(c.explanation), c.id);
  assert(!/^\d:/.test(c.explanation), 'full-exam key leaked into a card: ' + c.id);
}
console.log('436 task-11 hints: full coverage, suffix checks, exceptions, exact gaps and unchanged exercises verified.');
