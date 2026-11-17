// @vitest-environment happy-dom
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { COLS, PALETTE, ROWS, validatePage } from '../../src/model';
import type { Cell, Color, FastextLink, Page, Row } from '../../src/model';
import { renderPage } from '../../src/renderer';

// Property 4.3: any valid Page renders without throwing and preserves grid
// dimensions and palette.
// **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 6.1**

const colorArb: fc.Arbitrary<Color> = fc.constantFrom(...PALETTE);

const MARKUP_CHARS = ['<', '>', '&', '"', "'", '/', '=', ' '];

/** A single printable code point (never a control character). */
const glyphArb: fc.Arbitrary<string> = fc.oneof(
  { weight: 3, arbitrary: fc.constantFrom(...MARKUP_CHARS) },
  { weight: 3, arbitrary: fc.integer({ min: 0x20, max: 0x7e }).map((n) => String.fromCodePoint(n)) },
  { weight: 2, arbitrary: fc.integer({ min: 0xa0, max: 0x2fff }).map((n) => String.fromCodePoint(n)) },
  { weight: 1, arbitrary: fc.integer({ min: 0x1f300, max: 0x1f64f }).map((n) => String.fromCodePoint(n)) },
);

const cellArb: fc.Arbitrary<Cell> = fc.record({ char: glyphArb, fg: colorArb, bg: colorArb });

const bodyRowArb: fc.Arbitrary<Row> = fc.array(cellArb, { minLength: COLS, maxLength: COLS });

/** Per-cell colors only; chars are overlaid by the header/fastext builders. */
const colorRowArb: fc.Arbitrary<Array<[Color, Color]>> = fc.array(fc.tuple(colorArb, colorArb), {
  minLength: COLS,
  maxLength: COLS,
});

// Disjoint alphabets per link so no label can occur inside another label,
// which keeps `indexOf(label)` in validatePage pointing at the placed label.
const ALPHABETS = ['ABCDEF', 'GHIJKL', 'MNOPQR', 'STUVWX'] as const;
const FASTEXT_COLORS_ORDER = ['red', 'green', 'yellow', 'cyan'] as const;

const labelArb = (alphabet: string): fc.Arbitrary<string> =>
  fc
    .array(fc.constantFrom(...Array.from(alphabet)), { minLength: 1, maxLength: 9 })
    .map((chars) => chars.join(''));

const labelsArb = fc.tuple(
  labelArb(ALPHABETS[0]),
  labelArb(ALPHABETS[1]),
  labelArb(ALPHABETS[2]),
  labelArb(ALPHABETS[3]),
);

const pageNumberArb = fc.integer({ min: 100, max: 899 });
const serviceArb = fc
  .array(fc.constantFrom(...Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')), {
    minLength: 1,
    maxLength: 16,
  })
  .map((chars) => chars.join(''));
const timeArb = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

const pageArb: fc.Arbitrary<Page> = fc
  .record({
    number: pageNumberArb,
    service: serviceArb,
    time: timeArb,
    stale: fc.boolean(),
    labels: labelsArb,
    targets: fc.tuple(pageNumberArb, pageNumberArb, pageNumberArb, pageNumberArb),
    headerColors: colorRowArb,
    fastextColors: colorRowArb,
    body: fc.array(bodyRowArb, { minLength: ROWS - 2, maxLength: ROWS - 2 }),
    generatedAt: fc.date({ min: new Date(0), max: new Date(4102444800000), noInvalidDate: true }).map((d) => d.toISOString()),
  })
  .map((g) => {
    const headerText = `P${g.number} ${g.service} ${g.time}${g.stale ? ' STALE' : ''}`;
    const header: Row = g.headerColors.map(([fg, bg], i) => ({
      char: Array.from(headerText)[i] ?? ' ',
      fg,
      bg,
    }));

    const links = FASTEXT_COLORS_ORDER.map(
      (color, i): FastextLink => ({
        label: g.labels[i] as string,
        target: g.targets[i] as number,
        color,
      }),
    ) as Page['fastext'];

    const fastextRow: Row = g.fastextColors.map(([fg, bg]) => ({ char: ' ', fg, bg }));
    links.forEach((link, idx) => {
      Array.from(link.label).forEach((ch, j) => {
        const pos = idx * 10 + j;
        fastextRow[pos] = { char: ch, fg: link.color, bg: (fastextRow[pos] as Cell).bg };
      });
    });

    return {
      number: g.number,
      service: g.service,
      rows: [header, ...g.body, fastextRow],
      fastext: links,
      stale: g.stale,
      generatedAt: g.generatedAt,
    };
  });


const NUM_RUNS = 30;
const TIMEOUT_MS = 60_000;

function freshContainer(): HTMLElement {
  document.body.replaceChildren();
  const container = document.createElement('div');
  document.body.append(container);
  return container;
}

/** Grid as rows of cell elements, read by position (no selector scans). */
function cellMatrix(grid: HTMLElement): HTMLElement[][] {
  return Array.from(grid.children).map((row) => Array.from(row.children) as HTMLElement[]);
}

