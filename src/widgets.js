// -----------------------------------------------------------------------------
// Dashboard widgets (Gladys 5.1+): pure builders of the content, from the
// last reading of a place. Nothing here calls Tomorrow.io.
//
//   forecast  the weather now (live tiles), the next days, the rain of the
//             hour and, with the premium layers, air quality and pollen
//   rain      the minute-by-minute precipitation of the next hour
//
// The core budget: 8 components, 1 focal (chart | card-list), 6 tiles, 2
// texts (1 body), 1 status. Each builder stays within it — the tests run the
// SDK's validateWidgetContent on every content.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { placeIds } from './devices.js';
import { conditionText, FEATURE_NAMES, pick, POLLEN_LEVELS, TEXT } from './i18n.js';
import { currentReadings, dailyForecast, rainOutlook } from './model.js';

export const WIDGET = { FORECAST: 'forecast', RAIN: 'rain' };

// The data moves every refresh (15 min at best); the container also nudges
// the core after each refresh.
const TTL_SECONDS = 600;
const MAX_DAYS = 6;

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** A content made of one sentence: not configured, no place chosen… */
export function messageContent(text) {
  return { ttl_seconds: 60, components: [{ type: 'text', variant: 'body', text }] };
}

function formatTime(time, language) {
  return new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(time);
}

function formatNumber(value, language, digits = 0) {
  return new Intl.NumberFormat(language, { maximumFractionDigits: digits }).format(value);
}

/** "Rain in 12 min", "Raining now", "No rain within the hour". */
export function rainSentence(outlook, language) {
  if (outlook.minutesUntil === null) {
    return pick(TEXT.noRain, language);
  }
  if (outlook.minutesUntil === 0) {
    return pick(TEXT.rainNow, language);
  }
  return pick(TEXT.rainSoon, language)(outlook.minutesUntil);
}

function updatedCaption(snapshot, language) {
  return {
    type: 'text',
    variant: 'caption',
    text: pick(TEXT.updated, language)(formatTime(snapshot.fetchedAt, language)),
  };
}

function pollenValue(level, language) {
  const levels = pick(POLLEN_LEVELS, language);
  return levels[level] ?? String(level);
}

export function buildForecastContent({ gladys, place, snapshot, language, premium }) {
  const ids = placeIds(gladys, place);
  const names = pick(FEATURE_NAMES, language);
  const readings = currentReadings(snapshot);
  const outlook = rainOutlook(snapshot);

  const heading = [place.name];
  if (readings.condition !== null) {
    heading.push(conditionText(readings.condition, language));
  }

  const tile = (key) => ({
    type: 'value',
    label: truncate(names[key], 24),
    device_feature: ids.feature(key),
  });

  const weekday = new Intl.DateTimeFormat(language, { weekday: 'short', day: 'numeric' });
  const items = [];
  for (let offset = 0; offset < MAX_DAYS; offset += 1) {
    const day = dailyForecast(snapshot, offset);
    if (!day) {
      break;
    }
    const range =
      day.min !== null && day.max !== null
        ? ` · ${formatNumber(day.min, language)}° / ${formatNumber(day.max, language)}°`
        : '';
    items.push({
      title: truncate(`${weekday.format(day.time)}${range}`, 60),
      subtitle: conditionText(day.code, language),
      ...(day.probability !== null
        ? {
            badge: {
              text: `☂ ${day.probability} %`,
              color: day.probability >= 50 ? WIDGET_COLORS.INFO : WIDGET_COLORS.NEUTRAL,
            },
          }
        : {}),
    });
  }

  const rows = [];
  if (outlook.source !== null) {
    rows.push({
      label: pick(TEXT.rain, language),
      value: truncate(rainSentence(outlook, language), 40),
      icon: 'umbrella',
      color: outlook.minutesUntil === null ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.INFO,
    });
  }
  if (premium) {
    if (readings.aqi !== null) {
      rows.push({
        label: pick(TEXT.airQuality, language),
        value: readings.aqi,
        icon: 'wind',
        color:
          readings.aqi <= 50
            ? WIDGET_COLORS.SUCCESS
            : readings.aqi <= 100
              ? WIDGET_COLORS.WARNING
              : WIDGET_COLORS.DANGER,
      });
    }
    for (const [key, label] of [
      ['pollen-tree', TEXT.pollenTree],
      ['pollen-grass', TEXT.pollenGrass],
      ['pollen-weed', TEXT.pollenWeed],
    ]) {
      if (readings[key] !== null) {
        rows.push({
          label: pick(label, language),
          value: pollenValue(readings[key], language),
          icon: 'feather',
          color:
            readings[key] <= 2
              ? WIDGET_COLORS.SUCCESS
              : readings[key] === 3
                ? WIDGET_COLORS.WARNING
                : WIDGET_COLORS.DANGER,
        });
      }
    }
  }

  const components = [
    { type: 'text', variant: 'heading', text: truncate(heading.join(' · '), 40) },
    tile('temperature'),
    tile('apparent-temperature'),
    tile('wind-speed'),
    tile('precipitation-probability'),
  ];
  if (items.length > 0) {
    components.push({ type: 'card-list', display: 'grid', items });
  }
  if (rows.length > 0) {
    components.push({ type: 'status', items: rows });
  }
  components.push(updatedCaption(snapshot, language));
  return { ttl_seconds: TTL_SECONDS, components };
}

export function buildRainContent({ gladys, place, snapshot, language }) {
  const ids = placeIds(gladys, place);
  const outlook = rainOutlook(snapshot);
  const components = [
    { type: 'text', variant: 'heading', text: truncate(rainSentence(outlook, language), 40) },
    {
      type: 'value',
      label: pick(TEXT.nextHour, language),
      device_feature: ids.feature('precipitation-next-hour'),
    },
  ];
  if (outlook.source === 'minutely') {
    components.push({
      type: 'chart',
      chart_type: 'bar',
      unit: 'mm/h',
      series: [{ name: pick(TEXT.rain, language), points: outlook.points }],
    });
  } else {
    components.push({ type: 'text', variant: 'body', text: pick(TEXT.hourlyOnly, language) });
  }
  const rows = [];
  if (outlook.maxIntensity !== null) {
    rows.push({
      label: pick(TEXT.maxIntensity, language),
      value: `${formatNumber(outlook.maxIntensity, language, 1)} mm/h`,
      icon: 'cloud-rain',
      color: outlook.maxIntensity >= 4 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.INFO,
    });
  }
  if (outlook.probability !== null) {
    rows.push({
      label: pick(TEXT.probability, language),
      value: `${Math.round(outlook.probability)} %`,
      icon: 'umbrella',
      color: WIDGET_COLORS.NEUTRAL,
    });
  }
  if (rows.length > 0) {
    components.push({ type: 'status', items: rows });
  }
  // Two texts at most: the caption only when the body sentence is not there.
  if (outlook.source === 'minutely') {
    components.push(updatedCaption(snapshot, language));
  }
  return { ttl_seconds: TTL_SECONDS, components };
}
