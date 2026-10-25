import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalize } from '../js/engine/normalize.js';

test('lowercases and collapses whitespace', () => {
  assert.equal(normalize('  Call   NOW\n\tplease ').text, 'call now please');
});

test('strips zero-width characters', () => {
  assert.equal(normalize('gi​ft ca‍rd').text, 'gift card');
});

test('turns stylised letters into plain ones', () => {
  assert.equal(normalize('ＰＡＹ 𝐍𝐎𝐖').text, 'pay now');
});

test('folds ё into е and curly apostrophes into straight ones', () => {
  assert.equal(normalize('Ещё don’t').text, "еще don't");
});

test('maps every character back to the original text', () => {
  const input = 'A​b  C';
  const { text, starts, ends } = normalize(input);
  assert.equal(text, 'ab c');
  assert.deepEqual(starts, [0, 2, 3, 5]);
  assert.deepEqual(ends, [1, 3, 4, 6]);
});

test('keeps offsets right across surrogate pairs', () => {
  const input = '🚨 Pay now';
  const { text, starts } = normalize(input);
  const payAt = text.indexOf('pay');
  assert.equal(input.slice(starts[payAt]), 'Pay now');
});

test('folds Cyrillic look-alikes inside Latin words', () => {
  // The "а" in "Pаypal" is Cyrillic.
  const result = normalize('Pаypal account');
  assert.equal(result.text, 'paypal account');
  assert.deepEqual(result.mixedScript, [{ start: 0, end: 6 }]);
});

test('folds Latin look-alikes inside Cyrillic words', () => {
  // The "o" and "p" in "пoлиция" are Latin.
  const result = normalize('пoлиция');
  assert.equal(result.text, 'полиция');
  assert.equal(result.mixedScript.length, 1);
});

test('leaves ordinary text in either script alone', () => {
  assert.deepEqual(normalize('Привіт, як справи? Hello there').mixedScript, []);
});
