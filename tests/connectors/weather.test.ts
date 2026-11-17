import { describe, expect, it } from 'vitest';
import { COLS, validatePage } from '../../src/model';
import type { Page, Row } from '../../src/model';
import {
  DEFAULT_WEATHER_LOCATION,
  WEATHER_PAGE_NUMBER,
  buildWeatherUrl,
  createWeatherPage,
  createWeatherSource,
  describeWeatherCode,
  fetchWeather,
  parseWeatherResponse,
  resolveWeatherLocation,
} from '../../src/connectors/weather';
import type { FetchLike } from '../../src/connectors/weather';
import fixture from '../fixtures/open-meteo-london.json';

const NOW = new Date(2026, 10, 16, 9, 31);

function rowText(row: Row | undefined): string {
  return (row ?? []).map((cell) => cell.char).join('').trimEnd();
}

function pageText(page: Page): string {
  return page.rows.map(rowText).join('\n');
}

function okFetch(payload: unknown = fixture): FetchLike & { urls: string[] } {
  const urls: string[] = [];
  const fn = (url: string): Promise<Response> => {
    urls.push(url);
    return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }));
  };
  return Object.assign(fn, { urls });
}

const failingFetch: FetchLike = () => Promise.reject(new TypeError('network down'));

describe('default location', () => {
  it('is a clearly named, valid constant', () => {
    expect(DEFAULT_WEATHER_LOCATION.name).toBe('LONDON');
    expect(DEFAULT_WEATHER_LOCATION.latitude).toBeCloseTo(51.5072, 3);
    expect(DEFAULT_WEATHER_LOCATION.longitude).toBeCloseTo(-0.1276, 3);
  });

  it('is used when no location is configured', () => {
    expect(resolveWeatherLocation(undefined)).toEqual(DEFAULT_WEATHER_LOCATION);
  });

  it('is used when the configured location has invalid coordinates', () => {
    expect(resolveWeatherLocation({ name: 'X', latitude: 123, longitude: 0 })).toEqual(
      DEFAULT_WEATHER_LOCATION,
    );
    expect(resolveWeatherLocation({ name: 'X', latitude: 0, longitude: Number.NaN })).toEqual(
      DEFAULT_WEATHER_LOCATION,
    );
  });

  it('keeps a valid configured location', () => {
    const paris = { name: 'PARIS', latitude: 48.8566, longitude: 2.3522 };
    expect(resolveWeatherLocation(paris)).toEqual(paris);
  });

  it('is requested from Open-Meteo when the source has no configuration', async () => {
    const fetchFn = okFetch();
    await createWeatherSource({ fetch: fetchFn, now: () => NOW }).refresh();
    expect(fetchFn.urls).toEqual([buildWeatherUrl(DEFAULT_WEATHER_LOCATION)]);
  });
});

describe('buildWeatherUrl', () => {
  it('targets the Open-Meteo forecast API with coordinates, current and daily fields', () => {
    const url = new URL(buildWeatherUrl({ name: 'PARIS', latitude: 48.8566, longitude: 2.3522 }));
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(url.searchParams.get('latitude')).toBe('48.8566');
    expect(url.searchParams.get('longitude')).toBe('2.3522');
    expect(url.searchParams.get('current')).toContain('temperature_2m');
    expect(url.searchParams.get('current')).toContain('weather_code');
    expect(url.searchParams.get('daily')).toContain('temperature_2m_max');
    expect(url.searchParams.get('timezone')).toBe('auto');
    expect(url.searchParams.get('forecast_days')).toBe('4');
  });
});

