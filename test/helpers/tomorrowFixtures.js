// -----------------------------------------------------------------------------
// Tomorrow.io answers for the tests, built from REAL published responses
// (see test/fixtures/README.md):
//   - pytomorrowio's Timelines API fixtures (MIT), in imperial units;
//   - the `current` block of Home Assistant's tomorrowio fixture (Apache-2.0).
//
// The Weather API answers (/weather/realtime, /weather/forecast) are those
// values converted to metric and laid out in the documented Weather API
// shape (`data.values`, `timelines.minutely[] = { time, values }`), with the
// precipitation split in `rainIntensity`… like the Weather API does. The
// timelines are shifted so that they start at the test's "now".
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const load = (path) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${path}`, import.meta.url), 'utf8'));

export const PYTOMORROWIO = {
  realtime: load('pytomorrowio/timelines_realtime.json'),
  minutely: load('pytomorrowio/timelines_1min_first_hour.json'),
  hourly: load('pytomorrowio/timelines_1hour.json'),
  daily: load('pytomorrowio/timelines_1day.json'),
};
export const HA_CURRENT = load('home-assistant/v4_current.json');

// The instant of pytomorrowio's realtime answer: the tests run at it.
export const FIXTURE_NOW = Date.parse('2022-04-17T02:16:00Z');

const f2c = (f) => Math.round(((f - 32) * 5 * 10) / 9) / 10;
const mph2ms = (mph) => Math.round(mph * 0.44704 * 100) / 100;
const inhg2hpa = (inhg) => Math.round(inhg * 33.8639 * 10) / 10;
const mi2km = (mi) => Math.round(mi * 1.609344 * 100) / 100;
const in2mm = (inch) => Math.round(inch * 25.4 * 1000) / 1000;

const CONVERT = {
  temperature: f2c,
  temperatureApparent: f2c,
  dewPoint: f2c,
  windSpeed: mph2ms,
  windGust: mph2ms,
  pressureSeaLevel: inhg2hpa,
  pressureSurfaceLevel: inhg2hpa,
  visibility: mi2km,
  precipitationIntensity: in2mm,
};

/** Imperial Timelines values → metric Weather API values. */
export function toWeatherApiValues(values) {
  const result = {};
  for (const [key, value] of Object.entries(values)) {
    const base = key.replace(/(Avg|Max|Min)$/, '');
    const convert = CONVERT[base];
    const converted = typeof value === 'number' && convert ? convert(value) : value;
    if (base === 'precipitationIntensity') {
      // The Weather API splits the precipitation by type.
      const suffix = key.slice(base.length);
      result[`rainIntensity${suffix}`] = converted;
      result[`snowIntensity${suffix}`] = 0;
      result[`sleetIntensity${suffix}`] = 0;
      result[`freezingRainIntensity${suffix}`] = 0;
    } else if (
      ![
        'precipitationType',
        'treeIndex',
        'grassIndex',
        'grassGrassIndex',
        'weedIndex',
        'weedRagweedIndex',
        'fireIndex',
      ].includes(key)
    ) {
      result[key] = converted;
    }
  }
  return result;
}

function shift(intervals, start, step) {
  return intervals.map((interval, index) => ({
    time: new Date(start + index * step).toISOString(),
    values: toWeatherApiValues(interval.values),
  }));
}

/** `GET /v4/weather/realtime`, metric. */
export function realtimeAnswer(now = FIXTURE_NOW, overrides = {}) {
  const values = PYTOMORROWIO.realtime.data.timelines[0].intervals[0].values;
  return {
    data: {
      time: new Date(now).toISOString(),
      // pytomorrowio's realtime answer has no UV: Home Assistant's has one.
      values: { ...toWeatherApiValues(values), uvIndex: HA_CURRENT.uvIndex, ...overrides },
    },
    location: { lat: 48.8566, lon: 2.3522 },
  };
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * `GET /v4/weather/forecast`, metric.
 * @param {object} [options]
 * @param {number} [options.now]
 * @param {boolean} [options.minutely] false: a plan without the minutely timeline
 * @param {(minute: number) => number} [options.rain] mm/h at each minute from now
 */
export function forecastAnswer({ now = FIXTURE_NOW, minutely = true, rain } = {}) {
  const minutes = shift(PYTOMORROWIO.minutely.data.timelines[0].intervals, now, 60_000);
  if (rain) {
    minutes.forEach((entry, minute) => {
      entry.values.rainIntensity = rain(minute);
      entry.values.precipitationProbability = rain(minute) > 0 ? 80 : 0;
    });
  }
  const hourStart = now - (now % HOUR);
  const dayStart = now - (now % DAY);
  return {
    timelines: {
      ...(minutely ? { minutely: minutes } : {}),
      hourly: shift(PYTOMORROWIO.hourly.data.timelines[0].intervals.slice(0, 120), hourStart, HOUR),
      daily: shift(PYTOMORROWIO.daily.data.timelines[0].intervals.slice(0, 6), dayStart, DAY),
    },
    location: { lat: 48.8566, lon: 2.3522 },
  };
}

/** `POST /v4/timelines` with the premium fields, `current` timestep. */
export function premiumAnswer(now = FIXTURE_NOW) {
  const pollen = PYTOMORROWIO.realtime.data.timelines[0].intervals[0].values;
  const values = {
    particulateMatter25: HA_CURRENT.particulateMatter25,
    particulateMatter10: HA_CURRENT.particulateMatter10,
    pollutantO3: HA_CURRENT.pollutantO3,
    epaIndex: HA_CURRENT.epaIndex,
    treeIndex: pollen.treeIndex,
    grassIndex: pollen.grassIndex,
    weedIndex: pollen.weedIndex,
    fireIndex: pollen.fireIndex,
  };
  const time = new Date(now).toISOString();
  return {
    data: {
      timelines: [
        {
          timestep: 'current',
          startTime: time,
          endTime: time,
          intervals: [{ startTime: time, values }],
        },
      ],
    },
  };
}

// Error bodies of the Tomorrow.io API (`{ code, type, message }`).
export const ERRORS = {
  invalidKey: {
    status: 401,
    body: {
      code: 401001,
      type: 'Invalid Auth',
      message: 'The method requires authentication but it was not presented or is invalid.',
    },
  },
  rateLimited: {
    status: 429,
    body: {
      code: 429001,
      type: 'Too Many Calls',
      message:
        'The request limit for this resource has been reached for the current rate limit window.',
    },
  },
  planRefused: {
    status: 403,
    body: { code: 403003, type: 'Forbidden', message: 'The plan does not include these fields.' },
  },
};
