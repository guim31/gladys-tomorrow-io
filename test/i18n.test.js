// -----------------------------------------------------------------------------
// Every text Gladys shows exists in the four languages of its interface
// (English, French, German, Spanish): the manifest, the message tables of the
// code, the feature names and the four documentation files, which share the
// same sections. German says "du", never the polite "Sie".
// -----------------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LANGUAGES } from '../src/config.js';
import { FEATURE_NAMES, MESSAGES, POLLEN_LEVELS, TEXT, WEATHER_CODES } from '../src/i18n.js';
import { CORE_FEATURES, PREMIUM_FEATURES } from '../src/devices.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

const LANGS = ['en', 'fr', 'de', 'es'];
const POLITE_GERMAN = /(?<!\p{L})(Sie|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres)(?!\p{L})/u;

// Upper bounds, in characters: what the Gladys interface shows without cutting.
const MAX = {
  catalog: 100,
  widgetLabel: 30,
  label: 60,
  placeholder: 60,
  description: 300,
  message: 200,
  short: 40,
  featureName: 40,
  condition: 40,
};

const sorted = (keys) => [...keys].sort();

/** Checks one multi-language object; returns its problems. */
function problems(value, path, max) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [`${path} must be a multi-language object`];
  }
  const found = [];
  if (JSON.stringify(sorted(Object.keys(value))) !== JSON.stringify(sorted(LANGS))) {
    found.push(`${path} has [${Object.keys(value)}], expected exactly [${LANGS}]`);
  }
  for (const [lang, text] of Object.entries(value)) {
    found.push(...textProblems(text, `${path}.${lang}`, lang, max));
  }
  return found;
}

function textProblems(text, path, lang, max) {
  if (typeof text !== 'string' || text.trim() === '') {
    return [`${path} is empty`];
  }
  const found = [];
  if (text.length > max) {
    found.push(`${path} has ${text.length} characters (${max} at most)`);
  }
  if (lang === 'de' && POLITE_GERMAN.test(text)) {
    found.push(`${path} uses the polite form: "${text}"`);
  }
  return found;
}

