'use strict';
(() => {
  const cache = new Map();
  async function load(summary) {
    if (typeof summary.prompt === 'string') return summary;
    const file = summary.file;
    if (!cache.has(file)) cache.set(file, fetch(file).then(response => {
      if (!response.ok) throw new Error('Не удалось загрузить задания. Попробуйте ещё раз.');
      return response.json();
    }).catch(error => {cache.delete(file); throw error;}));
    const data = await cache.get(file);
    const q = data.questions.find(q => q.id === summary.id);
    if (!q) throw new Error('Задание не найдено в базе.');
    return {...q,passage:data.passages[q.passageKey]?.text || ''};
  }
  window.EGE_EXAM_LOADER = {load};
})();
