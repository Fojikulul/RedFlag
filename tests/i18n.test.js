import assert from 'node:assert/strict';
import { test } from 'node:test';

import { analyze } from '../js/engine/index.js';
import { LINK_RULES } from '../js/engine/links.js';
import { HOMOGLYPH_RULE, RULE_DEFINITIONS } from '../js/engine/rules/index.js';
import { LANGUAGES, pickLanguage, STRINGS, t } from '../js/i18n/index.js';

const CATEGORIES = [
  'urgency', 'payment', 'impersonation', 'credentials', 'prize',
  'family-emergency', 'secrecy', 'investment-romance', 'job', 'links',
];

const ENGINE_KEYS = [
  ...RULE_DEFINITIONS.map((rule) => `explain.${rule.id}`),
  `explain.${HOMOGLYPH_RULE.id}`,
  ...Object.values(LINK_RULES).map((rule) => `explain.${rule.id}`),
  ...['red', 'yellow', 'green', 'empty'].map((verdict) => `summary.${verdict}`),
  ...CATEGORIES.map((category) => `category.${category}`),
];

test('every language has exactly the same keys as English', () => {
  const english = Object.keys(STRINGS.en).sort();
  for (const { code } of LANGUAGES) {
    assert.deepEqual(Object.keys(STRINGS[code]).sort(), english, code);
  }
});

test('no string is empty', () => {
  for (const { code } of LANGUAGES) {
    for (const [key, value] of Object.entries(STRINGS[code])) {
      assert.ok(typeof value === 'string' && value.trim() !== '', `${code} ${key}`);
    }
  }
});

test('every rule, summary and category the engine can produce is translated', () => {
  for (const { code } of LANGUAGES) {
    for (const key of ENGINE_KEYS) {
      assert.ok(key in STRINGS[code], `${code} is missing ${key}`);
    }
  }
});

test('every advice key the engine returns is translated', () => {
  const advice = new Set(Object.keys(STRINGS.en).filter((key) => key.startsWith('advice.')));
  const result = analyze('Pay with gift cards now or face arrest. Send the code. bit.ly/x');
  for (const key of result.adviceKeys) assert.ok(advice.has(key), key);
});

test('placeholders match across languages', () => {
  const placeholders = (text) => (text.match(/\{\w+\}/g) || []).sort();
  for (const [key, english] of Object.entries(STRINGS.en)) {
    for (const { code } of LANGUAGES) {
      assert.deepEqual(placeholders(STRINGS[code][key]), placeholders(english), `${code} ${key}`);
    }
  }
});

test('example messages are flagged red in their own language', () => {
  for (const { code } of LANGUAGES) {
    for (const n of [1, 2, 3]) {
      const result = analyze(STRINGS[code][`examples.${n}.text`]);
      assert.equal(result.verdict, 'red', `${code} example ${n} scored ${result.score}`);
    }
  }
});

test('t fills placeholders and falls back to English', () => {
  assert.equal(t('result.score', 'en', { score: 85 }), 'Risk 85 of 100');
  assert.equal(t('result.score', 'xx', { score: 5 }), 'Risk 5 of 100');
  assert.equal(t('no.such.key', 'en'), 'no.such.key');
});

test('pickLanguage uses the first supported browser language', () => {
  assert.equal(pickLanguage(['de-DE', 'uk-UA', 'en']), 'uk');
  assert.equal(pickLanguage(['es-MX']), 'es');
  assert.equal(pickLanguage(['fr']), 'en');
  assert.equal(pickLanguage([]), 'en');
});
