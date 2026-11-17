// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { renderPage } from '../../src/renderer';
import { typeset } from '../../src/pipeline/typeset';
import type { Cell, Color, FastextLink, Page, Row } from '../../src/model';

// RED step (task 4.1): src/renderer does not exist yet; task 4.2 implements it.
//
// Assumed API (to be implemented in 4.2), exported from src/renderer/index.ts:
//   renderPage(page: Page, container: HTMLElement): HTMLElement
//   - Replaces the container's children with a single grid element and returns it.
//     Calling it again on the same container replaces the previous grid.
//   - DOM conventions (no innerHTML; cell text is set via textContent):
//       grid : <div class="teletext-grid">           exactly one per container
//       row  : <div class="tt-row" data-row="r">     25 per grid, r = 0..24, in order
//       cell : <span class="tt-cell"
//                    data-row="r" data-col="c"
//                    data-fg="<palette color>" data-bg="<palette color>">
//              one glyph via textContent </span>        40 per row, c = 0..39, in order
//   - Colors are exposed only as palette names in data-fg / data-bg.
//
// Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 6.1

const PALETTE: Color[] = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
const COLS = 40;
const ROWS = 25;

const cell = (char = ' ', fg: Color = 'white', bg: Color = 'black'): Cell => ({ char, fg, bg });

function textRow(text: string, fg: Color = 'white'): Row {
  const glyphs = Array.from(text);
  const row: Row = [];
  for (let i = 0; i < COLS; i++) row.push(cell(glyphs[i] ?? ' ', fg));
  return row;
}

const LINKS: [FastextLink, FastextLink, FastextLink, FastextLink] = [
  { label: 'INDEX', target: 100, color: 'red' },
  { label: 'NEWS', target: 101, color: 'green' },
  { label: 'WEATHER', target: 302, color: 'yellow' },
  { label: 'ABOUT', target: 888, color: 'cyan' },
];

function fastextRow(links: readonly FastextLink[]): Row {
  const row: Row = [];
  for (let i = 0; i < COLS; i++) row.push(cell());
  links.forEach((link, idx) => {
    for (let j = 0; j < link.label.length; j++) {
      row[idx * 10 + j] = cell(link.label[j] ?? ' ', link.color);
    }
  });
  return row;
}

function makePage(overrides: Partial<Page> = {}, body: string[] = []): Page {
  const number = overrides.number ?? 100;
  const service = overrides.service ?? 'TELETEXT REBORN';
  const stale = overrides.stale ?? false;
  const header = `P${number} ${service} 12:34${stale ? ' STALE' : ''}`;
  const rows: Row[] = [textRow(header, 'yellow')];
  for (let r = 1; r < ROWS - 1; r++) rows.push(textRow(body[r - 1] ?? ''));
  rows.push(fastextRow(LINKS));
  return {
    number,
    service,
    rows,
    fastext: LINKS,
    stale,
    generatedAt: '2025-01-01T12:34:00.000Z',
    ...overrides,
  };
}

let container: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  container = document.createElement('div');
  document.body.append(container);
});

const rowEl = (grid: HTMLElement, r: number): HTMLElement => {
  const el = grid.querySelector<HTMLElement>(`.tt-row[data-row="${r}"]`);
  if (!el) throw new Error(`row ${r} not found`);
  return el;
};

const cellEl = (grid: HTMLElement, r: number, c: number): HTMLElement => {
  const el = grid.querySelector<HTMLElement>(`.tt-cell[data-row="${r}"][data-col="${c}"]`);
  if (!el) throw new Error(`cell ${r},${c} not found`);
  return el;
};

const rowText = (grid: HTMLElement, r: number): string =>
  Array.from(rowEl(grid, r).querySelectorAll('.tt-cell'))
    .map((el) => el.textContent ?? '')
    .join('');

describe('renderPage: 40x25 grid (Req 1.1)', () => {
  it('returns a single .teletext-grid placed inside the container', () => {
    const grid = renderPage(makePage(), container);
    expect(grid.classList.contains('teletext-grid')).toBe(true);
    expect(container.querySelectorAll('.teletext-grid')).toHaveLength(1);
    expect(grid.parentElement).toBe(container);
  });

  it('renders exactly 25 rows numbered 0..24 in order', () => {
    const grid = renderPage(makePage(), container);
    const rows = Array.from(grid.querySelectorAll('.tt-row'));
    expect(rows).toHaveLength(ROWS);
    expect(rows.map((r) => r.getAttribute('data-row'))).toEqual(
      Array.from({ length: ROWS }, (_, i) => String(i)),
    );
  });

  it('renders exactly 40 cells numbered 0..39 in every row', () => {
    const grid = renderPage(makePage(), container);
    for (let r = 0; r < ROWS; r++) {
      const cells = Array.from(rowEl(grid, r).querySelectorAll('.tt-cell'));
      expect(cells).toHaveLength(COLS);
      expect(cells.map((c) => c.getAttribute('data-col'))).toEqual(
        Array.from({ length: COLS }, (_, i) => String(i)),
      );
    }
  });

  it('renders 1000 cells in total', () => {
    const grid = renderPage(makePage(), container);
    expect(grid.querySelectorAll('.tt-cell')).toHaveLength(COLS * ROWS);
  });

  it('replaces the previous grid when rendering again into the same container', () => {
    renderPage(makePage({ number: 100 }), container);
    const grid = renderPage(makePage({ number: 302 }), container);
    expect(container.querySelectorAll('.teletext-grid')).toHaveLength(1);
    expect(container.querySelectorAll('.tt-cell')).toHaveLength(COLS * ROWS);
    expect(rowText(grid, 0).startsWith('P302 ')).toBe(true);
  });
});

