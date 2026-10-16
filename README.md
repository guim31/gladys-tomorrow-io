# Tomorrow.io for Gladys Assistant

Hyperlocal weather from [Tomorrow.io](https://www.tomorrow.io) in
[Gladys Assistant](https://gladysassistant.com): current conditions, the rain of the next hour
minute by minute, the forecast of the next days and, with a paid Tomorrow.io plan, air quality
and pollen.

> **Developed without a Tomorrow.io account: feedback welcome.** The code follows the official
> Tomorrow.io v4 documentation and is tested against the real answers published by pytomorrowio
> and Home Assistant; `scripts/probe.mjs` checks it against the real API.

This integration is **not affiliated with Tomorrow.io**.

## Features

- **One device per place**: every house of Gladys placed on its map, the coordinates typed in the
  configuration, or both.
- **Weather now**: temperature, feels like, humidity, pressure, wind speed, gusts and direction,
  cloud cover, precipitation, visibility, UV index, and the weather in words.
- **Rain in the next hour**: expected precipitation, "rain within the hour" (yes/no) and the
  chance of rain, from the minute-by-minute forecast when the plan gives it.
- **Air quality and pollen** (paid plans): EPA index, PM2.5, PM10, ozone, tree, grass and weed
  pollen, fire index.
- **Scene trigger** "Rain expected soon": rain within 15, 30 or 60 minutes, once per shower.
- **Scene action** "Read the Tomorrow.io forecast": today's or tomorrow's summary for a message.
- **Dashboard widgets**: the forecast of the next six days; the rain of the next hour, minute by
  minute.
- Everything is read-only. English, French, German and Spanish.

## Requirements

- Gladys Assistant **5.1.0** or later.
- A Tomorrow.io account (the free plan is enough) and its API key, from
  [app.tomorrow.io](https://app.tomorrow.io/development/keys).
- Internet access from Gladys (`api.tomorrow.io`).

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and give
   `https://github.com/guim31/gladys-tomorrow-io`.
2. Paste the API key in the configuration and press **Test the API key**.
3. Open the **Discovery** tab and add the device of each place.

The full user documentation is in [English](docs/en.md), [French](docs/fr.md),
[German](docs/de.md) and [Spanish](docs/es.md).

## How it works

- **API**: `GET /v4/weather/realtime` (current conditions) and `GET /v4/weather/forecast` (the
  minutely, hourly and daily timelines of the plan, in one call), metric units. With the premium
  option, `POST /v4/timelines` with the air quality and pollen fields. The key travels in the
  `apikey` header, never in a URL.
- **Quota**: the free plan allows 500 calls a day and 25 an hour. A reading costs 2 calls per place
  (3 with the premium layers); the integration only reads the places added to Gladys, stretches the
  interval (15 minutes by default) to fit 90 % of both limits, counts its calls in `/data` across
  restarts, and pauses on a 429 until the window resets.
- **Refresh**: the container reads the places itself on its own timer, as the core does not poll
  external devices reliably (GladysAssistant/Gladys#3198); the core's poll is a fallback that skips
  a fresh place. Only changed values are published, every value at least every 6 hours.
- **Rain trigger**: each window (15, 30, 60 minutes) fires once when rain enters it and re-arms
  after a dry forecast; the state is kept in `/data` so a restart during a shower does not fire
  again.

## Limitations

- Developed without a Tomorrow.io account; the first real use may reveal differences in the answers.
- Metric units only.
- With the free plan, beyond 4 places the readings slow down to stay within the quota.
- Air quality, pollen and the fire index need a paid Tomorrow.io plan.
- Feature names are set when the device is created (a later language change does not rename them).
- No weather alerts: Gladys' weather alert trigger needs a weather provider integration.

## Development

Node.js 22+, ESM, no build step. The only runtime dependency is
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

```bash
npm install
npm test              # node --test, against the SDK's fake Gladys and a fake Tomorrow.io
npm run lint
npm run format:check
npx github:GladysAssistant/integration-store .   # store validator
```

```
index.js              SDK wiring (src/app.js registers the handlers)
src/app.js            places, refresh loop, states, trigger, scene action, widgets, Test action
src/tomorrow.js       Tomorrow.io v4 client (realtime, forecast, premium timelines)
src/model.js          answers -> readings, rain of the next hour, daily forecast
src/devices.js        place -> Gladys device and states
src/places.js         houses of Gladys and custom coordinates
src/quota.js          planned interval and call ledger
src/rain.js           "rain expected within N minutes" windows
src/widgets.js        "forecast" and "rain" dashboard widgets
src/i18n.js           texts in English, French, German and Spanish
scripts/probe.mjs     read-only probe of the real API (fake key: must be refused)
test/fixtures/        real Tomorrow.io answers (pytomorrowio, Home Assistant)
```

`test/gladys-rules.test.js` checks every discovered device against the category/type table
extracted from the Gladys core.

To probe the real API (2 calls of the key's quota, the key is never printed):

```bash
node scripts/probe.mjs                                  # a fake key: must be refused
TOMORROW_API_KEY=<key> node scripts/probe.mjs 48.85 2.35 --premium
```

Releases are made by the **Release** workflow (Actions → Release); never edit the versions by
hand. A hand-pushed `vX.Y.Z` tag also builds the image and the GitHub Release, but then `version`
in `package.json` and in the manifest (with the `docker_image` tag) must be bumped and committed
before tagging. See [`CLAUDE.md`](CLAUDE.md) for the project rules.

## Credits

- [raman325/pytomorrowio](https://github.com/raman325/pytomorrowio) (MIT): the Tomorrow.io v4
  client of Home Assistant; its real API answers are the test fixtures, its weather code list the
  translations.
- The [Home Assistant `tomorrowio` integration](https://www.home-assistant.io/integrations/tomorrowio/)
  (Apache 2.0): the quota-based update interval, and its test fixture.
- [Gladys Assistant](https://gladysassistant.com) and its
  [integration SDK](https://github.com/GladysAssistant/integration-sdk-js).

## Disclaimer

Tomorrow.io is a trademark of its owner. This project is not affiliated with,
endorsed by or sponsored by Tomorrow.io. Weather data © Tomorrow.io.

## License

[Apache-2.0](LICENSE)