describe('renderPage property: any valid Page', () => {
  it(
    'generator only produces pages accepted by validatePage',
    () => {
      fc.assert(
        fc.property(pageArb, (page) => {
          const result = validatePage(page);
          expect(result.violations).toEqual([]);
          expect(result.valid).toBe(true);
        }),
        { numRuns: NUM_RUNS },
      );
    },
    TIMEOUT_MS,
  );

  it(
    'renders without throwing into exactly 25 rows x 40 cells',
    () => {
      fc.assert(
        fc.property(pageArb, (page) => {
          expect(validatePage(page).valid).toBe(true);
          const container = freshContainer();
          let grid!: HTMLElement;
          expect(() => {
            grid = renderPage(page, container);
          }).not.toThrow();

          expect(grid.classList.contains('teletext-grid')).toBe(true);
          const matrix = cellMatrix(grid);
          expect(matrix).toHaveLength(ROWS);
          const badShape: string[] = [];
          matrix.forEach((cells, r) => {
            const rowEl = grid.children[r] as HTMLElement;
            if (rowEl.className !== 'tt-row' || rowEl.dataset['row'] !== String(r)) {
              badShape.push(`row ${r} header`);
            }
            if (cells.length !== COLS) badShape.push(`row ${r} has ${cells.length} cells`);
            cells.forEach((cell, c) => {
              if (
                cell.className !== 'tt-cell' ||
                cell.dataset['row'] !== String(r) ||
                cell.dataset['col'] !== String(c)
              ) {
                badShape.push(`cell ${r},${c}`);
              }
            });
          });
          expect(badShape).toEqual([]);
          expect(grid.querySelectorAll('.tt-cell')).toHaveLength(ROWS * COLS);
        }),
        { numRuns: NUM_RUNS },
      );
    },
    TIMEOUT_MS,
  );

  it(
    'keeps every cell char and palette colors equal to the model',
    () => {
      const palette: readonly string[] = PALETTE;
      fc.assert(
        fc.property(pageArb, (page) => {
          expect(validatePage(page).valid).toBe(true);
          const matrix = cellMatrix(renderPage(page, freshContainer()));
          const mismatches: string[] = [];
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              const input = (page.rows[r] as Row)[c] as Cell;
              const el = (matrix[r] as HTMLElement[])[c] as HTMLElement;
              const fg = el.dataset['fg'] ?? '';
              const bg = el.dataset['bg'] ?? '';
              if (
                !palette.includes(fg) ||
                !palette.includes(bg) ||
                fg !== input.fg ||
                bg !== input.bg ||
                el.textContent !== input.char
              ) {
                mismatches.push(
                  `${r},${c}: got ${JSON.stringify([el.textContent, fg, bg])}, want ${JSON.stringify([input.char, input.fg, input.bg])}`,
                );
              }
            }
          }
          expect(mismatches).toEqual([]);
        }),
        { numRuns: NUM_RUNS },
      );
    },
    TIMEOUT_MS,
  );

  it(
    'leaves exactly one grid when rendering twice into the same container',
    () => {
      fc.assert(
        fc.property(pageArb, pageArb, (first, second) => {
          const container = freshContainer();
          renderPage(first, container);
          const grid = renderPage(second, container);
          expect(container.children).toHaveLength(1);
          expect(container.firstElementChild).toBe(grid);
          expect(container.querySelectorAll('.teletext-grid')).toHaveLength(1);
          expect(container.querySelectorAll('.tt-row')).toHaveLength(ROWS);
          expect(container.querySelectorAll('.tt-cell')).toHaveLength(ROWS * COLS);
        }),
        { numRuns: NUM_RUNS },
      );
    },
    TIMEOUT_MS,
  );

  it(
    'never creates child elements inside cells, even for markup-like chars',
    () => {
      const markupCell = fc.record({
        char: fc.constantFrom('<', '>', '&', '"', "'"),
        fg: colorArb,
        bg: colorArb,
      });
      const overrideArb = fc.record({
        row: fc.integer({ min: 1, max: ROWS - 2 }),
        col: fc.integer({ min: 0, max: COLS - 1 }),
        cell: markupCell,
      });
      fc.assert(
        fc.property(
          pageArb,
          fc.array(overrideArb, { minLength: 1, maxLength: 60 }),
          (base, overrides) => {
            const rows = base.rows.map((row) => row.slice());
            for (const o of overrides) (rows[o.row] as Row)[o.col] = o.cell;
            const page: Page = { ...base, rows };
            expect(validatePage(page).valid).toBe(true);

            const grid = renderPage(page, freshContainer());
            const matrix = cellMatrix(grid);
            const offenders: string[] = [];
            matrix.forEach((cells, r) =>
              cells.forEach((el, c) => {
                const input = (rows[r] as Row)[c] as Cell;
                if (
                  el.children.length !== 0 ||
                  el.childNodes.length > 1 ||
                  el.textContent !== input.char
                ) {
                  offenders.push(`${r},${c}`);
                }
              }),
            );
            expect(offenders).toEqual([]);
            expect(grid.querySelectorAll('.tt-cell')).toHaveLength(ROWS * COLS);
            expect(grid.querySelectorAll('.tt-row')).toHaveLength(ROWS);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    },
    TIMEOUT_MS,
  );
});
