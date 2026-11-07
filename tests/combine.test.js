import assert from 'node:assert/strict';
import { test } from 'node:test';

import { combine } from '../js/combine.js';
import { analyze } from '../js/engine/index.js';

const SCAM = 'URGENT: your account is locked. Pay the $50 fee in gift cards today or it will be closed.';
const HARMLESS = 'Hi, are we still on for lunch on Friday?';

const opinion = (verdict, score, tactics = []) => ({ verdict, score, tactics, explanation: 'x', advice: 'y' });

test('the rules answer alone when there is no AI opinion', () => {
  const rules = analyze(SCAM);
  const result = combine(rules, null);
  assert.equal(result.verdict, rules.verdict);
  assert.equal(result.aiScore, null);
  assert.equal(result.ruleScore, rules.score);
  assert.deepEqual(result.adviceKeys, rules.adviceKeys);
});

test('the AI leads the verdict', () => {
  const result = combine(analyze(HARMLESS), opinion('red', 88, ['payment']));
  assert.equal(result.verdict, 'red');
  assert.equal(result.aiScore, 88);
  assert.ok(result.adviceKeys.includes('advice.do_not_pay'));
});

test('the AI can calm a yellow, but never call a clear scam safe', () => {
  assert.equal(combine(analyze(SCAM), opinion('green', 5)).verdict, 'yellow');
  assert.equal(combine(analyze('Was this you?'), opinion('green', 5)).verdict, 'green');
});

test('advice covers tactics from both the rules and the AI', () => {
  const result = combine(analyze(SCAM), opinion('red', 95, ['links']));
  assert.ok(result.adviceKeys.includes('advice.do_not_pay'));
  assert.ok(result.adviceKeys.includes('advice.do_not_click'));
});
