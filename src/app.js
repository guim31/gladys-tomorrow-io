// -----------------------------------------------------------------------------
// The integration: configuration, places, refresh loop, states, scene
// trigger, scene action, widgets and the "Test" action, wired on a Gladys
// client. index.js passes the real one; the tests pass the SDK's fake Gladys
// and a fake fetch.
//
// Refreshing: the core cannot be trusted to call onPoll (Gladys#3198), so the
// container checks every minute which places are due and reads them itself;
// the core's onPoll is a fallback that skips a fresh place. Only the places
// the user added to Gladys are read: a reading nobody stores would spend the
// quota for nothing. Tomorrow.io is never called for a widget, a scene action
// or a device creation: they all use the last reading of the place.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { isConfigured, normalizeConfig } from './config.js';
import { buildDevice, buildStates, placeIds, STATE_HEARTBEAT_MS } from './devices.js';
import { conditionText, each, MESSAGES, pick, render, TEXT } from './i18n.js';
import { createIssueLog } from './issues.js';
import { buildSnapshot, currentReadings, dailyForecast, rainOutlook } from './model.js';
import { resolvePlaces } from './places.js';
import { callsPerDay, createCallLedger, plannedIntervalMinutes } from './quota.js';
import { createRainWatch, RAIN_TRIGGER } from './rain.js';
import { createStore } from './store.js';
import { createTomorrowClient } from './tomorrow.js';
import { buildForecastContent, buildRainContent, messageContent, WIDGET } from './widgets.js';

export const TICK_MS = 60_000;
// Tomorrow.io allows 3 calls a second: the calls of a refresh are spaced.
export const CALL_SPACING_MS = 400;
// A plan that refused the premium layers is asked again once a day.
export const PREMIUM_RETRY_MS = 24 * 60 * 60 * 1000;

export const SCENE_ACTION = 'get_forecast';
export const TEST_ACTION = 'test_connection';

const MINUTE = 60_000;

/**
 * @param {object} options
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} options.gladys
 * @param {ReturnType<typeof createTomorrowClient>} [options.client]
 * @param {ReturnType<typeof createStore>} [options.store]
 * @param {() => number} [options.now]
 * @param {boolean} [options.timers] run the refresh timer (tests may turn it off)
 * @param {(ms: number) => Promise<void>} [options.sleep]
 */
