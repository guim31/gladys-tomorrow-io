// -----------------------------------------------------------------------------
// Every text the container produces, in the four languages of the Gladys
// interface. German says "du", Spanish "usted" (test/i18n.test.js checks the
// tables). The language is the `language` field of the configuration (a
// device integration does not receive the user's language), except in the
// widgets, which receive it from the core.
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';

/** Pick the text of a multi-language object, French when unknown. */
export function pick(text, language) {
  return text[LANGUAGES.includes(language) ? language : 'fr'] ?? text.en;
}

/** Build a multi-language object from a function of the language. */
export function each(build) {
  return Object.fromEntries(LANGUAGES.map((lang) => [lang, build(lang)]));
}

// Feature names, written at device creation (frozen afterwards).
export const FEATURE_NAMES = {
  en: {
    temperature: 'Temperature',
    'apparent-temperature': 'Feels like',
    humidity: 'Humidity',
    pressure: 'Pressure',
    'wind-speed': 'Wind speed',
    'wind-gust': 'Wind gusts',
    'wind-direction': 'Wind direction',
    'cloud-cover': 'Cloud cover',
    precipitation: 'Precipitation now',
    'precipitation-next-hour': 'Precipitation next hour',
    'rain-next-hour': 'Rain within the hour',
    'precipitation-probability': 'Chance of rain',
    condition: 'Weather',
    visibility: 'Visibility',
    'uv-index': 'UV index',
    pm25: 'PM2.5',
    pm10: 'PM10',
    ozone: 'Ozone',
    aqi: 'Air quality (EPA)',
    'pollen-tree': 'Tree pollen',
    'pollen-grass': 'Grass pollen',
    'pollen-weed': 'Weed pollen',
    'fire-index': 'Fire index',
  },
  fr: {
    temperature: 'Température',
    'apparent-temperature': 'Ressenti',
    humidity: 'Humidité',
    pressure: 'Pression',
    'wind-speed': 'Vitesse du vent',
    'wind-gust': 'Rafales',
    'wind-direction': 'Direction du vent',
    'cloud-cover': 'Nébulosité',
    precipitation: 'Précipitations actuelles',
    'precipitation-next-hour': "Précipitations dans l'heure",
    'rain-next-hour': "Pluie dans l'heure",
    'precipitation-probability': 'Probabilité de pluie',
    condition: 'Temps',
    visibility: 'Visibilité',
    'uv-index': 'Indice UV',
    pm25: 'PM2,5',
    pm10: 'PM10',
    ozone: 'Ozone',
    aqi: "Qualité de l'air (EPA)",
    'pollen-tree': 'Pollens des arbres',
    'pollen-grass': 'Pollens des graminées',
    'pollen-weed': 'Pollens des herbacées',
    'fire-index': "Indice d'incendie",
  },
  de: {
    temperature: 'Temperatur',
    'apparent-temperature': 'Gefühlte Temperatur',
    humidity: 'Luftfeuchtigkeit',
    pressure: 'Luftdruck',
    'wind-speed': 'Windgeschwindigkeit',
    'wind-gust': 'Windböen',
    'wind-direction': 'Windrichtung',
    'cloud-cover': 'Bewölkung',
    precipitation: 'Niederschlag aktuell',
    'precipitation-next-hour': 'Niederschlag nächste Stunde',
    'rain-next-hour': 'Regen innerhalb einer Stunde',
    'precipitation-probability': 'Regenwahrscheinlichkeit',
    condition: 'Wetter',
    visibility: 'Sichtweite',
    'uv-index': 'UV-Index',
    pm25: 'PM2,5',
    pm10: 'PM10',
    ozone: 'Ozon',
    aqi: 'Luftqualität (EPA)',
    'pollen-tree': 'Baumpollen',
    'pollen-grass': 'Gräserpollen',
    'pollen-weed': 'Kräuterpollen',
    'fire-index': 'Waldbrandindex',
  },
  es: {
    temperature: 'Temperatura',
    'apparent-temperature': 'Sensación térmica',
    humidity: 'Humedad',
    pressure: 'Presión',
    'wind-speed': 'Velocidad del viento',
    'wind-gust': 'Ráfagas',
    'wind-direction': 'Dirección del viento',
    'cloud-cover': 'Nubosidad',
    precipitation: 'Precipitación actual',
    'precipitation-next-hour': 'Precipitación próxima hora',
    'rain-next-hour': 'Lluvia en la próxima hora',
    'precipitation-probability': 'Probabilidad de lluvia',
    condition: 'Tiempo',
    visibility: 'Visibilidad',
    'uv-index': 'Índice UV',
    pm25: 'PM2,5',
    pm10: 'PM10',
    ozone: 'Ozono',
    aqi: 'Calidad del aire (EPA)',
    'pollen-tree': 'Polen de árboles',
    'pollen-grass': 'Polen de gramíneas',
    'pollen-weed': 'Polen de malezas',
    'fire-index': 'Índice de incendio',
  },
};

