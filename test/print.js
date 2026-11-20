'use strict';
(() => {
  const {renderPassage, renderQuestion} = window.EGE_EXERCISES;
  const dialog = document.getElementById('print-dialog');
  const frame = document.getElementById('print-page');
  const printButton = document.getElementById('print-send');

  const stylesheet = `
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; }
    html { color-scheme: light; }
    body { margin: 0 auto; color: #151515; background: #fff; font: 11pt/1.28 Arial, sans-serif; overflow-wrap: anywhere; }
    h1 { margin: 0 0 .3em; font-size: 23pt; line-height: 1.08; }
    h2 { font-size: 15pt; }
    h2, h3, .part, .question-number { break-after: avoid; }
    h3 { margin: 0 0 .45em; font-size: 11pt; }
    p { margin: 0 0 .7em; orphans: 3; widows: 3; }
    .page-header { border-bottom: 1.3pt solid currentColor; margin-bottom: 7mm; padding-bottom: 4mm; }
    .page-header p:last-child { margin-bottom: 0; }
    .question-number { margin: 0 0 1mm; font-weight: bold; }
    .question, .passage { white-space: pre-wrap; orphans: 3; widows: 3; }
    .problem { margin: 0 0 4mm; }
    .problem.short { break-inside: avoid; }
    .passage { margin: 0 0 6mm; border-left: 1pt solid #666; padding-left: 4mm; }
    .inline-answer { margin: 2mm 0 0; break-before: avoid; }
    .matching-columns { display: grid; grid-template-columns: 1fr 1.2fr; gap: 5mm; white-space: normal; }
    .matching-columns section { min-width: 0; }
    .matching-columns section > div { white-space: pre-wrap; }
    .part { margin: 6mm 0 4mm; border-bottom: .75pt solid currentColor; }
    .blank { break-before: page; }
    .blank:first-child { break-before: auto; }
    .answer-grid { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(var(--answer-rows), auto); grid-auto-flow: column; column-gap: 6mm; }
    .answer-row { display: grid; align-items: center; grid-template-columns: 8mm repeat(17, minmax(0, 1fr)); break-inside: avoid; margin-bottom: 1.4mm; }
    .answer-row i { display: block; height: 5.5mm; border: .55pt solid #555; border-right: 0; }
    .answer-row i:last-child { border-right: .55pt solid #555; }
    .answer-row span { font-weight: bold; }
    .essay-line { height: 7mm; border-bottom: .55pt solid #666; }
    @media screen {
      body { max-width: 210mm; padding: clamp(10px, 3vw, 15mm); }
      .blank:not(:first-child) { border-top: 2pt solid #151515; margin-top: 15mm; padding-top: 8mm; }
    }
    @media screen and (max-width: 610px) {
      .answer-grid, .matching-columns { grid-template-columns: 1fr; }
      .answer-grid { grid-template-rows: none; grid-auto-flow: row; }
    }
  `;

  function element(tag, text = '', className = '') {
    const node = document.createElement(tag);
    node.textContent = text;
    node.className = className;
    return node;
  }

  function header(title, subtitle, fields) {
    const block = element('header', '', 'page-header');
    block.append(element('h1', title), element('p', subtitle), element('p', fields));
    return block;
  }

  function appendExam(output, questions, variant) {
    const title = variant?.title || 'Пробник по русскому языку';
    const duration = variant?.minutes ? ` · ${variant.minutes} минут` : '';
    output.append(header(title, `Руса Лингво · Русский язык · ${questions.length} заданий${duration}`, 'ФИО ___________________________________   Класс ______'));
    output.append(element('p', 'Записывайте краткие ответы в бланк № 1. Для сочинения используйте бланк № 2.'));
    const passages = new Set();
    let previousPart;
    for (const question of questions) {
      const essay = question.answerType === 'essay';
      const part = essay ? 'Часть 2 · Сочинение' : 'Часть 1 · Краткие ответы';
      if (part !== previousPart) output.append(element('h2', part, 'part'));
      previousPart = part;
      if (question.passage && !passages.has(question.passage)) {
        passages.add(question.passage);
        const group = questions.filter(entry => entry.passage === question.passage).map(entry => entry.task);
        const groupHeading = group.length === 1 ? `Текст к заданию ${group[0]}` : `Текст к заданиям ${group.join(', ')}`;
        const passage = element('div');
        renderPassage(passage, question);
        passage.querySelector('.passage-toggle')?.remove();
        output.append(element('h3', groupHeading), passage);
      }
      const section = element('section', '', question.prompt.length < 1800 ? 'problem short' : 'problem');
      const source = !variant && question.source?.title?.startsWith('СтатГрад') ? ` · ${question.source.title}` : '';
      section.append(element('h3', `Задание ${question.task}${source}`, 'question-number'));
      const prompt = element('div', '', 'question');
      renderQuestion(prompt, question);
      section.append(prompt);
      if (!essay) section.append(element('p', 'Ответ: ______________________________', 'inline-answer'));
      output.append(section);
    }
  }

  function appendForms(output, tasks, variant) {
    const fields = 'ФИО ___________________________________   Класс ______';
    const subtitle = variant?.title ? `Тренировочный бланк · ${variant.title}` : 'Тренировочный бланк · Русский язык';
    const shortTasks = tasks.filter(task => task < 27);
    if (shortTasks.length) {
      const sheet = element('section', '', 'blank');
      sheet.append(header('Бланк ответов № 1', subtitle, fields));
      sheet.append(element('p', 'Пишите по одному символу в клетку. Записывайте ответы без пробелов и запятых.'));
      const grid = element('div', '', 'answer-grid');
      grid.style.setProperty('--answer-rows', Math.ceil(shortTasks.length / 2));
      for (const task of shortTasks) {
        const row = element('div', '', 'answer-row');
        row.append(element('span', String(task)));
        for (let i = 0; i < 17; i++) row.append(element('i'));
        grid.append(row);
      }
      sheet.append(grid);
      const corrections = element('p', 'Замена ответа: № ______   Новый ответ ____________________________');
      corrections.style.marginTop = '8mm';
      sheet.append(corrections);
      output.append(sheet);
    }
    if (tasks.includes(27)) {
      for (const page of [1, 2]) {
        const sheet = element('section', '', 'blank');
        sheet.append(header(`Бланк ответов № 2 · лист ${page}`, subtitle, fields));
        sheet.append(element('p', page === 1 ? 'Задание 27. Напишите сочинение разборчиво.' : 'Задание 27. Продолжение сочинения.'));
        for (let i = 0; i < 30; i++) sheet.append(element('div', '', 'essay-line'));
        output.append(sheet);
      }
    }
  }

  function open(questions = [], variant = null) {
    const output = document.createElement('main');
    if (questions.length) appendExam(output, questions, variant);
    else appendForms(output, Array.from({length: 27}, (_, i) => i + 1), variant);
    printButton.disabled = true;
    frame.srcdoc = '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Руса Лингво — материалы для печати</title><style>' + stylesheet + '</style></head><body>' + output.outerHTML + '</body></html>';
    if (!dialog.open) dialog.showModal();
  }

  frame.addEventListener('load', () => { printButton.disabled = !frame.hasAttribute('srcdoc'); });
  printButton.addEventListener('click', () => frame.contentWindow.print());
  window.EGE_PRINT = {open};
})();
