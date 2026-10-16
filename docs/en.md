# Tomorrow.io

Hyperlocal weather from [Tomorrow.io](https://www.tomorrow.io) in Gladys: current conditions, the
rain of the next hour minute by minute, the forecast of the next days and, with a paid plan, air
quality and pollen. One device per place, a "rain expected" scene trigger, a scene action that
reads the forecast, and two dashboard widgets.

This integration is not affiliated with Tomorrow.io. It was developed without a Tomorrow.io
account, from the official documentation and the published responses of the Home Assistant
integration: feedback welcome.

## Requirements

- Gladys 5.1.0 or later.
- A Tomorrow.io account (the free plan is enough) and its API key: sign in at
  [app.tomorrow.io](https://app.tomorrow.io/development/keys), **Development → API keys**.
- Internet access from Gladys: the integration calls `api.tomorrow.io`.

## Configuration

### API key and quota

Paste the key in **API key**, then press **Test the API key**: the answer gives the temperature
read, the number of places and the pace of the readings.

The free plan allows **500 calls a day** (reset at midnight UTC), **25 an hour** (reset at the top of
each hour) and 3 a second. Each reading of a place costs **2 calls** (current conditions, then the
forecast, which carries every timeline at once), 3 with the premium layers. The integration:

- reads only the places whose device was added to Gladys;
- stretches the **refresh interval** (15 minutes by default) so that every place fits in 90 % of the
  hourly and daily limits: 1 or 2 places every 15 minutes, 3 places every 20 minutes, 4 every
  26 minutes;
- counts its calls, keeps the count in `/data` across restarts, and pauses when a limit is reached.

With a paid plan, set **Calls allowed per day** and **per hour** to its limits.

### Places

**Places to read**: the houses of Gladys (default), the coordinates typed below, or both. A house is
read only once its location is set on its map in **Settings → Houses**. Coordinates are decimal
degrees, with a comma or a point (`48,8566` and `2,3522`); **Name of the place** names that device.

**Language** sets the names of the features (when the device is created) and the texts the
integration writes: the weather, the scene action summary. French by default.

## Devices

Open the **Discovery** tab and add the device of each place. Its states arrive at once, then at
every reading. Everything is read-only.

### Features

| Feature                 | Unit | Source                                                         |
| ----------------------- | ---- | -------------------------------------------------------------- |
| Temperature, Feels like | °C   | current conditions                                             |
| Humidity                | %    | current conditions                                             |
| Pressure                | hPa  | sea level, else surface                                        |
| Wind speed, Wind gusts  | km/h | current conditions                                             |
| Wind direction          | °    | where the wind comes from                                      |
| Cloud cover             | %    | current conditions                                             |
| Precipitation now       | mm/h | rain, snow, sleet and freezing rain together                   |
| Precipitation next hour | mm   | expected over the next 60 minutes (shown as mm/h: same number) |
| Rain within the hour    | 0/1  | at least one minute at 0.1 mm/h or more in the next 60 minutes |
| Chance of rain          | %    | the highest of the next hour                                   |
| Weather                 | text | Tomorrow.io weather code, translated                           |
| Visibility              | km   | current conditions                                             |
| UV index                |      | current conditions                                             |

The minute-by-minute forecast is used when the plan gives it; otherwise the hour in progress of the
hourly forecast (rain if 0.1 mm/h or more with a chance of 50 % or more).

### Premium layers: air quality and pollen

**Air quality and pollen (paid plan)** adds: EPA air quality index, PM2.5, PM10, ozone (µg/m³,
converted from ppb), tree, grass and weed pollen (0 none to 5 very high), and the fire index. These
layers are **not in the free plan**: with a plan that refuses them, the integration says so once in
its logs and asks again a day later; the other features keep working. Turning the option on or off
changes the structure of the device: press **Update** in the Discovery tab.

## Widgets

- **Tomorrow.io forecast**: the weather now (live temperature, feels like, wind, chance of rain), the
  next six days (temperatures, weather, chance of rain), the rain of the hour and, with the premium
  layers, air quality and pollen.
- **Rain next hour**: when the rain starts, a bar chart of the next 60 minutes, peak intensity and
  chance of rain. Without the minute-by-minute forecast, it says so and gives the hourly estimate.

Choose the place in the settings of the widget. Neither widget calls Tomorrow.io: they show the last
reading.

## Scene trigger

**Rain expected soon (Tomorrow.io)** starts a scene when rain will begin within **15, 30 or 60
minutes** at a place (or just began). Each window fires once per shower: a shower announced at 50
minutes fires "60", then "30" and "15" as it gets closer. It fires again only after the forecast has
been dry for that window. Variables: the place, the minutes before the rain, the peak intensity
(mm/h), the chance of rain (%).

A restart of the integration during a shower does not fire it again. Without the minute-by-minute
forecast, only the 60-minute window exists.

## Scene action

**Read the Tomorrow.io forecast** gives, for today or tomorrow at a place: a summary sentence, the
weather, the minimum and maximum temperatures and the chance of rain, for the next actions of the
scene. It uses the last reading: no call.

## Scene examples

- **Bring the washing in**: trigger "Rain expected soon", within 30 minutes → send a message
  "Rain in {{triggerEvent.data.minutes}} min at {{triggerEvent.data.place}}".
- **Close the skylight**: trigger "Rain expected soon", within 15 minutes → close the skylight (or
  the awning) device.
- **Morning forecast**: every day at 7:00 → "Read the Tomorrow.io forecast" (today) → send a message
  with the summary.
- **Pollen**: with the premium layers, a device trigger "Tree pollen" above 3 → notify the allergic
  members of the house.

## Troubleshooting

- **"Tomorrow.io refuses the API key"**: copy the key again from your account, without spaces. A new
  key can take a few minutes to work.
- **"Tomorrow.io quota reached"**: another application (Home Assistant…) may use the same key. The
  readings resume when the hour or the day resets; lower the number of places or create a key for
  Gladys.
- **No device in Discovery**: no house has a location, and no coordinates are typed. Set the location
  of the house on the map, or switch to coordinates.
- **"No recent value"**: check that the device was added, and the logs of the integration.
- More detail in the logs: set `LOG_LEVEL=debug`. The API key never appears in them.

## Limitations

- Developed without a Tomorrow.io account: the field names follow the official documentation and
  the Home Assistant fixtures; the first real use may reveal differences.
- Metric units only (°C, km/h, hPa, mm, km).
- A place costs 2 calls per reading: with the free plan, beyond 4 places the readings slow down to
  stay within the quota.
- Air quality, pollen and the fire index need a paid Tomorrow.io plan.
- The names of the features are set when the device is created: changing the language later does
  not rename them.
- No weather alerts: Gladys' own weather alert trigger needs a weather provider integration.
