'use strict';

(() => {
  const STORAGE_KEY = 'russian-theory-editor-v1';
  const editor = document.getElementById('editor');
  const picker = document.getElementById('chapter');
  const download = document.getElementById('download');
  const status = document.getElementById('save-status');
  const count = document.getElementById('change-count');
  const toolbar = document.querySelector('.editor-toolbar');
  let chapters = new Map();
  let originals = new Map();
  let drafts = {};
  let active;
  let timer;
  let storageFailed = false;
  let draftUnreadable = false;

  function announce(message, error = false) {
    status.textContent = message;
    status.classList.toggle('error', error);
  }

  // Paste and restored drafts are data, never executable page markup.
  function cleanHTML(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const allowed = new Set(['P', 'DIV', 'SECTION', 'H2', 'H3', 'H4', 'H5', 'H6', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'BR', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'A', 'DETAILS', 'SUMMARY', 'DL', 'DT', 'DD', 'BLOCKQUOTE', 'SPAN']);
    const discard = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'IMG', 'LINK', 'META']);
    function scrub(parent) {
      for (const node of Array.from(parent.childNodes)) {
        if (node.nodeType === 8) { node.remove(); continue; }
        if (node.nodeType !== 1) continue;
        if (discard.has(node.tagName)) { node.remove(); continue; }
        scrub(node);
        if (!allowed.has(node.tagName)) { node.replaceWith(...node.childNodes); continue; }
        for (const attribute of Array.from(node.attributes)) {
          const {name, value} = attribute;
          const validID = name === 'id' && /^[RS]\d{2}-\d{2}$/.test(value);
          const validClass = name === 'class' && ['rule', 'exception', 'table-wrap', 'dictionary', 'words'].includes(value);
          const validLink = node.tagName === 'A' && name === 'href' && /^(https:\/\/|#[A-Za-z0-9-]+)/.test(value);
          const validSpan = ['TH', 'TD'].includes(node.tagName) && ['colspan', 'rowspan'].includes(name) && /^[1-9]\d?$/.test(value);
          if (!(validID || validClass || validLink || validSpan)) node.removeAttribute(name);
        }
      }
    }
    scrub(doc.body);
    return doc.body.innerHTML;
  }

  // A reading copy accompanies HTML; HTML retains tables, dictionary structure and IDs.
  function toMarkdown(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    function convert(node) {
      if (node.nodeType === 3) return node.textContent;
      if (node.nodeType !== 1) return '';
      const content = () => Array.from(node.childNodes, convert).join('');
      switch (node.tagName) {
        case 'STRONG': case 'B': return '**' + content() + '**';
        case 'EM': case 'I': return '*' + content() + '*';
        case 'BR': return '\n';
        case 'H2': return '# ' + content() + '\n\n';
        case 'H3': return '## ' + content() + '\n\n';
        case 'H4': return '### ' + (node.closest('.rule')?.id ? node.closest('.rule').id + '. ' : '') + content() + '\n\n';
        case 'H5': case 'H6': return '#### ' + content() + '\n\n';
        case 'A': return node.getAttribute('href')?.startsWith('https://') ? '[' + content() + '](' + node.getAttribute('href') + ')' : content();
        case 'P': case 'DIV': case 'SECTION': case 'BLOCKQUOTE': return content() + '\n\n';
        case 'UL': case 'OL': return Array.from(node.children, (li, i) => (node.tagName === 'OL' ? (i + 1) + '. ' : '- ') + convert(li).trim() + '\n').join('') + '\n';
        case 'TABLE': {
          const rows = Array.from(node.rows, row => '| ' + Array.from(row.cells, cell => convert(cell).trim().replaceAll('|', '\\|').replaceAll('\n', '<br>')).join(' | ') + ' |');
          if (rows.length) rows.splice(1, 0, '| ' + Array.from(node.rows[0].cells, () => '---').join(' | ') + ' |');
          return rows.join('\n') + '\n\n';
        }
        case 'DT': return '**' + content() + '**\n';
        case 'DD': return content() + '\n\n';
        case 'SUMMARY': return '## ' + content() + '\n\n';
        default: return content();
      }
    }
    return Array.from(doc.body.childNodes, convert).join('').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  function updateCount() {
    const total = Object.keys(drafts).length;
    count.textContent = String(total);
    download.disabled = !total;
    for (const option of picker.options) {
      const chapter = chapters.get(option.value);
      if (chapter) option.textContent = '№ ' + chapter.number + '. ' + chapter.title + (drafts[option.value] ? ' • изменено' : '');
    }
  }

  function persist() {
    if (draftUnreadable) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({schemaVersion: 1, chapters: drafts}));
      storageFailed = false;
      return true;
    } catch {
      storageFailed = true;
      announce('Браузер не сохранил черновик. Скачайте изменения перед закрытием страницы.', true);
      return false;
    }
  }

  function saveActive() {
    clearTimeout(timer);
    if (!active) return;
    const html = cleanHTML(editor.innerHTML);
    const original = originals.get(active);
    const previous = drafts[active];
    const baseline = previous?.originalHTML ?? original;
    if (html === baseline) {
      delete drafts[active];
    } else {
      const chapter = chapters.get(active);
      drafts[active] = {
        number: active, title: chapter.title, path: chapter.path,
        originalMarkdown: previous?.originalMarkdown ?? chapter.originalMarkdown,
        originalHTML: baseline, editedHTML: html,
        dictionary: previous?.dictionary ?? chapter.dictionary,
        updatedAt: new Date().toISOString(),
      };
    }
    updateCount();
    if (persist()) {
      const outdated = drafts[active] && drafts[active].originalHTML !== original;
      announce(outdated ? 'Черновик восстановлен из прежней версии базы. При переносе сверим изменения.' : 'Черновик сохранён в этом браузере.');
    }
  }

  function openChapter(number) {
    const next = chapters.has(number) ? number : '1';
    if (next === active) return;
    saveActive();
    active = next;
    picker.value = next;
    editor.innerHTML = drafts[next]?.editedHTML ?? originals.get(next);
    // Expand existing vocabularies without recording a cosmetic disclosure change.
    for (const details of editor.querySelectorAll('details')) details.open = true;
    document.title = '№ ' + next + ' — Редактор базы знаний — Русский';
    history.replaceState(null, '', '#task-' + next);
    const outdated = drafts[next] && drafts[next].originalHTML !== originals.get(next);
    if (!storageFailed) announce(outdated ? 'Восстановлен черновик из прежней версии базы. При переносе сверим изменения.' : drafts[next] ? 'Восстановлен сохранённый черновик.' : 'Можно редактировать. Черновик сохраняется в этом браузере.');
  }

  function selectionInsideEditor() {
    const selection = window.getSelection();
    return selection && selection.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer);
  }

  picker.addEventListener('change', () => openChapter(picker.value));
  window.addEventListener('hashchange', () => openChapter(location.hash.replace('#task-', '')));
  editor.addEventListener('input', () => {
    announce('Сохраняем черновик…');
    clearTimeout(timer);
    timer = setTimeout(saveActive, 300);
  });
  editor.addEventListener('click', event => {
    if (event.target.closest('a')) event.preventDefault();
  });
  editor.addEventListener('paste', event => {
    event.preventDefault();
    const clipboard = event.clipboardData;
    const html = clipboard.getData('text/html');
    if (html) document.execCommand('insertHTML', false, cleanHTML(html));
    else document.execCommand('insertText', false, clipboard.getData('text/plain'));
    saveActive();
  });
  // File/image drops have no place in the exported text document.
  editor.addEventListener('drop', event => event.preventDefault());
  toolbar.addEventListener('mousedown', event => {
    if (event.target.closest('button')) event.preventDefault();
  });
  toolbar.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !active) return;
    if (!selectionInsideEditor()) { announce('Сначала поставьте курсор или выделите текст в главе.'); return; }
    editor.focus();
    if (button.id === 'add-table') {
      document.execCommand('insertHTML', false, '<table><tbody><tr><th>Заголовок</th><th>Заголовок</th></tr><tr><td>Текст</td><td>Текст</td></tr></tbody></table><p><br></p>');
    } else document.execCommand(button.dataset.command, false, button.dataset.value || null);
    saveActive();
  });

  download.addEventListener('click', () => {
    saveActive();
    const changes = Object.values(drafts);
    if (!changes.length) return;
    const payload = {
      format: 'russian-knowledge-base-edits', schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      source: 'https://github.com/rosenfeldsgit/linguae-Russicae',
      instructions: 'Сопоставить originalMarkdown и originalHTML с актуальной базой. Перенести изменения editedHTML (editedMarkdown — читаемая копия), сохранить ID правил. Изменения словников перенести в dictionary.path. При конфликте не перезаписывать новые изменения сайта. Пересобрать /theory/ и /edit/. Карточки и ответы не менять автоматически.',
      chapters: changes.map(change => ({...change, editedMarkdown: toMarkdown(change.editedHTML)})),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2) + '\n'], {type: 'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'russkiy-edits-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    announce('Файл подготовлен к скачиванию. Отправьте его в наш чат. Черновик сохранён.');
  });
  window.addEventListener('pagehide', saveActive);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveActive(); });
  window.addEventListener('beforeunload', event => {
    saveActive();
    if (storageFailed) { event.preventDefault(); event.returnValue = ''; }
  });

  async function init() {
    try {
      const response = await fetch('chapters.json', {cache: 'no-store'});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (data.schemaVersion !== 1 || data.chapters.length !== 27) throw new Error('Invalid chapter data');
      chapters = new Map(data.chapters.map(chapter => [chapter.number, chapter]));
      originals = new Map(data.chapters.map(chapter => [chapter.number, cleanHTML(chapter.html)]));
      let saved;
      try { saved = localStorage.getItem(STORAGE_KEY); }
      catch { storageFailed = true; }
      if (saved) {
        try {
          const stored = JSON.parse(saved);
          if (stored.schemaVersion !== 1 || !stored.chapters || typeof stored.chapters !== 'object') throw new Error('Invalid draft');
          for (const [number, draft] of Object.entries(stored.chapters)) {
            if (!chapters.has(number) || draft.number !== number || draft.path !== chapters.get(number).path || typeof draft.editedHTML !== 'string' || typeof draft.originalHTML !== 'string' || typeof draft.originalMarkdown !== 'string') throw new Error('Invalid chapter draft');
          }
          drafts = stored.chapters;
          for (const draft of Object.values(drafts)) {
            draft.editedHTML = cleanHTML(draft.editedHTML);
            draft.originalHTML = cleanHTML(draft.originalHTML);
          }
        } catch {
          draftUnreadable = true;
          throw new Error('Saved draft cannot be read');
        }
      }
      updateCount();
      picker.disabled = false;
      editor.contentEditable = 'true';
      openChapter(location.hash.replace('#task-', ''));
      if (storageFailed) announce('Сохранение в браузере недоступно. Скачайте изменения перед закрытием страницы.', true);
    } catch {
      announce(draftUnreadable ? 'Не удалось прочитать сохранённый черновик. Он не перезаписан. Обратитесь в чат, чтобы восстановить данные.' : 'Не удалось загрузить базу. Обновите страницу или попробуйте позже.', true);
    }
  }
  init();
})();
