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
  async function load(summary) {
    if (typeof summary.prompt === 'string') return summary;
    const file = summary.file;
    if (typeof file !== 'string' || !/^doshchinsky-(?:2026\/v(?:[1-9]|[12]\d|3[0-6])|2027\/v(?:[3-9]|[12]\d|3[0-6]))\.json$/.test(file)) {
      throw new Error('Недопустимый путь к заданиям.');
    }
    if (!cache.has(file)) cache.set(file, fetchVariant(file).catch(error => {cache.delete(file); throw error;}));
    const data = await cache.get(file);
    const q = data.questions.get(summary.id);
    if (!q) throw new Error('Задание не найдено в базе.');
    return {...q,passage:data.passages[q.passageKey]?.text || ''};
  }
  window.EGE_EXAM_LOADER = {load};
})();
