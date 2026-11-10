'use strict';
(() => {
  const link = document.querySelector('.version-link');
  if (!link || (typeof HTMLDialogElement === 'undefined' || typeof HTMLDialogElement.prototype.showModal !== 'function')) return;
  const target = new URL(link.href);
  let dialog = null;
  let frame = null;
  let previousFocus = null;
  const previousTitle = document.title;
  const close = () => {
    if (!dialog) return;
    dialog.close();
    dialog.remove();
    dialog = frame = null;
    document.title = previousTitle;
    previousFocus?.focus({preventScroll:true});
  };
  const open = (push) => {
    if (dialog) return;
    previousFocus = document.activeElement;
    dialog = document.createElement('dialog');
    dialog.className = 'versions-dialog';
    dialog.setAttribute('aria-label', 'История версий');
    frame = document.createElement('iframe');
    frame.title = 'История версий';
    frame.src = target.href;
    dialog.append(frame);
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      window.history.back();
    });
    document.body.append(dialog);
    dialog.showModal();
    document.title = 'История версий — Русский';
    if (push) window.history.pushState({versionsOverlay:true}, '', target.href);
  };
  link.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    open(true);
  });
  window.addEventListener('popstate', event => {
    if (event.state?.versionsOverlay) open(false);
    else close();
  });
  window.addEventListener('message', event => {
    if (dialog && event.origin === window.location.origin && event.source === frame.contentWindow &&
        event.data?.type === 'close-versions') window.history.back();
  });
})();
