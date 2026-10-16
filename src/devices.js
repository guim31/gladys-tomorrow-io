// -----------------------------------------------------------------------------
// One Gladys device per place: its features, and the states read from a
// snapshot (src/model.js).
//
// External ids are forever: `place:<key>` where the key is `house-<selector>`
// for a house of Gladys (the selector is the stable identifier the core
// gives it) or `custom` for the coordinates of the configuration — moving
// them keeps the device and its history. The feature keys below are frozen
// the same way.
//
// Category/type couples: Gladys has none for a percentage of sky or a
// probability, so cloud cover and chance of rain are `counter-sensor/integer`
// in %, the pollen and fire indexes `risk/integer` (a 0-5 or 0-100 level).
// test/gladys-rules.test.js checks every couple against the core table.
// -----------------------------------------------------------------------------

import { conditionText, FEATURE_NAMES, pick } from './i18n.js';
import { currentReadings } from './model.js';

export const DEVICE_TYPE = 'place';

// The container refreshes the places itself (src/poller.js): the core's
// onPoll, once a minute, is only a fallback that skips a fresh place.
export const POLL_FREQUENCY_MS = 60_000;

// Re-sent at least this often even when unchanged, so Gladys never shows
// "no recent value" (it does past 48 h).
export const STATE_HEARTBEAT_MS = 6 * 60 * 60 * 1000;

const sensor = (category, type, unit, min, max) => ({ category, type, unit, min, max });

/** The features of every place, in display order. */
export const CORE_FEATURES = {
  temperature: sensor('temperature-sensor', 'decimal', 'celsius', -80, 60),
  'apparent-temperature': sensor('temperature-sensor', 'decimal', 'celsius', -80, 70),
  humidity: sensor('humidity-sensor', 'decimal', 'percent', 0, 100),
  pressure: sensor('pressure-sensor', 'decimal', 'hPa', 850, 1100),
  'wind-speed': sensor('speed-sensor', 'decimal', 'kilometer-per-hour', 0, 400),
  'wind-gust': sensor('speed-sensor', 'decimal', 'kilometer-per-hour', 0, 400),
  'wind-direction': sensor('angle-sensor', 'integer', 'degree', 0, 360),
  'cloud-cover': sensor('counter-sensor', 'integer', 'percent', 0, 100),
  precipitation: sensor('precipitation-sensor', 'decimal', 'millimeter-per-hour', 0, 500),
  'precipitation-next-hour': sensor(
    'precipitation-sensor',
    'decimal',
    'millimeter-per-hour',
    0,
    500,
  ),
  'rain-next-hour': sensor('rain-sensor', 'binary', undefined, 0, 1),
  'precipitation-probability': sensor('counter-sensor', 'integer', 'percent', 0, 100),
  condition: sensor('text', 'text', undefined, 0, 0),
  visibility: sensor('distance-sensor', 'decimal', 'km', 0, 100),
  'uv-index': sensor('uv-sensor', 'integer', 'uv-index', 0, 20),
};

/** Premium data layers: only with `premium_layers` on (not in the free plan). */
export const PREMIUM_FEATURES = {
  aqi: sensor('airquality-sensor', 'aqi', 'aqi', 0, 500),
  pm25: sensor('pm25-sensor', 'decimal', 'microgram-per-cubic-meter', 0, 1000),
  pm10: sensor('pm10-sensor', 'decimal', 'microgram-per-cubic-meter', 0, 1000),
  ozone: sensor('o3-sensor', 'decimal', 'microgram-per-cubic-meter', 0, 1000),
  'pollen-tree': sensor('risk', 'integer', undefined, 0, 5),
  'pollen-grass': sensor('risk', 'integer', undefined, 0, 5),
  'pollen-weed': sensor('risk', 'integer', undefined, 0, 5),
  'fire-index': sensor('risk', 'integer', undefined, 0, 100),
};

export function featureSet(config) {
  return config.premium_layers ? { ...CORE_FEATURES, ...PREMIUM_FEATURES } : CORE_FEATURES;
}

export function placeIds(gladys, place) {
  return gladys.externalIds(DEVICE_TYPE, place.key);
}

/** The Gladys device of one place, as published in the Discovery tab. */
export function buildDevice(gladys, place, config) {
  const ids = placeIds(gladys, place);
  const names = pick(FEATURE_NAMES, config.language);
  return {
    name: `Tomorrow.io ${place.name}`.slice(0, 60),
    external_id: ids.device,
    should_poll: true,
    poll_frequency: POLL_FREQUENCY_MS,
    features: Object.entries(featureSet(config)).map(([key, f]) => ({
      name: names[key],
      external_id: ids.feature(key),
      category: f.category,
      type: f.type,
      ...(f.unit ? { unit: f.unit } : {}),
      read_only: true,
      has_feedback: false,
      min: f.min,
      max: f.max,
    })),
  };
}

/**
 * The states of one place: only the features with a value, the weather code
 * as its text in the configured language (a text state is never empty).
 */
export function buildStates(gladys, place, config, snapshot) {
  const ids = placeIds(gladys, place);
  const readings = currentReadings(snapshot);
  const states = [];
  for (const key of Object.keys(featureSet(config))) {
    const value = readings[key];
    if (value === null || value === undefined) {
      continue;
    }
    const id = ids.feature(key);
    if (key === 'condition') {
      states.push({ device_feature_external_id: id, text: conditionText(value, config.language) });
    } else {
      states.push({ device_feature_external_id: id, state: value });
    }
  }
  return states;
}