// Tomorrow.io weather codes (`weatherCode`, same list as pytomorrowio).
export const WEATHER_CODES = {
  en: {
    0: 'Unknown',
    1000: 'Clear',
    1100: 'Mostly clear',
    1101: 'Partly cloudy',
    1102: 'Mostly cloudy',
    1001: 'Cloudy',
    2000: 'Fog',
    2100: 'Light fog',
    3000: 'Light wind',
    3001: 'Wind',
    3002: 'Strong wind',
    4000: 'Drizzle',
    4001: 'Rain',
    4200: 'Light rain',
    4201: 'Heavy rain',
    5000: 'Snow',
    5001: 'Flurries',
    5100: 'Light snow',
    5101: 'Heavy snow',
    6000: 'Freezing drizzle',
    6001: 'Freezing rain',
    6200: 'Light freezing rain',
    6201: 'Heavy freezing rain',
    7000: 'Ice pellets',
    7101: 'Heavy ice pellets',
    7102: 'Light ice pellets',
    8000: 'Thunderstorm',
  },
  fr: {
    0: 'Inconnu',
    1000: 'Ciel dégagé',
    1100: 'Plutôt dégagé',
    1101: 'Partiellement nuageux',
    1102: 'Plutôt nuageux',
    1001: 'Couvert',
    2000: 'Brouillard',
    2100: 'Brume',
    3000: 'Vent faible',
    3001: 'Vent',
    3002: 'Vent fort',
    4000: 'Bruine',
    4001: 'Pluie',
    4200: 'Pluie faible',
    4201: 'Forte pluie',
    5000: 'Neige',
    5001: 'Averses de neige',
    5100: 'Neige faible',
    5101: 'Forte neige',
    6000: 'Bruine verglaçante',
    6001: 'Pluie verglaçante',
    6200: 'Pluie verglaçante faible',
    6201: 'Forte pluie verglaçante',
    7000: 'Grésil',
    7101: 'Fort grésil',
    7102: 'Grésil faible',
    8000: 'Orage',
  },
  de: {
    0: 'Unbekannt',
    1000: 'Klar',
    1100: 'Überwiegend klar',
    1101: 'Teilweise bewölkt',
    1102: 'Überwiegend bewölkt',
    1001: 'Bedeckt',
    2000: 'Nebel',
    2100: 'Leichter Nebel',
    3000: 'Leichter Wind',
    3001: 'Wind',
    3002: 'Starker Wind',
    4000: 'Nieselregen',
    4001: 'Regen',
    4200: 'Leichter Regen',
    4201: 'Starker Regen',
    5000: 'Schnee',
    5001: 'Schneeschauer',
    5100: 'Leichter Schneefall',
    5101: 'Starker Schneefall',
    6000: 'Gefrierender Nieselregen',
    6001: 'Gefrierender Regen',
    6200: 'Leichter gefrierender Regen',
    6201: 'Starker gefrierender Regen',
    7000: 'Eiskörner',
    7101: 'Starke Eiskörner',
    7102: 'Leichte Eiskörner',
    8000: 'Gewitter',
  },
  es: {
    0: 'Desconocido',
    1000: 'Despejado',
    1100: 'Mayormente despejado',
    1101: 'Parcialmente nublado',
    1102: 'Mayormente nublado',
    1001: 'Nublado',
    2000: 'Niebla',
    2100: 'Neblina',
    3000: 'Viento suave',
    3001: 'Viento',
    3002: 'Viento fuerte',
    4000: 'Llovizna',
    4001: 'Lluvia',
    4200: 'Lluvia débil',
    4201: 'Lluvia fuerte',
    5000: 'Nieve',
    5001: 'Chubascos de nieve',
    5100: 'Nieve débil',
    5101: 'Nieve fuerte',
    6000: 'Llovizna helada',
    6001: 'Lluvia helada',
    6200: 'Lluvia helada débil',
    6201: 'Lluvia helada fuerte',
    7000: 'Granizo menudo',
    7101: 'Granizo menudo fuerte',
    7102: 'Granizo menudo débil',
    8000: 'Tormenta',
  },
};

/** The text of a weather code; an unknown code says "Unknown". */
export function conditionText(code, language) {
  const table = pick(WEATHER_CODES, language);
  return table[code] ?? table[0];
}

