import { COLS } from '../model';
import type { Row } from '../model';
import { BLANK_CELL, renderCell } from './renderCell';

/** Builds one `.tt-row` of exactly COLS cells; missing cells render blank, extras are dropped. */
export function renderRow(row: Row | undefined, index: number): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'tt-row';
  el.dataset['row'] = String(index);
  for (let col = 0; col < COLS; col++) {
    el.append(renderCell(row?.[col] ?? BLANK_CELL, index, col));
  }
  return el;
}
