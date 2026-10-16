// -----------------------------------------------------------------------------
// The refresh loop: the container reads Tomorrow.io by itself (Gladys#3198),
// the core's onPoll is a fallback, the quota is respected, only changes are
// published, and the logs stay quiet.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { STATE_HEARTBEAT_MS } from '../src/devices.js';
import { API_KEY, createWorld, settle } from './helpers/world.js';
import { ERRORS, realtimeAnswer } from './helpers/tomorrowFixtures.js';

const MINUTE = 60_000;
const TEMPERATURE = 'ext:test-integration:place:house-maison:temperature';

/** Advance the mocked clock minute by minute, letting each tick run. */
async function advance(t, minutes) {
  for (let i = 0; i < minutes; i += 1) {
    t.mock.timers.tick(MINUTE);
    await settle();
  }
}

test('the container reads an added place by itself, every period, without any onPoll', async (t) => {
  const { gladys, tomorrow } = await createWorld(t);
  assert.equal(tomorrow.count('realtime'), 1, 'read at connection');
  assert.equal(tomorrow.count('forecast'), 1, 'one forecast call carries every timeline');
  assert.equal(gladys.fake.lastState(TEMPERATURE), 23.6);

  await advance(t, 14);
  assert.equal(tomorrow.count('realtime'), 1, 'not before the 15-minute period');
  await advance(t, 1);
  assert.equal(tomorrow.count('realtime'), 2, 'read again after one period');
  await advance(t, 15);
  assert.equal(tomorrow.count('realtime'), 3);
  assert.equal(tomorrow.count('premium'), 0, 'no premium call on the free plan');
});

test('a place whose device is not in Gladys is never read', async (t) => {
  const { gladys, tomorrow } = await createWorld(t, { added: false });
  assert.equal(gladys.fake.discoveredDevices.length, 1, 'offered in the Discovery tab');
  await advance(t, 30);
  assert.equal(tomorrow.calls.length, 0, 'no quota spent for a device nobody added');

  // The user adds it: read at once, states sent.
  await gladys.fake.deviceCreated(gladys.fake.discoveredDevices[0]);
  assert.equal(tomorrow.count('realtime'), 1);
  assert.equal(gladys.fake.lastState(TEMPERATURE), 23.6);
});

test("the core's onPoll is a fallback: it never reads a fresh place again", async (t) => {
  const { gladys, tomorrow, devices } = await createWorld(t, { timers: false });
  assert.equal(tomorrow.count('realtime'), 1);
  for (let i = 0; i < 12; i += 1) {
    t.mock.timers.tick(MINUTE);
    assert.deepEqual(await gladys.fake.poll(devices[0]), { success: true });
  }
  assert.equal(tomorrow.count('realtime'), 1, 'polled every minute, Tomorrow.io read once');
  // The timer is stalled (turned off here): past 90 % of the period, the
  // core's poll reads the place.
  t.mock.timers.tick(2 * MINUTE);
  await gladys.fake.poll(devices[0]);
  assert.equal(tomorrow.count('realtime'), 2);
});

test('the key travels in a header, never in the URL, and the units are metric', async (t) => {
  const { tomorrow } = await createWorld(t, { config: { premium_layers: true } });
  assert.equal(tomorrow.calls.length, 3);
  for (const call of tomorrow.calls) {
    assert.equal(call.headers.apikey, API_KEY);
    assert.ok(!call.url.includes(API_KEY));
  }
  assert.deepEqual(tomorrow.calls[0].query, { location: '48.8566,2.3522', units: 'metric' });
  assert.equal(tomorrow.calls[2].method, 'POST');
  assert.deepEqual(tomorrow.calls[2].body.timesteps, ['current']);
  assert.equal(tomorrow.calls[2].body.units, 'metric');
});

test('only the values that changed are published again, and all once per heartbeat', async (t) => {
  let temperature = 23.6;
  const { gladys } = await createWorld(t, {
    routes: { realtime: () => realtimeAnswer(Date.now(), { temperature }) },
  });
  const first = gladys.fake.states.length;
  assert.ok(first >= 14);

  await advance(t, 15);
  assert.equal(gladys.fake.states.length, first, 'nothing changed, nothing sent');

  temperature = 25;
  await advance(t, 15);
  const sent = gladys.fake.states.slice(first).map((s) => s.device_feature_external_id);
  assert.ok(sent.includes(TEMPERATURE));
  assert.ok(sent.length <= 2, `only the temperatures, got ${sent}`);

  const before = gladys.fake.states.length;
  await advance(t, STATE_HEARTBEAT_MS / MINUTE);
  assert.ok(
    gladys.fake.states.length - before >= first,
    'everything sent again within the heartbeat',
  );
});

test('a device just added gets its states again without a new call', async (t) => {
  const { gladys, tomorrow, devices } = await createWorld(t);
  const first = gladys.fake.states.length;
  t.mock.timers.tick(5 * MINUTE);
  await gladys.fake.deviceCreated(devices[0]);
  assert.equal(tomorrow.count('realtime'), 1, 'the last reading is reused');
  assert.equal(gladys.fake.states.length, first * 2, 'every state sent again');
  assert.ok(gladys.fake.widgetRefreshes.length > 0, 'the widgets are nudged');
});

