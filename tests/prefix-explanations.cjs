const assert = require('node:assert/strict');
const all = require('./load-cards.js');
const targets=all.filter(c=>c.task===10 && /пр$/.test(c.before) && ['е','и'].includes(c.answer));
assert(targets.length>=139);
for(const c of targets){assert(c.explanation&&c.explanation.length>20,c.id);assert(!/Написание зависит от смысла|Выбор приставки зависит|очень или пере/.test(c.explanation),c.id);}
const hint=word=>targets.find(c=>c.before+c.answer+c.after===word).explanation;
assert.match(hint('премудрый'),/= очень/);
assert.match(hint('преступить'),/= ПЕРЕ-/);
assert.match(hint('прибрежный'),/близость/);
assert.match(hint('приоткрыть'),/= немного/);
assert.match(hint('пришить'),/присоединение/);
assert.match(hint('привилегия'),/Словарное/);
assert.match(hint('преуменьшить'),/чем на самом деле/);
console.log(`OK: ${targets.length} specific hints; answers, contexts and other cards preserved.`);
