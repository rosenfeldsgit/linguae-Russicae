'use strict';
const assert = require('node:assert/strict');
const {fitWidths, resizeWidths, percentages} = require('../edit/table-layout.js');
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < .00001, `${actual} differs from ${expected}`);
for (const total of [248, 288, 358, 700, 832]) {
  for (const count of [1, 2, 3, 5, 12]) {
    const initial = Array.from({length: count}, (_, i) => i ? 100 : 1800);
    for (const requested of [-500, 48, 240, 2000, 50000]) {
      const result = resizeWidths(initial, 0, requested, total);
      close(result.reduce((sum, value) => sum + value, 0), total);
      assert.ok(result.every(value => value >= Math.min(48, total / (count * 2)) - .00001));
      close(percentages(result).reduce((sum, value) => sum + value, 0), 100);
    }
  }
}
close(resizeWidths([200, 300, 300], 0, 400, 800)[0], 400);
assert.deepEqual(resizeWidths([200], 0, 9000, 320), [320]);
close(fitWidths([240, 768], 320).reduce((sum, value) => sum + value, 0), 320);
const proportions = percentages([240, 768]);
close(proportions[0] / proportions[1], 240 / 768);
assert.deepEqual(fitWidths([], 320), []);
console.log('Table widths stay within mobile and desktop content; percentages sum to 100%.');