// Tomorrow.io pollen index, 0 to 5.
export const POLLEN_LEVELS = {
  en: ['None', 'Very low', 'Low', 'Medium', 'High', 'Very high'],
  fr: ['Aucun', 'Très faible', 'Faible', 'Moyen', 'Élevé', 'Très élevé'],
  de: ['Keine', 'Sehr gering', 'Gering', 'Mittel', 'Hoch', 'Sehr hoch'],
  es: ['Ninguno', 'Muy bajo', 'Bajo', 'Medio', 'Alto', 'Muy alto'],
};

// Short texts of the widgets and of the scene action summary.
export const TEXT = {
  customPlace: {
    en: 'Custom place',
    fr: 'Lieu personnalisé',
    de: 'Eigener Ort',
    es: 'Lugar personalizado',
  },
  noRain: {
    en: 'No rain within the hour',
    fr: "Pas de pluie dans l'heure",
    de: 'Kein Regen in der nächsten Stunde',
    es: 'Sin lluvia en la próxima hora',
  },
  rainNow: { en: 'Raining now', fr: 'Il pleut', de: 'Es regnet', es: 'Está lloviendo' },
  rainSoon: {
    en: (m) => `Rain in ${m} min`,
    fr: (m) => `Pluie dans ${m} min`,
    de: (m) => `Regen in ${m} Min.`,
    es: (m) => `Lluvia en ${m} min`,
  },
  nextHour: { en: 'Next hour', fr: "Dans l'heure", de: 'Nächste Stunde', es: 'Próxima hora' },
  rain: { en: 'Rain', fr: 'Pluie', de: 'Regen', es: 'Lluvia' },
  maxIntensity: {
    en: 'Peak intensity',
    fr: 'Intensité max.',
    de: 'Max. Intensität',
    es: 'Intensidad máx.',
  },
  probability: {
    en: 'Chance of rain',
    fr: 'Probabilité',
    de: 'Wahrscheinlichkeit',
    es: 'Probabilidad',
  },
  hourlyOnly: {
    en: 'Your Tomorrow.io plan gives no minute-by-minute forecast: hourly estimate.',
    fr: "Votre offre Tomorrow.io ne donne pas la prévision minute par minute : estimation à l'heure.",
    de: 'Dein Tomorrow.io-Tarif liefert keine Minutenprognose: stündliche Schätzung.',
    es: 'Su plan de Tomorrow.io no ofrece previsión por minuto: estimación por hora.',
  },
  updated: {
    en: (t) => `Updated at ${t} · Tomorrow.io`,
    fr: (t) => `Mis à jour à ${t} · Tomorrow.io`,
    de: (t) => `Aktualisiert um ${t} · Tomorrow.io`,
    es: (t) => `Actualizado a las ${t} · Tomorrow.io`,
  },
  pickDevice: {
    en: 'Choose a Tomorrow.io place in the widget settings.',
    fr: 'Choisissez un lieu Tomorrow.io dans les réglages du widget.',
    de: 'Wähle einen Tomorrow.io-Ort in den Widget-Einstellungen.',
    es: 'Elija un lugar de Tomorrow.io en los ajustes del widget.',
  },
  noData: {
    en: 'No forecast yet: check the API key in the integration settings.',
    fr: "Pas encore de prévision : vérifiez la clé d'API dans la configuration.",
    de: 'Noch keine Vorhersage: prüfe den API-Schlüssel in der Konfiguration.',
    es: 'Aún no hay previsión: compruebe la clave de API en la configuración.',
  },
  airQuality: {
    en: 'Air quality',
    fr: "Qualité de l'air",
    de: 'Luftqualität',
    es: 'Calidad del aire',
  },
  pollenTree: { en: 'Trees', fr: 'Arbres', de: 'Bäume', es: 'Árboles' },
  pollenGrass: { en: 'Grasses', fr: 'Graminées', de: 'Gräser', es: 'Gramíneas' },
  pollenWeed: { en: 'Weeds', fr: 'Herbacées', de: 'Kräuter', es: 'Malezas' },
  today: { en: 'Today', fr: "Aujourd'hui", de: 'Heute', es: 'Hoy' },
  tomorrow: { en: 'Tomorrow', fr: 'Demain', de: 'Morgen', es: 'Mañana' },
  summary: {
    en: (d) => `${d.day}: ${d.condition}, ${d.min} to ${d.max} °C, ${d.rain} % chance of rain.`,
    fr: (d) =>
      `${d.day} : ${d.condition}, de ${d.min} à ${d.max} °C, ${d.rain} % de risque de pluie.`,
    de: (d) =>
      `${d.day}: ${d.condition}, ${d.min} bis ${d.max} °C, Regenwahrscheinlichkeit ${d.rain} %.`,
    es: (d) =>
      `${d.day}: ${d.condition}, de ${d.min} a ${d.max} °C, ${d.rain} % de probabilidad de lluvia.`,
  },
};

