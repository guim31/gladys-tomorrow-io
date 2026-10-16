#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Probe of the real Tomorrow.io API, read-only, through the integration's own
// client (src/tomorrow.js) and parser (src/model.js).
//
//   node scripts/probe.mjs                       a fake key: must be refused
//   TOMORROW_API_KEY=… node scripts/probe.mjs    a real key: reads one place
//   … node scripts/probe.mjs 48.8566 2.3522      another place
//   … node scripts/probe.mjs --premium           also asks the premium layers
//
// It prints the shapes and the classified errors, never the key, and spends
// 2 calls (3 with --premium) of the key's quota. Nothing is written.
// -----------------------------------------------------------------------------

import { createTomorrowClient } from '../src/tomorrow.js';
import { buildSnapshot, currentReadings, rainOutlook } from '../src/model.js';

const args = process.argv.slice(2);
const premium = args.includes('--premium');
const [latitude = 48.8566, longitude = 2.3522] = args
  .filter((arg) => !arg.startsWith('--'))
  .map(Number);
const realKey = process.env.TOMORROW_API_KEY;
const apiKey = realKey || 'gladys-probe-fake-key-0000000000';
const place = { latitude, longitude };
const client = createTomorrowClient();

const line = (label, value) => console.log(`${label.padEnd(22)} ${value}`);
const describe = (err) =>
  `${err.kind ?? 'error'}: ${err.message}${err.code ? ` [code ${err.code}]` : ''}`;

console.log(`Tomorrow.io probe, ${realKey ? 'key from TOMORROW_API_KEY' : 'FAKE key'}`);
line('place', `${latitude},${longitude}`);

let realtime = null;
try {
  realtime = await client.realtime(apiKey, place);
  line('realtime', `ok, values: ${Object.keys(realtime.data.values).sort().join(', ')}`);
} catch (err) {
  line('realtime', describe(err));
  if (!realKey) {
    console.log(
      err.kind === 'auth'
        ? 'Expected: the fake key is refused, and classified as such.'
        : 'UNEXPECTED: a fake key should be refused with 401/403.',
    );
  }
  process.exit(err.kind === 'auth' && !realKey ? 0 : 1);
}

let forecast = null;
try {
  forecast = await client.forecast(apiKey, place);
  for (const [name, list] of Object.entries(forecast.timelines)) {
    const first = list?.[0];
    line(
      `forecast ${name}`,
      `${list?.length ?? 0} entries from ${first?.time}, values: ${Object.keys(first?.values ?? {})
        .sort()
        .join(', ')}`,
    );
  }
} catch (err) {
  line('forecast', describe(err));
}

let layers = null;
if (premium) {
  try {
    layers = await client.premium(apiKey, place);
    line('premium', `ok: ${JSON.stringify(layers.data.timelines[0]?.intervals?.[0]?.values)}`);
  } catch (err) {
    line('premium', describe(err));
  }
}

const snapshot = buildSnapshot({ realtime, forecast, premium: layers, fetchedAt: Date.now() });
line('readings', JSON.stringify(currentReadings(snapshot)));
const outlook = rainOutlook(snapshot);
line('rain outlook', JSON.stringify({ ...outlook, points: outlook.points.length }));
