import fc from 'fast-check';
import { describe, it } from 'vitest';
import { validatePage } from '../../src/model';
import { createWeatherPage } from '../../src/connectors/weather';
import type { DailyForecast, WeatherData } from '../../src/connectors/weather';

const temperature = fc.double({ min: -90, max: 60, noNaN: true });

const daily: fc.Arbitrary<DailyForecast> = fc.record(
  {
    date: fc
      .date({ min: new Date('2000-01-01'), max: new Date('2099-12-31'), noInvalidDate: true })
      .map((d) => d.toISOString().slice(0, 10)),
    weatherCode: fc.integer({ min: 0, max: 120 }),
    maxC: temperature,
    minC: temperature,
    precipitationProbability: fc.integer({ min: 0, max: 100 }),
  },
  { requiredKeys: ['date', 'weatherCode', 'maxC', 'minC'] },
);

const weatherData: fc.Arbitrary<WeatherData> = fc.record({
  current: fc.record({
    time: fc.constant('2026-11-16T09:30'),
    temperatureC: temperature,
    apparentTemperatureC: temperature,
    humidityPercent: fc.integer({ min: 0, max: 100 }),
    windSpeedKmh: fc.double({ min: 0, max: 400, noNaN: true }),
    windDirectionDeg: fc.integer({ min: 0, max: 360 }),
    weatherCode: fc.integer({ min: 0, max: 120 }),
  }),
  daily: fc.array(daily, { minLength: 1, maxLength: 7 }),
});

const location = fc.record({
  name: fc.string({ unit: 'binary', maxLength: 120 }),
  latitude: fc.double({ min: -90, max: 90, noNaN: true }),
  longitude: fc.double({ min: -180, max: 180, noNaN: true }),
});

describe('page 302 generation (property)', () => {
  /** **Validates: Requirements 3.1, 3.2, 1.1, 1.4, 5.2** */
  it('produces a page that passes validatePage for any weather data and location name', () => {
    fc.assert(
      fc.property(weatherData, location, (data, loc) => {
        const page = createWeatherPage(data, loc, new Date(2026, 10, 16, 9, 31));
        return validatePage(page).valid;
      }),
    );
  });
});
