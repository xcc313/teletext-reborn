import { describe, expect, it } from 'vitest';
import { COLS, ROWS, validatePage } from '../../src/model';
import type { Page, Row } from '../../src/model';
import {
  CONTENT_ROWS,
  DEFAULT_FASTEXT,
  DEFAULT_SERVICE,
  buildPage,
  markStale,
  styledLines,
} from '../../src/pipeline/buildPage';

const NOW = new Date(2026, 10, 16, 9, 5);

function text(row: Row | undefined): string {
  return (row ?? []).map((cell) => cell.char).join('');
}

function build(overrides: Partial<Parameters<typeof buildPage>[0]> = {}): Page {
  return buildPage({
    number: 302,
    now: NOW,
    body: styledLines('HELLO WORLD', 'yellow'),
    ...overrides,
  });
}

describe('buildPage', () => {
  it('builds a 40x25 page that passes validatePage', () => {
    const page = build();
    expect(page.rows).toHaveLength(ROWS);
    expect(page.rows.every((row) => row.length === COLS)).toBe(true);
    expect(validatePage(page)).toEqual({ valid: true, violations: [] });
  });

  it('writes the header as P{number} {service} {HH:MM}', () => {
    const page = build();
    expect(text(page.rows[0]).trimEnd()).toBe(`P302 ${DEFAULT_SERVICE} 09:05`);
    expect(page.service).toBe(DEFAULT_SERVICE);
    expect(page.stale).toBe(false);
    expect(page.generatedAt).toBe(NOW.toISOString());
  });

  it('uses a custom service name', () => {
    const page = build({ service: 'DEMO TV' });
    expect(text(page.rows[0]).trimEnd()).toBe('P302 DEMO TV 09:05');
    expect(validatePage(page).valid).toBe(true);
  });

  it('adds a STALE marker to the header of a stale page', () => {
    const page = build({ stale: true });
    expect(page.stale).toBe(true);
    expect(text(page.rows[0]).trimEnd()).toBe(`P302 ${DEFAULT_SERVICE} 09:05 STALE`);
    expect(validatePage(page).valid).toBe(true);
  });

  it('places body lines from row 1 with their colors, blank rows elsewhere', () => {
    const page = build({ body: [{ text: 'HI', fg: 'yellow', bg: 'blue' }] });
    expect(text(page.rows[1]).trimEnd()).toBe('HI');
    expect(page.rows[1]?.[0]).toEqual({ char: 'H', fg: 'yellow', bg: 'blue' });
    expect(page.rows[1]?.[COLS - 1]).toEqual({ char: ' ', fg: 'yellow', bg: 'blue' });
    expect(text(page.rows[2]).trim()).toBe('');
  });

  it('defaults body colors to white on black', () => {
    const page = build({ body: [{ text: 'X' }] });
    expect(page.rows[1]?.[0]).toEqual({ char: 'X', fg: 'white', bg: 'black' });
  });

  it('drops body lines beyond the content area', () => {
    const body = Array.from({ length: CONTENT_ROWS + 5 }, (_, i) => ({ text: `LINE ${i}` }));
    const page = build({ body });
    expect(page.rows).toHaveLength(ROWS);
    expect(text(page.rows[CONTENT_ROWS]).trimEnd()).toBe(`LINE ${CONTENT_ROWS - 1}`);
    expect(text(page.rows[ROWS - 1])).toContain('INDEX');
  });

  it('truncates over-long body lines and replaces control characters', () => {
    const page = build({ body: [{ text: 'A'.repeat(60) }, { text: 'A\tB\u0000C' }] });
    expect(page.rows[1]).toHaveLength(COLS);
    expect(text(page.rows[1])).toBe('A'.repeat(COLS));
    expect(text(page.rows[2]).trimEnd()).toBe('A B C');
    expect(validatePage(page).valid).toBe(true);
  });

  it('draws the default fastext row in red, green, yellow, cyan', () => {
    const page = build();
    expect(page.fastext).toEqual(DEFAULT_FASTEXT);
    expect(page.fastext.map((l) => l.color)).toEqual(['red', 'green', 'yellow', 'cyan']);
    const last = page.rows[ROWS - 1] ?? [];
    for (const link of page.fastext) {
      const start = text(last).indexOf(link.label);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(last[start]?.fg).toBe(link.color);
    }
  });

  it('does not share the default fastext array between pages', () => {
    const page = build();
    expect(page.fastext).not.toBe(DEFAULT_FASTEXT);
  });
});

describe('styledLines', () => {
  it('typesets text into colored lines of at most 40 columns', () => {
    const lines = styledLines('WORD '.repeat(20), 'cyan', 'blue');
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.text.length).toBeLessThanOrEqual(COLS);
      expect(line.fg).toBe('cyan');
      expect(line.bg).toBe('blue');
    }
  });

  it('returns no lines for empty text', () => {
    expect(styledLines('')).toEqual([]);
  });
});

describe('markStale', () => {
  it('returns a stale copy with the marker in the header, leaving the original untouched', () => {
    const fresh = build();
    const stale = markStale(fresh);
    expect(stale.stale).toBe(true);
    expect(text(stale.rows[0]).trimEnd()).toBe(`P302 ${DEFAULT_SERVICE} 09:05 STALE`);
    expect(stale.rows.slice(1)).toEqual(fresh.rows.slice(1));
    expect(stale.generatedAt).toBe(fresh.generatedAt);
    expect(validatePage(stale)).toEqual({ valid: true, violations: [] });
    expect(fresh.stale).toBe(false);
    expect(text(fresh.rows[0]).trimEnd()).toBe(`P302 ${DEFAULT_SERVICE} 09:05`);
  });

  it('is idempotent', () => {
    const stale = markStale(build());
    expect(markStale(stale)).toEqual(stale);
  });
});
