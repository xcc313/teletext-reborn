import { describe, expect, it } from 'vitest';
import { validatePage } from '../../src/model';
import type { Cell, Color, FastextLink, Page, Row } from '../../src/model';

// RED step (task 2.1): src/model does not exist yet; task 2.2 implements it.
//
// Assumed API (to be implemented in 2.2):
//   validatePage(page: unknown): { valid: boolean; violations: Violation[] }
//   Violation = { rule: string; message: string; row?: number; col?: number }
// Rule ids used below: 'grid', 'palette', 'header', 'fastext'.

const PALETTE: Color[] = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
const COLS = 40;
const ROWS = 25;

const cell = (char = ' ', fg: Color = 'white', bg: Color = 'black'): Cell => ({ char, fg, bg });

function textRow(text: string, fg: Color = 'white'): Row {
  const row: Row = [];
  for (let i = 0; i < COLS; i++) row.push(cell(text[i] ?? ' ', fg));
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

function makePage(overrides: Partial<Page> = {}): Page {
  const number = overrides.number ?? 100;
  const service = overrides.service ?? 'TELETEXT REBORN';
  const stale = overrides.stale ?? false;
  const header = `P${number} ${service} 12:34${stale ? ' STALE' : ''}`;
  const rows: Row[] = [textRow(header, 'yellow')];
  for (let r = 1; r < ROWS - 1; r++) rows.push(textRow(''));
  rows.push(fastextRow(overrides.fastext ?? LINKS));
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

const rulesOf = (page: unknown) => validatePage(page).violations.map((v) => v.rule);

describe('validatePage: valid page', () => {
  it('accepts a well-formed fresh page', () => {
    const result = validatePage(makePage());
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('accepts a well-formed stale page with a stale marker in the header', () => {
    expect(validatePage(makePage({ stale: true })).valid).toBe(true);
  });

  it('accepts boundary page numbers 100 and 899', () => {
    expect(validatePage(makePage({ number: 100 })).valid).toBe(true);
    expect(validatePage(makePage({ number: 899 })).valid).toBe(true);
  });
});

describe('validatePage: grid dimensions (Req 1.1)', () => {
  it('rejects a page with 24 rows', () => {
    const page = makePage();
    page.rows.pop();
    const result = validatePage(page);
    expect(result.valid).toBe(false);
    expect(rulesOf(page)).toContain('grid');
  });

  it('rejects a page with 26 rows', () => {
    const page = makePage();
    page.rows.push(textRow(''));
    expect(validatePage(page).valid).toBe(false);
    expect(rulesOf(page)).toContain('grid');
  });

  it('rejects a row with 39 cells and reports its row index', () => {
    const page = makePage();
    page.rows[5] = page.rows[5]!.slice(0, 39);
    const violations = validatePage(page).violations.filter((v) => v.rule === 'grid');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.row === 5)).toBe(true);
  });

  it('rejects a row with 41 cells', () => {
    const page = makePage();
    page.rows[7] = [...page.rows[7]!, cell()];
    expect(rulesOf(page)).toContain('grid');
  });

  it('rejects a cell whose char is not a single glyph', () => {
    const page = makePage();
    page.rows[3]![4] = cell('AB');
    const v = validatePage(page).violations.find((x) => x.rule === 'grid');
    expect(v).toBeDefined();
    expect(v?.row).toBe(3);
    expect(v?.col).toBe(4);
  });

  it('rejects an empty-string cell char', () => {
    const page = makePage();
    page.rows[3]![4] = cell('');
    expect(rulesOf(page)).toContain('grid');
  });
});

describe('validatePage: palette membership (Req 1.2)', () => {
  it.each(PALETTE)('accepts %s as foreground and background', (color) => {
    const page = makePage();
    page.rows[10]![0] = cell('X', color, color);
    expect(validatePage(page).valid).toBe(true);
  });

  it('rejects a foreground outside the palette and reports row/col', () => {
    const page = makePage();
    page.rows[8]![12] = cell('X', 'orange' as Color);
    const v = validatePage(page).violations.find((x) => x.rule === 'palette');
    expect(v).toBeDefined();
    expect(v?.row).toBe(8);
    expect(v?.col).toBe(12);
  });

  it('rejects a background outside the palette', () => {
    const page = makePage();
    page.rows[9]![0] = cell('X', 'white', '#123456' as Color);
    expect(rulesOf(page)).toContain('palette');
  });

  it('rejects a palette color with wrong case', () => {
    const page = makePage();
    page.rows[9]![0] = cell('X', 'RED' as Color);
    expect(rulesOf(page)).toContain('palette');
  });
});

describe('validatePage: header format (Req 1.3)', () => {
  it('rejects a header missing the P{number} prefix', () => {
    const page = makePage();
    page.rows[0] = textRow('TELETEXT REBORN 12:34', 'yellow');
    expect(rulesOf(page)).toContain('header');
  });

  it('rejects a header whose page number differs from page.number', () => {
    const page = makePage({ number: 302 });
    page.rows[0] = textRow('P101 TELETEXT REBORN 12:34', 'yellow');
    expect(rulesOf(page)).toContain('header');
  });

  it('rejects a header missing the service name', () => {
    const page = makePage();
    page.rows[0] = textRow('P100 12:34', 'yellow');
    expect(rulesOf(page)).toContain('header');
  });

  it('rejects a header missing the HH:MM time', () => {
    const page = makePage();
    page.rows[0] = textRow('P100 TELETEXT REBORN', 'yellow');
    expect(rulesOf(page)).toContain('header');
  });

  it('rejects a malformed time such as 12:3', () => {
    const page = makePage();
    page.rows[0] = textRow('P100 TELETEXT REBORN 12:3', 'yellow');
    expect(rulesOf(page)).toContain('header');
  });

  it('rejects a stale page whose header has no stale marker', () => {
    const page = makePage({ stale: true });
    page.rows[0] = textRow('P100 TELETEXT REBORN 12:34', 'yellow');
    expect(rulesOf(page)).toContain('header');
  });

  it('rejects a fresh page whose header shows a stale marker', () => {
    const page = makePage({ stale: false });
    page.rows[0] = textRow('P100 TELETEXT REBORN 12:34 STALE', 'yellow');
    expect(rulesOf(page)).toContain('header');
  });

  it.each([99, 900, 0, 1000, -1, 100.5])('rejects out-of-range or non-integer page number %s', (n) => {
    const page = makePage({ number: n });
    expect(rulesOf(page)).toContain('header');
  });
});

describe('validatePage: fastext (Req 1.5)', () => {
  it('rejects fewer than four fastext links', () => {
    const page = makePage();
    (page as { fastext: unknown }).fastext = LINKS.slice(0, 3);
    expect(rulesOf(page)).toContain('fastext');
  });

  it('rejects more than four fastext links', () => {
    const page = makePage();
    (page as { fastext: unknown }).fastext = [...LINKS, LINKS[0]];
    expect(rulesOf(page)).toContain('fastext');
  });

  it('rejects fastext colors out of the order red, green, yellow, cyan', () => {
    const page = makePage();
    page.fastext = [LINKS[1], LINKS[0], LINKS[2], LINKS[3]].map((l, i) => ({
      ...l!,
      color: (['green', 'red', 'yellow', 'cyan'] as const)[i]!,
    })) as Page['fastext'];
    expect(rulesOf(page)).toContain('fastext');
  });

  it('rejects blue in place of cyan as the fourth link color', () => {
    const page = makePage();
    page.fastext = [LINKS[0], LINKS[1], LINKS[2], { ...LINKS[3], color: 'blue' as never }];
    expect(rulesOf(page)).toContain('fastext');
  });

  it('rejects a fastext target outside 100-899', () => {
    const page = makePage();
    page.fastext = [LINKS[0], LINKS[1], LINKS[2], { ...LINKS[3], target: 999 }];
    expect(rulesOf(page)).toContain('fastext');
  });

  it('rejects a row 24 that does not display a link label', () => {
    const page = makePage();
    page.rows[24] = textRow('');
    expect(rulesOf(page)).toContain('fastext');
  });
});

describe('validatePage: result shape and robustness (Req 5.2, 5.3)', () => {
  it('returns valid=false with at least one violation for an invalid page', () => {
    const page = makePage();
    page.rows.pop();
    const result = validatePage(page);
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    for (const v of result.violations) {
      expect(typeof v.rule).toBe('string');
      expect(typeof v.message).toBe('string');
      expect(v.message.length).toBeGreaterThan(0);
    }
  });

  it('reports every independent violation instead of stopping at the first', () => {
    const page = makePage();
    page.rows[8]![12] = cell('X', 'orange' as Color);
    page.rows[0] = textRow('garbage', 'yellow');
    const rules = rulesOf(page);
    expect(rules).toContain('palette');
    expect(rules).toContain('header');
  });

  it.each([null, undefined, 42, 'page', {}, { rows: 'nope' }])(
    'rejects non-page input %j without throwing',
    (input) => {
      expect(() => validatePage(input)).not.toThrow();
      expect(validatePage(input).valid).toBe(false);
    },
  );
});
