'use strict';

// Replay the entrance only when switching card sections, never on each answer.
(() => {
  const sections = document.getElementById('sections');
  if (!sections || !Element.prototype.animate) return;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const panels = [...document.querySelectorAll('.practice-main, .poster-rail')];
  let selected = sections.querySelector('[aria-pressed="true"]')?.dataset.section;
  function cancelEntrances() {
    for (const panel of panels) {
      for (const animation of panel.getAnimations()) animation.cancel();
    }
  }
  sections.addEventListener('click', event => {
    const button = event.target.closest('button[data-section]');
    if (!button || button.dataset.section === selected) return;
    selected = button.dataset.section;
    cancelEntrances();
    if (reducedMotion.matches) return;
    for (const panel of panels) {
      panel.animate([
        {opacity: 0, transform: 'translateY(10px)'},
        {opacity: 1, transform: 'translateY(0)'}
      ], {duration: 280, easing: 'cubic-bezier(.22,1,.36,1)'});
    }
  });
  reducedMotion.addEventListener('change', event => {
    if (event.matches) cancelEntrances();
  });
})();

(() => {
 const number = document.getElementById('rail-number');
 const topic = document.getElementById('rail-topic');
 const label = document.getElementById('task-label');
 if (!number || !topic || !label) return;
 const topics = {1:'Части речи',4:'Поставь ударение',5:'Паронимы',7:'Грамматические нормы',9:'Гласные в корне',10:'Приставки',11:'Суффиксы',12:'Спряжение и причастия',13:'НЕ и НИ',14:'Слитно, раздельно, через дефис',15:'Н и НН',16:'Однородные члены',17:'Обособление',18:'Вводные конструкции',19:'Сложные предложения',20:'Стык союзов',21:'Знаки препинания'};
 const update = () => {const task = label.textContent.match(/\d+/)?.[0]; number.textContent = task ? task.padStart(2,'0') : 'Ѣ'; topic.textContent = topics[task] || 'Русский язык на практике';};
 new MutationObserver(update).observe(label,{childList:true,characterData:true,subtree:true});
 update();
})();

(() => {
  const button = document.querySelector('.nav-toggle');
  if (!button) return;
  const nav = document.getElementById('section-nav');
  const compact = matchMedia('(max-width: 1100px)');
  function setOpen(open) {
    button.hidden = !compact.matches;
    button.setAttribute('aria-expanded', String(open));
    nav.hidden = compact.matches && !open;
    nav.classList.toggle('compact-nav', compact.matches);
  }
  button.addEventListener('click', () => setOpen(nav.hidden));
  compact.addEventListener('change', () => setOpen(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && compact.matches && !nav.hidden) {
      setOpen(false);
      button.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!button.contains(event.target)) setOpen(false);
  });
  document.addEventListener('focusin', event => {
    if (!nav.contains(event.target) && event.target !== button) setOpen(false);
  });
  setOpen(false);
})();

// Warm only a section the visitor has expressed interest in.
// The browser controls priority, caching and whether to honor the hint.
(() => {
  const nav = document.querySelector('.mode-nav');
  if (!nav) return;
  const connection = navigator.connection;
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return;
  const warmed = new Set();
  let timer;
  function prefetch(link) {
    const url = new URL(link.href);
    if (url.origin !== location.origin || url.pathname === location.pathname ||
        warmed.has(url.href)) return;
    warmed.add(url.href);
    const hint = document.createElement('link');
    hint.rel = 'prefetch';
    hint.href = url.href;
    document.head.append(hint);
  }
  for (const link of nav.querySelectorAll('a')) {
    link.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse') timer = setTimeout(() => prefetch(link), 100);
    });
    link.addEventListener('pointerleave', () => clearTimeout(timer));
    link.addEventListener('focus', () => prefetch(link));
  }
})();
