import { ROWS } from '../model';
import type { Page } from '../model';
import { renderRow } from './renderRow';

/**
 * Draws a page as a 40x25 DOM grid, replacing the container's children.
 * Returns the new `.teletext-grid` element.
 */
export function renderPage(page: Page, container: HTMLElement): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'teletext-grid';
  for (let r = 0; r < ROWS; r++) {
    grid.append(renderRow(page.rows[r], r));
  }
  container.replaceChildren(grid);
  return grid;
}
