const fs = require('node:fs');
const assert = require('node:assert/strict');
const cards = require('./load-cards.js').filter(c => c.id.startsWith('paronym-'));
const sources = JSON.parse(fs.readFileSync('data/paronyms-source.json','utf8'));
const excluded = JSON.parse(fs.readFileSync('data/paronyms-excluded.json','utf8'));
const ids = new Set();
assert.equal(cards.length,141);
assert.equal(cards.length + excluded.length,180);
assert.equal(new Set(cards.map(c=>c.sourceVariant)).size,36);
for (const c of cards) {
 assert(!ids.has(c.id)); ids.add(c.id);
 assert.equal(c.task,5);
 assert.equal(c.kind,'word-choice');
 assert(c.options.length >= 2 && c.options.length <= 6);
 assert.equal(new Set(c.options).size,c.options.length);
 assert.equal(c.options.filter(o=>o===c.answer).length,1);
 assert.equal(c.explanation.split('\n').length,c.options.length);
 assert(!/[А-ЯЁ]{2,}/.test(c.before+c.after));
 assert(!/___/.test(c.before+c.after));
 const q = sources.find(q=>q.v===c.sourceVariant);
 const sentences=q.prompt.split(/\n\s*\n/).slice(1).join('\n').split('\n').filter(Boolean);
 const original=sentences[c.sourceSentence-1];
 const word=original.match(/[А-ЯЁ]{2,}/)[0];
 assert.equal(original.replace(word,''),c.before+c.after);
 assert(c.options.includes(word.toLowerCase()),`Missing source word: ${c.id}`);
 if (word.toLowerCase()!==c.answer) assert(q.answers.includes(c.answer),`Key mismatch: ${c.id}`);
}
for (const [v,s] of [[7,1],[12,2],[18,3],[23,2],[25,5],[27,5],[35,4]]) {
 assert(!cards.some(c=>c.sourceVariant===v&&c.sourceSentence===s),'Ambiguous context included');
}
console.log('Paronyms: 141 cards, 36 variants, unique IDs, source text, answer keys, choices and explanations verified.');
