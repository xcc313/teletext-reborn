import type { WeatherLocation } from './connectors/weather';

/** Optional settings, as read from Vite's `import.meta.env`. Every field may be missing or blank. */
export interface AppEnv {
  /** GNews key for live headlines on page 101. Missing or blank selects the demo feed. */
  VITE_NEWS_API_KEY?: string;
  /** Weather location latitude, e.g. `48.8566`. Needs VITE_WEATHER_LONGITUDE too. */
  VITE_WEATHER_LATITUDE?: string;
  /** Weather location longitude, e.g. `2.3522`. Needs VITE_WEATHER_LATITUDE too. */
  VITE_WEATHER_LONGITUDE?: string;
  /** Name shown on page 302. Defaults to the coordinates. */
  VITE_WEATHER_NAME?: string;
}

/** Longest configured location name shown in the page 302 heading. */
const MAX_NAME_LENGTH = 24;

function parseCoordinate(raw: unknown): number | undefined {
  if (typeof raw !== 'string' || raw.trim() === '') return undefined;
  const value = Number(raw.trim());
  return Number.isFinite(value) ? value : undefined;
}

function cleanName(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const name = raw.replace(/[\p{Cc}\s]+/gu, ' ').trim();
  return name === '' ? undefined : Array.from(name).slice(0, MAX_NAME_LENGTH).join('');
}

/**
 * The weather location configured in the environment, or undefined when it is
 * not set or incomplete. Out-of-range coordinates are handled later by
 * resolveWeatherLocation, which falls back to the default location.
 */
export function parseWeatherLocation(env: AppEnv): WeatherLocation | undefined {
  const latitude = parseCoordinate(env.VITE_WEATHER_LATITUDE);
  const longitude = parseCoordinate(env.VITE_WEATHER_LONGITUDE);
  if (latitude === undefined || longitude === undefined) return undefined;
  return {
    name: cleanName(env.VITE_WEATHER_NAME) ?? `${latitude}, ${longitude}`,
    latitude,
    longitude,
  };
}
