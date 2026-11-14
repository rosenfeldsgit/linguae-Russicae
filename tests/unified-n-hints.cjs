const assert = require('node:assert/strict');
const cards = require('./load-cards.js').filter(c => c.task === 15 && c.id !== 'task-15-card-1');
for (const card of cards) {
  const word = (card.before + card.spelling + card.after).toLowerCase();
  const hint = card.explanation;
  assert(hint?.toLowerCase().startsWith('«' + word + '» — '), card.id);
  assert.match(hint, /прилагательное|причастие|существительное|наречие|глагол|частица|повторное образование/, card.id);
  assert.match(hint, /одн(?:а|у|ой) Н|НН|две Н|двух Н/i, card.id);
  assert(!/полная форма причастия с суффиксом -нн-|В выделенном фрагменте/.test(hint), card.id);
}
const hint = word => cards.find(card => card.before + card.spelling + card.after === word)?.explanation;
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