describe('parseWeatherResponse', () => {
  it('parses the recorded Open-Meteo payload', () => {
    const data = parseWeatherResponse(fixture);
    expect(data.current).toEqual({
      time: '2026-11-16T09:30',
      temperatureC: 4.9,
      apparentTemperatureC: 1.6,
      humidityPercent: 77,
      windSpeedKmh: 9.4,
      windDirectionDeg: 269,
      weatherCode: 2,
    });
    expect(data.daily).toHaveLength(4);
    expect(data.daily[0]).toEqual({
      date: '2026-11-16',
      weatherCode: 61,
      maxC: 7.8,
      minC: 4.2,
      precipitationProbability: 83,
    });
    expect(data.daily[3]?.date).toBe('2026-11-19');
  });

  it('treats a null precipitation probability as unknown', () => {
    const payload = structuredClone(fixture) as unknown as {
      daily: { precipitation_probability_max: (number | null)[] };
    };
    payload.daily.precipitation_probability_max[1] = null;
    expect(parseWeatherResponse(payload).daily[1]?.precipitationProbability).toBeUndefined();
  });

  it.each([
    ['null', null],
    ['a string', 'nope'],
    ['missing current', { daily: fixture.daily }],
    ['missing daily', { current: fixture.current }],
    ['non-numeric temperature', { ...fixture, current: { ...fixture.current, temperature_2m: 'warm' } }],
    ['non-finite wind', { ...fixture, current: { ...fixture.current, wind_speed_10m: null } }],
    ['bad current time', { ...fixture, current: { ...fixture.current, time: 'noon' } }],
    ['empty daily', { ...fixture, daily: { ...fixture.daily, time: [] } }],
    [
      'mismatched daily arrays',
      { ...fixture, daily: { ...fixture.daily, temperature_2m_max: [1] } },
    ],
  ])('rejects %s', (_label, payload) => {
    expect(() => parseWeatherResponse(payload)).toThrow();
  });
});

describe('fetchWeather', () => {
  it('returns parsed data on success', async () => {
    const data = await fetchWeather(okFetch(), DEFAULT_WEATHER_LOCATION);
    expect(data.current.temperatureC).toBe(4.9);
  });

  it('rejects on network failure, HTTP error status and invalid JSON', async () => {
    await expect(fetchWeather(failingFetch, DEFAULT_WEATHER_LOCATION)).rejects.toThrow();
    const http500: FetchLike = () => Promise.resolve(new Response('oops', { status: 500 }));
    await expect(fetchWeather(http500, DEFAULT_WEATHER_LOCATION)).rejects.toThrow(/500/);
    const notJson: FetchLike = () => Promise.resolve(new Response('<html>', { status: 200 }));
    await expect(fetchWeather(notJson, DEFAULT_WEATHER_LOCATION)).rejects.toThrow();
  });
});

describe('describeWeatherCode', () => {
  it('maps WMO codes to short uppercase text', () => {
    expect(describeWeatherCode(0)).toBe('CLEAR SKY');
    expect(describeWeatherCode(2)).toBe('PARTLY CLOUDY');
    expect(describeWeatherCode(61)).toBe('LIGHT RAIN');
    expect(describeWeatherCode(95)).toBe('THUNDERSTORM');
  });

  it('falls back for unknown codes', () => {
    expect(describeWeatherCode(1234)).toBe('UNKNOWN');
  });
});

describe('createWeatherPage', () => {
  const page = createWeatherPage(parseWeatherResponse(fixture), DEFAULT_WEATHER_LOCATION, NOW);

  it('is page 302 and passes validatePage', () => {
    expect(page.number).toBe(WEATHER_PAGE_NUMBER);
    expect(WEATHER_PAGE_NUMBER).toBe(302);
    expect(page.stale).toBe(false);
    expect(validatePage(page)).toEqual({ valid: true, violations: [] });
  });

  it('has the standard header and fastext row', () => {
    expect(rowText(page.rows[0])).toBe('P302 TELETEXT REBORN 09:31');
    expect(rowText(page.rows[24])).toContain('INDEX');
    expect(page.fastext.map((l) => l.color)).toEqual(['red', 'green', 'yellow', 'cyan']);
  });

  it('shows location, current conditions and the forecast as typeset text', () => {
    const text = pageText(page);
    expect(text).toContain('WEATHER - LONDON');
    expect(text).toContain('PARTLY CLOUDY');
    expect(text).toContain('TEMP 5C');
    expect(text).toContain('FEELS LIKE 2C');
    expect(text).toContain('HUMIDITY 77%');
    expect(text).toContain('WIND 9 KM/H W');
    expect(text).toContain('MON 16 NOV');
    expect(text).toContain('HI 8C');
    expect(text).toContain('LO 4C');
    expect(text).toContain('LIGHT RAIN, 83% PRECIP CHANCE');
    expect(text).toContain('THU 19 NOV');
  });

  it('keeps every row at 40 cells with a long location name', () => {
    const long = createWeatherPage(
      parseWeatherResponse(fixture),
      { name: 'Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch on sea', latitude: 1, longitude: 1 },
      NOW,
    );
    expect(long.rows.every((row) => row.length === COLS)).toBe(true);
    expect(validatePage(long).valid).toBe(true);
  });
});

