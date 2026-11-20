'use strict';
(() => {
  const managed = window.EGE_MANAGED || {exams:[],disabled:[],tasks:{}};
  const config = {...window.EGE_EXAM_CONFIG, tasks:{...window.EGE_EXAM_CONFIG.tasks,...managed.tasks}};
  let preparing = false;
  const {bank: exercises, score, renderPassage, renderQuestion, renderAnswer} = window.EGE_EXERCISES;
  const byId = new Map(exercises.map(question => [question.id, question]));
  const disabled = new Set(managed.disabled);
  const bank = [...exercises, ...window.EGE_ESSAY_QUESTIONS
    .filter(question => !disabled.has(question.id) && !byId.has(question.id))
    .map(question => ({...question, passageSource: byId.get(question.passageSource.id) || question.passageSource}))];
  const bookCatalog = {
    2026: 'https://www.nobr.ru/catalog/ege/ege/4955/',
    2027: 'https://www.nobr.ru/catalog/ege/ege/7910/',
  };
  const $ = id => document.getElementById(id);
  let session = null;
  let interval = null;
  const readyVariants = window.EGE_READY_VARIANTS;
  if (bank.some(question => question.task === 27)) config.tasks[27] = {number: 27, maxPrimary: 22};
  const randomItem = items => items[Math.floor(Math.random() * items.length)];
  const time = ms => {
    const seconds = Math.floor(ms / 1000);
    return [Math.floor(seconds / 60), seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
  };
  function essaySource(question) {
    const {title, variant} = question.source;
    return Number.isInteger(variant) ? `${title} · Вариант ${variant}` : title;
  }
  function updateEssayInput(value) {
    const words = value.match(/\p{L}+(?:[-‑]\p{L}+)*/gu)?.length || 0;
    $('essay-count').textContent = `Слов ≈ ${words}`;
    $('essay-draft-download').disabled = !value.trim();
  }
  function renderEssayReview(question, answer) {
    $('essay-review').hidden = false;
    $('essay-review-source').textContent = essaySource(question);
    $('essay-review-problem').textContent = question.problem || '';
    $('essay-review-problem').hidden = !question.problem;
    $('essay-submission').textContent = answer.trim() ? answer : 'Сочинение не написано.';
    $('essay-result-download').hidden = !answer.trim();
    $('essay-info').open = false;
    $('essay-info').hidden = !question.authorPosition;
    $('essay-author-position').textContent = question.authorPosition || '';
    const keyUrl = bookCatalog[question.essayYear] || question.source.url;
    $('essay-key').hidden = !keyUrl;
    if (keyUrl) $('essay-key').href = keyUrl;
    $('essay-key').textContent = question.answerPage ? `Издание · ключ на с. ${question.answerPage}` : 'Источник задания';
    $('essay-criteria').href = question.source.date ? '../theory/#task-27' : question.source.url || '../theory/#task-27';
  }
  function selection() {
    return [...$('setup').querySelectorAll('input:checked')].map(input => Number(input.value));
  }
  function updateSelection() {
    const numbers = selection();
    const points = numbers.filter(n => n !== 27).reduce((sum, n) => sum + config.tasks[n].maxPrimary, 0);
    const essayNote = numbers.includes(27) ? ' Сочинение проверяется вручную (до 22 баллов).' : '';
    const part1 = points ? ` Максимум за часть 1 — ${points} первичных баллов.` : '';
    $('selection-summary').textContent = `Выбрано заданий — ${numbers.length}.${part1}${essayNote}`;
    $('start').disabled = !numbers.length;
    $('print-selected').disabled = !numbers.length;
  }
  function saveTime() {
    if (!session || session.finished) return;
    const now = performance.now();
    session.elapsed[session.index] += now - session.enteredAt;
    session.enteredAt = now;
  }
  function updateClock() {
    if (!session || session.finished) return;
    const now = performance.now();
    $('total-time').textContent = time(now - session.startedAt);
    $('task-time').textContent = time(session.elapsed[session.index] + now - session.enteredAt);
  }
  function updateNavigation() {
    for (const button of $('task-nav').children) {
      const index = Number(button.dataset.index);
      button.classList.toggle('answered', Boolean(session.answers[index].trim()));
      if (index === session.index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
      button.setAttribute('aria-label', `Задание ${session.questions[index].task}${session.answers[index].trim() ? ', ответ записан' : ''}`);
    }
  }
  function showQuestion(index, focus = true) {
    saveTime();
    session.index = index;
    const question = session.questions[index];
    const isEssay = question.answerType === 'essay';
    $('question-title').textContent = session.variant
      ? `Задание ${question.task}`
      : `Задание ${question.task} · #${question.displayId}`;
    $('weight').textContent = `${isEssay ? 'до ' : ''}${question.maxPrimary} ${question.maxPrimary === 1 ? 'балл' : 'балла'}`;
    $('source').textContent = isEssay ? essaySource(question) : question.source.title;
    renderPassage($('passage'), question, session.passageCollapsed[index], collapsed => {
      session.passageCollapsed[index] = collapsed;
    });
    renderQuestion($('question'),question);
    $('short-answer').hidden = isEssay;
    $('essay-answer').hidden = !isEssay;
    $('essay').value = isEssay ? session.answers[index] : '';
    if (isEssay) updateEssayInput(session.answers[index]);
    $('answer').value = session.answers[index];
    $('answer').inputMode = question.answerType === 'word' ? 'text' : 'numeric';
    $('answer-help').textContent = question.answerType === 'matching' ? 'Пять цифр в порядке А, Б, В, Г, Д.' : question.answerType === 'word' ? 'Слово или сочетание слов.' : 'Запишите цифры без пробелов и запятых.';
    $('previous').disabled = index === 0;
    $('next').textContent = index === session.questions.length - 1 ? 'К завершению' : 'Далее';
    $('finish-confirm').hidden = true;
    updateNavigation();
    updateClock();
    if (focus) $('question-title').focus();
  }
  async function loadSelectedQuestions() {
    const numbers = selection();
    if (!numbers.length) return;
    // Номера, опирающиеся на один текст, получают общий вариант источника.
    const variants = {};
    const groups = new Map();
    for (const question of bank) {
      const {title, variant} = question.source;
      const imported = /^doshchinsky-(?:2026|2027)-/.test(question.id) &&
        /^(?:legacy-|book-2026-)(\d+)$/.exec(variant);
      const key = JSON.stringify([title, imported ? Number(imported[1]) : variant]);
      if (!groups.has(key)) groups.set(key, new Map());
      const tasks = groups.get(key);
      if (!tasks.has(question.task)) tasks.set(question.task, []);
      tasks.get(question.task).push(question);
    }
    const selected = numbers.map(task => {
      const shared = task <= 3 ? [1, 2, 3] : task >= 23 && task <= 27 ? [23, 24, 25, 26, 27] : [task];
      const key = shared[0];
      if (!variants[key]) {
        const needed = shared.filter(n => numbers.includes(n));
        const compatible = [...groups.values()].filter(tasks => needed.every(n => tasks.has(n)));
        if (!compatible.length) throw new Error('Нет полного комплекта заданий для общего текста');
        variants[key] = randomItem(compatible);
      }
      return randomItem(variants[key].get(task));
    });
    return Promise.all(selected.map(window.EGE_EXAM_LOADER.load));
  }
  function cleanPassages(questions) {
    // Some 2027 passages carry a scan transcription of the essay instructions at the end.
    return questions.map(question => {
      if (question.task < 23 || !question.passage) return question;
      const passage = question.passage.split(/\n+\*\*Задание 27\.\*\* Напишите сочинение-рассуждение/u, 1)[0].trimEnd();
      return passage === question.passage ? question : {...question, passage};
    });
  }
  function startSession(questions, variant, startButton) {
    questions = cleanPassages(questions);
    const now = performance.now();
    session = { questions, variant, startButton, passageCollapsed: questions.map(() => false), answers: questions.map(() => ''), elapsed: questions.map(() => 0), index: 0, startedAt: now, enteredAt: now, finished: false };
    $('setup').hidden = true;
    $('ready-variants').hidden = true;
    $('results').hidden = true;
    $('session').hidden = false;
    $('task-nav').replaceChildren();
    questions.forEach((question, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = question.task;
      button.dataset.index = index;
      button.addEventListener('click', () => showQuestion(index));
      $('task-nav').append(button);
    });
    showQuestion(0);
    clearInterval(interval);
    interval = setInterval(updateClock, 250);
  }
  function confirmFinish() {
    const missing = session.answers.filter(answer => !answer.trim()).length;
    $('finish-message').textContent = missing ? `Заданий без ответа — ${missing}. Завершить пробник?` : 'Проверить ответы и показать результат?';
    $('finish-confirm').hidden = false;
    $('confirm-finish').focus();
  }
  function finish() {
    if (!session || session.finished) return;
    saveTime();
    const duration = performance.now() - session.startedAt;
    session.finished = true;
    clearInterval(interval);
    let total = 0;
    let maximum = 0;
    $('result-rows').replaceChildren();
    session.questions.forEach((question, index) => {
      if (question.answerType === 'essay') {
        renderEssayReview(question, session.answers[index]);
        return;
      }
      const points = score(question, session.answers[index]);
      total += points;
      maximum += question.maxPrimary;
      const row = document.createElement('tr');
      const values = [String(question.task), session.answers[index] || '—', question.answers.join(' / '), `${points} / ${question.maxPrimary}`, time(session.elapsed[index])];
      values.forEach((value, column) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        if (column === 0) {
          const source = document.createElement('small');
          source.textContent = session.variant ? session.variant.publisher : `${question.source.title} · #${question.displayId}`;
          cell.append(source);
        }
        if (column === 3) cell.className = points === question.maxPrimary ? 'score-full' : points ? 'score-partial' : 'score-zero';
        row.append(cell);
      });
      const detailRow = document.createElement('tr');
      detailRow.hidden = true;
      const detailCell = document.createElement('td');
      detailCell.colSpan = 5;
      const review = document.createElement('article');
      review.className = 'review-question';
      for (const [key,text] of [["passage",question.passage], ["prompt",question.prompt]]) {
        if (!text) continue;
        const block = document.createElement('div');
        block.className = key === 'passage' ? 'passage-block' : 'question';
        if (key==='prompt') renderQuestion(block,question); else renderPassage(block,question);
        review.append(block);
      }
      const answer = document.createElement('div');
      answer.className = 'answer-review';
      renderAnswer(answer, question);
      review.append(answer);
      detailCell.append(review);
      detailRow.append(detailCell);
      detailRow.id = 'review-' + (question.displayId ?? question.id);
      const info = document.createElement('button');
      info.type = 'button';
      info.className = 'rule-toggle';
      info.textContent = 'ⓘ';
      info.setAttribute('aria-label', session.variant ? 'Разбор задания ' + question.task : 'Задание и объяснение #' + question.displayId);
      info.setAttribute('aria-expanded', 'false');
      info.setAttribute('aria-controls', detailRow.id);
      info.addEventListener('click', () => {
        detailRow.hidden = !detailRow.hidden;
        info.setAttribute('aria-expanded', String(!detailRow.hidden));
      });
      row.children[0].append(info);
      $('result-rows').append(row, detailRow);
    });
    const hasEssay = !$('essay-review').hidden;
    $('result-summary').textContent = maximum ? `${total} из ${maximum} первичных баллов · ${time(duration)}` : `Время работы — ${time(duration)}`;
    $('results').querySelector('.table-wrap').hidden = !maximum;
    $('conversion').textContent = session.variant
      ? `${session.variant.title} · Баллы за часть 1. Сочинение проверяется вручную.`
      : hasEssay ? 'Сочинение проверяется вручную.'
      : `По предоставленной шкале ${total} первичных → ${config.conversion[total]} тестовых из 100. Учтены только выбранные задания, сочинение — 0 баллов. Максимум части 1 — 28 первичных → 55 тестовых.`;
    $('session').hidden = true;
    $('results').hidden = false;
    $('result-title').focus();
  }
  const requestedTask = new URLSearchParams(window.location.search).get('task');
  const availableTask = bank.some(q => String(q.task) === requestedTask);
  for (const task of Object.values(config.tasks)) {
    const label = document.createElement('label');
    label.className = 'task-choice';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = task.number;
    input.checked = availableTask ? String(task.number) === requestedTask : task.number !== 27;
    input.disabled = !bank.some(question => question.task === task.number);
    if (input.disabled) input.checked = false;
    input.setAttribute('aria-label', `Задание ${task.number}, максимум ${task.maxPrimary}`);
    input.addEventListener('change', updateSelection);
    const number = document.createElement('span');
    number.textContent = task.number === 27 ? '27 · Сочинение' : task.number;
    const weight = document.createElement('small');
    weight.textContent = `${task.maxPrimary} б.`;
    label.append(input, number, weight);
    $(task.number === 27 ? 'essay-picker' : 'task-picker').append(label);
  }
  $('select-all').addEventListener('click', () => {
    $('task-picker').querySelectorAll('input:not(:disabled)').forEach(input => input.checked = true);
    updateSelection();
  });
  $('clear-all').addEventListener('click', () => {
    $('setup').querySelectorAll('input[type="checkbox"]').forEach(input => input.checked = false);
    updateSelection();
  });
  async function prepare(startButton, variant) {
    if (preparing) return;
    const label = startButton.textContent;
    const status = $(variant ? 'ready-variant-error' : 'selection-summary');
    preparing = true;
    startButton.disabled = true;
    startButton.textContent = 'Подготовка…';
    if (variant) status.textContent = '';
    try {
      const questions = variant
        ? await window.EGE_EXAM_LOADER.loadReady(variant)
        : await loadSelectedQuestions();
      if (questions) startSession(questions, variant, startButton);
    } catch {
      status.textContent = 'Не удалось загрузить задания. Попробуйте ещё раз.';
    } finally {
      preparing = false;
      startButton.textContent = label;
      startButton.disabled = !variant && !selection().length;
    }
  }
  $('start').addEventListener('click', () => prepare($('start')));
  async function printSelection(button, variant) {
    if (preparing) return;
    const status = $(variant ? 'ready-variant-error' : 'selection-summary');
    const label = button.textContent;
    preparing = true;
    button.disabled = true;
    button.textContent = 'Подготовка…';
    if (variant) status.textContent = '';
    try {
      const questions = variant ? await window.EGE_EXAM_LOADER.loadReady(variant) : await loadSelectedQuestions();
      if (questions) window.EGE_PRINT.open(cleanPassages(questions), variant);
    } catch {
      status.textContent = 'Не удалось подготовить пробник для печати. Попробуйте ещё раз.';
    } finally {
      preparing = false;
      button.textContent = label;
      button.disabled = !variant && !selection().length;
    }
  }
  $('print-selected').addEventListener('click', () => printSelection($('print-selected')));
  $('print-forms').addEventListener('click', () => window.EGE_PRINT.open());
  for (const id of ['print-session', 'print-results']) {
    $(id).addEventListener('click', () => window.EGE_PRINT.open(session.questions, session.variant));
  }
  for (const variant of readyVariants) {
    const row = document.createElement('li');
    const info = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = variant.title;
    const meta = document.createElement('p');
    meta.className = 'ready-variant-meta';
    const source = document.createElement('a');
    source.href = variant.sourceUrl;
    source.textContent = variant.publisher;
    source.setAttribute('aria-label', `Первоисточник — ${variant.publisher}, ${variant.title}`);
    meta.append(source, ` · 27 заданий · ${variant.minutes} мин`);
    info.append(title, meta);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = 'Начать вариант';
    button.setAttribute('aria-label', `Начать вариант — ${variant.title}`);
    button.addEventListener('click', () => prepare(button, variant));
    const print = document.createElement('button');
    print.type = 'button';
    print.className = 'secondary';
    print.textContent = 'Для печати';
    print.setAttribute('aria-label', `Для печати — ${variant.title}`);
    print.addEventListener('click', () => printSelection(print, variant));
    const actions = document.createElement('div');
    actions.className = 'print-actions';
    actions.append(button, print);
    row.append(info, actions);
    $('ready-variant-list').append(row);
  }
  $('ready-variants').hidden = !readyVariants.length;
  for (const id of ['answer', 'essay']) {
    $(id).addEventListener('input', event => {
      session.answers[session.index] = event.currentTarget.value;
      if (id === 'essay') updateEssayInput(event.currentTarget.value);
      updateNavigation();
    });
  }
  function downloadEssay(index) {
    const question = session.questions[index];
    window.EGE_ESSAY_DOCX.download(question, essaySource(question), session.answers[index]);
  }
  $('essay-draft-download').addEventListener('click', () => downloadEssay(session.index));
  $('essay-result-download').addEventListener('click', () => downloadEssay(session.questions.findIndex(question => question.answerType === 'essay')));
  $('previous').addEventListener('click', () => showQuestion(session.index - 1));
  $('next').addEventListener('click', () => session.index < session.questions.length - 1 ? showQuestion(session.index + 1) : confirmFinish());
  $('finish').addEventListener('click', confirmFinish);
  $('cancel-finish').addEventListener('click', () => $('finish-confirm').hidden = true);
  $('confirm-finish').addEventListener('click', finish);
  $('restart').addEventListener('click', () => {
    const {startButton} = session;
    session = null;
    $('answer').value = '';
    $('essay').value = '';
    $('essay-submission').textContent = '';
    $('essay-review').hidden = true;
    $('result-rows').replaceChildren();
    $('result-summary').textContent = '';
    $('conversion').textContent = '';
    $('results').hidden = true;
    $('setup').hidden = false;
    $('ready-variants').hidden = !readyVariants.length;
    startButton.focus();
  });
  updateSelection();
})();