test('the interval is stretched so that every place fits in the free quota', async (t) => {
  const houses = Array.from({ length: 4 }, (_, i) => ({
    id: String(i),
    name: `House ${i}`,
    selector: `house-${i}`,
    latitude: 45 + i,
    longitude: 3,
  }));
  const { tomorrow } = await createWorld(t, { houses });
  assert.equal(tomorrow.count('realtime'), 4);
  // 4 places × 2 calls: 25/hour → 22 min, 500/day → 26 min.
  await advance(t, 25);
  assert.equal(tomorrow.count('realtime'), 4);
  await advance(t, 1);
  assert.equal(tomorrow.count('realtime'), 8);
  // Over a whole day, the daily quota holds.
  await advance(t, 24 * 60 - 26);
  assert.ok(tomorrow.calls.length <= 500, `${tomorrow.calls.length} calls in a day`);
});

test('the call ledger survives a restart: a restart loop cannot spend the quota', async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), 'tomorrow-io-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  // A plan of 4 calls an hour: two restarts in the hour spend it.
  const config = { hourly_limit: 4, daily_limit: 100 };
  for (let i = 0; i < 2; i += 1) {
    const { app } = await createWorld(t, {
      config,
      dataDir,
      now: Date.parse('2022-04-17T02:00:00Z') + i * MINUTE,
    });
    app.stop();
  }
  const saved = JSON.parse(await readFile(join(dataDir, 'state.json'), 'utf8'));
  assert.equal(saved.calls.length, 4);
  const { tomorrow, lines } = await createWorld(t, {
    config,
    dataDir,
    now: Date.parse('2022-04-17T02:05:00Z'),
  });
  assert.equal(tomorrow.calls.length, 0, 'the hour is spent: nothing read');
  assert.equal(lines.filter((l) => l.includes('Call budget reached')).length, 1);
});

test('a refused key is said once, in the logs and in the Configuration screen', async (t) => {
  let refused = true;
  const { gladys, lines } = await createWorld(t, {
    routes: { realtime: () => (refused ? ERRORS.invalidKey : realtimeAnswer(Date.now())) },
  });
  await advance(t, 45);
  const warnings = lines.filter((l) => l.includes('[WARN]'));
  assert.equal(warnings.length, 1, warnings.join('\n'));
  assert.match(warnings[0], /refuses the API key \(HTTP 401 \(Invalid Auth/);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /refuse la clé/);

  refused = false;
  await advance(t, 15);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  const infos = lines.filter((l) => l.includes('[INFO]') && l.includes('again'));
  assert.equal(infos.length, 1, infos.join('\n'));
});

test('a 429 pauses the readings until the window resets', async (t) => {
  let limited = true;
  const { tomorrow, lines, gladys } = await createWorld(t, {
    routes: {
      forecast: () =>
        limited ? { ...ERRORS.rateLimited, headers: { 'retry-after': '1800' } } : undefined,
    },
  });
  assert.equal(tomorrow.count('realtime'), 1);
  assert.match(gladys.fake.connectionStatus.message.en, /quota/);
  limited = false;
  delete tomorrow.routes.forecast;
  await advance(t, 29);
  assert.equal(tomorrow.count('realtime'), 1, 'paused for the Retry-After');
  await advance(t, 1);
  assert.equal(tomorrow.count('realtime'), 2);
  assert.equal(lines.filter((l) => l.includes('quota reached')).length, 1);
});

test('a plan without the premium layers is said once and asked again a day later', async (t) => {
  const { gladys, tomorrow, lines } = await createWorld(t, {
    config: { premium_layers: true },
    routes: { premium: () => ERRORS.planRefused },
  });
  assert.equal(tomorrow.count('premium'), 1);
  assert.ok(
    gladys.fake.lastState(TEMPERATURE) !== undefined,
    'the core weather is still published',
  );
  await advance(t, 60);
  assert.equal(tomorrow.count('premium'), 1, 'not asked again within the day');
  assert.equal(lines.filter((l) => l.includes('does not give air quality')).length, 1);
  await advance(t, 24 * 60);
  assert.equal(tomorrow.count('premium'), 2);
});

test('a Tomorrow.io outage is one warning, and its end one info line', async (t) => {
  let down = true;
  const { lines, gladys } = await createWorld(t, {
    routes: { realtime: () => (down ? new TypeError('fetch failed') : realtimeAnswer(Date.now())) },
  });
  await advance(t, 45);
  const warnings = lines.filter((l) => l.includes('[WARN]'));
  assert.equal(warnings.length, 1, warnings.join('\n'));
  assert.match(gladys.fake.connectionStatus.message.en, /does not answer/);
  down = false;
  await advance(t, 15);
  const infos = lines.filter((l) => l.includes('[INFO]') && l.includes('answers again'));
  assert.equal(infos.length, 1);
});

test('a normal cycle writes nothing at info level, and no secret ever reaches the logs', async (t) => {
  const previous = process.env.LOG_LEVEL;
  t.after(() => {
    if (previous === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = previous;
    }
  });
  delete process.env.LOG_LEVEL; // the default: info
  let temperature = 23.6;
  const { lines } = await createWorld(t, {
    config: { premium_layers: true },
    routes: { realtime: () => realtimeAnswer(Date.now(), { temperature: (temperature += 1) }) },
  });
  const startup = lines.length;
  await advance(t, 60);
  assert.deepEqual(lines.slice(startup), [], 'four readings, new values, no line at info');

  // Even in debug, with failures, the key never shows.
  process.env.LOG_LEVEL = 'debug';
  const world = await createWorld(t, {
    config: { premium_layers: true },
    routes: { realtime: () => ERRORS.invalidKey },
  });
  await advance(t, 30);
  assert.ok(world.lines.length > 0);
  for (const line of [...lines, ...world.lines]) {
    assert.ok(!line.includes(API_KEY), `the API key leaked: ${line}`);
  }
});
