import {
  COLS,
  FASTEXT_COLORS,
  MAX_PAGE,
  MIN_PAGE,
  PALETTE,
  ROWS,
} from './types';

export type Rule = 'grid' | 'palette' | 'header' | 'fastext';

export interface Violation {
  rule: Rule;
  message: string;
  row?: number;
  col?: number;
}

export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
}

const STALE_MARKER = 'STALE';
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const CONTROL_CHAR = /\p{Cc}/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPageNumber(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_PAGE &&
    value <= MAX_PAGE
  );
}

function isPaletteColor(value: unknown): boolean {
  return PALETTE.some((color) => color === value);
}

function isSingleGlyph(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    Array.from(value).length === 1 &&
    !CONTROL_CHAR.test(value)
  );
}

/** Cell chars of a row, with non-glyph cells rendered as a space. */
function rowText(row: readonly unknown[]): string {
  return row
    .map((cell) =>
      isRecord(cell) && isSingleGlyph(cell['char']) ? cell['char'] : ' ',
    )
    .join('');
}

function checkGridAndPalette(rows: unknown, out: Violation[]): void {
  if (!Array.isArray(rows)) {
    out.push({ rule: 'grid', message: 'rows must be an array of 25 rows' });
    return;
  }
  if (rows.length !== ROWS) {
    out.push({
      rule: 'grid',
      message: `page must have exactly ${ROWS} rows, found ${rows.length}`,
    });
  }
  rows.forEach((row: unknown, r) => {
    if (!Array.isArray(row)) {
      out.push({ rule: 'grid', message: 'row must be an array of cells', row: r });
      return;
    }
    if (row.length !== COLS) {
      out.push({
        rule: 'grid',
        message: `row must have exactly ${COLS} cells, found ${row.length}`,
        row: r,
      });
    }
    row.forEach((cell: unknown, c) => {
      if (!isRecord(cell)) {
        out.push({ rule: 'grid', message: 'cell must be an object', row: r, col: c });
        return;
      }
      if (!isSingleGlyph(cell['char'])) {
        out.push({
          rule: 'grid',
          message: 'cell char must be a single printable glyph',
          row: r,
          col: c,
        });
      }
      for (const layer of ['fg', 'bg'] as const) {
        if (!isPaletteColor(cell[layer])) {
          out.push({
            rule: 'palette',
            message: `${layer} color is not in the teletext palette`,
            row: r,
            col: c,
          });
        }
      }
    });
  });
}

function checkHeader(page: Record<string, unknown>, out: Violation[]): void {
  const { number, service, stale, rows } = page;
  const header = (message: string): void => {
    out.push({ rule: 'header', message, row: 0 });
  };

  if (!isPageNumber(number)) {
    header(`page number must be an integer in ${MIN_PAGE}-${MAX_PAGE}`);
  }
  if (typeof service !== 'string' || service.length === 0) {
    header('service name must be a non-empty string');
  }
  if (typeof stale !== 'boolean') {
    header('stale must be a boolean');
  }
  if (!Array.isArray(rows) || !Array.isArray(rows[0])) return;
  if (
    typeof number !== 'number' ||
    typeof service !== 'string' ||
    typeof stale !== 'boolean'
  ) {
    return;
  }

  const text = rowText(rows[0]).trimEnd();
  const prefix = `P${number} ${service} `;
  if (!text.startsWith(prefix)) {
    header(`header must start with "${prefix}"`);
    return;
  }
  const rest = text.slice(prefix.length);
  const markerSuffix = ` ${STALE_MARKER}`;
  const hasMarker = rest.endsWith(markerSuffix);
  const time = hasMarker ? rest.slice(0, -markerSuffix.length) : rest;
  if (!TIME_PATTERN.test(time)) {
    header('header must contain a time formatted HH:MM');
  }
  if (stale && !hasMarker) {
    header('stale page header must show a stale marker');
  } else if (!stale && hasMarker) {
    header('fresh page header must not show a stale marker');
  }
}

function checkFastext(page: Record<string, unknown>, out: Violation[]): void {
  const fastext = (message: string, col?: number): void => {
    out.push(
      col === undefined
        ? { rule: 'fastext', message, row: ROWS - 1 }
        : { rule: 'fastext', message, row: ROWS - 1, col },
    );
  };
  const { fastext: links, rows } = page;

  if (!Array.isArray(links) || links.length !== FASTEXT_COLORS.length) {
    fastext('fastext must contain exactly four links');
    return;
  }

  const row = Array.isArray(rows) ? rows[ROWS - 1] : undefined;
  const rowChars = Array.isArray(row) ? rowText(row) : undefined;

  links.forEach((link: unknown, i) => {
    const expectedColor = FASTEXT_COLORS[i];
    if (!isRecord(link)) {
      fastext(`fastext link ${i} must be an object`);
      return;
    }
    if (link['color'] !== expectedColor) {
      fastext(`fastext link ${i} must be ${expectedColor}`);
    }
    if (!isPageNumber(link['target'])) {
      fastext(`fastext link ${i} target must be an integer in ${MIN_PAGE}-${MAX_PAGE}`);
    }
    const label = link['label'];
    if (typeof label !== 'string' || label.length === 0) {
      fastext(`fastext link ${i} label must be a non-empty string`);
      return;
    }
    if (rowChars === undefined || !Array.isArray(row)) return;
    const start = rowChars.indexOf(label);
    if (start < 0) {
      fastext(`fastext link ${i} label "${label}" is not displayed in row 24`);
      return;
    }
    const labelCells: unknown[] = row.slice(start, start + label.length);
    const colored = labelCells.every(
      (cell) => isRecord(cell) && cell['fg'] === link['color'],
    );
    if (!colored) {
      fastext(`fastext link ${i} label must be drawn in ${String(link['color'])}`, start);
    }
  });
}

/**
 * Checks a value against the grid, palette, header and fastext invariants.
 * Pure and total: never throws, reports every independent violation.
 */
export function validatePage(page: unknown): ValidationResult {
  const violations: Violation[] = [];
  if (!isRecord(page)) {
    violations.push({ rule: 'grid', message: 'page must be an object' });
    return { valid: false, violations };
  }
  checkGridAndPalette(page['rows'], violations);
  checkHeader(page, violations);
  checkFastext(page, violations);
  return { valid: violations.length === 0, violations };
}
