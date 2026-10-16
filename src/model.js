// -----------------------------------------------------------------------------
// From the Tomorrow.io answers to the values the integration publishes.
//
// Pure functions, no I/O: a "snapshot" is what one refresh of one place read
// (realtime + forecast + optional premium layers), and every reading, the
// rain outlook, the widgets and the scene action are computed from it.
//
// Two answer shapes are read, so the code works with both Tomorrow.io APIs:
//   - the Weather API: `timelines.minutely[] = { time, values }`;
//   - the Timelines API (pytomorrowio, Home Assistant):
//     `data.timelines[] = { timestep, intervals[] = { startTime, values } }`.
// -----------------------------------------------------------------------------

// Below this intensity (mm/h), a minute is dry: Tomorrow.io's nowcast puts
// hundredths of a millimetre on cloudy minutes that nobody calls rain.
export const RAIN_THRESHOLD_MM_H = 0.1;

// Without a minutely timeline, an hour counts as rainy from this chance on.
export const HOURLY_RAIN_PROBABILITY = 50;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const round = (value, decimals) =>
  isNumber(value) ? Math.round(value * 10 ** decimals) / 10 ** decimals : null;

/**
 * Precipitation intensity of one entry, in mm/h: `precipitationIntensity`
 * (Timelines API), or the sum of the rain, snow, sleet and freezing rain
 * intensities (Weather API). null when the entry has none of them.
 */
export function intensityOf(values) {
  if (!values || typeof values !== 'object') {
    return null;
  }
  if (isNumber(values.precipitationIntensity)) {
    return values.precipitationIntensity;
  }
  const parts = ['rainIntensity', 'snowIntensity', 'sleetIntensity', 'freezingRainIntensity']
    .map((key) => values[key])
    .filter(isNumber);
  return parts.length > 0 ? parts.reduce((sum, value) => sum + value, 0) : null;
}

/** `[{ time (ms), values }]`, sorted, entries without a valid date dropped. */
function readEntries(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map((entry) => ({
      time: Date.parse(entry?.time ?? entry?.startTime),
      values: entry?.values && typeof entry.values === 'object' ? entry.values : {},
    }))
    .filter((entry) => Number.isFinite(entry.time))
    .sort((a, b) => a.time - b.time);
}

/** The timelines of a forecast answer, whatever its shape. */
export function readForecast(forecast) {
  const result = { minutely: [], hourly: [], daily: [] };
  if (!forecast || typeof forecast !== 'object') {
    return result;
  }
  if (forecast.timelines && !Array.isArray(forecast.timelines)) {
    result.minutely = readEntries(forecast.timelines.minutely);
    result.hourly = readEntries(forecast.timelines.hourly);
    result.daily = readEntries(forecast.timelines.daily);
    return result;
  }
  for (const timeline of forecast?.data?.timelines ?? []) {
    const entries = readEntries(timeline?.intervals);
    if (timeline?.timestep === '1m') {
      result.minutely = entries;
    } else if (timeline?.timestep === '1h') {
      result.hourly = entries;
    } else if (timeline?.timestep === '1d') {
      result.daily = entries;
    }
  }
  return result;
}

/** Current values of a realtime answer (Weather API or Timelines `current`). */
export function readCurrent(answer) {
  if (answer?.data?.values && typeof answer.data.values === 'object') {
    return answer.data.values;
  }
  const current = (answer?.data?.timelines ?? []).find((t) => t?.timestep === 'current');
  return current?.intervals?.[0]?.values ?? null;
}

/**
 * @param {object} parts
 * @param {object} parts.realtime answer of /weather/realtime (or null)
 * @param {object} [parts.forecast] answer of /weather/forecast (or null)
 * @param {object} [parts.premium] answer of /timelines (or null)
 * @param {number} parts.fetchedAt
 */
export function buildSnapshot({ realtime, forecast = null, premium = null, fetchedAt }) {
  return {
    fetchedAt,
    current: readCurrent(realtime) ?? {},
    ...readForecast(forecast),
    premium: premium ? readCurrent(premium) : null,
  };
}

/** The O₃ of Tomorrow.io is in ppb; Gladys displays µg/m³ (25 °C, 1 atm). */
export const OZONE_PPB_TO_UG_M3 = 1.96;

/**
 * The numbers the devices publish, null when Tomorrow.io gave none.
 * Wind arrives in m/s (metric) and is published in km/h, like the forecasts
 * people read.
 */
