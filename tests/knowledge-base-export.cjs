'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const cards = require('./load-cards.js');

const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'russian-kb-export-'));
try {
  execFileSync(process.execPath, ['knowledge-base/tools/export-project-data.cjs', '--with-hints', destination]);
  const read = name => JSON.parse(fs.readFileSync(path.join(destination, name), 'utf8'));
  const inventory = read('current-inventory.json');
  const counts = {};
  for (const card of cards) counts[card.task] = (counts[card.task] || 0) + 1;
  assert.deepEqual(inventory.cardCountsByTask, counts);

  const hints = read('card-explanations.json').entries;
  const byId = new Map(hints.map(entry => [entry.id, entry]));
  assert.equal(hints.length, cards.length);
  for (const card of cards) {
    assert.equal(byId.get(card.id).explanation, card.explanation || '', card.id);
  }

  const stress = read('stress-words.json').entries;
  const existingStress = JSON.parse(fs.readFileSync('knowledge-base/data/stress-words.json', 'utf8')).entries;
  assert.deepEqual(stress, existingStress);
  const paronyms = cards.filter(card => card.task === 5 && card.id.startsWith('paronym-'));
  const groups = read('paronym-groups.json').groups;
  assert.equal(groups.flatMap(group => group.cardIds).length, paronyms.length);
  assert.equal(inventory.paronymCards, paronyms.length);
  console.log('Knowledge-base export reads current card banks, preserves the stress vocabulary and exports current explanations.');
} finally {
  fs.rmSync(destination, {recursive: true, force: true});
}