export function createApp({
  gladys,
  client = createTomorrowClient(),
  store = createStore(),
  now = () => Date.now(),
  timers = true,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const logger = createLogger({ name: 'tomorrow-io' });
  const issues = createIssueLog(logger);

  let config = normalizeConfig();
  let houses = [];
  let places = [];
  /** Last reading of each place, by place key. */
  const snapshots = new Map();
  /** When each place was last refreshed (start of the refresh). */
  const lastRefresh = new Map();
  let ledger = createCallLedger({ now });
  let rainWatch = createRainWatch();
  let premiumRefusedAt = null;
  let blockedUntil = 0;
  let timer = null;
  let stopped = false;
  let cycleRunning = null;
  let lastStatus = null;
  let loaded = false;

  const premiumAvailable = () =>
    premiumRefusedAt === null || now() - premiumRefusedAt >= PREMIUM_RETRY_MS;
  const periodMinutes = () =>
    plannedIntervalMinutes(config, activePlaces().length, premiumAvailable());

  /** The places whose device the user added to Gladys. */
  function activePlaces() {
    const created = new Set((gladys.devices ?? []).map((device) => device.external_id));
    return places.filter((place) => created.has(placeIds(gladys, place).device));
  }

  function placeByDevice(externalId) {
    return places.find((place) => placeIds(gladys, place).device === externalId);
  }

  async function loadState() {
    if (loaded) {
      return;
    }
    loaded = true;
    const saved = await store.load();
    ledger = createCallLedger({ now, calls: Array.isArray(saved.calls) ? saved.calls : [] });
    rainWatch = createRainWatch(saved.rain);
  }

  const saveState = () =>
    store.save({ calls: ledger.toJSON(), rain: rainWatch.toJSON() }).catch((err) => {
      issues.fail('store', `Cannot write /data (${err.message})`);
    });

  /** The connection status of the Configuration screen, sent on change only. */
  async function setStatus(connected, message) {
    const key = JSON.stringify([connected, message ?? null]);
    if (key === lastStatus) {
      return;
    }
    lastStatus = key;
    await gladys.setConnectionStatus(connected, message).catch((err) => {
      lastStatus = null;
      logger.debug(`setConnectionStatus failed (${err.message})`);
    });
  }

  /** Read the houses (location: true) and work out the places. */
  async function resolve() {
    try {
      houses = await gladys.getHouses();
      issues.ok('houses', 'The houses of Gladys can be read again');
    } catch (err) {
      issues.fail('houses', `Cannot read the houses of Gladys (${err.message})`);
    }
    const result = resolvePlaces(config, houses);
    places = result.places;
    for (const key of [...snapshots.keys()]) {
      if (!places.some((place) => place.key === key)) {
        snapshots.delete(key);
        rainWatch.forget(key);
      }
    }
    return result;
  }

  /**
   * (Re)start after a connection or a new configuration. A reconnection to
   * Gladys keeps the refresh times: only a new configuration reads at once.
   */
  async function start({ newConfig = false } = {}) {
    await loadState();
    issues.reset();
    lastStatus = null;
    if (!isConfigured(config)) {
      logger.info('Not configured yet: waiting for the Tomorrow.io API key');
      places = [];
      await setStatus(false, MESSAGES.notConfigured);
      return;
    }
    const { skipped, badCoordinates } = await resolve();
    if (skipped.length > 0) {
      logger.info(`Houses without a location, skipped: ${skipped.join(', ')}`);
    }
    await gladys.publishDiscoveredDevices(
      places.map((place) => buildDevice(gladys, place, config)),
    );
    if (badCoordinates) {
      await setStatus(false, MESSAGES.badCoordinates);
    } else if (places.length === 0) {
      await setStatus(false, MESSAGES.noPlace);
    }
    const count = activePlaces().length;
    const minutes = periodMinutes();
    logger.info(
      `${places.length} place(s), ${count} added to Gladys: one reading every ${minutes} min ` +
        `(${callsPerDay(config, count, minutes, premiumAvailable())} calls a day at most)`,
    );
    if (newConfig) {
      lastRefresh.clear();
    }
    schedule();
    await cycle();
  }

  /** Publish the states of a place from its last reading. */
  async function publishPlace(place) {
    const snapshot = snapshots.get(place.key);
    if (!snapshot) {
      return;
    }
    await gladys.publishChangedStates(buildStates(gladys, place, config, snapshot), {
      heartbeat: STATE_HEARTBEAT_MS,
    });
  }

  /** Fire the rain trigger for the windows that just opened. */
  async function fireRain(place, snapshot) {
    const outlook = rainOutlook(snapshot);
    const opened = rainWatch.evaluate(place.key, outlook, snapshot.fetchedAt);
    for (const window of opened) {
      try {
        await gladys.publishSceneEvent(RAIN_TRIGGER, {
          device: placeIds(gladys, place).device,
          within: String(window),
          place: place.name,
          minutes: outlook.minutesUntil,
          intensity:
            outlook.maxIntensity === null ? null : Math.round(outlook.maxIntensity * 100) / 100,
          probability: outlook.probability,
        });
        logger.debug(`${place.key}: rain expected within ${window} min, trigger fired`);
      } catch (err) {
        issues.fail('scene-event', `Cannot fire the rain trigger (${err.message})`);
      }
    }
  }

  /**
   * Read Tomorrow.io for one place: realtime, then forecast, then the premium
   * layers when asked. Throws a TomorrowError when the realtime call fails.
   */
  async function refreshPlace(place) {
    const withPremium = config.premium_layers && premiumAvailable();
    const cost = 2 + (withPremium ? 1 : 0);
    if (!ledger.canSpend(cost, config)) {
      issues.fail(
        'budget',
        `Call budget reached (${ledger.thisHour()} this hour, ${ledger.today()} today): readings paused`,
      );
      return false;
    }
    issues.ok('budget', 'Call budget available again: readings resume');
    lastRefresh.set(place.key, now());
    const fetchedAt = now();

    ledger.record();
    const realtime = await client.realtime(config.api_key, place);

    let forecast = null;
    await sleep(CALL_SPACING_MS);
    ledger.record();
    try {
      forecast = await client.forecast(config.api_key, place);
      issues.ok(`forecast:${place.key}`, `${place.key}: forecast available again`);
    } catch (err) {
      if (err.kind === 'rate') {
        throw err;
      }
      issues.fail(`forecast:${place.key}`, `${place.key}: forecast failed (${err.message})`);
    }

    let premium = null;
    if (withPremium) {
      await sleep(CALL_SPACING_MS);
      ledger.record();
      try {
        premium = await client.premium(config.api_key, place);
        if (premiumRefusedAt !== null) {
          logger.info('The air quality and pollen layers are now available');
        }
        premiumRefusedAt = null;
      } catch (err) {
        if (err.kind === 'plan') {
          if (premiumRefusedAt === null) {
            logger.warn(
              `The Tomorrow.io plan does not give air quality and pollen (${err.message}): asked again in 24 h`,
            );
          }
          premiumRefusedAt = now();
        } else if (err.kind === 'rate') {
          throw err;
        } else {
          issues.fail('premium', `Air quality and pollen read failed (${err.message})`);
        }
      }
    }

    const previous = snapshots.get(place.key);
    const snapshot = buildSnapshot({ realtime, forecast, premium, fetchedAt });
    if (!premium && previous?.premium && withPremium) {
      // A failed premium read keeps the previous values rather than none.
      snapshot.premium = previous.premium;
    }
    snapshots.set(place.key, snapshot);
    try {
      await publishPlace(place);
      issues.ok('publish', 'Gladys accepts the states again');
    } catch (err) {
      // Gladys refused the states (rate limit, restart): the reading is
      // fine, the SDK sends the states again at the next refresh.
      issues.fail('publish', `Publishing the states failed (${err.message})`);
    }
    await fireRain(place, snapshot);
    logger.debug(`${place.key}: refreshed`);
    return true;
  }

  async function handleRefreshError(place, err) {
    if (err.kind === 'auth') {
      issues.fail('auth', `Tomorrow.io refuses the API key (${err.message})`);
      await setStatus(false, MESSAGES.badKey);
    } else if (err.kind === 'rate') {
      blockedUntil = now() + (err.retryAfterMs ?? Math.max(ledger.nextHour() - now(), MINUTE));
      issues.fail(
        'rate',
        `Tomorrow.io quota reached (${err.message}): paused until the next window`,
      );
      await setStatus(false, MESSAGES.rateLimited);
    } else {
      issues.fail(`refresh:${place.key}`, `${place.key}: refresh failed (${err.message})`);
      await setStatus(false, render(MESSAGES.unreachable, err.message));
    }
  }

  /**
   * Refresh the places that are due (or the given ones, `force`).
   * @param {object} [options]
   * @param {object[]} [options.only] restrict to these places
   * @param {number} [options.minGap] share of the period a place must be older than
   */
  async function cycle({ only, minGap = 1 } = {}) {
    // A targeted refresh (a device just added) waits for the cycle in
    // progress instead of being lost in it.
    while (only && cycleRunning) {
      await cycleRunning.catch(() => {});
    }
    if (cycleRunning) {
      return cycleRunning;
    }
    cycleRunning = (async () => {
      if (!isConfigured(config) || gladys.connected === false || now() < blockedUntil) {
        return;
      }
      const period = periodMinutes() * MINUTE;
      let refreshed = 0;
      for (const place of only ?? activePlaces()) {
        const last = lastRefresh.get(place.key);
        // Half a minute of slack: the tick runs every minute, a tick a few ms
        // early must not push the refresh one more minute away.
        if (last !== undefined && now() - last < period * minGap - MINUTE / 2) {
          continue;
        }
        try {
          if (await refreshPlace(place)) {
            refreshed += 1;
            issues.ok(`refresh:${place.key}`, `${place.key}: Tomorrow.io answers again`);
          }
        } catch (err) {
          await handleRefreshError(place, err);
          if (err.kind === 'auth' || err.kind === 'rate') {
            break;
          }
          continue;
        }
        issues.ok('auth', 'Tomorrow.io accepts the API key again');
        issues.ok('rate', 'Tomorrow.io quota available again: readings resume');
        await setStatus(true);
      }
      if (refreshed > 0) {
        await saveState();
        refreshWidgets();
      }
    })();
    try {
      await cycleRunning;
    } finally {
      cycleRunning = null;
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!timers || stopped) {
      return;
    }
    timer = setTimeout(async () => {
      timer = null;
      try {
        await cycle();
      } catch (err) {
        logger.error(`Refresh cycle failed (${err.message})`);
      } finally {
        schedule();
      }
    }, TICK_MS);
  }

  // --- Widgets ---------------------------------------------------------------

  /** "Re-pull me now" (fire-and-forget, rate-limited by the core). */
  function refreshWidgets() {
    for (const key of Object.values(WIDGET)) {
      try {
        gladys.requestWidgetRefresh(key);
      } catch (err) {
        logger.debug(`requestWidgetRefresh(${key}) failed (${err.message})`);
      }
    }
  }

  function widgetPlace(settings, language) {
    if (!isConfigured(config)) {
      return { content: messageContent(pick(MESSAGES.notConfigured, language)) };
    }
    const place = placeByDevice(settings?.device);
    if (!place) {
      return { content: messageContent(pick(TEXT.pickDevice, language)) };
    }
    const snapshot = snapshots.get(place.key);
    if (!snapshot) {
      return { content: messageContent(pick(TEXT.noData, language)) };
    }
    return { place, snapshot };
  }

  // --- Handlers --------------------------------------------------------------

  function register() {
    gladys.on('connected', async () => {
      try {
        config = normalizeConfig(await gladys.getConfig());
        await start();
      } catch (err) {
        logger.error(`Post-connection initialization failed (${err.message})`);
        await setStatus(false, MESSAGES.initFailed);
      }
    });

    gladys.onConfigUpdated(async (newConfig) => {
      logger.info('New configuration received');
      config = normalizeConfig(newConfig);
      // Another key, maybe another plan: ask for the premium layers again.
      premiumRefusedAt = null;
      blockedUntil = 0;
      await start({ newConfig: true });
    });

    gladys.onScanRequest(async () => {
      if (isConfigured(config)) {
        await resolve();
      }
      await gladys.publishDiscoveredDevices(
        places.map((place) => buildDevice(gladys, place, config)),
      );
    });

    // The core's poll (fallback): reads the place unless the timer just did.
    gladys.onPoll(async (device) => {
      const place = placeByDevice(device.external_id);
      if (place) {
        await cycle({ only: [place], minGap: 0.9 });
      }
    });

    // A device just added: Gladys dropped the states sent before it existed,
    // the SDK forgot them, send the last reading again — or read the place
    // now if it was never read (it was not added until now).
    const onAdded = async (device) => {
      const place = placeByDevice(device.external_id);
      if (!place) {
        return;
      }
      if (snapshots.has(place.key)) {
        await publishPlace(place);
      } else {
        await cycle({ only: [place] });
      }
      refreshWidgets();
    };
    gladys.onDeviceCreated(onAdded);
    gladys.onDeviceUpdated(onAdded);

    gladys.onAction(TEST_ACTION, async () => {
      logger.info('Action: test the Tomorrow.io connection');
      if (!isConfigured(config)) {
        return MESSAGES.notConfigured;
      }
      const place = places[0];
      if (!place) {
        return MESSAGES.noPlace;
      }
      if (!ledger.canSpend(1, config)) {
        return MESSAGES.quotaSpent;
      }
      try {
        ledger.record();
        const realtime = await client.realtime(config.api_key, place);
        await saveState();
        const temperature = currentReadings(
          buildSnapshot({ realtime, fetchedAt: now() }),
        ).temperature;
        const count = Math.max(activePlaces().length, 1);
        const minutes = periodMinutes();
        logger.info('Test: the API key is accepted');
        const calls = callsPerDay(config, count, minutes, premiumAvailable());
        return each((lang) =>
          MESSAGES.testOk[lang]({
            temperature:
              temperature === null ? '?' : new Intl.NumberFormat(lang).format(temperature),
            place: place.name,
            places: count,
            minutes,
            calls,
          }),
        );
      } catch (err) {
        logger.info(`Test failed (${err.message})`);
        return err.kind === 'auth' ? MESSAGES.badKey : render(MESSAGES.testFailed, err.message);
      }
    });

    gladys.onSceneAction(SCENE_ACTION, async (fields) => {
      const place = placeByDevice(fields.device);
      if (!place) {
        throw new Error('Unknown Tomorrow.io place');
      }
      const snapshot = snapshots.get(place.key);
      const offset = fields.day === 'tomorrow' ? 1 : 0;
      const day = snapshot ? dailyForecast(snapshot, offset) : null;
      if (!day) {
        throw new Error('No forecast read yet for this place');
      }
      const language = config.language;
      const condition = conditionText(day.code, language);
      const format = (value) =>
        value === null
          ? '?'
          : new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(value);
      logger.info(`Scene action: forecast of ${place.key} (${fields.day ?? 'today'})`);
      return {
        summary: pick(
          TEXT.summary,
          language,
        )({
          day: pick(offset === 1 ? TEXT.tomorrow : TEXT.today, language),
          condition,
          min: format(day.min),
          max: format(day.max),
          rain: day.probability ?? '?',
        }),
        condition,
        temperature_min: day.min,
        temperature_max: day.max,
        precipitation_probability: day.probability,
      };
    });

    gladys.onWidgetGet(WIDGET.FORECAST, async ({ settings, language }) => {
      const found = widgetPlace(settings, language);
      if (found.content) {
        return found.content;
      }
      return buildForecastContent({
        gladys,
        place: found.place,
        snapshot: found.snapshot,
        language,
        premium: config.premium_layers,
      });
    });

    gladys.onWidgetGet(WIDGET.RAIN, async ({ settings, language }) => {
      const found = widgetPlace(settings, language);
      if (found.content) {
        return found.content;
      }
      return buildRainContent({ gladys, place: found.place, snapshot: found.snapshot, language });
    });

    gladys.handleShutdown(async (signal) => {
      logger.info(`Received ${signal}: shutting down`);
      stop();
      await saveState();
    });
  }

  function stop() {
    stopped = true;
    clearTimeout(timer);
    timer = null;
  }

  return {
    register,
    stop,
    /** For the tests. */
    get config() {
      return config;
    },
    get places() {
      return places;
    },
    snapshot: (key) => snapshots.get(key),
    cycle,
    /** Resolves once the refresh in progress (and its /data write) is over. */
    whenIdle: () => cycleRunning ?? Promise.resolve(),
  };
}
