// -----------------------------------------------------------------------------
// A test world: the integration (src/app.js) on the SDK's fake Gladys, with a
// fake Tomorrow.io behind an injected fetch. Nothing touches the network.
// -----------------------------------------------------------------------------

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { createApp } from '../../src/app.js';
import { buildDevice } from '../../src/devices.js';
import { normalizeConfig } from '../../src/config.js';
import { resolvePlaces } from '../../src/places.js';
import { createStore } from '../../src/store.js';
import { createTomorrowClient } from '../../src/tomorrow.js';
import { FIXTURE_NOW, forecastAnswer, premiumAnswer, realtimeAnswer } from './tomorrowFixtures.js';

const worlds = new WeakMap();

export const API_KEY = 'tmrw-test-key-0123456789abcdef';

export const HOUSES = [
  { id: '1', name: 'Maison', selector: 'maison', latitude: 48.8566, longitude: 2.3522 },
  { id: '2', name: 'Chalet', selector: 'chalet', latitude: null, longitude: null },
];

/**
 * A fake Tomorrow.io. `routes` maps an endpoint (`realtime`, `forecast`,
 * `premium`) to an answer: an object (200 JSON), `{ status, body, headers }`,
 * a function of the call returning one of them, or an Error (no answer).
 */
export function createFakeTomorrow(routes = {}) {
  const calls = [];
  const defaults = {
    realtime: () => realtimeAnswer(Date.now()),
    forecast: () => forecastAnswer({ now: Date.now() }),
    premium: () => premiumAnswer(Date.now()),
  };
  const fetch = async (url, init) => {
    const { pathname, searchParams } = new URL(url);
    const endpoint = {
      '/v4/weather/realtime': 'realtime',
      '/v4/weather/forecast': 'forecast',
      '/v4/timelines': 'premium',
    }[pathname];
    const call = {
      endpoint,
      url: String(url),
      method: init.method,
      headers: init.headers,
      query: Object.fromEntries(searchParams),
      body: init.body ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    let answer = routes[endpoint] ?? defaults[endpoint];
    if (typeof answer === 'function') {
      answer = answer(call);
    }
    if (answer instanceof Error) {
      throw answer;
    }
    if (answer && typeof answer.status === 'number' && 'body' in answer) {
      return new Response(JSON.stringify(answer.body), {
        status: answer.status,
        headers: { 'content-type': 'application/json', ...(answer.headers ?? {}) },
      });
    }
    return new Response(JSON.stringify(answer), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return {
    fetch,
    calls,
    routes,
    count: (endpoint) => calls.filter((c) => c.endpoint === endpoint).length,
  };
}

/** Let the work started by a fired timer run to its end. */
export async function settle() {
  for (let i = 0; i < 50; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

/**
 * @param {import('node:test').TestContext} t
 * @param {object} [options]
 * @param {object} [options.config] raw configuration (API key set by default)
 * @param {boolean} [options.added] the places' devices are already in Gladys
 * @param {object} [options.routes] see createFakeTomorrow
 * @param {boolean} [options.timers] run the refresh timer
 * @param {string | null} [options.dataDir]
 * @param {number} [options.now]
 */
export async function createWorld(
  t,
  {
    config = {},
    added = true,
    routes = {},
    timers = true,
    dataDir = null,
    houses = HOUSES,
    now = FIXTURE_NOW,
    connect = true,
  } = {},
) {
  // A second world in the same test shares the clock and the console.
  const shared = worlds.get(t);
  if (shared) {
    if (now !== FIXTURE_NOW) {
      t.mock.timers.setTime(now);
    }
  } else {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now });
  }
  const lines = [];
  const sink = shared ?? { targets: [] };
  sink.targets = [lines];
  if (!shared) {
    worlds.set(t, sink);
    for (const stream of ['log', 'error']) {
      t.mock.method(console, stream, (...args) =>
        sink.targets.forEach((l) => l.push(args.join(' '))),
      );
    }
  }
  const raw = { api_key: API_KEY, ...config };
  const probe = createFakeGladys();
  const devices = added
    ? resolvePlaces(normalizeConfig(raw), houses).places.map((place) =>
        buildDevice(probe, place, normalizeConfig(raw)),
      )
    : [];
  const gladys = createFakeGladys({ config: raw, devices, houses });
  const tomorrow = createFakeTomorrow(routes);
  const app = createApp({
    gladys,
    client: createTomorrowClient({ fetch: tomorrow.fetch }),
    store: createStore(dataDir),
    now: () => Date.now(),
    timers,
    sleep: async () => {},
  });
  app.register();
  t.after(() => app.stop());
  if (connect) {
    await gladys.connect();
  }
  return { gladys, app, tomorrow, lines, devices };
}
