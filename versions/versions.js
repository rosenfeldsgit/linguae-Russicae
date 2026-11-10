'use strict';
(() => {
  const back = document.getElementById('versions-back');
  const root = new URL('../', window.location.href);
  if (window.parent !== window) {
    back.addEventListener('click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      window.parent.postMessage({type:'close-versions'}, window.location.origin);
    });
    return;
  }
  let previous;
  try { previous = new URL(document.referrer); } catch { return; }
  if (previous.origin !== root.origin || !previous.pathname.startsWith(root.pathname) ||
      previous.pathname.startsWith(new URL('./', window.location.href).pathname)) return;
  back.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (window.history.length > 1) {
      event.preventDefault();
      window.history.back();
    }
  });
})();
