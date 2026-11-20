'use strict';
(() => {
  const modes = ['system', 'light', 'dark'];
  const labels = {system: 'Авто', light: 'Светлая', dark: 'Тёмная'};
  const key = 'rusa-lingvo-theme';
  const system = matchMedia('(prefers-color-scheme: dark)');
  const root = document.documentElement;
  let mode = 'system';
  let button;
  try {
    const saved = localStorage.getItem(key);
    if (modes.includes(saved)) mode = saved;
  } catch {
    // The device preference still works when storage is unavailable.
  }

  function nextMode() {
    const automatic = system.matches ? 'dark' : 'light';
    const opposite = system.matches ? 'light' : 'dark';
    if (mode === 'system') return opposite;
    return mode === opposite ? automatic : 'system';
  }

  function apply() {
    const dark = mode === 'dark' || (mode === 'system' && system.matches);
    root.dataset.theme = dark ? 'dark' : 'light';
    const color = document.querySelector('meta[name="theme-color"]');
    if (color) color.content = dark ? '#181a18' : '#f2f0e7';
    if (button) {
      button.textContent = `Тема: ${labels[mode]}`;
      button.title = `Переключить на: ${labels[nextMode()]}`;
    }
  }

  apply();
  system.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    mode = modes.includes(event.newValue) ? event.newValue : 'system';
    apply();
  });

  document.addEventListener('DOMContentLoaded', () => {
    const placement = document.querySelector('.poster-caption, .editor-header');
    if (placement) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'theme-toggle';
      button.addEventListener('click', () => {
        mode = nextMode();
        try { localStorage.setItem(key, mode); } catch { /* Keep the choice on this page. */ }
        apply();
      });
      placement.append(button);
    }
    apply();
  });
})();
