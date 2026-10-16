// -----------------------------------------------------------------------------
// Reading the Tomorrow.io answers: both shapes (Weather API, Timelines API
// as in pytomorrowio's real fixtures), units, the rain of the next hour.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSnapshot,
  currentReadings,
  dailyForecast,
  intensityOf,
  rainOutlook,
  readCurrent,
  readForecast,
} from '../src/model.js';
import {
  FIXTURE_NOW,
  forecastAnswer,
  premiumAnswer,
  PYTOMORROWIO,
  realtimeAnswer,
} from './helpers/tomorrowFixtures.js';

const MINUTE = 60_000;

test('the Timelines API answers of pytomorrowio are read as they are', () => {
  const current = readCurrent(PYTOMORROWIO.realtime);
  assert.equal(current.weatherCode, 1100);
  assert.equal(current.treeIndex, 3);

  const minutely = readForecast(PYTOMORROWIO.minutely).minutely;
  assert.equal(minutely.length, 61);
  assert.equal(minutely[0].time, Date.parse('2022-04-17T02:16:00Z'));
  const hourly = readForecast(PYTOMORROWIO.hourly).hourly;
  assert.equal(hourly.length, 109);
  const daily = readForecast(PYTOMORROWIO.daily).daily;
  assert.equal(daily.length, 15);
  assert.equal(daily[0].values.temperatureMax, 86.98);
});

test('the Weather API answers are read: minutely, hourly and daily in one forecast', () => {
  const timelines = readForecast(forecastAnswer());
  assert.equal(timelines.minutely.length, 61);
  assert.equal(timelines.hourly.length, 109);
  assert.equal(timelines.daily.length, 6);
  assert.deepEqual(readForecast(null), { minutely: [], hourly: [], daily: [] });
  assert.deepEqual(
    readForecast({ timelines: { minutely: [{ time: 'nope', values: {} }] } }).minutely,
    [],
  );
});

test('the precipitation intensity sums the rain, snow, sleet and freezing rain', () => {
  assert.equal(intensityOf({ precipitationIntensity: 1.5 }), 1.5);
  assert.equal(
    intensityOf({
      rainIntensity: 1,
      snowIntensity: 0.5,
      sleetIntensity: 0,
      freezingRainIntensity: 0.25,
    }),
    1.75,
  );
  assert.equal(intensityOf({ temperature: 3 }), null);
  assert.equal(intensityOf(null), null);
});

test('the readings are metric, the wind in km/h, the ozone in µg/m³', () => {
  const snapshot = buildSnapshot({
    realtime: realtimeAnswer(),
    forecast: forecastAnswer(),
    premium: premiumAnswer(),
    fetchedAt: FIXTURE_NOW,
  });
  const r = currentReadings(snapshot);
  assert.equal(r.temperature, 23.6); // 74.53 °F
  assert.equal(r.humidity, 83);
  assert.equal(r.pressure, 1017.3); // 30.04 inHg, sea level preferred
  assert.equal(r['wind-speed'], 5.4); // 3.36 mph = 1.5 m/s
  assert.equal(r['wind-direction'], 114);
  assert.equal(r.visibility, 16);
  assert.equal(r.condition, 1100);
  assert.equal(r.aqi, 24);
  assert.equal(r.ozone, 91.2); // 46.53 ppb
  assert.equal(r['pollen-tree'], 3);
  assert.equal(r['rain-next-hour'], 0);
  // Nothing invented when a value is missing.
  const bare = currentReadings(buildSnapshot({ realtime: { data: { values: {} } }, fetchedAt: 0 }));
  assert.ok(Object.values(bare).every((value) => value === null));
});

test('the rain outlook reads the minutely timeline', () => {
  const rain = (minute) => (minute >= 7 && minute < 37 ? 1.2 : 0);
  const snapshot = buildSnapshot({
    realtime: realtimeAnswer(),
    forecast: forecastAnswer({ rain }),
    fetchedAt: FIXTURE_NOW,
  });
  const outlook = rainOutlook(snapshot);
  assert.equal(outlook.source, 'minutely');
  assert.equal(outlook.minutesUntil, 7);
  assert.equal(outlook.maxIntensity, 1.2);
  assert.equal(Math.round(outlook.nextHourMm * 100) / 100, 0.6, '30 minutes at 1.2 mm/h');
  assert.equal(outlook.probability, 80);
  assert.equal(outlook.points.length, 60);

  // Ten minutes later, from the same reading: the past minutes are gone.
  assert.equal(rainOutlook(snapshot, FIXTURE_NOW + 10 * MINUTE).minutesUntil, 0);

  // Drizzle below the threshold is not rain.
  const drizzle = buildSnapshot({
    realtime: realtimeAnswer(),
    forecast: forecastAnswer({ rain: () => 0.05 }),
    fetchedAt: FIXTURE_NOW,
  });
  assert.equal(rainOutlook(drizzle).minutesUntil, null);
});

test('without a minutely timeline, the hour in progress gives the outlook', () => {
  const answer = forecastAnswer({ minutely: false });
  const hour = answer.timelines.hourly[0].values;
  hour.rainIntensity = 1.5;
  hour.precipitationProbability = 70;
  const snapshot = buildSnapshot({
    realtime: realtimeAnswer(),
    forecast: answer,
    fetchedAt: FIXTURE_NOW,
  });
  assert.deepEqual(rainOutlook(snapshot), {
    source: 'hourly',
    minutesUntil: 0,
    nextHourMm: 1.5,
    maxIntensity: 1.5,
    probability: 70,
    points: [],
  });
  hour.precipitationProbability = 20;
  assert.equal(rainOutlook(snapshot).minutesUntil, null, 'an unlikely shower is not announced');
  assert.equal(rainOutlook(buildSnapshot({ realtime: null, fetchedAt: 0 })).source, null);
});

test('the daily forecast gives today and tomorrow', () => {
  const snapshot = buildSnapshot({
    realtime: realtimeAnswer(),
    forecast: forecastAnswer(),
    fetchedAt: FIXTURE_NOW,
  });
  const today = dailyForecast(snapshot, 0);
  assert.equal(today.max, 30.5); // 86.98 °F
  assert.equal(typeof today.min, 'number');
  assert.equal(today.probability, 30);
  assert.ok(dailyForecast(snapshot, 1));
  assert.equal(dailyForecast(snapshot, 10), null);
});
