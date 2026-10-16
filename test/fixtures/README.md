# Test fixtures

## `gladys-feature-table.json`

The category/type couples, units and poll frequencies the Gladys core and its
front know, extracted from the Gladys code (see its `source` field). Read by
`test/gladys-rules.test.js`.

## `pytomorrowio/`

Real Tomorrow.io v4 **Timelines API** answers, copied from the tests of
[raman325/pytomorrowio](https://github.com/raman325/pytomorrowio) (MIT
License, © 2020 raman325), in imperial units:

- `timelines_realtime.json`, `timelines_1hour.json`, `timelines_1day.json`:
  verbatim;
- `timelines_1min_first_hour.json`: the first 61 intervals of
  `timelines_1min.json` (the file has 361), nothing else changed.

## `home-assistant/v4_current.json`

The `current` block of `tests/components/tomorrowio/fixtures/v4.json` of
[Home Assistant](https://github.com/home-assistant/core) (Apache License 2.0):
the values pytomorrowio returned for a real call, with the air quality fields
the pytomorrowio fixtures lack.

## How the tests use them

`test/helpers/tomorrowFixtures.js` reads these files and builds the **Weather
API** answers (`/weather/realtime`, `/weather/forecast`) the integration
calls: the same values converted to metric, laid out in the documented Weather
API shape (`data.values`, `timelines.minutely[] = { time, values }`, the
precipitation split in `rainIntensity`, `snowIntensity`…), and shifted to the
test's clock. No real Weather API answer was available (no account, the
session network blocks `api.tomorrow.io`): `scripts/probe.mjs` checks the
shape against the real API.

The error bodies (`401001 Invalid Auth`, `429001 Too Many Calls`) follow the
`{ code, type, message }` format of the Tomorrow.io documentation; the body of
a refused premium layer (`403`) is an assumption, and the integration only
relies on the HTTP status.
