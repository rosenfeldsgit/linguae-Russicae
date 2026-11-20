'use strict';
(() => {
  const labels = {light: 'Светлая', dark: 'Тёмная'};
  const icons = {
    light: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4',
    dark: 'M20.8 14.2A8.8 8.8 0 0 1 9.8 3.2a9 9 0 1 0 11 11Z',
  };
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const key = 'rusa-lingvo-theme';
  const root = document.documentElement;
  let mode = 'light';
  let button;
  let iconPath;
  try {
    if (localStorage.getItem(key) === 'dark') mode = 'dark';
  } catch {
    // Start in the light theme when storage is unavailable.
  }

  function nextMode() {
    return mode === 'dark' ? 'light' : 'dark';
  }

  function apply() {
    root.dataset.theme = mode;
    const color = document.querySelector('meta[name="theme-color"]');
    if (color) color.content = mode === 'dark' ? '#181a18' : '#f2f0e7';
    if (button) {
      const name = `Тема: ${labels[mode]}`;
      button.setAttribute('aria-label', name);
      button.title = `${name} · Далее: ${labels[nextMode()]}`;
      iconPath.setAttribute('d', icons[mode]);
    }
  }

  apply();
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    mode = event.newValue === 'dark' ? 'dark' : 'light';
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
