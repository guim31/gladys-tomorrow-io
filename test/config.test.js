// -----------------------------------------------------------------------------
// Configuration, places and quota planning.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, parseCoordinate } from '../src/config.js';
import { resolvePlaces } from '../src/places.js';
import { callsPerDay, createCallLedger, plannedIntervalMinutes } from '../src/quota.js';
import { HOUSES } from './helpers/world.js';

test('the configuration is normalized: blanks, strings and unknown values', () => {
  const config = normalizeConfig({
    api_key: '  key  ',
    refresh_minutes: '30',
    daily_limit: '1000',
    hourly_limit: 'lots',
    language: 'it',
    location_mode: 'nowhere',
    premium_layers: 'true',
  });
  assert.equal(config.api_key, 'key');
  assert.equal(config.refresh_minutes, 30);
  assert.equal(config.daily_limit, 1000);
  assert.equal(config.hourly_limit, 25);
  assert.equal(config.language, 'fr');
  assert.equal(config.location_mode, 'houses');
  assert.equal(config.premium_layers, true);
  assert.equal(normalizeConfig(null).api_key, '');
});

test('a coordinate accepts a comma, refuses text and out-of-range values', () => {
  assert.equal(parseCoordinate('48,8566', 90), 48.8566);
  assert.equal(parseCoordinate(' -3.7038 ', 180), -3.7038);
  assert.equal(parseCoordinate(2.35, 180), 2.35);
  assert.equal(parseCoordinate('91', 90), null);
  assert.equal(parseCoordinate('Paris', 90), null);
  assert.equal(parseCoordinate('', 90), null);
});

test('the places: located houses, the custom coordinates, or both', () => {
  const houses = resolvePlaces(normalizeConfig({ api_key: 'k' }), HOUSES);
  assert.deepEqual(
    houses.places.map((p) => p.key),
    ['house-maison'],
  );
  assert.deepEqual(houses.skipped, ['Chalet'], 'a house without a location is skipped');

  const both = resolvePlaces(
    normalizeConfig({
      location_mode: 'both',
      latitude: '45,764',
      longitude: '4,8357',
      language: 'de',
    }),
    HOUSES,
  );
  assert.deepEqual(
    both.places.map((p) => [p.key, p.name, p.latitude]),
    [
      ['house-maison', 'Maison', 48.8566],
      ['custom', 'Eigener Ort', 45.764],
    ],
  );

  const bad = resolvePlaces(
    normalizeConfig({ location_mode: 'coordinates', latitude: 'x' }),
    HOUSES,
  );
  assert.equal(bad.badCoordinates, true);
  assert.deepEqual(bad.places, []);
});

test('the planned interval keeps every place inside 90 % of the quota', () => {
  const free = normalizeConfig({ refresh_minutes: '15' });
  assert.equal(plannedIntervalMinutes(free, 1), 15);
  assert.equal(plannedIntervalMinutes(free, 2), 15);
  assert.equal(plannedIntervalMinutes(free, 3), 20, '6 calls: 500/day → 19.2 min');
  assert.equal(plannedIntervalMinutes(free, 4), 26);
  assert.equal(plannedIntervalMinutes({ ...free, premium_layers: true }, 2), 20);
  assert.equal(plannedIntervalMinutes({ ...free, premium_layers: true }, 2, false), 15);
  for (let places = 1; places <= 10; places += 1) {
    const minutes = plannedIntervalMinutes(free, places);
    assert.ok(callsPerDay(free, places, minutes) <= 500, `${places} places`);
    assert.ok((60 / minutes) * places * 2 <= 25, `${places} places, per hour`);
  }
});

test('the ledger counts the calls of the current UTC hour and day', () => {
  let now = Date.parse('2026-10-16T23:50:00Z');
  const ledger = createCallLedger({ now: () => now, calls: [now - 25 * 3_600_000, Number.NaN] });
  const config = normalizeConfig({ hourly_limit: 3, daily_limit: 4 });
  ledger.record(2);
  assert.equal(ledger.thisHour(), 2);
  assert.equal(ledger.canSpend(1, config), true);
  assert.equal(ledger.canSpend(2, config), false);
  now += 15 * 60_000; // 00:05 UTC: a new hour and a new day
  assert.equal(ledger.thisHour(), 0);
  assert.equal(ledger.today(), 0);
  assert.equal(ledger.toJSON().length, 2, 'kept 24 h for the restart');
  assert.equal(ledger.nextHour(), Date.parse('2026-10-17T01:00:00Z'));
});
