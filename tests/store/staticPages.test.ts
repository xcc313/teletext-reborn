import { describe, expect, it } from 'vitest';
import { validatePage } from '../../src/model';
import type { Page } from '../../src/model';
import { DEFAULT_WEATHER_LOCATION } from '../../src/connectors/weather';
import {
  ABOUT_PAGE_NUMBER,
  INDEX_PAGE_NUMBER,
  createAboutPage,
  createIndexPage,
} from '../../src/store';

// Task 8: static pages 100 (index) and 888 (about).

const NOW = new Date(2026, 10, 16, 9, 31);

const body = (page: Page): string =>
  page.rows
    .slice(1, 24)
    .map((row) => row.map((c) => c.char).join('').trimEnd())
    .join('\n');

const header = (page: Page): string => (page.rows[0] ?? []).map((c) => c.char).join('').trimEnd();

describe('index page 100', () => {
  const page = createIndexPage(NOW);

  it('is page 100 and passes validatePage', () => {
    expect(INDEX_PAGE_NUMBER).toBe(100);
    expect(page.number).toBe(100);
    expect(validatePage(page)).toEqual({ valid: true, violations: [] });
    expect(header(page)).toBe('P100 TELETEXT REBORN 09:31');
    expect(page.stale).toBe(false);
  });

  it('lists the news, weather and about pages with their numbers', () => {
    const text = body(page);
    expect(text).toContain('101 NEWS');
    expect(text).toContain('302 WEATHER');
    expect(text).toContain('888 ABOUT');
  });

  it('links to the listed pages from the fastext row', () => {
    expect(page.fastext.map((l) => l.target)).toEqual([100, 101, 302, 888]);
  });

  it('uses the given service name', () => {
    const custom = createIndexPage(NOW, 'TEST SVC');
    expect(header(custom)).toBe('P100 TEST SVC 09:31');
    expect(validatePage(custom).valid).toBe(true);
  });
});

describe('about page 888', () => {
  const demo = createAboutPage(NOW, { newsMode: 'demo', location: DEFAULT_WEATHER_LOCATION });

  it('is page 888 and passes validatePage', () => {
    expect(ABOUT_PAGE_NUMBER).toBe(888);
    expect(demo.number).toBe(888);
    expect(validatePage(demo)).toEqual({ valid: true, violations: [] });
    expect(header(demo)).toBe('P888 TELETEXT REBORN 09:31');
  });

  it('names the project', () => {
    expect(body(demo)).toContain('TELETEXT REBORN');
  });

  it('discloses demo mode for news and the default weather location', () => {
    const text = body(demo);
    expect(text).toContain('DEMO');
    expect(text).toContain('LONDON');
    expect(text).toContain('DEFAULT');
  });

  it('names the data sources and the optional key', () => {
    const text = body(demo);
    expect(text).toContain('OPEN-METEO');
    expect(text).toContain('GNEWS');
    expect(text).toContain('VITE_NEWS_API_KEY');
  });

  it('reports live news and a configured location without claiming defaults', () => {
    const live = createAboutPage(NOW, {
      newsMode: 'live',
      location: { name: 'Paris', latitude: 48.8566, longitude: 2.3522 },
    });
    const text = body(live);
    expect(text).toContain('LIVE');
    expect(text).toContain('PARIS');
    expect(text).not.toContain('DEFAULT');
    expect(text).not.toContain('NEWS: DEMO');
    expect(validatePage(live).valid).toBe(true);
  });

  it('stays valid for an unusually long location name', () => {
    const page = createAboutPage(NOW, {
      newsMode: 'demo',
      location: { name: 'X'.repeat(200), latitude: 1, longitude: 2 },
    });
    expect(validatePage(page).valid).toBe(true);
  });
});