/** Every multi-language object of the manifest, with its length limit. */
function manifestTexts(root) {
  const texts = [];
  const walk = (value, path, key) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`, key));
      return;
    }
    if (!value || typeof value !== 'object') {
      return;
    }
    const isText =
      ['label', 'description', 'placeholder'].includes(key) ||
      Object.keys(value).some((child) => LANGS.includes(child));
    if (isText) {
      // The store schema caps the catalog and widget descriptions, and widget labels.
      const max =
        path === 'manifest.description' || /^manifest\.widgets\[\d+\]\.description$/.test(path)
          ? MAX.catalog
          : /^manifest\.widgets\[\d+\]\.label$/.test(path)
            ? MAX.widgetLabel
            : (MAX[key] ?? MAX.label);
      texts.push({ path, value, max });
      return;
    }
    for (const [child, item] of Object.entries(value)) {
      walk(item, `${path}.${child}`, child);
    }
  };
  walk(root, 'manifest', null);
  return texts;
}

/** Render an entry that is a text, or a function of an argument. */
const renderEntry = (entry, lang, arg) =>
  typeof entry[lang] === 'function' ? entry[lang](arg) : entry[lang];

const SAMPLE = {
  temperature: '12,5',
  place: 'Maison',
  places: 2,
  minutes: 15,
  calls: 384,
  day: 'Demain',
  condition: 'Pluie faible',
  min: 8,
  max: 17,
  rain: 40,
};

test('the configuration offers the four languages', () => {
  assert.deepEqual(LANGUAGES, LANGS);
  for (const table of [FEATURE_NAMES, WEATHER_CODES, POLLEN_LEVELS]) {
    assert.deepEqual(Object.keys(table), LANGS);
  }
});

test('every text of the manifest is in English, French, German and Spanish', () => {
  const texts = manifestTexts(manifest);
  assert.ok(texts.length >= 60, `only ${texts.length} texts found in the manifest`);
  const found = texts.flatMap(({ path, value, max }) => problems(value, path, max));
  assert.deepEqual(found, []);
});

test('the catalog description holds 10 characters at least in every language', () => {
  for (const lang of LANGS) {
    assert.ok(manifest.description[lang].length >= 10, `description.${lang} is too short`);
  }
});

test('the name is the brand, the same in every language', () => {
  assert.equal(typeof manifest.name, 'string');
  assert.ok(manifest.name.length >= 3 && manifest.name.length <= 30);
});

test('every message of the code has the four languages', () => {
  const found = [
    ...Object.entries(MESSAGES).flatMap(([key, entry]) =>
      problems(
        Object.fromEntries(
          LANGS.map((l) => [l, renderEntry(entry, l, key.startsWith('test') ? SAMPLE : 'timeout')]),
        ),
        `MESSAGES.${key}`,
        MAX.message,
      ),
    ),
    ...Object.entries(TEXT).flatMap(([key, entry]) =>
      problems(
        Object.fromEntries(
          LANGS.map((l) => [
            l,
            renderEntry(entry, l, key === 'summary' ? SAMPLE : key === 'updated' ? '14:05' : 12),
          ]),
        ),
        `TEXT.${key}`,
        ['hourlyOnly', 'pickDevice', 'noData', 'summary'].includes(key) ? MAX.message : MAX.short,
      ),
    ),
  ];
  assert.deepEqual(found, []);
});

// Tables written one language at a time: same keys everywhere, no empty text.
function tableProblems(table, name, max) {
  const found = [];
  for (const lang of LANGS) {
    const entries = table[lang] ?? {};
    if (
      JSON.stringify(sorted(Object.keys(entries))) !== JSON.stringify(sorted(Object.keys(table.en)))
    ) {
      found.push(`${name}.${lang} does not have the keys of ${name}.en`);
    }
    for (const [key, value] of Object.entries(entries)) {
      found.push(...textProblems(value, `${name}.${lang}.${key}`, lang, max));
    }
  }
  return found;
}

test('the feature names exist in every language, for every feature', () => {
  assert.deepEqual(tableProblems(FEATURE_NAMES, 'FEATURE_NAMES', MAX.featureName), []);
  assert.deepEqual(
    sorted(Object.keys(FEATURE_NAMES.en)),
    sorted([...Object.keys(CORE_FEATURES), ...Object.keys(PREMIUM_FEATURES)]),
  );
});

test('the weather codes and pollen levels exist in every language', () => {
  assert.deepEqual(tableProblems(WEATHER_CODES, 'WEATHER_CODES', MAX.condition), []);
  assert.deepEqual(tableProblems(POLLEN_LEVELS, 'POLLEN_LEVELS', MAX.short), []);
  for (const lang of LANGS) {
    assert.equal(POLLEN_LEVELS[lang].length, 6, 'pollen index 0 to 5');
  }
});

// The four documentation files: same sections, in the same order.
const docs = Object.fromEntries(
  await Promise.all(
    LANGS.map(async (lang) => [
      lang,
      await readFile(new URL(`../docs/${lang}.md`, import.meta.url), 'utf8'),
    ]),
  ),
);
const outline = (text) =>
  text
    .split('\n')
    .filter((line) => /^#{1,3} /.test(line))
    .map((line) => line.match(/^#+/)[0].length);

test('the four documentation files have the same sections', () => {
  for (const lang of LANGS) {
    assert.ok(docs[lang].length >= 300, `docs/${lang}.md is too short for the store`);
    assert.deepEqual(
      outline(docs[lang]),
      outline(docs.en),
      `docs/${lang}.md sections differ from en`,
    );
    assert.ok(/Tomorrow\.io/.test(docs[lang]));
  }
  assert.ok(outline(docs.en).length >= 10, 'the documentation covers every topic');
  assert.ok(!POLITE_GERMAN.test(docs.de), 'docs/de.md uses the polite form');
});

test('the guard catches a missing language, an empty text and the polite German form', () => {
  assert.equal(problems({ en: 'Rain', fr: 'Pluie', de: 'Regen' }, 'x', 60).length, 1);
  assert.equal(problems({ en: 'Rain', fr: 'Pluie', de: '', es: 'Lluvia' }, 'x', 60).length, 1);
  assert.equal(problems({ en: 'a', fr: 'a', de: 'a', es: 'a', it: 'a' }, 'x', 60).length, 1);
  assert.equal(problems({ en: 'a', fr: 'a', de: 'a'.repeat(61), es: 'a' }, 'x', 60).length, 1);
  for (const polite of [
    'Wählen Sie',
    'Ihr Ort',
    'Ihre Daten',
    'mit Ihrem',
    'Ihren',
    'Ihrer',
    'Ihres',
  ]) {
    assert.equal(problems({ en: 'a', fr: 'a', de: polite, es: 'a' }, 'x', 60).length, 1, polite);
  }
  // Words that only contain the letters stay allowed.
  assert.deepEqual(
    problems({ en: 'a', fr: 'a', de: 'Siebenschläfer, ihre', es: 'a' }, 'x', 60),
    [],
  );
  // A manifest text forgotten in German is found.
  const forgotten = structuredClone(manifest);
  delete forgotten.config_schema[3].placeholder.de;
  const found = manifestTexts(forgotten).flatMap(({ path, value, max }) =>
    problems(value, path, max),
  );
  assert.deepEqual(found, [
    'manifest.config_schema[3].placeholder has [en,fr,es], expected exactly [en,fr,de,es]',
  ]);
  // Two documentation files with different sections are found.
  assert.notDeepEqual(outline('# A\n## B\n## C'), outline('# A\n## B'));
});
