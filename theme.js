'use strict';
(() => {
  const modes = ['system', 'light', 'dark'];
  const labels = {system: 'Авто', light: 'Светлая', dark: 'Тёмная'};
  const icons = {
    light: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4',
    dark: 'M20.8 14.2A8.8 8.8 0 0 1 9.8 3.2a9 9 0 1 0 11 11Z',
  };
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const key = 'rusa-lingvo-theme';
  const system = matchMedia('(prefers-color-scheme: dark)');
  const root = document.documentElement;
  let mode = 'system';
  let button;
  let iconPath;
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
      const name = `Тема: ${labels[mode]}`;
      button.setAttribute('aria-label', name);
      button.title = `${name} · Далее: ${labels[nextMode()]}`;
      iconPath.setAttribute('d', icons[root.dataset.theme]);
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
      const icon = document.createElementNS(svgNamespace, 'svg');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('aria-hidden', 'true');
      icon.setAttribute('focusable', 'false');
      iconPath = document.createElementNS(svgNamespace, 'path');
      icon.append(iconPath);
      button.append(icon);
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
