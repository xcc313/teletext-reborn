import type { Page } from '../model';
import { DEFAULT_SERVICE, buildPage, markStale, styledLines } from '../pipeline/buildPage';
import type { BodyLine } from '../pipeline/buildPage';

export const WEATHER_PAGE_NUMBER = 302;

export interface WeatherLocation {
  /** Shown on the page; uppercased when displayed. */
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * Location used when none is configured (requirement 3.4).
 * Disclosed in the README: London, UK.
 */
export const DEFAULT_WEATHER_LOCATION: WeatherLocation = {
  name: 'LONDON',
  latitude: 51.5072,
  longitude: -0.1276,
};

/** Days of forecast requested from Open-Meteo and shown on the page. */
const FORECAST_DAYS = 4;

const CURRENT_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'is_day',
  'precipitation',
  'weather_code',
  'wind_speed_10m',
  'wind_direction_10m',
];

const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_probability_max',
];

/** The slice of Response the connector needs; the global fetch satisfies it. */
export interface ResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/** Injectable network boundary. */
export type FetchLike = (url: string) => Promise<ResponseLike>;

export interface CurrentConditions {
  /** Local time at the location, `YYYY-MM-DDTHH:MM`. */
  time: string;
  temperatureC: number;
  apparentTemperatureC: number;
  humidityPercent: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  weatherCode: number;
}

export interface DailyForecast {
  /** `YYYY-MM-DD` */
  date: string;
  weatherCode: number;
  maxC: number;
  minC: number;
  precipitationProbability?: number;
}

export interface WeatherData {
  current: CurrentConditions;
  daily: DailyForecast[];
}

export class WeatherParseError extends Error {
  constructor(message: string) {
    super(`Unexpected Open-Meteo response: ${message}`);
    this.name = 'WeatherParseError';
  }
}

function isValidLocation(location: WeatherLocation): boolean {
  return (
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    Math.abs(location.latitude) <= 90 &&
    Math.abs(location.longitude) <= 180
  );
}

/** The configured location when valid, otherwise DEFAULT_WEATHER_LOCATION. */
export function resolveWeatherLocation(configured?: WeatherLocation): WeatherLocation {
  return configured !== undefined && isValidLocation(configured)
    ? configured
    : DEFAULT_WEATHER_LOCATION;
}

export function buildWeatherUrl(location: WeatherLocation): string {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: CURRENT_FIELDS.join(','),
    daily: DAILY_FIELDS.join(','),
    timezone: 'auto',
    forecast_days: String(FORECAST_DAYS),
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = source[key];
  if (!isRecord(value)) throw new WeatherParseError(`"${key}" must be an object`);
  return value;
}

function finite(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new WeatherParseError(`"${key}" must be a finite number`);
  }
  return value;
}

function array(source: Record<string, unknown>, key: string): unknown[] {
  const value = source[key];
  if (!Array.isArray(value)) throw new WeatherParseError(`"${key}" must be an array`);
  return value as unknown[];
}

/** Validates an Open-Meteo forecast payload and extracts the fields the page uses. */
export function parseWeatherResponse(payload: unknown): WeatherData {
  if (!isRecord(payload)) throw new WeatherParseError('payload must be an object');

  const current = record(payload, 'current');
  const time = current['time'];
  if (typeof time !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(time)) {
    throw new WeatherParseError('"current.time" must look like YYYY-MM-DDTHH:MM');
  }

  const daily = record(payload, 'daily');
  const dates = array(daily, 'time');
  const codes = array(daily, 'weather_code');
  const maxes = array(daily, 'temperature_2m_max');
  const mins = array(daily, 'temperature_2m_min');
  const precip = array(daily, 'precipitation_probability_max');

  if (dates.length === 0) throw new WeatherParseError('"daily" has no days');
  for (const column of [codes, maxes, mins, precip]) {
    if (column.length !== dates.length) {
      throw new WeatherParseError('"daily" arrays must have equal lengths');
    }
  }

  const days = dates.map((date, i): DailyForecast => {
    const code = codes[i];
    const max = maxes[i];
    const min = mins[i];
    const probability = precip[i];
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new WeatherParseError('"daily.time" entries must look like YYYY-MM-DD');
    }
    if (![code, max, min].every((n) => typeof n === 'number' && Number.isFinite(n))) {
      throw new WeatherParseError('"daily" values must be finite numbers');
    }
    const day: DailyForecast = {
      date,
      weatherCode: code as number,
      maxC: max as number,
      minC: min as number,
    };
    if (typeof probability === 'number' && Number.isFinite(probability)) {
      day.precipitationProbability = probability;
    }
    return day;
  });

  return {
    current: {
      time,
      temperatureC: finite(current, 'temperature_2m'),
      apparentTemperatureC: finite(current, 'apparent_temperature'),
      humidityPercent: finite(current, 'relative_humidity_2m'),
      windSpeedKmh: finite(current, 'wind_speed_10m'),
      windDirectionDeg: finite(current, 'wind_direction_10m'),
      weatherCode: finite(current, 'weather_code'),
    },
    daily: days,
  };
}

/** Fetches and parses current conditions and forecast. Rejects on any failure. */
export async function fetchWeather(
  fetchFn: FetchLike,
  location: WeatherLocation,
): Promise<WeatherData> {
  const response = await fetchFn(buildWeatherUrl(location));
  if (!response.ok) throw new Error(`Open-Meteo request failed with HTTP ${response.status}`);
  return parseWeatherResponse(await response.json());
}

