// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Where the forecasts are read: every located house of Gladys, the
// coordinates typed in the configuration, or both.
export const LOCATION_MODES = ['houses', 'coordinates', 'both'];

// Refresh intervals offered, in minutes. The Tomorrow.io free plan allows 25
// calls per hour and 500 per day: the poller stretches the interval when the
// number of places would exceed them (see src/quota.js).
export const REFRESH_MINUTES = ['15', '20', '30', '60'];

export const DEFAULT_CONFIG = {
  api_key: '',
  location_mode: 'houses',
  location_name: '',
  latitude: '',
  longitude: '',
  refresh_minutes: '15',
  premium_layers: false,
  daily_limit: 500,
  hourly_limit: 25,
  language: 'fr',
};

/**
 * Parse a decimal coordinate typed by hand: a comma is accepted as the
 * decimal separator (French keyboards), blanks are ignored.
 * @param {unknown} raw
 * @param {number} bound 90 for a latitude, 180 for a longitude
 * @returns {number | null} null when empty or invalid
 */
export function parseCoordinate(raw, bound) {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && Math.abs(raw) <= bound ? raw : null;
  }
  if (typeof raw !== 'string') {
    return null;
  }
  const text = raw.trim().replace(',', '.');
  if (!/^[-+]?\d{1,3}(\.\d+)?$/.test(text)) {
    return null;
  }
  const value = Number(text);
  return Math.abs(value) <= bound ? value : null;
}

/** A positive integer, or the default. */
function positiveInteger(raw, fallback) {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const pick = (key, allowed) =>
    allowed.includes(String(source[key])) ? String(source[key]) : DEFAULT_CONFIG[key];
  return {
    api_key: typeof source.api_key === 'string' ? source.api_key.trim() : '',
    location_mode: pick('location_mode', LOCATION_MODES),
    location_name:
      typeof source.location_name === 'string' ? source.location_name.trim().slice(0, 40) : '',
    latitude: parseCoordinate(source.latitude, 90),
    longitude: parseCoordinate(source.longitude, 180),
    refresh_minutes: Number(pick('refresh_minutes', REFRESH_MINUTES)),
    premium_layers: source.premium_layers === true || source.premium_layers === 'true',
    daily_limit: positiveInteger(source.daily_limit, DEFAULT_CONFIG.daily_limit),
    hourly_limit: positiveInteger(source.hourly_limit, DEFAULT_CONFIG.hourly_limit),
    language: pick('language', LANGUAGES),
  };
}

/** The API key is the only value without which nothing can be read. */
export function isConfigured(config) {
  return config.api_key !== '';
}

/** The coordinates typed in the configuration are one of the places. */
export function usesCoordinates(config) {
  return config.location_mode !== 'houses';
}

export function usesHouses(config) {
  return config.location_mode !== 'coordinates';
}
