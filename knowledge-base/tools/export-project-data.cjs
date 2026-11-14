'use strict';
// Export current static card banks without loading the app, API or administrator records.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repo = path.resolve(__dirname, '../..');
const args = process.argv.slice(2);
const destination = args.find(argument => !argument.startsWith('--'));
const target = path.resolve(destination || path.join(repo, 'knowledge-base/data'));
const context = {window: {}};
const banks = fs.readdirSync(path.join(repo, 'cards')).filter(file => /^task-\d+\.js$/.test(file));
for (const file of ['catalog.js', ...banks]) {
  vm.runInNewContext(fs.readFileSync(path.join(repo, 'cards', file), 'utf8'), context, {filename: file});
}
const cards = context.window.EGE_TRAINER_CARDS;
const metadata = {
  asOf: new Date().toISOString().slice(0, 10),
  scope: 'current_repository_snapshot',
  official2027FullList: false,
  managedOverridesIncluded: false,
};
fs.mkdirSync(target, {recursive: true});
function write(name, value) {
  fs.writeFileSync(path.join(target, name), JSON.stringify(value, null, 2) + '\n');
}

// Preserve the original FIPI vocabulary subset rather than mixing in collection exercises.
const stress = cards.filter(card => card.task === 4 && card.id.startsWith('stress-')).map(card => {
  const index = Number(card.answer);
  const form = card.prompt.slice(0, index) + card.prompt[index].toUpperCase() + card.prompt.slice(index + 1);
  return {form, word: card.prompt.toLowerCase(), stressIndex: index, context: card.context || ''};
});
write('stress-words.json', {
  metadata: {
    ...metadata,
    source: 'cards/task-4.js: original stress-* entries from the FIPI 2026 subset',
    verification: 'Project spellings retained; not a new word-by-word verification against 2027 normative dictionaries',
  },
  entries: stress,
});

const paronyms = cards.filter(card => card.task === 5 && card.id.startsWith('paronym-'));
const groups = new Map();
for (const card of paronyms) {
  const key = card.options.map(form => form.toLowerCase()).sort().join('|');
  if (!groups.has(key)) {
    groups.set(key, {
      id: 'PG-' + String(groups.size + 1).padStart(3, '0'),
      forms: [...card.options],
      meanings: card.explanation,
      cardIds: [],
    });
  }
  groups.get(key).cardIds.push(card.id);
}
write('paronym-groups.json', {
  metadata: {
    ...metadata,
    verification: 'Existing authored project meanings; groups distinguish inflected forms, not necessarily unique lemma families',
  },
  groups: [...groups.values()],
});
const counts = {};
for (const card of cards) counts[card.task] = (counts[card.task] || 0) + 1;
write('current-inventory.json', {
  metadata,
  cardCountsByTask: counts,
  stressForms: stress.length,
  paronymGroups: groups.size,
  paronymCards: paronyms.length,
});
if (args.includes('--with-hints')) {
  write('card-explanations.json', {
    metadata: {...metadata, verification: 'Current authored card annotations. Prefer normative sources for linguistic verification.'},
    entries: cards.map(card => ({
      id: card.id,
      task: card.task,
      kind: card.kind,
      explanation: card.explanation || '',
    })),
  });
}
console.log(JSON.stringify({target, stressForms: stress.length, paronymGroups: groups.size, projectCards: cards.length}));
