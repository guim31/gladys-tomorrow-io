// -----------------------------------------------------------------------------
// The Tomorrow.io client: requests and error classification.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTomorrowClient, formatLocation, PREMIUM_FIELDS } from '../src/tomorrow.js';
import { createFakeTomorrow } from './helpers/world.js';
import { ERRORS } from './helpers/tomorrowFixtures.js';

const PLACE = { latitude: 48.85661234, longitude: -2.3522 };

async function failure(promise) {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  assert.fail('expected a failure');
}

test('the location has four decimals', () => {
  assert.equal(formatLocation(PLACE), '48.8566,-2.3522');
});

test('the premium call asks the premium fields in the current timestep', async () => {
  const fake = createFakeTomorrow();
  const client = createTomorrowClient({ fetch: fake.fetch });
  await client.premium('key', PLACE);
  assert.deepEqual(fake.calls[0].body, {
    location: '48.8566,-2.3522',
    fields: PREMIUM_FIELDS,
    timesteps: ['current'],
    units: 'metric',
  });
  assert.equal(fake.calls[0].headers['content-type'], 'application/json');
});

test('the errors are classified by what the integration does about them', async () => {
  const client = (routes) => createTomorrowClient({ fetch: createFakeTomorrow(routes).fetch });

  const auth = await failure(client({ realtime: ERRORS.invalidKey }).realtime('key', PLACE));
  assert.equal(auth.kind, 'auth');
  assert.equal(
    auth.message,
    'HTTP 401 (Invalid Auth: The method requires authentication but it was not presented or is invalid.)',
  );

  const forbidden = await failure(client({ forecast: ERRORS.planRefused }).forecast('key', PLACE));
  assert.equal(forbidden.kind, 'auth', 'a 403 on a core endpoint is the key');
  const plan = await failure(client({ premium: ERRORS.planRefused }).premium('key', PLACE));
  assert.equal(plan.kind, 'plan', 'a 403 on the premium layers is the plan');

  const rate = await failure(
    client({ realtime: { ...ERRORS.rateLimited, headers: { 'retry-after': '120' } } }).realtime(
      'key',
      PLACE,
    ),
  );
  assert.equal(rate.kind, 'rate');
  assert.equal(rate.retryAfterMs, 120_000);

  const down = await failure(
    client({ realtime: new TypeError('fetch failed') }).realtime('key', PLACE),
  );
  assert.equal(down.kind, 'network');

  const html = await failure(
    client({ realtime: { status: 502, body: '<html>' } }).realtime('key', PLACE),
  );
  assert.equal(html.kind, 'api');
  assert.match(html.message, /^HTTP 502/);

  const empty = await failure(client({ realtime: {} }).realtime('key', PLACE));
  assert.equal(empty.kind, 'api');
  const noTimelines = await failure(client({ forecast: { data: {} } }).forecast('key', PLACE));
  assert.equal(noTimelines.kind, 'api');
});
