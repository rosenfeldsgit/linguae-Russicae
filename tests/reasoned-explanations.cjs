const assert = require('node:assert/strict');
const all = require('./load-cards.js');
for(const [word,rule] of [['студёный','несовершенного вида'],['русско-китайского','равноправные основы'],['вбок','пространственное наречие'],['труженик','суффикс -еник-'],['вдвоём','собирательное числительное']]){
 const c=all.find(c=>(c.kind==='n_count'?c.before+c.spelling+c.after:c.spelling||c.before+c.answer+c.after)===word);assert(c&&c.explanation.toLocaleLowerCase('ru').includes(rule.toLocaleLowerCase('ru')),word);
}
const bare=all.filter(c=>[14,15].includes(c.task)&&/^Запомни(ть)? (слитное|раздельное|дефисное|одну|написание)/.test(c.explanation||''));
assert.equal(bare.length,0);
console.log('Task 14–15 explanations OK');
