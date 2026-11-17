import { describe, expect, it } from 'vitest';
import { createNotFoundPage } from '../../src/nav';
import { validatePage } from '../../src/model';
import type { Page } from '../../src/model';

// RED step (task 5.1): src/nav does not exist yet.
//
// Assumed API, exported from src/nav/index.ts:
//   createNotFoundPage(number: number, now: Date, service?: string): Page
//     - Pure. Carries the requested page number and is a valid Page
//       (header "P{number} {service} HH:MM", four colored fastext links).
//     - Fastext links lead back to the MVP pages 100, 101, 302, 888.
//
// Requirements: 2.2

const NOW = new Date(2025, 0, 2, 9, 5);

const text = (page: Page, r: number): string =>
  (page.rows[r] ?? []).map((c) => c.char).join('');

describe('createNotFoundPage', () => {
  it.each([555, 100, 899])('passes validatePage for page %s', (number) => {
    const page = createNotFoundPage(number, NOW);
    const result = validatePage(page);
    expect(result.violations).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('carries the requested number in the header with the local time', () => {
    const page = createNotFoundPage(555, NOW);
    expect(page.number).toBe(555);
    expect(text(page, 0).trimEnd()).toBe('P555 TELETEXT REBORN 09:05');
    expect(page.stale).toBe(false);
  });

  it('uses the given service name', () => {
    expect(text(createNotFoundPage(555, NOW, 'TEST SVC'), 0).trimEnd()).toBe(
      'P555 TEST SVC 09:05',
    );
  });

  it('tells the viewer the page was not found and names the number', () => {
    const page = createNotFoundPage(555, NOW);
    const body = page.rows
      .slice(1, 24)
      .map((_, i) => text(page, i + 1))
      .join('\n');
    expect(body).toContain('PAGE NOT FOUND');
    expect(body).toContain('555');
  });

  it('offers fastext links back to 100, 101, 302 and 888', () => {
    const page = createNotFoundPage(555, NOW);
    expect(page.fastext.map((l) => l.target)).toEqual([100, 101, 302, 888]);
    expect(page.fastext.map((l) => l.color)).toEqual(['red', 'green', 'yellow', 'cyan']);
  });

  it('records generatedAt as an ISO timestamp', () => {
    expect(createNotFoundPage(555, NOW).generatedAt).toBe(NOW.toISOString());
  });
});
