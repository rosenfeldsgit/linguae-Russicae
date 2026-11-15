'use strict';

// Geometry is independent of the DOM so the same constraints can be tested.
(() => {
  function fitWidths(values, total, minimum = Math.min(48, total / (values.length * 2))) {
    if (!values.length || !Number.isFinite(total) || total <= 0) return [];
    const weights = values.map(value => Number.isFinite(value) && value > 0 ? value : 1);
    const floor = Math.min(Math.max(0, minimum), total / weights.length);
    const result = Array(weights.length).fill(0);
    let remaining = total;
    let pending = weights.map((_, i) => i);
    while (pending.length) {
      const sum = pending.reduce((sum, i) => sum + weights[i], 0);
      const small = pending.filter(i => remaining * weights[i] / sum < floor);
      if (!small.length) {
        for (const i of pending) result[i] = remaining * weights[i] / sum;
        break;
      }
      for (const i of small) { result[i] = floor; remaining -= floor; }
      pending = pending.filter(i => !small.includes(i));
    }
    return result;
  }

  function resizeWidths(values, index, requested, total) {
    const widths = fitWidths(values, total);
    if (widths.length < 2 || !Number.isFinite(requested) || !Number.isInteger(index) || index < 0 || index >= widths.length) return widths;
    const minimum = Math.min(48, total / (widths.length * 2));
    const width = Math.max(minimum, Math.min(total - minimum * (widths.length - 1), requested));
    const others = fitWidths(widths.filter((_, i) => i !== index), total - width, minimum);
    return widths.map((_, i) => i === index ? width : others.shift());
  }

  function percentages(values) {
    const sum = values.reduce((sum, value) => sum + value, 0);
    if (!sum) return values.map(() => 100 / values.length);
    let used = 0;
    return values.map((value, i) => {
      const result = i === values.length - 1 ? 100 - used : Number((value / sum * 100).toFixed(6));
      used += result;
      return Number(result.toFixed(6));
    });
  }

  const api = Object.freeze({fitWidths, resizeWidths, percentages});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.RussianTableLayout = api;
})();
