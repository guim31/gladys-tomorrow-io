// -----------------------------------------------------------------------------
// The "rain expected within N minutes" trigger, and the rain features.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRainWatch, RAIN_TRIGGER } from '../src/rain.js';
import { createWorld, settle } from './helpers/world.js';
import { forecastAnswer } from './helpers/tomorrowFixtures.js';

const MINUTE = 60_000;
const DEVICE = 'ext:test-integration:place:house-maison';

async function advance(t, minutes) {
  for (let i = 0; i < minutes; i += 1) {
    t.mock.timers.tick(MINUTE);
    await settle();
  }
}

const outlook = (minutesUntil, source = 'minutely') => ({ source, minutesUntil });

test('a window fires once when rain enters it, and again only after a dry spell', () => {
  const watch = createRainWatch({ maison: { at: 0, active: {} } });
  assert.deepEqual(watch.evaluate('maison', outlook(null), 1), []);
  assert.deepEqual(watch.evaluate('maison', outlook(50), 2), [60]);
  assert.deepEqual(watch.evaluate('maison', outlook(35), 3), []);
  assert.deepEqual(watch.evaluate('maison', outlook(25), 4), [30]);
  assert.deepEqual(watch.evaluate('maison', outlook(5), 5), [15]);
  assert.deepEqual(watch.evaluate('maison', outlook(0), 6), [], 'raining: nothing new');
  assert.deepEqual(watch.evaluate('maison', outlook(null), 7), []);
  assert.deepEqual(watch.evaluate('maison', outlook(10), 8), [60, 30, 15], 'a sudden shower');
});

test('the first evaluation without a recent saved state is a baseline', () => {
  const fresh = createRainWatch();
  assert.deepEqual(fresh.evaluate('maison', outlook(10), 1_000), [], 'a restart during a shower');
  assert.deepEqual(fresh.evaluate('maison', outlook(10), 2_000), []);

  const stale = createRainWatch({ maison: { at: 0, active: { 60: false } } });
  assert.deepEqual(stale.evaluate('maison', outlook(10), 4 * 60 * MINUTE), []);

  const recent = createRainWatch(JSON.parse(JSON.stringify(fresh.toJSON())));
  assert.deepEqual(recent.evaluate('maison', outlook(null), 3_000), []);
  assert.deepEqual(recent.evaluate('maison', outlook(20), 4_000), [60, 30]);
});

test('without a minutely timeline, only the 60-minute window is evaluated', () => {
  const watch = createRainWatch({ maison: { at: 0, active: {} } });
  assert.deepEqual(watch.evaluate('maison', outlook(0, 'hourly'), 1), [60]);
  assert.deepEqual(watch.evaluate('maison', { source: null, minutesUntil: null }, 2), []);
});

test('rain announced in the minutely forecast fires the trigger with its details', async (t) => {
  let rainAt = null; // minute from now at which the rain starts
  const { gladys } = await createWorld(t, {
    routes: {
      forecast: () =>
        forecastAnswer({
          now: Date.now(),
          rain: (minute) => (rainAt !== null && minute >= rainAt ? 2.4 : 0),
        }),
    },
  });
  assert.equal(gladys.fake.sceneEvents.length, 0, 'dry, and the first reading is a baseline');
  assert.equal(gladys.fake.lastState(`${DEVICE}:rain-next-hour`), 0);

  rainAt = 40;
  await advance(t, 15);
  assert.deepEqual(gladys.fake.sceneEvents, [
    {
      key: RAIN_TRIGGER,
      data: {
        device: DEVICE,
        within: '60',
        place: 'Maison',
        minutes: 40,
        intensity: 2.4,
        probability: 80,
      },
    },
  ]);
  assert.equal(gladys.fake.lastState(`${DEVICE}:rain-next-hour`), 1);
  assert.equal(
    gladys.fake.lastState(`${DEVICE}:precipitation-next-hour`),
    0.8,
    '20 min × 2.4 mm/h',
  );

  rainAt = 12;
  await advance(t, 15);
  assert.deepEqual(
    gladys.fake.sceneEvents.slice(1).map((e) => [e.data.within, e.data.minutes]),
    [
      ['30', 12],
      ['15', 12],
    ],
  );
});

test('the fired windows survive a restart (no second alert for the same shower)', async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), 'tomorrow-io-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  let rainAt = null;
  const routes = {
    forecast: () =>
      forecastAnswer({ now: Date.now(), rain: (m) => (rainAt !== null && m >= rainAt ? 1 : 0) }),
  };
  const first = await createWorld(t, { dataDir, routes });
  rainAt = 20;
  await advance(t, 15);
  assert.equal(first.gladys.fake.sceneEvents.length, 2, '60 and 30');
  await first.app.whenIdle();
  first.app.stop();
  await first.gladys.disconnect();

  t.mock.timers.tick(5 * MINUTE);
  const second = await createWorld(t, { dataDir, routes, now: Date.now() });
  assert.equal(second.gladys.fake.sceneEvents.length, 0, 'the same shower, after a restart');
  rainAt = 10;
  await advance(t, 15);
  assert.deepEqual(
    second.gladys.fake.sceneEvents.map((e) => e.data.within),
    ['15'],
  );
});
