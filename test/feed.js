'use strict';
(() => {
  const {bank, score, renderPassage, renderQuestion} = window.EGE_EXERCISES;
  const questions = bank.filter(q => /^doshchinsky-202[67]-v\d+-q\d+$/.test(q.id))
    .sort((a, b) => a.displayId - b.displayId);
  const byId = id => document.getElementById(id);
  const task = byId('task');
  const query = byId('search-id');
  const feed = byId('feed');
  const more = byId('more');
  const status = byId('status');
  const attempts = new Map();
  let results, offset, generation = 0, loading = false;

  for (const number of [...new Set(questions.map(q => q.task))].sort((a, b) => a - b)) {
    task.add(new Option('Задание ' + number, number));
  }

  function exercise(q) {
    const node = byId('exercise').content.firstElementChild.cloneNode(true);
    node.querySelector('h2').textContent = 'Задание ' + q.task + ' · #' + q.displayId;
    const [, year, variant] = q.id.match(/^doshchinsky-(\d+)-v(\d+)-/);
    node.querySelector('.source').textContent = 'Сборник Дощинского ' + year + ' · Вариант ' + variant;
    renderPassage(node.querySelector('.reading'), q, true);
    renderQuestion(node.querySelector('.question'), q);
    const input = node.querySelector('input');
    input.inputMode = q.answerType === 'word' ? 'text' : 'numeric';
    const feedback = node.querySelector('.result');
    const state = attempts.get(q.id) || {value: '', feedback: ''};
    input.value = state.value;
    feedback.textContent = state.feedback;
    input.addEventListener('input', () => {
      state.value = input.value;
      state.feedback = '';
      feedback.textContent = '';
      attempts.set(q.id, state);
    });
    node.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      const points = score(q, input.value);
      const verdict = points === q.maxPrimary ? 'Верно!' : points ? 'Частично верно.' : 'Пока неверно.';
      state.feedback = verdict + ' Баллы: ' + points + ' из ' + q.maxPrimary + '.';
      state.value = input.value;
      feedback.textContent = state.feedback;
      attempts.set(q.id, state);
    });
    return node;
  }

  async function next() {
    if (loading || offset >= results.length) return;
    const version = generation;
    loading = true;
    more.disabled = true;
    try {
      const batch = await Promise.all(results.slice(offset, offset + 8).map(window.EGE_EXAM_LOADER.load));
      if (version !== generation) return;
      feed.append(...batch.map(exercise));
      offset += batch.length;
      status.textContent = 'Показано ' + offset + ' из ' + results.length;
      more.hidden = offset >= results.length;
      more.textContent = 'Показать ещё';
    } catch {
      if (version !== generation) return;
      status.textContent = 'Не удалось загрузить задания.';
      more.textContent = 'Повторить загрузку';
    } finally {
      if (version === generation) {
        loading = false;
        more.disabled = false;
      }
    }
  }

  function select() {
    generation++;
    const id = query.value.trim().replace(/^#/, '');
    results = questions.filter(q => (!task.value || q.task === Number(task.value)) &&
      (!id || String(q.displayId) === id));
    offset = 0;
    loading = false;
    feed.replaceChildren();
    more.hidden = !results.length;
    status.textContent = results.length ? 'Загрузка…' : 'Заданий не найдено. Проверьте ID или сбросьте фильтр.';
    next();
  }
  byId('search').addEventListener('submit', event => { event.preventDefault(); select(); });
  task.addEventListener('change', select);
  byId('reset').addEventListener('click', () => { task.value = query.value = ''; select(); });
  more.addEventListener('click', next);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) next();
    }, {rootMargin: '350px'}).observe(more);
  }
  select();
})();
