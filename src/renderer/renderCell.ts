import type { Cell } from '../model';

export const BLANK_CELL: Cell = { char: ' ', fg: 'white', bg: 'black' };

/** Builds one `.tt-cell` span. The glyph is set via textContent only. */
export function renderCell(cell: Cell, row: number, col: number): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = 'tt-cell';
  el.dataset['row'] = String(row);
  el.dataset['col'] = String(col);
  el.dataset['fg'] = cell.fg;
  el.dataset['bg'] = cell.bg;
  el.textContent = cell.char;
  return el;
}
