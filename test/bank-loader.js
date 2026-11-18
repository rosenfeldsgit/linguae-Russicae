'use strict';
(() => {
  const cache = new Map();
  // Variant paths belong to this script, regardless of the page using the bank.
  const bankRoot = new URL('.', document.currentScript.src);
  async function fetchVariant(file) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(new URL(file, bankRoot), {signal: controller.signal});
      if (!response.ok) throw new Error('Не удалось загрузить задания. Попробуйте ещё раз.');
      const data = await response.json();
      return {questions: new Map(data.questions.map(q => [q.id, q])), passages: data.passages};
    } finally {
      clearTimeout(timer);
    }
  }
  function getVariant(file) {
    if (!cache.has(file)) cache.set(file, fetchVariant(file).catch(error => {cache.delete(file); throw error;}));
    return cache.get(file);
  }
  async function load(summary) {
    if (typeof summary.prompt === 'string') return summary;
    if (summary.readyVariantId) {
      const variant = window.EGE_READY_VARIANTS.find(entry => entry.id === summary.readyVariantId);
      const questions = await loadReady(variant);
      const question = questions[summary.task - 1];
      if (question?.id !== summary.id) throw new Error('Задание не найдено в базе.');
      return question;
    }
    const file = summary.file;
    if (typeof file !== 'string' || !/^doshchinsky-(?:2026\/v(?:[1-9]|[12]\d|3[0-6])|2027\/v(?:[3-9]|[12]\d|3[0-6]))\.json$/.test(file)) {
      throw new Error('Недопустимый путь к заданиям.');
    }
    const data = await getVariant(file);
    const q = data.questions.get(summary.id);
    if (!q) throw new Error('Задание не найдено в базе.');
    return {...q,passage:data.passages[q.passageKey]?.text || ''};
  }
  async function loadReady(variant) {
    if (!window.EGE_READY_VARIANTS.includes(variant) || !/^[a-z0-9-]+$/.test(variant.id)) {
      throw new Error('Готовый вариант не найден.');
    }
    const data = await getVariant(`ready-variants/${variant.id}.json`);
    const questions = [...data.questions.values()];
    if (questions.length !== 27 || questions.some((q, index) =>
      q.task !== index + 1 || q.id !== `${variant.id}-q${q.task}` || !q.prompt ||
      (q.passageKey && !data.passages[q.passageKey]?.text) ||
      (q.task === 27 ? q.answerType !== 'essay' : !q.answers?.length))) {
      throw new Error('Комплект заданий неполный.');
    }
    return questions.map((q, index) => ({
      ...q,
      displayId: variant.firstDisplayId + index,
      passage: data.passages[q.passageKey]?.text || '',
      source: {title: variant.title, url: variant.sourceUrl, variant: variant.id},
    }));
  }
  window.EGE_EXAM_LOADER = {load, loadReady};
})();
