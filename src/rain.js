// -----------------------------------------------------------------------------
// The "rain expected within N minutes" scene trigger.
//
// Each place has three windows: 15, 30 and 60 minutes. A window fires once
// when rain enters it (the first rainy minute of the forecast is at most N
// minutes away, or it rains now), then stays silent until the forecast is dry
// for that window again. A shower announced at 50 minutes thus fires "60",
// then "30" and "15" as it gets closer: the scene author picks the window.
//
// The device already has a "rain within the hour" binary feature: the trigger
// adds the shorter windows, the minutes before the rain and the expected
// intensity, which a state cannot carry.
//
// The first evaluation of a place without a recent saved state is a
// baseline: no event (a container restart during a shower must not fire
// every scene again — the core does the same with its weather alerts). The
// states live in /data for that reason.
//
// Without a minutely timeline (plan without it), only the 60-minute window is
// evaluated, from the hour in progress.
// -----------------------------------------------------------------------------

export const RAIN_TRIGGER = 'rain_expected';
export const RAIN_WINDOWS = [15, 30, 60];

// A saved state older than this is not trusted as a baseline.
const STALE_MS = 3 * 60 * 60 * 1000;

/**
 * @param {object} [saved] the `toJSON()` of a previous run
 */
export function createRainWatch(saved = {}) {
  const places = new Map(Object.entries(saved && typeof saved === 'object' ? saved : {}));

  return {
    /**
     * @param {string} placeKey
     * @param {ReturnType<import('./model.js').rainOutlook>} outlook
     * @param {number} now
     * @returns {number[]} the windows that just opened, smallest last
     */
    evaluate(placeKey, outlook, now) {
      if (outlook.source === null) {
        return [];
      }
      const windows = outlook.source === 'minutely' ? RAIN_WINDOWS : [60];
      const previous = places.get(placeKey);
      const baseline = !previous || !(now - previous.at < STALE_MS);
      const active = { ...(previous?.active ?? {}) };
      const opened = [];
      for (const window of windows) {
        const rainy = outlook.minutesUntil !== null && outlook.minutesUntil <= window;
        if (rainy && !active[window] && !baseline) {
          opened.push(window);
        }
        active[window] = rainy;
      }
      places.set(placeKey, { at: now, active });
      return opened.sort((a, b) => b - a);
    },

    /** Forget a place (removed from the configuration). */
    forget(placeKey) {
      places.delete(placeKey);
    },

    toJSON() {
      return Object.fromEntries(places);
    },
  };
}
