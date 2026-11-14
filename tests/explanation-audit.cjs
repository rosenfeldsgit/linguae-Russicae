const fs=require('node:fs'),vm=require('node:vm'),ctx={window:{}};
const assert = require('node:assert/strict');
const all = require('./load-cards.js');
const find=w=>all.find(c=>c.task===9&&c.before+c.answer+c.after===w);
assert.match(find('старожил').explanation,/стАрый/);
assert.match(find('сторожил').explanation,/стОрож/);
assert.match(find('вождение').explanation,/суффикс -ени-/);
assert.match(find('платяной').explanation,/плАтье/);
for(const [task,word,part]of [[11,'беседовать','беседую'],[12,'бреющий','исключение'],[15,'воспитана','краткое страдательное причастие'],[15,'воспитанна','краткое прилагательное'],[14,'вблизи','наречие']]){
 const c=all.find(c=>c.task===task&&(c.kind==='n_count'?c.before+c.spelling+c.after:c.spelling||c.before+c.answer+c.after)===word);assert(c,word);assert(c.explanation.includes(part),word);
}
vm.runInNewContext(fs.readFileSync('test/bank.js','utf8'),ctx);
const examAnswers=ctx.window.EGE_EXAM_BANK.map(q=>JSON.stringify(q.answers));
vm.runInNewContext(fs.readFileSync('exam-explanations.js','utf8'),ctx);
assert.deepEqual(ctx.window.EGE_EXAM_BANK.map(q=>JSON.stringify(q.answers)),examAnswers);
assert.match(ctx.window.EGE_EXAM_BANK.find(q=>q.id==='doshchinsky-2027-v1-q23').explanation,/НЕ соответствующие/);
assert.match(ctx.window.EGE_EXAM_BANK.find(q=>q.id==='doshchinsky-2027-v1-q24').explanation,/ОШИБОЧНЫЕ/);
console.log('OK: exam reviews retain answer keys and explain reversed instructions correctly.');
