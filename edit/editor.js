'use strict';

(() => {
  const {fitWidths, resizeWidths, percentages} = window.RussianTableLayout;
  const Table = window.RussianTableModel;
  const STORAGE_KEY = 'russian-theory-editor-v1';
  const editor = document.getElementById('editor');
  const picker = document.getElementById('chapter');
  const download = document.getElementById('download');
  const status = document.getElementById('save-status');
  const count = document.getElementById('change-count');
  const toolbar = document.querySelector('.editor-toolbar');
  const tableTools = document.getElementById('table-tools');
  let selectedCell = null;
  let selectedCells = [];
  let selectionAnchor = null;
  let selectionMode = false;
  let customTableSelection = false;
  let skipTableClick = false;
  let popupFrame = null;
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
            const pixels = /^\d+(?:\.\d+)?px$/.test(value) && parseFloat(value) > 0 && parseFloat(value) <= (node.tagName === 'TABLE' ? 40000 : 2000);
            const percent = property === 'width' && node.tagName === 'COL' && /^\d+(?:\.\d+)?%$/.test(value) && parseFloat(value) > 0 && parseFloat(value) <= 100;
            if (pixels || percent) dimensions.push(property + ': ' + value);
          }
          if (node.tagName === 'TABLE' && node.style.tableLayout === 'fixed') dimensions.push('table-layout: fixed');
        }
        for (const attribute of Array.from(node.attributes)) {
          const {name, value} = attribute;
          const validID = name === 'id' && /^[RS]\d{2}-\d{2}$/.test(value);
          const validClass = name === 'class' && ['rule', 'exception', 'table-wrap', 'dictionary', 'words'].includes(value);
          const validLink = node.tagName === 'A' && name === 'href' && /^(https:\/\/|#[A-Za-z0-9-]+)/.test(value);
          const validSpan = ['TH', 'TD'].includes(node.tagName) && ['colspan', 'rowspan'].includes(name) && /^[1-9]\d{0,2}$/.test(value);
          if (!(validID || validClass || validLink || validSpan)) node.removeAttribute(name);
        }
        if (dimensions.length) node.setAttribute('style', dimensions.join('; ') + ';');
      }
    }
    scrub(doc.body);
    // Migrate old pixel-wide drafts without losing their column proportions.
    for (const table of doc.body.querySelectorAll('table')) {
      table.style.width = '100%';
      table.style.tableLayout = 'fixed';
      const cols = Array.from(table.querySelectorAll(':scope > colgroup > col'));
      const ratios = percentages(cols.map(col => parseFloat(col.style.width) || 1));
      cols.forEach((col, i) => { col.style.width = ratios[i] + '%'; });
      for (const row of table.rows) for (const cell of row.cells) cell.style.removeProperty('width');
    }
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
    document.title = '№ ' + next + ' — Редактор базы знаний — Руса Лингво';
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
    const budget = Math.max(1, table.getBoundingClientRect().width);
    const widths = Array(total).fill(budget / total);
    for (const [cell, column] of positions) {
      if (cell.colSpan === 1) widths[column] = cell.getBoundingClientRect().width;
    }
    const cols = Array.from(table.querySelectorAll(':scope > colgroup > col'));
    if (cols.length === total) cols.forEach((col, i) => {
      const size = parseFloat(col.style.width);
      if (size) widths[i] = col.style.width.endsWith('%') ? size * budget / 100 : size;
    });
    const minimum = Math.min(48, budget / (total * 2));
    return {positions, widths: fitWidths(widths, budget), budget,
      minimum, maximum: budget - minimum * (total - 1)};
  }

  function readTable(table) {
    return Table.fromRows(Array.from(table.rows, row => Array.from(row.cells, cell => ({
      element: cell, html: cell.innerHTML, tag: cell.tagName, style: cell.getAttribute('style') || '',
      rowSpan: cell.rowSpan, colSpan: cell.colSpan,
    }))), Array.from(table.rows, row => row.getAttribute('style') || ''));
  }

  function positionTableTools() {
    if (!selectedCell?.isConnected || resizing) { tableTools.hidden = true; return; }
    const rect = selectedCell.closest('table').getBoundingClientRect();
    const toolbarBottom = Math.max(0, toolbar.getBoundingClientRect().bottom);
    if (rect.bottom < toolbarBottom || rect.top > window.innerHeight) { tableTools.hidden = true; return; }
    tableTools.hidden = false;
    const popup = tableTools.getBoundingClientRect();
    const cell = selectedCell.getBoundingClientRect();
    const anchor = rect.top >= toolbarBottom ? rect.top : cell.top;
    let top = anchor - popup.height - 10;
    if (top < toolbarBottom + 8) top = cell.bottom + 10;
    top = Math.max(toolbarBottom + 8, Math.min(top, window.innerHeight - popup.height - 12));
    tableTools.style.top = top + 'px';
    tableTools.style.left = Math.max(12, Math.min(rect.left, window.innerWidth - popup.width - 12)) + 'px';
  }
  function scheduleTableTools() {
    if (popupFrame !== null) return;
    popupFrame = requestAnimationFrame(() => { popupFrame = null; positionTableTools(); });
  }
  window.addEventListener('scroll', scheduleTableTools, true);
  window.addEventListener('resize', scheduleTableTools);

  function selectCell(cell, end = cell) {
    for (const marker of editor.querySelectorAll('[data-selected-cell],[data-multi-selected]')) {
      marker.removeAttribute('data-selected-cell'); marker.removeAttribute('data-multi-selected');
    }
    selectedCell = cell && editor.contains(cell) ? cell : null;
    if (!selectedCell) {
      selectedCells = []; selectionAnchor = null; selectionMode = false; customTableSelection = false; tableTools.hidden = true; return;
    }
    const table = selectedCell.closest('table');
    const model = readTable(table);
    const first = model.cells.find(record => record.element === cell);
    const last = model.cells.find(record => record.element === end) || first;
    const area = Table.rectangle(model, first.id, last.id);
    selectedCells = model.cells.filter(record => area.ids.includes(record.id)).map(record => record.element).filter(Boolean);
    for (const selected of selectedCells) {
      selected.dataset.selectedCell = '';
      if (selectedCells.length > 1) selected.dataset.multiSelected = '';
    }
    tableTools.querySelector('[data-table-action="merge"]').disabled = selectedCells.length < 2;
    tableTools.querySelector('[data-table-action="split"]').disabled = selectedCells.length !== 1 || cell.rowSpan === 1 && cell.colSpan === 1;
    tableTools.querySelector('[data-table-action="select"]').setAttribute('aria-pressed', String(selectionMode));
    document.getElementById('table-selection-status').textContent = 'Выбрано ячеек: ' + selectedCells.length;
    const rowsToDelete = area.bottom - area.top;
    const columnsToDelete = area.right - area.left;
    tableTools.querySelector('[data-table-action="delete-rows"]').textContent = rowsToDelete === 1 ? 'Удалить строку' : 'Удалить строки (' + rowsToDelete + ')';
    tableTools.querySelector('[data-table-action="delete-columns"]').textContent = columnsToDelete === 1 ? 'Удалить столбец' : 'Удалить столбцы (' + columnsToDelete + ')';
    document.getElementById('table-hint').textContent = selectionMode
      ? 'Нажмите первую и последнюю ячейку нужного прямоугольника, затем «Объединить».'
      : 'Для объединения выделите ячейки мышью или с помощью Shift + щелчок. Размеры меняются за границы.';
    positionTableTools();
    scheduleTableTools();
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
      cell.scrollIntoView({block: 'nearest'});
    }
    selectionMode = false;
    customTableSelection = false;
    selectionAnchor = cell || null;
    selectCell(cell || null);
    saveActive();
  }

  function sizedTable(position, width, height) {
    const {table} = position;
    const geometry = tableGeometry(table);
    const {positions, budget} = geometry;
    const column = position.resizeColumn ?? positions.get(table.rows[position.row].cells[position.cell]);
    const widths = width !== null ? resizeWidths(position.widths || geometry.widths, column, width, budget) : geometry.widths;
    const clone = table.cloneNode(true);
    for (const marker of clone.querySelectorAll('[data-selected-cell]')) marker.removeAttribute('data-selected-cell');
    if (width !== null) {
      for (const group of clone.querySelectorAll(':scope > colgroup, :scope > col')) group.remove();
      const group = document.createElement('colgroup');
      for (const size of percentages(widths)) {
        const col = document.createElement('col');
        col.style.width = size + '%';
        group.append(col);
      }
      clone.prepend(group);
      clone.style.width = '100%';
      clone.style.tableLayout = 'fixed';
      for (const row of clone.rows) for (const cell of row.cells) cell.style.removeProperty('width');
    }
    if (height !== null) clone.rows[position.resizeRow ?? position.row].style.height = height + 'px';
    return cleanHTML(clone.outerHTML);
  }

  function renderTable(model, source, focusId, widths) {
    const clone = source.cloneNode(true);
    for (const child of Array.from(clone.children)) child.remove();
    const cols = document.createElement('colgroup');
    for (const width of percentages(widths)) {
      const col = document.createElement('col'); col.style.width = width + '%'; cols.append(col);
    }
    clone.append(cols);
    const body = document.createElement('tbody');
    let focus;
    for (let r = 0; r < model.rows; r++) {
      const row = document.createElement('tr');
      if (model.rowStyles[r]) row.setAttribute('style', model.rowStyles[r]);
      const records = model.cells.filter(record => record.row === r).sort((a, b) => a.col - b.col);
      for (const [c, record] of records.entries()) {
        const cell = document.createElement(record.tag === 'TH' ? 'th' : 'td');
        cell.innerHTML = record.html;
        if (record.style) cell.setAttribute('style', record.style);
        if (record.rowSpan > 1) cell.rowSpan = record.rowSpan;
        if (record.colSpan > 1) cell.colSpan = record.colSpan;
        row.append(cell);
        if (record.id === focusId) focus = {row: r, cell: c};
      }
      body.append(row);
    }
    clone.append(body);
    return {html: cleanHTML(clone.outerHTML), focus};
  }

  function changeTable(action, insertAt) {
    const position = rememberTable();
    if (!position) return;
    const {table} = position;
    if (action === 'delete') {
      const wrapper = table.parentElement;
      const target = wrapper.matches('.table-wrap') && wrapper.children.length === 1 ? wrapper : table;
      replaceTable(target, '<p><br></p>', null);
      return;
    }
    const model = readTable(table);
    const current = model.cells.find(record => record.element === selectedCell);
    let result, focusId;
    const widths = tableGeometry(table).widths;
    try {
      if (action === 'delete-rows' || action === 'delete-columns') {
        const records = model.cells.filter(record => selectedCells.includes(record.element)).sort((a, b) => a.row - b.row || a.col - b.col);
        const area = Table.rectangle(model, records[0].id, records[records.length - 1].id);
        if (action === 'delete-rows') result = Table.deleteRows(model, area.top, area.bottom - area.top);
        else {
          result = Table.deleteColumns(model, area.left, area.right - area.left);
          widths.splice(area.left, area.right - area.left);
        }
        if (!result.rows || !result.columns) { changeTable('delete'); return; }
        focusId = Table.grid(result)[Math.min(area.top, result.rows - 1)][Math.min(area.left, result.columns - 1)].id;
      } else if (action.startsWith('row-')) {
        const at = insertAt ?? (action === 'row-before' ? current.row : current.row + current.rowSpan);
        result = Table.insertRow(model, at);
        focusId = Table.grid(result)[at][current.col].id;
      } else if (action.startsWith('column-')) {
        const at = action === 'column-before' ? current.col : current.col + current.colSpan;
        result = Table.insertColumn(model, at);
        focusId = Table.grid(result)[current.row][at].id;
        widths.splice(at, 0, widths.reduce((sum, value) => sum + value, 0) / widths.length);
      } else if (action === 'merge') {
        if (selectedCells.length < 2) return;
        const records = model.cells.filter(record => selectedCells.includes(record.element)).sort((a, b) => a.row - b.row || a.col - b.col);
        result = Table.merge(model, records[0].id, records[records.length - 1].id);
        focusId = records[0].id;
      } else if (action === 'split') {
        result = Table.split(model, current.id); focusId = current.id;
      } else return;
      const rendered = renderTable(result, table, focusId, widths);
      replaceTable(table, rendered.html, {...position, ...rendered.focus});
    } catch (error) { announce(error.message || 'Не удалось изменить таблицу.', true); }
  }

  tableTools.addEventListener('mousedown', event => { if (event.target.closest('button')) event.preventDefault(); });
  tableTools.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.id === 'close-table-tools') { selectCell(null); return; }
    const action = button.dataset.tableAction;
    if (action === 'select') {
      selectionMode = !selectionMode;
      selectionAnchor = null;
      selectCell(selectedCell);
    } else changeTable(action);
  });
  document.addEventListener('selectionchange', () => {
    if (resizing || selectionMode || customTableSelection && selectedCells.length > 1 || tableTools.contains(document.activeElement)) return;
    const selection = window.getSelection();
    const node = selection?.anchorNode;
    const element = node?.nodeType === 1 ? node : node?.parentElement;
    const focusNode = selection?.focusNode;
    const focus = focusNode?.nodeType === 1 ? focusNode : focusNode?.parentElement;
    if (element && editor.contains(element)) selectCell(element.closest('td,th'), focus?.closest('td,th'));
  });
  document.addEventListener('pointerdown', event => {
    if (!editor.contains(event.target) && !tableTools.contains(event.target)) selectCell(null);
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
    skipTableClick = false;
    if (event.button !== 0) return;
    const cell = event.target.closest('td,th');
    if (cell && (selectionMode || event.shiftKey)) {
      event.preventDefault();
      customTableSelection = true;
      if (!selectionAnchor || selectionAnchor.closest('table') !== cell.closest('table')) selectionAnchor = cell;
      selectCell(selectionAnchor, cell);
      skipTableClick = true;
      return;
    }
    customTableSelection = false;
    selectionAnchor = cell;
    const edge = edgeAt(event);
    if (!edge) return;
    event.preventDefault();
    selectCell(edge.cell);
    const position = rememberTable();
    const geometry = tableGeometry(position.table);
    const column = geometry.positions.get(edge.cell) + edge.cell.colSpan - 1;
    const row = position.row + edge.cell.rowSpan - 1;
    resizing = {...position, axis: edge.axis, x: event.clientX, y: event.clientY,
      original: cleanHTML(position.table.outerHTML), width: geometry.widths[column], height: position.table.rows[row].getBoundingClientRect().height,
      widths: geometry.widths, minimum: geometry.minimum, maximum: geometry.maximum, resizeColumn: column, resizeRow: row};
    tableTools.hidden = true;
    document.querySelector('.editor-app').classList.add('table-resizing');
    editor.setPointerCapture(event.pointerId);
  });
  editor.addEventListener('pointermove', event => {
    if (!resizing) return;
    const column = resizing.axis === 'column';
    const size = Math.max(column ? resizing.minimum : 28, Math.min(column ? resizing.maximum : 2000, Math.round(column ? resizing.width + event.clientX - resizing.x : resizing.height + event.clientY - resizing.y)));
    const preview = sizedTable(resizing, column ? size : null, column ? null : size);
    resizing.size = size;
    // Preview the geometry on the existing node, keeping the original for undo.
    const parsed = new DOMParser().parseFromString(preview, 'text/html').querySelector('table');
    resizing.table.setAttribute('style', parsed.getAttribute('style') || '');
    if (column) {
      for (const group of resizing.table.querySelectorAll(':scope > colgroup')) group.remove();
      resizing.table.prepend(parsed.querySelector('colgroup').cloneNode(true));
    } else {
      resizing.table.rows[resizing.resizeRow].style.height = size + 'px';
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
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    const node = window.getSelection()?.anchorNode;
    const cell = (node?.nodeType === 1 ? node : node?.parentElement)?.closest('td,th');
    if (!cell || !editor.contains(cell)) return;
    const model = readTable(cell.closest('table'));
    const current = model.cells.find(record => record.element === cell);
    if (event.key === 'Enter' && !event.shiftKey && window.getSelection()?.isCollapsed && current.row + current.rowSpan === model.rows) {
      event.preventDefault(); selectCell(cell); changeTable('row-after', model.rows);
    } else if (event.key === 'Tab') {
      const ordered = model.cells.slice().sort((a, b) => a.row - b.row || a.col - b.col);
      const index = ordered.findIndex(record => record.id === current.id);
      const next = ordered[index + (event.shiftKey ? -1 : 1)];
      if (next?.element) {
        event.preventDefault();
        const range = document.createRange(); range.selectNodeContents(next.element);
        const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
        selectCell(next.element); next.element.scrollIntoView({block: 'nearest'});
      } else if (!event.shiftKey) { event.preventDefault(); selectCell(cell); changeTable('row-after', model.rows); }
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (resizing) { event.preventDefault(); finishResize(true); }
    else if (!tableTools.hidden) { event.preventDefault(); selectCell(null); }
  });

  picker.addEventListener('change', () => openChapter(picker.value));
  window.addEventListener('hashchange', () => openChapter(location.hash.replace('#task-', '')));
  editor.addEventListener('input', () => {
    announce('Сохраняем черновик…');
    clearTimeout(timer);
    timer = setTimeout(saveActive, 300);
  });
  editor.addEventListener('click', event => {
    if (!skipTableClick) {
      const selection = window.getSelection();
      if (selection?.isCollapsed) selectCell(event.target.closest('td,th'));
    }
    skipTableClick = false;
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
      instructions: 'Сопоставить originalMarkdown и originalHTML с актуальной базой. Перенести изменения editedHTML (editedMarkdown — читаемая копия, размеры и объединения ячеек сохранены только в editedHTML), сохранить ID правил, colspan/rowspan, размеры столбцов/строк и весь текст объединённых ячеек. Изменения словников перенести в dictionary.path. При конфликте не перезаписывать новые изменения сайта. Пересобрать /theory/ и /edit/. Карточки и ответы не менять автоматически.',
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