describe('createWeatherSource', () => {
  it('generates page 302 from a successful fetch', async () => {
    const source = createWeatherSource({ fetch: okFetch(), now: () => NOW });
    const page = await source.refresh();
    expect(page.number).toBe(302);
    expect(page.stale).toBe(false);
    expect(pageText(page)).toContain('PARTLY CLOUDY');
    expect(validatePage(page).valid).toBe(true);
    expect(source.lastGood).toBe(page);
  });

  it('returns the last good page marked stale when a later fetch fails', async () => {
    let fail = false;
    const fetchFn: FetchLike = (url) => (fail ? failingFetch(url) : okFetch()(url));
    const errors: unknown[] = [];
    const source = createWeatherSource({
      fetch: fetchFn,
      now: () => NOW,
      onError: (error) => errors.push(error),
    });
    const good = await source.refresh();
    fail = true;
    const stale = await source.refresh();

    expect(stale.stale).toBe(true);
    expect(rowText(stale.rows[0])).toBe('P302 TELETEXT REBORN 09:31 STALE');
    expect(stale.rows.slice(1)).toEqual(good.rows.slice(1));
    expect(validatePage(stale).valid).toBe(true);
    expect(errors).toHaveLength(1);
    expect(source.lastGood).toBe(good);
    expect(good.stale).toBe(false);
  });

  it('falls back to the stale last-good page on HTTP errors and malformed payloads', async () => {
    const responses: Response[] = [
      new Response(JSON.stringify(fixture), { status: 200 }),
      new Response('', { status: 503 }),
      new Response(JSON.stringify({ current: {} }), { status: 200 }),
    ];
    const source = createWeatherSource({
      fetch: () => Promise.resolve(responses.shift() ?? new Response('', { status: 500 })),
      now: () => NOW,
    });
    const good = await source.refresh();
    for (let i = 0; i < 2; i++) {
      const stale = await source.refresh();
      expect(stale.stale).toBe(true);
      expect(stale.rows.slice(1)).toEqual(good.rows.slice(1));
    }
  });

  it('becomes fresh again after a failed refresh is followed by a good one', async () => {
    const outcomes = [true, false, true];
    const source = createWeatherSource({
      fetch: (url) => (outcomes.shift() ? okFetch()(url) : failingFetch(url)),
      now: () => NOW,
    });
    await source.refresh();
    expect((await source.refresh()).stale).toBe(true);
    expect((await source.refresh()).stale).toBe(false);
  });

  it('returns a valid stale "unavailable" page when the very first fetch fails', async () => {
    const source = createWeatherSource({ fetch: failingFetch, now: () => NOW });
    const page = await source.refresh();
    expect(page.number).toBe(302);
    expect(page.stale).toBe(true);
    expect(pageText(page)).toContain('WEATHER DATA UNAVAILABLE');
    expect(validatePage(page).valid).toBe(true);
    expect(source.lastGood).toBeUndefined();
  });

  it('requests the configured location', async () => {
    const fetchFn = okFetch();
    const paris = { name: 'PARIS', latitude: 48.8566, longitude: 2.3522 };
    const page = await createWeatherSource({ fetch: fetchFn, location: paris, now: () => NOW }).refresh();
    expect(fetchFn.urls).toEqual([buildWeatherUrl(paris)]);
    expect(pageText(page)).toContain('WEATHER - PARIS');
  });
});
