import type { Page } from '../model';
import { DEFAULT_SERVICE, buildPage, styledLines } from '../pipeline/buildPage';
import type { BodyLine } from '../pipeline/buildPage';
import { NEWS_PAGE_NUMBER } from '../connectors/news';
import { DEFAULT_WEATHER_LOCATION, WEATHER_PAGE_NUMBER } from '../connectors/weather';
import type { WeatherLocation } from '../connectors/weather';

export const INDEX_PAGE_NUMBER = 100;
export const ABOUT_PAGE_NUMBER = 888;

const INDEX_ENTRIES: ReadonlyArray<{ number: number; title: string }> = [
  { number: NEWS_PAGE_NUMBER, title: 'NEWS HEADLINES' },
  { number: WEATHER_PAGE_NUMBER, title: 'WEATHER' },
  { number: ABOUT_PAGE_NUMBER, title: 'ABOUT' },
];

/** Page 100: the index. Pure; the result passes validatePage. */
export function createIndexPage(now: Date, service: string = DEFAULT_SERVICE): Page {
  const body: BodyLine[] = [
    ...styledLines('INDEX', 'white', 'blue'),
    ...styledLines('LIVE NEWS AND WEATHER, 1985 STYLE', 'cyan'),
    { text: '' },
    ...INDEX_ENTRIES.flatMap((entry) => styledLines(`${entry.number} ${entry.title}`, 'yellow')),
    { text: '' },
    ...styledLines('ENTER A PAGE NUMBER FROM 100 TO 899'),
    ...styledLines('OR USE THE COLOUR KEYS BELOW.'),
  ];
  return buildPage({ number: INDEX_PAGE_NUMBER, now, body, service });
}

export interface AboutPageOptions {
  /** `demo` when no news API key is configured (see NewsSource.mode). */
  newsMode: 'live' | 'demo';
  /** The location the weather page actually uses (see WeatherSource.location). */
  location: WeatherLocation;
}

function isDefaultLocation(location: WeatherLocation): boolean {
  return (
    location.latitude === DEFAULT_WEATHER_LOCATION.latitude &&
    location.longitude === DEFAULT_WEATHER_LOCATION.longitude
  );
}

/**
 * Page 888: project name, whether news runs in demo mode, which weather
 * location is in use (and whether it is the default), data sources and keys.
 * Pure; the result passes validatePage.
 */
export function createAboutPage(
  now: Date,
  options: AboutPageOptions,
  service: string = DEFAULT_SERVICE,
): Page {
  const { newsMode, location } = options;
  const where = `${location.name.toUpperCase()} (${isDefaultLocation(location) ? 'DEFAULT LOCATION' : 'CONFIGURED'})`;
  const body: BodyLine[] = [
    ...styledLines('ABOUT TELETEXT REBORN', 'white', 'blue'),
    ...styledLines('LOOKS LIKE 1985. THINKS LIKE 2026.', 'cyan'),
    { text: '' },
    ...styledLines(
      newsMode === 'demo' ? 'NEWS: DEMO FEED (NO API KEY SET)' : 'NEWS: LIVE (API KEY SET)',
      'yellow',
    ),
    ...styledLines(`WEATHER: ${where}`, 'yellow'),
    { text: '' },
    ...styledLines('DATA SOURCES', 'cyan'),
    ...styledLines('NEWS: GNEWS, OR DEMO FEED WITHOUT A KEY'),
    ...styledLines('WEATHER: OPEN-METEO, NO KEY NEEDED'),
    { text: '' },
    ...styledLines('KEYS', 'cyan'),
    ...styledLines('NO API KEYS ARE REQUIRED. FOR LIVE NEWS SET VITE_NEWS_API_KEY.'),
  ];
  return buildPage({ number: ABOUT_PAGE_NUMBER, now, body, service });
}
