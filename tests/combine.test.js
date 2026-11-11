import assert from 'node:assert/strict';
import { test } from 'node:test';

import { combineVerdicts } from '../js/engine/combine.js';

test('keeps the rules verdict when the AI agrees', () => {
  for (const verdict of ['red', 'yellow', 'green']) {
    assert.deepEqual(combineVerdicts(verdict, verdict), { verdict, change: 'agree' });
  }
});

test('goes with the AI when it is more worried', () => {
  assert.deepEqual(combineVerdicts('green', 'red'), { verdict: 'red', change: 'raised' });
  assert.deepEqual(combineVerdicts('green', 'yellow'), { verdict: 'yellow', change: 'raised' });
  assert.deepEqual(combineVerdicts('yellow', 'red'), { verdict: 'red', change: 'raised' });
});

test('lowers the warning only one step when the AI is less worried', () => {
  assert.deepEqual(combineVerdicts('red', 'yellow'), { verdict: 'yellow', change: 'lowered' });
  assert.deepEqual(combineVerdicts('yellow', 'green'), { verdict: 'green', change: 'lowered' });
  // The AI alone can never turn a red into "no red flags".
  assert.deepEqual(combineVerdicts('red', 'green'), { verdict: 'yellow', change: 'lowered' });
});

test('uses the rules alone when there is no usable AI answer', () => {
  assert.deepEqual(combineVerdicts('red', undefined), { verdict: 'red', change: 'none' });
  assert.deepEqual(combineVerdicts('green', 'purple'), { verdict: 'green', change: 'none' });
});
