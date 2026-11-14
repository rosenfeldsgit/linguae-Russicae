'use strict';

window.EGE_TRAINER_CARDS = [];

function registerCards(task, rows) {
  for (const row of rows) {
    const { id, legacyId, word, choices, ...fields } = row;
    const card = { ...fields, id: legacyId || 'task-' + task + '-card-' + id, task,
      prompt: fields.prompt || word, before: fields.before || '', after: fields.after || '',
      options: choices };

    if (task === 15) {
      const spelling = row.answer.toLowerCase();
      const position = row.position ?? word.toLowerCase().indexOf(spelling);
      card.before = word.slice(0, position);
      card.after = word.slice(position + spelling.length);
      card.spelling = word.slice(position, position + spelling.length);
      card.prompt = card.before + '…' + card.after;
      card.kind = 'n_count';
    } else if (row.kind === 'stress') {
      const position = row.answer.search(/[АЕЁИОУЫЭЮЯ]/);
      card.before = word.slice(0, position);
      card.after = word.slice(position + 1);
      card.spelling = word[position];
      card.answer = String(position);
    } else if (row.kind === 'punctuation') {
      card.parts = word.split('¦');
    } else if (row.kind === 'word-choice' || row.kind === 'letter') {
      [card.before, card.after] = word.split(row.kind === 'letter' ? '…' : '___');
    }
    window.EGE_TRAINER_CARDS.push(card);
  }
}
