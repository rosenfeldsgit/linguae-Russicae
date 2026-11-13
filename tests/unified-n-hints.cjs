'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const context = {window: {}};
const scripts = [...fs.readFileSync('index.html', 'utf8').matchAll(/<script[^>]+src="([^"]+)"/g)]
  .map(match => match[1].split('?')[0])
  .filter(file => !['app.js', 'poster.js', 'versions-link.js'].includes(file));
let original;
for (const file of scripts) {
  if (file === 'reasoned-explanations.js') {
    const cards = [...context.window.EGE_CARDS, ...context.window.EGE_ADAPTED_CARDS,
      ...context.window.EGE_COLLECTION_CARDS];
    original = JSON.stringify(cards.map(({explanation, ...card}) => card));
  }
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context, {filename: file});
}
const all = [...context.window.EGE_CARDS, ...context.window.EGE_ADAPTED_CARDS,
  ...context.window.EGE_COLLECTION_CARDS];
assert.equal(JSON.stringify(all.map(({explanation, ...card}) => card)), original);
const cards = all.filter(card => card.task === 15);
assert.equal(cards.length, 481);
for (const card of cards) {
  let word = card.before + card.answer + card.after;
  if (!card.before && !card.after) {
    const gap = card.prompt.match(/([а-яё]*)…([а-яё]*)/i);
    word = gap[1] + card.answer + gap[2];
  }
  const hint = card.explanation;
  assert(hint?.startsWith('«' + word + '» — '), card.id);
  assert.match(hint, /прилагательное|причастие|существительное|наречие|глагол|частица|повторное образование/, card.id);
  assert.match(hint, /одн(?:а|у|ой) Н|НН|две Н|двух Н/i, card.id);
  assert.equal(context.window.EGE_HINTS.get(card.id), hint, card.id);
  assert(!/полная форма причастия с суффиксом -нн-|В выделенном фрагменте/.test(hint), card.id);
}
const hint = word => cards.find(card => card.before + card.answer + card.after === word)?.explanation;
assert.match(hint('величественность'), /образовано от «величественный».*«величественный» — отыменное прилагательное.*-ЕНН-/);
assert.match(hint('путано'), /образовано от «путаный».*«путаный» — отглагольное прилагательное.*«путать».*несовершенного вида/);
assert.match(hint('масляное'), /«масло».*-ЯН-.*одной Н/);
assert.match(hint('масленый'), /«маслить».*-ЕН-.*одну Н/);
assert.match(hint('масленный'), /причастие.*специальной кисточкой.*НН/);
assert.match(hint('воспитана'), /краткое страдательное причастие.*всегда одна Н/);
assert.match(hint('воспитанна'), /краткое прилагательное.*«воспитанный».*НН/);
assert.match(hint('синей'), /прилагательное/);
assert(!/существительное/.test(hint('синей')));
console.log('All 481 task-15 hints follow the shared format and preserve parent rules, context and card data.');
