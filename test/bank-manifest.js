'use strict';
window.EGE_EXAM_MANIFEST = [];
window.EGE_READY_VARIANTS = [
  {
    id: 'fipi-2027-demo',
    title: 'Демоверсия ЕГЭ 2027',
    publisher: 'ФИПИ',
    minutes: 210,
    sourceUrl: 'https://fipi.ru/ege/demoversii-specifikacii-kodifikatory',
  },
];
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
