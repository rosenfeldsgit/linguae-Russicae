'use strict';
window.EGE_EXAM_MANIFEST = [];
window.EGE_READY_VARIANTS = [
  {
    id: 'fipi-2027-demo',
    title: 'Демоверсия ЕГЭ 2027',
    publisher: 'ФИПИ',
    minutes: 210,
    firstDisplayId: 1873,
    sourceUrl: 'https://fipi.ru/ege/demoversii-specifikacii-kodifikatory',
  },
];
window.EGE_READY_QUESTIONS = window.EGE_READY_VARIANTS.flatMap(variant =>
  Array.from({length: 27}, (_, index) => ({
    id: `${variant.id}-q${index + 1}`,
    displayId: variant.firstDisplayId + index,
    task: index + 1,
    readyVariantId: variant.id,
    source: {title: variant.title, url: variant.sourceUrl, variant: variant.id},
  }))
);
for (const [year, firstVariant] of [[2027, 3], [2026, 1]]) {
  for (let variant = firstVariant; variant <= 36; variant++) {
    for (let task = 1; task <= 26; task++) {
      window.EGE_EXAM_MANIFEST.push({
        id: `doshchinsky-${year}-v${variant}-q${task}`,
        displayId: (year === 2026 ? 936 : 0) + (variant - 1) * 26 + task,
        task,
        maxPrimary: [8, 22].includes(task) ? 2 : 1,
        source: {title: `Сборник Дощинского ${year}`, variant},
        file: `doshchinsky-${year}/v${variant}.json`,
      });
    }
  }
}

window.EGE_ESSAY_QUESTIONS = [
  ...window.EGE_EXAM_MANIFEST,
  ...(window.EGE_EXAM_BANK || []),
].filter(question => question.task === 26).map(passageSource => {
  const year = passageSource.id.startsWith('doshchinsky-2026-') ? 2026 : 2027;
  return {
    id: passageSource.id.replace(/q26$/, 'q27'),
    displayId: 1899 + (year === 2027 ? 36 : 0) + passageSource.source.variant,
    task: 27,
    maxPrimary: 22,
    source: passageSource.source,
    essayYear: year,
    passageSource,
  };
});
