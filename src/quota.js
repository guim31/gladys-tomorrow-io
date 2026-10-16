// -----------------------------------------------------------------------------
// The call budget of the Tomorrow.io plan.
//
// The free plan allows 500 calls a day (reset at 00:00 UTC) and 25 an hour
// (reset at the top of each hour), 3 a second; one call per endpoint and per
// place. Two guards keep the integration inside:
//   1. the planned interval: the configured one, stretched so that every
//      place fits in 90 % of the hourly and daily limits (the margin is for
//      the "Test" button and a restart) — Home Assistant does the same;
//   2. the ledger: every call is counted in the current UTC hour and day,
//      and a refresh that would go past a limit is skipped. It is kept in
//      /data, so a restart loop cannot spend the quota again.
// -----------------------------------------------------------------------------

export const BUDGET_SHARE = 0.9;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Calls one refresh of one place costs. */
export function callsPerPlace(config, premiumAvailable = true) {
  return 2 + (config.premium_layers && premiumAvailable ? 1 : 0);
}

/**
 * @returns {number} minutes between two refreshes of the same place
 */
export function plannedIntervalMinutes(config, placeCount, premiumAvailable = true) {
  const calls = placeCount * callsPerPlace(config, premiumAvailable);
  if (calls === 0) {
    return config.refresh_minutes;
  }
  const byHour = Math.ceil((60 * calls) / (config.hourly_limit * BUDGET_SHARE));
  const byDay = Math.ceil((1440 * calls) / (config.daily_limit * BUDGET_SHARE));
  return Math.max(config.refresh_minutes, byHour, byDay);
}

/** Calls a day at a given interval. */
export function callsPerDay(config, placeCount, minutes, premiumAvailable = true) {
  return Math.ceil(1440 / minutes) * placeCount * callsPerPlace(config, premiumAvailable);
}

/**
 * @param {object} options
 * @param {() => number} options.now
 * @param {number[]} [options.calls] timestamps restored from /data
 */
export function createCallLedger({ now, calls = [] }) {
  let history = calls.filter((t) => Number.isFinite(t) && now() - t < DAY);

  const startOfHour = (t) => t - (t % HOUR);
  const startOfDay = (t) => t - (t % DAY);

  return {
    record(count = 1) {
      const t = now();
      for (let i = 0; i < count; i += 1) {
        history.push(t);
      }
      history = history.filter((time) => t - time < DAY);
    },
    thisHour() {
      const from = startOfHour(now());
      return history.filter((t) => t >= from).length;
    },
    today() {
      const from = startOfDay(now());
      return history.filter((t) => t >= from).length;
    },
    /** Room for `count` more calls in the current hour and UTC day. */
    canSpend(count, config) {
      return (
        this.thisHour() + count <= config.hourly_limit && this.today() + count <= config.daily_limit
      );
    },
    /** When the hourly window resets. */
    nextHour() {
      return startOfHour(now()) + HOUR;
    },
    toJSON() {
      return [...history];
    },
  };
}