describe('renderPage: cell content and palette (Req 1.2)', () => {
  it('writes each cell glyph and colors from the model', () => {
    const page = makePage();
    page.rows[3]![4] = cell('X', 'magenta', 'blue');
    const grid = renderPage(page, container);
    const el = cellEl(grid, 3, 4);
    expect(el.textContent).toBe('X');
    expect(el.getAttribute('data-fg')).toBe('magenta');
    expect(el.getAttribute('data-bg')).toBe('blue');
  });

  it.each(PALETTE)('renders %s as foreground and background', (color) => {
    const page = makePage();
    page.rows[10]![0] = cell('#', color, color);
    const el = cellEl(renderPage(page, container), 10, 0);
    expect(el.getAttribute('data-fg')).toBe(color);
    expect(el.getAttribute('data-bg')).toBe(color);
  });

  it('exposes only palette colors on every cell', () => {
    const grid = renderPage(makePage(), container);
    for (const el of Array.from(grid.querySelectorAll<HTMLElement>('.tt-cell'))) {
      expect(PALETTE).toContain(el.getAttribute('data-fg'));
      expect(PALETTE).toContain(el.getAttribute('data-bg'));
    }
  });

  it('renders markup characters as literal text, not elements', () => {
    const page = makePage();
    page.rows[5]![0] = cell('<');
    page.rows[5]![1] = cell('&');
    const grid = renderPage(page, container);
    expect(cellEl(grid, 5, 0).textContent).toBe('<');
    expect(cellEl(grid, 5, 1).textContent).toBe('&');
    expect(cellEl(grid, 5, 0).children).toHaveLength(0);
    expect(grid.querySelectorAll('.tt-cell')).toHaveLength(COLS * ROWS);
  });
});

describe('renderPage: header row (Req 1.3)', () => {
  it('shows P{number}, service name and HH:MM in row 0', () => {
    const grid = renderPage(makePage({ number: 302, service: 'TELETEXT REBORN' }), container);
    expect(rowText(grid, 0).trimEnd()).toBe('P302 TELETEXT REBORN 12:34');
  });

  it.each([100, 101, 899])('shows page number %s in the header', (number) => {
    const grid = renderPage(makePage({ number }), container);
    expect(rowText(grid, 0).startsWith(`P${number} TELETEXT REBORN `)).toBe(true);
  });

  it('shows a visible stale marker in the header of a stale page', () => {
    const grid = renderPage(makePage({ stale: true }), container);
    expect(rowText(grid, 0).trimEnd()).toBe('P100 TELETEXT REBORN 12:34 STALE');
  });

  it('shows no stale marker in the header of a fresh page', () => {
    const grid = renderPage(makePage({ stale: false }), container);
    expect(rowText(grid, 0)).not.toContain('STALE');
  });

  it('renders the header row cells with the colors from the model', () => {
    const grid = renderPage(makePage(), container);
    for (let c = 0; c < COLS; c++) {
      expect(cellEl(grid, 0, c).getAttribute('data-fg')).toBe('yellow');
    }
  });
});

describe('renderPage: content never overflows the grid (Req 1.4)', () => {
  it('renders typeset lines, including a truncated long word, as exactly 40 cells per row', () => {
    const lines = typeset(`${'W'.repeat(60)} and a long headline that must wrap onto more than one line`);
    const grid = renderPage(makePage({}, lines), container);
    expect(lines.length).toBeGreaterThan(1);
    expect(grid.querySelectorAll('.tt-cell')).toHaveLength(COLS * ROWS);
    for (let r = 0; r < ROWS; r++) {
      expect(rowEl(grid, r).querySelectorAll('.tt-cell')).toHaveLength(COLS);
    }
    expect(rowText(grid, 1)).toBe('W'.repeat(COLS));
  });
});

describe('renderPage: fastext row (Req 1.5)', () => {
  it('shows all four link labels in row 24', () => {
    const text = rowText(renderPage(makePage(), container), 24);
    for (const link of LINKS) expect(text).toContain(link.label);
  });

  it('draws each label in its link color: red, green, yellow, cyan', () => {
    const grid = renderPage(makePage(), container);
    const text = rowText(grid, 24);
    LINKS.forEach((link) => {
      const start = text.indexOf(link.label);
      expect(start).toBeGreaterThanOrEqual(0);
      for (let i = 0; i < link.label.length; i++) {
        expect(cellEl(grid, 24, start + i).getAttribute('data-fg')).toBe(link.color);
      }
    });
  });

  it('orders the labels left to right as red, green, yellow, cyan', () => {
    const grid = renderPage(makePage(), container);
    const text = rowText(grid, 24);
    const positions = LINKS.map((link) => text.indexOf(link.label));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(
      positions.map((p) => cellEl(grid, 24, p).getAttribute('data-fg')),
    ).toEqual(['red', 'green', 'yellow', 'cyan']);
  });
});
