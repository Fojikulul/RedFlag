import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildClaudeRequest, buildWorkersAiRequest, DEFAULT_WORKERS_AI_MODEL, InputError, MAX_CHARS,
  parseInput, readClaudeResponse, readOpinion, readWorkersAiResponse, secondOpinion,
} from '../server/src/check.js';

const opinion = (overrides = {}) => ({
  verdict: 'red', score: 90, tactics: ['payment'], explanation: 'It asks for money.', advice: 'Do not pay.', ...overrides,
});

const claudeReply = (payload, stopReason = 'end_turn') => ({
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
  for (const request of [buildWorkersAiRequest({ text: 'Pay now', lang: 'ru' }), buildClaudeRequest({ text: 'Pay now', lang: 'ru' })]) {
    const content = request.messages.at(-1).content;
    assert.match(content, /Answer in Russian/);
    assert.match(content, /<message>\nPay now\n<\/message>/);
  }
});

test('spells out the JSON shape for Workers AI and uses a schema for Claude', () => {
  assert.match(buildWorkersAiRequest({ text: 'x', lang: 'en' }).messages[0].content, /Reply with only a JSON object/);
  assert.equal(buildClaudeRequest({ text: 'x', lang: 'en' }).output_config.format.type, 'json_schema');
});

test('uses the refusal fallback except on Haiku', () => {
  assert.equal(buildClaudeRequest({ text: 'x', lang: 'en' }, 'claude-opus-5-5').fallbacks, 'default');
  assert.equal(buildClaudeRequest({ text: 'x', lang: 'en' }, 'claude-haiku-5-5').fallbacks, undefined);
});

test('reads an opinion and drops unknown tactics', () => {
  assert.deepEqual(readOpinion(opinion({ tactics: ['payment', 'made-up', 'payment'] })), opinion());
});

test('finds the JSON inside a code fence or a sentence', () => {
  const wrapped = `Here is my answer:\n\`\`\`json\n${JSON.stringify(opinion())}\n\`\`\``;
  assert.deepEqual(readOpinion(wrapped), opinion());
});

test('keeps the score inside its verdict band', () => {
  assert.equal(readOpinion(opinion({ verdict: 'green', score: 80 })).score, 24);
  assert.equal(readOpinion(opinion({ verdict: 'red', score: 10 })).score, 60);
  assert.equal(readOpinion(opinion({ verdict: 'yellow', score: 'lots' })).score, 42);
  assert.equal(readOpinion(opinion({ score: 140 })).score, 100);
});

test('returns null for unusable answers', () => {
  assert.equal(readOpinion('not json'), null);
  assert.equal(readOpinion('{broken'), null);
  assert.equal(readOpinion(opinion({ verdict: 'purple' })), null);
  assert.equal(readClaudeResponse(claudeReply(opinion(), 'refusal')), null);
  assert.equal(readClaudeResponse(claudeReply(opinion(), 'max_tokens')), null);
});

test('reads every Workers AI answer shape', () => {
  const text = JSON.stringify(opinion());
  assert.equal(readWorkersAiResponse({ response: text }).verdict, 'red');
  assert.equal(readWorkersAiResponse({ response: opinion() }).verdict, 'red');
  assert.equal(readWorkersAiResponse({ choices: [{ message: { content: text } }] }).verdict, 'red');
  assert.equal(readWorkersAiResponse({}), null);
});

test('secondOpinion calls Workers AI with the default model', async () => {
  let model;
  let sent;
  const result = await secondOpinion({ text: 'send me all your money', lang: 'es' }, {
    call: async (name, request) => {
      model = name;
      sent = request;
      return { response: JSON.stringify(opinion({ explanation: 'Pide dinero.' })) };
    },
  });
  assert.equal(model, DEFAULT_WORKERS_AI_MODEL);
  assert.match(sent.messages[1].content, /Answer in Spanish/);
  assert.equal(result.explanation, 'Pide dinero.');
});

test('secondOpinion can use Claude instead', async () => {
  let sent;
  const result = await secondOpinion({ text: 'send me all your money', lang: 'en' }, {
    provider: 'claude',
    call: async (request) => {
      sent = request;
      return claudeReply(opinion());
    },
  });
  assert.equal(sent.model, 'claude-haiku-5-5');
  assert.equal(result.score, 90);
});
