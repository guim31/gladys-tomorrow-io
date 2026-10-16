// -----------------------------------------------------------------------------
// Dashboard widgets, the scene action and the "Test" action, through the
// fake Gladys: every content fits the core vocabulary and budget
// (validateWidgetContent), and every live tile targets a real feature.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createWorld } from './helpers/world.js';
import { ERRORS, forecastAnswer } from './helpers/tomorrowFixtures.js';

const LANGS = ['en', 'fr', 'de', 'es'];
const DEVICE = 'ext:test-integration:place:house-maison';

async function widget(gladys, key, language, device = DEVICE) {
  const ack = await gladys.fake.widgetGet(key, {
    settings: { device },
    language,
    units: 'metric',
  });
  assert.equal(ack.success, true, ack.error);
  return ack.data.content;
}

function assertFits(content, features, where) {
  assert.deepEqual(validateWidgetContent(content), [], where);
  for (const component of content.components) {
    if (component.device_feature) {
      assert.ok(features.has(component.device_feature), `${where}: ${component.device_feature}`);
    }
  }
}

const featureIds = (gladys) =>
  new Set(gladys.fake.discoveredDevices.flatMap((d) => d.features.map((f) => f.external_id)));

for (const premium of [false, true]) {
  test(`both widgets fit the core budget in every language (premium: ${premium})`, async (t) => {
    const { gladys } = await createWorld(t, {
      config: { premium_layers: premium },
      routes: {
        forecast: () => forecastAnswer({ now: Date.now(), rain: (m) => (m > 20 ? 3 : 0) }),
      },
    });
    const features = featureIds(gladys);
    for (const language of LANGS) {
      const forecast = await widget(gladys, 'forecast', language);
      assertFits(forecast, features, `forecast/${language}`);
      const rows = forecast.components.find((c) => c.type === 'status').items;
      assert.equal(rows.length, premium ? 5 : 1, 'rain, then air quality and three pollens');
      const days = forecast.components.find((c) => c.type === 'card-list');
      assert.equal(days.items.length, 6);

      const rain = await widget(gladys, 'rain', language);
      assertFits(rain, features, `rain/${language}`);
      const chart = rain.components.find((c) => c.type === 'chart');
      assert.equal(chart.series[0].points.length, 60);
    }
    const rain = await widget(gladys, 'rain', 'fr');
    assert.equal(rain.components[0].text, 'Pluie dans 21 min');
  });
}

test('without the minutely timeline, the rain widget says so', async (t) => {
  const { gladys } = await createWorld(t, {
    routes: { forecast: () => forecastAnswer({ now: Date.now(), minutely: false }) },
  });
  const content = await widget(gladys, 'rain', 'de');
  assertFits(content, featureIds(gladys), 'rain without minutely');
  assert.ok(content.components.every((c) => c.type !== 'chart'));
  assert.match(content.components.find((c) => c.variant === 'body').text, /Minutenprognose/);
});

test('a widget without a place or without data gives a sentence', async (t) => {
  const { gladys } = await createWorld(t, { routes: { realtime: () => ERRORS.invalidKey } });
  const none = await widget(gladys, 'forecast', 'es', null);
  assert.match(none.components[0].text, /Elija un lugar/);
  const empty = await widget(gladys, 'rain', 'en');
  assert.match(empty.components[0].text, /No forecast yet/);
  assert.deepEqual(validateWidgetContent(empty), []);
});

test('the scene action reads the forecast of today or tomorrow, without a call', async (t) => {
  const { gladys, tomorrow } = await createWorld(t);
  const calls = tomorrow.calls.length;
  const ack = await gladys.fake.sceneAction('get_forecast', { device: DEVICE, day: 'tomorrow' });
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(ack.data.outputs, {
    summary: 'Demain : Ciel dégagé, de 18 à 28 °C, 15 % de risque de pluie.',
    condition: 'Ciel dégagé',
    temperature_min: 18.4,
    temperature_max: 27.5,
    precipitation_probability: 15,
  });
  const today = await gladys.fake.sceneAction('get_forecast', { device: DEVICE, day: 'today' });
  assert.match(today.data.outputs.summary, /^Aujourd'hui : /);
  assert.equal(tomorrow.calls.length, calls);

  const unknown = await gladys.fake.sceneAction('get_forecast', {
    device: 'ext:x:y',
    day: 'today',
  });
  assert.equal(unknown.success, false);
});

test('the Test action checks the key with one call and reports the pace', async (t) => {
  const { gladys, tomorrow, lines } = await createWorld(t);
  const before = tomorrow.calls.length;
  const ack = await gladys.fake.action('test_connection', {});
  assert.equal(tomorrow.calls.length, before + 1);
  assert.equal(
    ack.data.message.fr,
    'Clé acceptée : 23,6 °C à Maison. 1 lieu(x), un relevé toutes les 15 min (192 appels par jour).',
  );
  assert.match(ack.data.message.en, /23\.6 °C/);
  assert.equal(
    lines.filter((l) => l.includes('Action: test')).length,
    1,
    'one line per user action',
  );

  tomorrow.routes.realtime = ERRORS.invalidKey;
  const refused = await gladys.fake.action('test_connection', {});
  assert.match(refused.data.message.de, /lehnt den API-Schlüssel ab/);
});

test('without a key, nothing is read and the Configuration screen says what to do', async (t) => {
  const { gladys, tomorrow } = await createWorld(t, { config: { api_key: '' } });
  assert.equal(tomorrow.calls.length, 0);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /clé d'API/);
  const ack = await gladys.fake.action('test_connection', {});
  assert.match(ack.data.message.en, /Enter your Tomorrow\.io API key/);
});
