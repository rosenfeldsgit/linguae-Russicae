'use strict';

// Logical cells keep row/column spans independent of the browser's text caret.
(() => {
  const copy = model => ({...model, rowStyles: [...model.rowStyles], cells: model.cells.map(cell => ({...cell}))});
  const nextId = model => Math.max(-1, ...model.cells.map(cell => cell.id)) + 1;
  const blank = (id, row, col, tag = 'TD') => ({id, row, col, rowSpan: 1, colSpan: 1, tag, html: '<br>', style: ''});

  function grid(model) {
    const result = Array.from({length: model.rows}, () => Array(model.columns).fill(null));
    for (const cell of model.cells) for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
      for (let c = cell.col; c < cell.col + cell.colSpan; c++) {
        if (!result[r] || c >= model.columns || result[r][c]) throw new Error('Invalid table geometry');
        result[r][c] = cell;
      }
    }
    return result;
  }

  function fromRows(rows, rowStyles = []) {
    const occupied = rows.map(() => []);
    const cells = [];
    let columns = 0;
    for (let r = 0; r < rows.length; r++) {
      let c = 0;
      for (const source of rows[r]) {
        const rowSpan = Math.min(Math.max(1, source.rowSpan || 1), rows.length - r);
        const colSpan = Math.max(1, source.colSpan || 1);
        while (Array.from({length: colSpan}, (_, x) => occupied[r][c + x]).some(Boolean)) c++;
        const cell = {...source, id: cells.length, row: r, col: c, rowSpan, colSpan};
        cells.push(cell);
        for (let y = r; y < r + rowSpan; y++) for (let x = c; x < c + colSpan; x++) occupied[y][x] = cell;
        c += colSpan;
        columns = Math.max(columns, c);
      }
    }
    const model = {rows: rows.length, columns, cells, rowStyles: rows.map((_, i) => rowStyles[i] || '')};
    // Ragged pasted tables gain empty cells; existing content is never discarded.
    let id = nextId(model);
    for (let r = 0; r < model.rows; r++) for (let c = 0; c < columns; c++) if (!occupied[r][c]) model.cells.push(blank(id++, r, c));
    return model;
  }

  function rectangle(model, firstId, lastId) {
    const first = model.cells.find(cell => cell.id === firstId);
    const last = model.cells.find(cell => cell.id === lastId);
    if (!first || !last) return null;
    let top = Math.min(first.row, last.row), left = Math.min(first.col, last.col);
    let bottom = Math.max(first.row + first.rowSpan, last.row + last.rowSpan);
    let right = Math.max(first.col + first.colSpan, last.col + last.colSpan);
    let selected;
    let changed;
    do {
      changed = false;
      selected = model.cells.filter(cell => cell.row < bottom && cell.row + cell.rowSpan > top && cell.col < right && cell.col + cell.colSpan > left);
      for (const cell of selected) {
        const bounds = [Math.min(top, cell.row), Math.min(left, cell.col), Math.max(bottom, cell.row + cell.rowSpan), Math.max(right, cell.col + cell.colSpan)];
        if (bounds.some((value, i) => value !== [top, left, bottom, right][i])) changed = true;
        [top, left, bottom, right] = bounds;
      }
    } while (changed);
    return {top, left, bottom, right, ids: selected.map(cell => cell.id)};
  }

  function insertRow(model, at) {
    if (model.rows >= 999) throw new Error('Слишком много строк в одной таблице.');
    const result = copy(model);
    at = Math.max(0, Math.min(model.rows, at));
    for (const cell of result.cells) {
      if (cell.row < at && cell.row + cell.rowSpan > at) cell.rowSpan++;
      else if (cell.row >= at) cell.row++;
    }
    result.rows++;
    result.rowStyles.splice(at, 0, '');
    const occupied = grid(result);
    let id = nextId(result);
    for (let c = 0; c < result.columns; c++) if (!occupied[at][c]) result.cells.push(blank(id++, at, c));
    return result;
  }

  function insertColumn(model, at) {
    if (model.columns >= 999) throw new Error('Слишком много столбцов в одной таблице.');
    const result = copy(model);
    at = Math.max(0, Math.min(model.columns, at));
    for (const cell of result.cells) {
      if (cell.col < at && cell.col + cell.colSpan > at) cell.colSpan++;
      else if (cell.col >= at) cell.col++;
    }
    result.columns++;
    const occupied = grid(result);
    let id = nextId(result);
    for (let r = 0; r < result.rows; r++) if (!occupied[r][at]) {
      const header = model.cells.filter(cell => cell.row <= r && cell.row + cell.rowSpan > r).every(cell => cell.tag === 'TH');
      result.cells.push(blank(id++, r, at, header ? 'TH' : 'TD'));
    }
    return result;
  }

  function merge(model, firstId, lastId) {
    const area = rectangle(model, firstId, lastId);
    if (!area || area.ids.length < 2) return copy(model);
    const result = copy(model);
    const selected = result.cells.filter(cell => area.ids.includes(cell.id)).sort((a, b) => a.row - b.row || a.col - b.col);
    const first = selected[0];
    const content = selected.filter(cell => cell.html.replace(/<[^>]+>|&nbsp;|\s/g, '')).map(cell => '<div>' + cell.html + '</div>').join('');
    first.html = content || '<br>';
    first.row = area.top; first.col = area.left;
    first.rowSpan = area.bottom - area.top; first.colSpan = area.right - area.left;
    result.cells = result.cells.filter(cell => cell.id === first.id || !area.ids.includes(cell.id));
    return result;
  }

  function split(model, id) {
    const result = copy(model);
    const cell = result.cells.find(cell => cell.id === id);
    if (!cell) return result;
    let newId = nextId(result);
    for (let r = cell.row; r < cell.row + cell.rowSpan; r++) for (let c = cell.col; c < cell.col + cell.colSpan; c++) {
      if (r !== cell.row || c !== cell.col) result.cells.push(blank(newId++, r, c, cell.tag));
    }
    cell.rowSpan = 1; cell.colSpan = 1;
    return result;
  }

  function deleteBand(model, axis, at, count = 1) {
    const result = copy(model);
    const dimension = axis === 'row' ? 'rows' : 'columns';
    const span = axis === 'row' ? 'rowSpan' : 'colSpan';
    if (!model[dimension] || !Number.isInteger(at) || at < 0 || at >= model[dimension] || !Number.isInteger(count) || count < 1) return result;
    count = Math.min(count, model[dimension] - at);
    const end = at + count;
    result[dimension] -= count;
    result.cells = result.cells.filter(cell => {
      const overlap = Math.max(0, Math.min(end, cell[axis] + cell[span]) - Math.max(at, cell[axis]));
      if (overlap === cell[span]) return false;
      cell[span] -= overlap;
      if (cell[axis] >= at) cell[axis] = Math.max(at, cell[axis] - count);
      return true;
    });
    if (axis === 'row') result.rowStyles.splice(at, count);
    return result;
  }
  const deleteRows = (model, at, count = 1) => deleteBand(model, 'row', at, count);
  const deleteColumns = (model, at, count = 1) => deleteBand(model, 'col', at, count);

  const api = Object.freeze({fromRows, grid, rectangle, insertRow, insertColumn, merge, split, deleteRows, deleteColumns});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.RussianTableModel = api;
})();
