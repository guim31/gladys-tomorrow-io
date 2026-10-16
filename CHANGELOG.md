# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.1] - 2026-10-16

### Added

- One Gladys device per place, read from the Tomorrow.io v4 Weather API: the
  located houses of Gladys, coordinates typed in the configuration, or both.
- Temperature, feels like, humidity, pressure, wind speed, gusts and direction,
  cloud cover, precipitation now and over the next hour, rain within the hour,
  chance of rain, the weather in words, visibility and UV index.
- Air quality (EPA index, PM2.5, PM10, ozone), tree, grass and weed pollen and
  the fire index, for the paid Tomorrow.io plans that include them.
- Readings every 15 minutes by default, stretched to stay within the free plan
  quota (500 calls a day, 25 an hour); the calls are counted across restarts.
- A "Rain expected soon" scene trigger: rain within 15, 30 or 60 minutes, once
  per shower, with the minutes before the rain and its intensity.
- A "Read the Tomorrow.io forecast" scene action: today's or tomorrow's
  summary, temperatures and chance of rain.
- Two dashboard widgets: the forecast of the next days, and the rain of the
  next hour minute by minute.
- A "Test the API key" button in the configuration.
- Every text in English, French, German and Spanish, and the documentation in
  the four languages.

[Unreleased]: https://github.com/guim31/gladys-tomorrow-io/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/guim31/gladys-tomorrow-io/releases/tag/v1.0.1
