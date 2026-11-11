'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('app.js', 'utf8');
const context = {};
vm.runInNewContext(source.slice(source.indexOf(' const random='), source.indexOf(' function solution(')) +
  '\nthis.createRotation=createRotation;this.nextCard=nextCard;this.exerciseKey=exerciseKey;', context);
const card = (id, prompt = 'пр…брежный', answer = 'и', extra = {}) =>
  ({id, task: 10, kind: 'letter', prompt, before: 'пр', after: 'брежный', answer, ...extra});
const originals = [card('a'), card('b', '', 'е', {before: 'пр', after: 'града'}),
  card('c', '', 'ы', {before: 'пред', after: 'стория'})];
const duplicated = [...originals, card('copy-of-a')];
const state = context.createRotation(duplicated);
assert.equal(state.groups.size, 3);
let previous;
for (let round = 0; round < 100; round++) {
  const keys = Array.from({length: 3}, () => context.exerciseKey(context.nextCard(state)));
  assert.equal(new Set(keys).size, 3);
  assert.notEqual(keys[0], previous);
  previous = keys.at(-1);
}
const single = context.createRotation([originals[0]]);
assert.equal(context.nextCard(single).id, 'a');
assert.equal(context.nextCard(single).id, 'a');
assert.notEqual(context.exerciseKey(card('x', '', 'и', {context: 'в городе'})),
  context.exerciseKey(card('y', '', 'и', {context: 'в гости'})));
assert.notEqual(context.exerciseKey(card('x')), context.exerciseKey(card('y', '', 'е')));
const unconsumed = context.createRotation(originals);
context.nextCard(unconsumed);
const second = context.createRotation(originals);
context.nextCard(second);
assert.equal(unconsumed.remaining.length, 2);
context.nextCard(unconsumed);
assert.equal(unconsumed.remaining.length, 1);
console.log('Rotation rounds, duplicate IDs, round boundaries, single card, contexts and independent queues OK');
