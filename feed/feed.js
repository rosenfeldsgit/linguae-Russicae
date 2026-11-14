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
    const state = attempts.get(q.id) || {value: '', points: null};
    const showResult = () => {
      feedback.hidden = state.points === null;
      input.removeAttribute('aria-invalid');
      node.removeAttribute('data-result');
      if (state.points === null) return;
      const outcome = state.points === q.maxPrimary ? 'correct' : state.points ? 'partial' : 'incorrect';
      node.dataset.result = outcome;
      feedback.querySelector('.result-icon').textContent = {correct: '✓', partial: '◐', incorrect: '×'}[outcome];
      feedback.querySelector('.result-title').textContent = {correct: 'Всё верно', partial: 'Частично верно', incorrect: 'Попробуйте ещё раз'}[outcome];
      feedback.querySelector('.result-points').textContent = 'Баллы: ' + state.points + ' из ' + q.maxPrimary;
      if (outcome === 'incorrect') input.setAttribute('aria-invalid', 'true');
    };
    input.value = state.value;
    showResult();
    input.addEventListener('input', () => {
      state.value = input.value;
      state.points = null;
      showResult();
      attempts.set(q.id, state);
    });
    node.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      state.points = score(q, input.value);
      state.value = input.value;
      showResult();
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
