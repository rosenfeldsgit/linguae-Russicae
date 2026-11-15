'use strict';

(() => {
  const STORAGE_KEY = 'russian-theory-editor-v1';
  const editor = document.getElementById('editor');
  const picker = document.getElementById('chapter');
  const download = document.getElementById('download');
  const status = document.getElementById('save-status');
  const count = document.getElementById('change-count');
  const toolbar = document.querySelector('.editor-toolbar');
  const tableTools = document.getElementById('table-tools');
  const columnWidth = document.getElementById('column-width');
  const rowHeight = document.getElementById('row-height');
  let selectedCell = null;
  let resizing = null;
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
    const allowed = new Set(['P', 'DIV', 'SECTION', 'H2', 'H3', 'H4', 'H5', 'H6', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'BR', 'UL', 'OL', 'LI', 'TABLE', 'COLGROUP', 'COL', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'A', 'DETAILS', 'SUMMARY', 'DL', 'DT', 'DD', 'BLOCKQUOTE', 'SPAN']);
    const discard = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'IMG', 'LINK', 'META']);
    function scrub(parent) {
      for (const node of Array.from(parent.childNodes)) {
        if (node.nodeType === 8) { node.remove(); continue; }
        if (node.nodeType !== 1) continue;
        if (discard.has(node.tagName)) { node.remove(); continue; }
        scrub(node);
        if (!allowed.has(node.tagName)) { node.replaceWith(...node.childNodes); continue; }
        // Keep only numeric table geometry. Never retain arbitrary pasted CSS.
        const dimensions = [];
        if (['TABLE', 'COL', 'TR', 'TH', 'TD'].includes(node.tagName)) {
          for (const property of ['width', 'height']) {
            const value = node.style[property];
            if (/^\d+(?:\.\d+)?px$/.test(value) && parseFloat(value) > 0 && parseFloat(value) <= (node.tagName === 'TABLE' ? 40000 : 2000)) dimensions.push(property + ': ' + value);
          }
          if (node.tagName === 'TABLE' && node.style.tableLayout === 'fixed') dimensions.push('table-layout: fixed');
        }
        for (const attribute of Array.from(node.attributes)) {
          const {name, value} = attribute;
          const validID = name === 'id' && /^[RS]\d{2}-\d{2}$/.test(value);
          const validClass = name === 'class' && ['rule', 'exception', 'table-wrap', 'dictionary', 'words'].includes(value);
          const validLink = node.tagName === 'A' && name === 'href' && /^(https:\/\/|#[A-Za-z0-9-]+)/.test(value);
          const validSpan = ['TH', 'TD'].includes(node.tagName) && ['colspan', 'rowspan'].includes(name) && /^[1-9]\d?$/.test(value);
          if (!(validID || validClass || validLink || validSpan)) node.removeAttribute(name);
        }
        if (dimensions.length) node.setAttribute('style', dimensions.join('; ') + ';');
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
    selectCell(null);
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

  function tableGeometry(table) {
    const grid = [];
    const positions = new Map();
    for (const [r, row] of Array.from(table.rows).entries()) {
      grid[r] ||= [];
      let c = 0;
      for (const cell of row.cells) {
        while (grid[r][c]) c++;
        positions.set(cell, c);
        for (let y = r; y < r + cell.rowSpan; y++) {
          grid[y] ||= [];
          for (let x = c; x < c + cell.colSpan; x++) grid[y][x] = cell;
        }
        c += cell.colSpan;
      }
    }
    const total = Math.max(1, ...grid.map(row => row.length));
    const widths = Array(total).fill(table.getBoundingClientRect().width / total);
    for (const [cell, column] of positions) {
      if (cell.colSpan === 1) widths[column] = cell.getBoundingClientRect().width;
    }
    const cols = Array.from(table.querySelectorAll(':scope > colgroup > col'));
    if (cols.length === total) cols.forEach((col, i) => { if (parseFloat(col.style.width)) widths[i] = parseFloat(col.style.width); });
    return {positions, widths: widths.map(width => Math.max(48, Math.min(2000, Math.round(width))))};
  }

  function selectCell(cell) {
    for (const marker of editor.querySelectorAll('[data-selected-cell]')) marker.removeAttribute('data-selected-cell');
    selectedCell = cell && editor.contains(cell) ? cell : null;
    for (const control of tableTools.querySelectorAll('input,button')) control.disabled = !selectedCell;
    document.getElementById('table-hint').textContent = selectedCell
      ? 'Тяните правую границу ячейки для ширины, нижнюю — для высоты. Ctrl+Z отменяет изменение.'
      : 'Нажмите на ячейку, чтобы изменить таблицу.';
    if (!selectedCell) { columnWidth.value = ''; rowHeight.value = ''; return; }
    selectedCell.dataset.selectedCell = '';
    const {positions, widths} = tableGeometry(selectedCell.closest('table'));
    columnWidth.value = widths[positions.get(selectedCell)];
    rowHeight.value = Math.round(selectedCell.parentElement.getBoundingClientRect().height);
  }

  function rememberTable() {
    if (!selectedCell?.isConnected) return null;
    const table = selectedCell.closest('table');
    return {table, index: Array.from(editor.querySelectorAll('table')).indexOf(table),
      row: selectedCell.parentElement.rowIndex, cell: selectedCell.cellIndex};
  }

  // Replacing the selected table with an edit command puts geometry/deletion in
  // the same native undo history as typing, including Ctrl+Z and the toolbar.
  function replaceTable(target, html, position) {
    editor.focus({preventScroll: true});
    const range = document.createRange();
    range.selectNode(target);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const changed = document.execCommand('insertHTML', false, html);
    if (!changed) { announce('Браузер не смог изменить таблицу. Попробуйте ещё раз.', true); return; }
    const cell = position && editor.querySelectorAll('table')[position.index]?.rows[position.row]?.cells[position.cell];
    if (cell) {
      range.selectNodeContents(cell);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    selectCell(cell || null);
    saveActive();
  }

  function sizedTable(position, width, height) {
    const {table} = position;
    const {positions, widths} = tableGeometry(table);
    const column = positions.get(table.rows[position.row].cells[position.cell]);
    if (width !== null) widths[column] = width;
    const clone = table.cloneNode(true);
    for (const marker of clone.querySelectorAll('[data-selected-cell]')) marker.removeAttribute('data-selected-cell');
    if (width !== null) {
      for (const group of clone.querySelectorAll(':scope > colgroup, :scope > col')) group.remove();
      const group = document.createElement('colgroup');
      for (const size of widths) {
        const col = document.createElement('col');
        col.style.width = size + 'px';
        group.append(col);
      }
      clone.prepend(group);
      clone.style.width = widths.reduce((sum, value) => sum + value, 0) + 'px';
      clone.style.tableLayout = 'fixed';
      for (const row of clone.rows) for (const cell of row.cells) cell.style.removeProperty('width');
    }
    if (height !== null) clone.rows[position.row].style.height = height + 'px';
    return cleanHTML(clone.outerHTML);
  }

  tableTools.addEventListener('click', event => {
    const button = event.target.closest('button');
    const position = rememberTable();
    if (!button || !position) return;
    if (button.id === 'delete-table') {
      const wrapper = position.table.parentElement;
      const target = wrapper.matches('.table-wrap') && wrapper.children.length === 1 ? wrapper : position.table;
      replaceTable(target, '<p><br></p>', null);
    } else {
      if (!columnWidth.reportValidity() || !rowHeight.reportValidity() || !columnWidth.value || !rowHeight.value) return;
      replaceTable(position.table, sizedTable(position, Number(columnWidth.value), Number(rowHeight.value)), position);
    }
  });
  for (const input of [columnWidth, rowHeight]) input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); document.getElementById('resize-table').click(); }
  });
  document.addEventListener('selectionchange', () => {
    if (resizing || tableTools.contains(document.activeElement)) return;
    const selection = window.getSelection();
    const node = selection?.anchorNode;
    const element = node?.nodeType === 1 ? node : node?.parentElement;
    if (element && editor.contains(element)) selectCell(element.closest('td,th'));
  });

  function edgeAt(event) {
    const cell = event.target.closest('td,th');
    if (!cell || !editor.contains(cell)) return null;
    const rect = cell.getBoundingClientRect();
    const axis = Math.abs(event.clientX - rect.right) < 6 ? 'column' : Math.abs(event.clientY - rect.bottom) < 6 ? 'row' : null;
    return axis && {cell, axis};
  }
  editor.addEventListener('pointermove', event => {
    if (resizing) return;
    const edge = edgeAt(event);
    editor.classList.toggle('resize-column', edge?.axis === 'column');
    editor.classList.toggle('resize-row', edge?.axis === 'row');
  });
  editor.addEventListener('pointerleave', () => editor.classList.remove('resize-column', 'resize-row'));
  editor.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const edge = edgeAt(event);
    if (!edge) return;
    event.preventDefault();
    selectCell(edge.cell);
    const position = rememberTable();
    resizing = {...position, axis: edge.axis, x: event.clientX, y: event.clientY,
      original: cleanHTML(position.table.outerHTML), width: Number(columnWidth.value), height: Number(rowHeight.value)};
    document.querySelector('.editor-app').classList.add('table-resizing');
    editor.setPointerCapture(event.pointerId);
  });
  editor.addEventListener('pointermove', event => {
    if (!resizing) return;
    const column = resizing.axis === 'column';
    const size = Math.max(column ? 48 : 28, Math.min(2000, Math.round(column ? resizing.width + event.clientX - resizing.x : resizing.height + event.clientY - resizing.y)));
    const preview = sizedTable(resizing, column ? size : null, column ? null : size);
    resizing.size = size;
    // Preview the geometry on the existing node, keeping the original for undo.
    const parsed = new DOMParser().parseFromString(preview, 'text/html').querySelector('table');
    resizing.table.setAttribute('style', parsed.getAttribute('style') || '');
    if (column) {
      for (const group of resizing.table.querySelectorAll(':scope > colgroup')) group.remove();
      resizing.table.prepend(parsed.querySelector('colgroup').cloneNode(true));
      columnWidth.value = size;
    } else {
      resizing.table.rows[resizing.row].style.height = size + 'px';
      rowHeight.value = size;
    }
  });
  function finishResize(cancelled = false) {
    if (!resizing) return;
    const state = resizing;
    const html = cleanHTML(state.table.outerHTML);
    // Restore before applying one undoable edit, rather than one edit per pixel.
    const original = new DOMParser().parseFromString(state.original, 'text/html').querySelector('table');
    state.table.replaceWith(original);
    resizing = null;
    document.querySelector('.editor-app').classList.remove('table-resizing');
    editor.classList.remove('resize-column', 'resize-row');
    if (!cancelled && state.size !== undefined) replaceTable(original, html, state);
    else { selectCell(original.rows[state.row]?.cells[state.cell]); saveActive(); }
  }
  editor.addEventListener('pointerup', () => finishResize());
  editor.addEventListener('pointercancel', () => finishResize(true));
  editor.addEventListener('lostpointercapture', () => finishResize(true));
  editor.addEventListener('keydown', event => {
    if (event.key === 'Escape' && resizing) { event.preventDefault(); finishResize(true); }
  });

  picker.addEventListener('change', () => openChapter(picker.value));
  window.addEventListener('hashchange', () => openChapter(location.hash.replace('#task-', '')));
  editor.addEventListener('input', () => {
    announce('Сохраняем черновик…');
    clearTimeout(timer);
    timer = setTimeout(saveActive, 300);
  });
  editor.addEventListener('click', event => {
    selectCell(event.target.closest('td,th'));
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
    if (!button || !active || tableTools.contains(button)) return;
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
      instructions: 'Сопоставить originalMarkdown и originalHTML с актуальной базой. Перенести изменения editedHTML (editedMarkdown — читаемая копия, размеры таблиц сохранены только в editedHTML), сохранить ID правил и размеры столбцов/строк. Изменения словников перенести в dictionary.path. При конфликте не перезаписывать новые изменения сайта. Пересобрать /theory/ и /edit/. Карточки и ответы не менять автоматически.',
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