// Messages of the Configuration screen: connection status and the action.
export const MESSAGES = {
  notConfigured: {
    en: 'Enter your Tomorrow.io API key.',
    fr: "Saisissez votre clé d'API Tomorrow.io.",
    de: 'Gib deinen Tomorrow.io-API-Schlüssel ein.',
    es: 'Introduzca su clave de API de Tomorrow.io.',
  },
  noPlace: {
    en: 'No place to read: set the location of a house in Gladys, or type coordinates.',
    fr: 'Aucun lieu à relever : placez une maison sur la carte de Gladys ou saisissez des coordonnées.',
    de: 'Kein Ort: lege den Standort eines Hauses in Gladys fest oder gib Koordinaten ein.',
    es: 'Ningún lugar: defina la ubicación de una casa en Gladys o introduzca coordenadas.',
  },
  badCoordinates: {
    en: 'The latitude or the longitude is invalid (e.g. 48.8566 and 2.3522).',
    fr: 'La latitude ou la longitude est invalide (ex. 48,8566 et 2,3522).',
    de: 'Breiten- oder Längengrad ist ungültig (z. B. 48,8566 und 2,3522).',
    es: 'La latitud o la longitud no es válida (p. ej. 40,4168 y -3,7038).',
  },
  badKey: {
    en: 'Tomorrow.io refuses the API key: check it in your Tomorrow.io account.',
    fr: "Tomorrow.io refuse la clé d'API : vérifiez-la dans votre compte Tomorrow.io.",
    de: 'Tomorrow.io lehnt den API-Schlüssel ab: prüfe ihn in deinem Tomorrow.io-Konto.',
    es: 'Tomorrow.io rechaza la clave de API: compruébela en su cuenta de Tomorrow.io.',
  },
  rateLimited: {
    en: 'Tomorrow.io quota reached: the readings resume when it resets.',
    fr: 'Quota Tomorrow.io atteint : les relevés reprennent à sa remise à zéro.',
    de: 'Tomorrow.io-Kontingent erreicht: die Abfragen laufen nach dem Zurücksetzen weiter.',
    es: 'Cuota de Tomorrow.io alcanzada: las lecturas se reanudan cuando se reinicie.',
  },
  unreachable: {
    en: (e) => `Tomorrow.io does not answer (${e}).`,
    fr: (e) => `Tomorrow.io ne répond pas (${e}).`,
    de: (e) => `Tomorrow.io antwortet nicht (${e}).`,
    es: (e) => `Tomorrow.io no responde (${e}).`,
  },
  initFailed: {
    en: 'Initialization failed: see the integration logs.',
    fr: "L'initialisation a échoué : consultez les journaux de l'intégration.",
    de: 'Initialisierung fehlgeschlagen: sieh dir die Protokolle der Integration an.',
    es: 'La inicialización ha fallado: consulte los registros de la integración.',
  },
  testOk: {
    en: (d) =>
      `Key accepted: ${d.temperature} °C at ${d.place}. ${d.places} place(s), one reading every ${d.minutes} min (${d.calls} calls a day).`,
    fr: (d) =>
      `Clé acceptée : ${d.temperature} °C à ${d.place}. ${d.places} lieu(x), un relevé toutes les ${d.minutes} min (${d.calls} appels par jour).`,
    de: (d) =>
      `Schlüssel akzeptiert: ${d.temperature} °C in ${d.place}. ${d.places} Ort(e), eine Abfrage alle ${d.minutes} Min. (${d.calls} Aufrufe pro Tag).`,
    es: (d) =>
      `Clave aceptada: ${d.temperature} °C en ${d.place}. ${d.places} lugar(es), una lectura cada ${d.minutes} min (${d.calls} llamadas al día).`,
  },
  testFailed: {
    en: (e) => `Test failed: ${e}`,
    fr: (e) => `Échec du test : ${e}`,
    de: (e) => `Test fehlgeschlagen: ${e}`,
    es: (e) => `La prueba ha fallado: ${e}`,
  },
  quotaSpent: {
    en: 'The call budget of the hour is spent: try again later.',
    fr: "Le budget d'appels de l'heure est épuisé : réessayez plus tard.",
    de: 'Das Aufrufbudget dieser Stunde ist aufgebraucht: versuche es später erneut.',
    es: 'El presupuesto de llamadas de esta hora está agotado: inténtelo más tarde.',
  },
};

/** Render a message entry (a text or a function of `arg`) in every language. */
export function render(entry, arg) {
  return each((lang) => (typeof entry[lang] === 'function' ? entry[lang](arg) : entry[lang]));
}