export function currentReadings(snapshot) {
  const now = snapshot.current ?? {};
  const firstHour = snapshot.hourly?.[0]?.values ?? {};
  const outlook = rainOutlook(snapshot);
  const premium = snapshot.premium ?? {};
  const kmh = (ms) => (isNumber(ms) ? round(ms * 3.6, 1) : null);
  const integer = (value) => (isNumber(value) ? Math.round(value) : null);
  return {
    temperature: round(now.temperature, 1),
    'apparent-temperature': round(now.temperatureApparent, 1),
    humidity: round(now.humidity, 1),
    pressure: round(now.pressureSeaLevel ?? now.pressureSurfaceLevel, 1),
    'wind-speed': kmh(now.windSpeed),
    'wind-gust': kmh(now.windGust),
    'wind-direction': integer(now.windDirection),
    'cloud-cover': integer(now.cloudCover),
    precipitation: round(intensityOf(now), 2),
    'precipitation-next-hour': round(outlook.nextHourMm, 2),
    'rain-next-hour': outlook.source === null ? null : outlook.minutesUntil === null ? 0 : 1,
    'precipitation-probability': integer(
      isNumber(outlook.probability) ? outlook.probability : now.precipitationProbability,
    ),
    condition: isNumber(now.weatherCode) ? now.weatherCode : null,
    visibility: round(now.visibility, 1),
    'uv-index': integer(now.uvIndex ?? firstHour.uvIndex),
    pm25: round(premium.particulateMatter25, 1),
    pm10: round(premium.particulateMatter10, 1),
    ozone: isNumber(premium.pollutantO3)
      ? round(premium.pollutantO3 * OZONE_PPB_TO_UG_M3, 1)
      : null,
    aqi: integer(premium.epaIndex),
    'pollen-tree': integer(premium.treeIndex),
    'pollen-grass': integer(premium.grassIndex),
    'pollen-weed': integer(premium.weedIndex),
    'fire-index': integer(premium.fireIndex),
  };
}

/**
 * Rain in the next hour, from the minutely timeline when the plan gives it,
 * else from the hourly one (the hour in progress).
 * @returns {{
 *   source: 'minutely' | 'hourly' | null,
 *   minutesUntil: number | null, // 0 = raining now, null = dry hour
 *   nextHourMm: number | null,   // expected accumulation over the hour
 *   maxIntensity: number | null, // mm/h
 *   probability: number | null,  // %, the highest of the hour
 *   points: { t: string, v: number }[], // minutely intensities, for the chart
 * }}
 */
export function rainOutlook(snapshot, now = snapshot.fetchedAt) {
  const empty = {
    source: null,
    minutesUntil: null,
    nextHourMm: null,
    maxIntensity: null,
    probability: null,
    points: [],
  };
  const minutes = (snapshot.minutely ?? []).filter(
    (entry) => entry.time > now - MINUTE && entry.time < now + HOUR,
  );
  const withIntensity = minutes.filter((entry) => isNumber(intensityOf(entry.values)));
  if (withIntensity.length > 0) {
    let minutesUntil = null;
    let total = 0;
    let max = 0;
    let probability = null;
    const points = [];
    for (const entry of withIntensity) {
      const intensity = intensityOf(entry.values);
      total += intensity / 60;
      max = Math.max(max, intensity);
      if (isNumber(entry.values.precipitationProbability)) {
        probability = Math.max(probability ?? 0, entry.values.precipitationProbability);
      }
      if (minutesUntil === null && intensity >= RAIN_THRESHOLD_MM_H) {
        minutesUntil = Math.max(0, Math.round((entry.time - now) / MINUTE));
      }
      points.push({ t: new Date(entry.time).toISOString(), v: round(intensity, 2) });
    }
    return {
      source: 'minutely',
      minutesUntil,
      nextHourMm: total,
      maxIntensity: max,
      probability,
      points,
    };
  }
  const hour = (snapshot.hourly ?? []).find(
    (entry) => entry.time <= now && now < entry.time + HOUR,
  );
  const intensity = intensityOf(hour?.values);
  if (!hour || !isNumber(intensity)) {
    return empty;
  }
  const probability = isNumber(hour.values.precipitationProbability)
    ? hour.values.precipitationProbability
    : null;
  const rainy = intensity >= RAIN_THRESHOLD_MM_H && (probability ?? 100) >= HOURLY_RAIN_PROBABILITY;
  return {
    source: 'hourly',
    minutesUntil: rainy ? 0 : null,
    nextHourMm: intensity,
    maxIntensity: intensity,
    probability,
    points: [],
  };
}

/**
 * One day of the daily timeline: `offset` 0 is the day in progress at the
 * place (Tomorrow.io starts the daily timeline with it), 1 tomorrow.
 */
export function dailyForecast(snapshot, offset) {
  const entry = snapshot.daily?.[offset];
  if (!entry) {
    return null;
  }
  const v = entry.values;
  const probability = v.precipitationProbabilityMax ?? v.precipitationProbabilityAvg;
  return {
    time: entry.time,
    min: round(v.temperatureMin, 1),
    max: round(v.temperatureMax, 1),
    code: isNumber(v.weatherCodeMax)
      ? v.weatherCodeMax
      : isNumber(v.weatherCode)
        ? v.weatherCode
        : 0,
    probability: isNumber(probability) ? Math.round(probability) : null,
  };
}
