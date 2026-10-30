import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildRequest, InputError, MAX_CHARS, parseInput, readResponse, secondOpinion,
} from '../server/src/check.js';

const reply = (payload, stopReason = 'end_turn') => ({
  stop_reason: stopReason,
  content: [{ type: 'text', text: JSON.stringify(payload) }],
});

test('rejects empty, missing and oversized messages', () => {
  assert.throws(() => parseInput(null), InputError);
  assert.throws(() => parseInput({ text: '   ' }), InputError);
  assert.throws(() => parseInput({ text: 'x'.repeat(MAX_CHARS + 1) }), InputError);
});

test('falls back to English for unknown languages', () => {
  assert.deepEqual(parseInput({ text: ' hi ', lang: 'fr' }), { text: 'hi', lang: 'en' });
  assert.equal(parseInput({ text: 'hi', lang: 'uk' }).lang, 'uk');
});

test('wraps the message as data and names the answer language', () => {
  const request = buildRequest({ text: 'Pay now', lang: 'ru' });
  const content = request.messages[0].content;
  assert.match(content, /Answer in Russian/);
  assert.match(content, /<message>\nPay now\n<\/message>/);
  assert.equal(request.output_config.format.type, 'json_schema');
});

test('uses the refusal fallback except on Haiku', () => {
  assert.equal(buildRequest({ text: 'x', lang: 'en' }).fallbacks, 'default');
  assert.equal(buildRequest({ text: 'x', lang: 'en' }, 'claude-haiku-5-5').fallbacks, undefined);
});

test('reads a valid opinion and drops unknown tactics', () => {
  const opinion = readResponse(reply({
    verdict: 'red', tactics: ['payment', 'made-up'], explanation: 'It asks for money.', advice: 'Do not pay.',
  }));
  assert.deepEqual(opinion, {
    verdict: 'red', tactics: ['payment'], explanation: 'It asks for money.', advice: 'Do not pay.',
  });
});

test('returns null for refusals, cut-off and broken answers', () => {
  assert.equal(readResponse(reply({ verdict: 'red' }, 'refusal')), null);
  assert.equal(readResponse(reply({ verdict: 'red' }, 'max_tokens')), null);
  assert.equal(readResponse({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] }), null);
  assert.equal(readResponse(reply({ verdict: 'purple' })), null);
});

test('secondOpinion passes the built request to the API call', async () => {
  let sent;
  const opinion = await secondOpinion({ text: 'send me all your money', lang: 'es' }, async (request) => {
    sent = request;
    return reply({ verdict: 'red', tactics: ['payment'], explanation: 'Pide dinero.', advice: 'No envíe nada.' });
  });
  assert.match(sent.messages[0].content, /Answer in Spanish/);
  assert.equal(opinion.verdict, 'red');
});