const WMO_DESCRIPTIONS: Readonly<Record<number, string>> = {
  0: 'CLEAR SKY',
  1: 'MAINLY CLEAR',
  2: 'PARTLY CLOUDY',
  3: 'OVERCAST',
  45: 'FOG',
  48: 'RIME FOG',
  51: 'LIGHT DRIZZLE',
  53: 'DRIZZLE',
  55: 'HEAVY DRIZZLE',
  56: 'FREEZING DRIZZLE',
  57: 'HEAVY FREEZING DRIZZLE',
  61: 'LIGHT RAIN',
  63: 'RAIN',
  65: 'HEAVY RAIN',
  66: 'FREEZING RAIN',
  67: 'HEAVY FREEZING RAIN',
  71: 'LIGHT SNOW',
  73: 'SNOW',
  75: 'HEAVY SNOW',
  77: 'SNOW GRAINS',
  80: 'LIGHT SHOWERS',
  81: 'SHOWERS',
  82: 'HEAVY SHOWERS',
  85: 'SNOW SHOWERS',
  86: 'HEAVY SNOW SHOWERS',
  95: 'THUNDERSTORM',
  96: 'THUNDERSTORM WITH HAIL',
  99: 'HEAVY THUNDERSTORM WITH HAIL',
};

/** WMO weather interpretation code to short uppercase text. */
export function describeWeatherCode(code: number): string {
  return WMO_DESCRIPTIONS[code] ?? 'UNKNOWN';
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const;

function compass(degrees: number): string {
  const index = Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
  return COMPASS[index] ?? 'N';
}

function whole(value: number): string {
  return String(Math.round(value) + 0); // + 0 turns -0 into 0
}

/** `MON 16 NOV` for a `YYYY-MM-DD` date, independent of the machine time zone. */
function dayLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return date;
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${WEEKDAYS[weekday] ?? ''} ${String(day).padStart(2, '0')} ${MONTHS[month - 1] ?? ''}`;
}

/** Builds page 302 from parsed weather data. Pure; the result passes validatePage. */
export function createWeatherPage(
  data: WeatherData,
  location: WeatherLocation,
  now: Date,
  service: string = DEFAULT_SERVICE,
): Page {
  const { current } = data;
  const body: BodyLine[] = [
    ...styledLines(`WEATHER - ${location.name.toUpperCase()}`, 'white', 'blue'),
    { text: '' },
    ...styledLines(`NOW (${current.time.slice(11)}): ${describeWeatherCode(current.weatherCode)}`, 'yellow'),
    ...styledLines(`TEMP ${whole(current.temperatureC)}C  FEELS LIKE ${whole(current.apparentTemperatureC)}C`),
    ...styledLines(
      `HUMIDITY ${whole(current.humidityPercent)}%  WIND ${whole(current.windSpeedKmh)} KM/H ${compass(current.windDirectionDeg)}`,
    ),
    { text: '' },
    ...styledLines('FORECAST', 'cyan'),
  ];

  for (const day of data.daily.slice(0, FORECAST_DAYS)) {
    const chance =
      day.precipitationProbability === undefined
        ? ''
        : `, ${whole(day.precipitationProbability)}% PRECIP CHANCE`;
    body.push(
      ...styledLines(`${dayLabel(day.date)}  HI ${whole(day.maxC)}C  LO ${whole(day.minC)}C`, 'green'),
      ...styledLines(`${describeWeatherCode(day.weatherCode)}${chance}`),
    );
  }

  return buildPage({ number: WEATHER_PAGE_NUMBER, now, body, service });
}

/** Stale placeholder for page 302 when no weather has ever been fetched. */
export function createWeatherUnavailablePage(
  location: WeatherLocation,
  now: Date,
  service: string = DEFAULT_SERVICE,
): Page {
  return buildPage({
    number: WEATHER_PAGE_NUMBER,
    now,
    service,
    stale: true,
    body: [
      ...styledLines(`WEATHER - ${location.name.toUpperCase()}`, 'white', 'blue'),
      { text: '' },
      ...styledLines('WEATHER DATA UNAVAILABLE', 'yellow'),
      ...styledLines('WILL RETRY AUTOMATICALLY.'),
    ],
  });
}

export interface WeatherSourceOptions {
  /** Network boundary; defaults to the global fetch. */
  fetch?: FetchLike;
  /** Defaults to DEFAULT_WEATHER_LOCATION. */
  location?: WeatherLocation;
  now?: () => Date;
  service?: string;
  /** Called with the reason whenever a refresh fails. */
  onError?: (error: unknown) => void;
}

export interface WeatherSource {
  readonly location: WeatherLocation;
  /** The most recent successfully generated page, if any. */
  readonly lastGood: Page | undefined;
  /**
   * Fetches fresh weather and returns page 302. On failure returns the last
   * good page marked stale (or a stale "unavailable" page if there is none).
   */
  refresh(): Promise<Page>;
}

export function createWeatherSource(options: WeatherSourceOptions = {}): WeatherSource {
  const fetchFn: FetchLike = options.fetch ?? ((url) => globalThis.fetch(url));
  const location = resolveWeatherLocation(options.location);
  const now = options.now ?? (() => new Date());
  const service = options.service ?? DEFAULT_SERVICE;
  let lastGood: Page | undefined;

  return {
    location,
    get lastGood() {
      return lastGood;
    },
    async refresh() {
      try {
        const data = await fetchWeather(fetchFn, location);
        lastGood = createWeatherPage(data, location, now(), service);
        return lastGood;
      } catch (error) {
        options.onError?.(error);
        return lastGood === undefined
          ? createWeatherUnavailablePage(location, now(), service)
          : markStale(lastGood);
      }
    },
  };
}
