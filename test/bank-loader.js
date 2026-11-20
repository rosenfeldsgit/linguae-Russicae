'use strict';
(() => {
  const cache = new Map();
  const essayKeys = new Map();
  // Variant paths belong to this script, regardless of the page using the bank.
  const bankRoot = new URL('.', document.currentScript.src);
  async function fetchVariant(file) {
    const data = await fetchJSON(file);
    return {questions: new Map(data.questions.map(q => [q.id, q])), passages: data.passages};
  }
  function getVariant(file) {
    if (!cache.has(file)) cache.set(file, fetchVariant(file).catch(error => {cache.delete(file); throw error;}));
    return cache.get(file);
  }
  async function fetchJSON(file) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(new URL(file, bankRoot), {signal: controller.signal});
      if (!response.ok) throw new Error('Не удалось загрузить задания. Попробуйте ещё раз.');
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }
  async function loadEssay(summary) {
    const {essayYear: year, passageSource, ...question} = summary;
    if (year !== 2026 && year !== 2027) throw new Error('Сборник не найден.');
    if (!essayKeys.has(year)) {
      essayKeys.set(year, fetchJSON(`essay-topics/${year}.json`).catch(error => {
        essayKeys.delete(year);
        throw error;
      }));
    }
    const [topics, {passage}] = await Promise.all([essayKeys.get(year), load(passageSource)]);
    const topic = topics[question.source.variant - 1];
    if (!passage || !topic?.problem || !topic.authorPosition || !Number.isInteger(topic.answerPage)) {
      throw new Error('Сочинение не найдено в базе.');
    }
    const prompt = [
      `Напишите сочинение-рассуждение по проблеме исходного текста.\n**${topic.problem}**`,
      'Сформулируйте позицию автора (рассказчика). Прокомментируйте, как она раскрывается в тексте. Приведите два примера-иллюстрации из прочитанного текста, поясните каждый и объясните смысловую связь между ними.',
      'Сформулируйте и обоснуйте своё отношение к позиции автора. Приведите пример-аргумент из читательского, историко-культурного или жизненного опыта, не повторяя суждений автора. Комиксы, аниме, манга, фанфики, графические романы, компьютерные игры и сходные источники для аргумента не засчитываются.',
      'Объём сочинения — не менее 150 слов. Работа без опоры на исходный текст не оценивается. Полное переписывание или пересказ текста без комментария оценивается в 0 баллов.',
    ].join('\n\n');
    return {...question, ...topic, essayYear: year, prompt, passage, answerType: 'essay', answers: []};
  }
  async function load(summary) {
    if (typeof summary.prompt === 'string') return summary;
    if (summary.essayYear) return loadEssay(summary);
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
      source: {title: variant.title, url: variant.sourceUrl, variant: variant.id, ...(variant.date ? {date: variant.date} : {})},
    }));
  }
  window.EGE_EXAM_LOADER = {load, loadReady};
})();
