'use strict';
(() => {
  const {bank, score, renderPassage, renderQuestion, renderAnswer} = window.EGE_EXERCISES;
  const questions = bank.filter(q => Number.isInteger(q.displayId));
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }
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
    const source = node.querySelector('.source');
    source.textContent = q.source?.title || '';
    if (Number.isInteger(q.source?.variant)) source.textContent += ' · Вариант ' + q.source.variant;
    renderPassage(node.querySelector('.reading'), q, true);
    renderQuestion(node.querySelector('.question'), q);
    if (q.answerType === 'essay') {
      node.querySelector('.check').hidden = true;
      const essay = node.querySelector('.feed-essay');
      const draft = essay.querySelector('textarea');
      const criteria = essay.querySelector('a');
      essay.hidden = false;
      draft.value = attempts.get(q.id)?.value || '';
      draft.addEventListener('input', () => attempts.set(q.id, {value: draft.value}));
      criteria.href = q.source?.url || '../theory/#task-27';
      essay.querySelector('.author-position').textContent = q.authorPosition || '';
      essay.querySelector('details').hidden = !q.authorPosition;
      return node;
    }
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
      renderAnswer(feedback.querySelector('.answer-content'), q);
      const verdict = {correct: 'Верно', partial: 'Частично верно', incorrect: 'Неверно'}[outcome];
      feedback.querySelector('.result-points').textContent = verdict + ' · ' + state.points + ' из ' + q.maxPrimary;
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
