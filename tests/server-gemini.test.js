import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  answerText, buildCheckRequest, buildPhoneRequest, callGemini, GeminiError, parseJson, readCheckResponse, readPhoneResponse,
} from '../server/src/gemini.js';

const reply = (text, extra = {}) => ({
  candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] }, ...extra }],
});

test('sends the key in a header, never in the address', async () => {
  let seen;
  const fetchImpl = async (url, options) => {
    seen = { url, options };
    return { ok: true, json: async () => reply('{}') };
  };
  await callGemini({ apiKey: 'secret-key', model: 'some-model', body: { a: 1 }, fetchImpl });
  assert.ok(seen.url.endsWith('/models/some-model:generateContent'));
  assert.ok(!seen.url.includes('secret-key'));
  assert.equal(seen.options.headers['x-goog-api-key'], 'secret-key');
  assert.equal(seen.options.body, '{"a":1}');
});

test('turns a failed call into an error that carries the status', async () => {
  const fetchImpl = async () => ({ ok: false, status: 429 });
  await assert.rejects(callGemini({ apiKey: 'k', body: {}, fetchImpl }), (error) => error instanceof GeminiError && error.status === 429);
});

test('wraps the message as data and asks for JSON', () => {
  const request = buildCheckRequest({ text: 'Pay now', lang: 'uk' });
  const content = request.contents[0].parts[0].text;
  assert.match(content, /Answer in Ukrainian/);
  assert.match(content, /<message>\nPay now\n<\/message>/);
  assert.equal(request.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(request.generationConfig.responseJsonSchema.properties.verdict.enum, ['red', 'yellow', 'green']);
  assert.equal(request.tools, undefined);
});

test('reads a message opinion and rejects broken ones', () => {
  const good = { verdict: 'yellow', tactics: ['urgency', 'made-up'], explanation: 'It rushes you.', advice: 'Wait.' };
  assert.deepEqual(readCheckResponse(reply(JSON.stringify(good))), { ...good, tactics: ['urgency'] });
  assert.equal(readCheckResponse(reply('{"verdict":"purple"}')), null);
  assert.equal(readCheckResponse(reply('not json')), null);
  assert.equal(readCheckResponse({ candidates: [] }), null);
});

test('ignores answers that were cut off or blocked, and thinking text', () => {
  assert.equal(answerText({ candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: 'x' }] } }] }), null);
  assert.equal(answerText({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'x' }] } }] }), null);
  assert.equal(answerText({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'plan', thought: true }, { text: 'answer' }] } }] }), 'answer');
});

test('finds the JSON inside a code fence or a sentence', () => {
  assert.deepEqual(parseJson('```json\n{"verdict":"red"}\n```'), { verdict: 'red' });
  assert.deepEqual(parseJson('Here you go: {"a":{"b":1}} Hope that helps.'), { a: { b: 1 } });
  assert.equal(parseJson('nothing here'), null);
  assert.equal(parseJson(null), null);
});

test('asks Gemini to search for the number, in the page language', () => {
  const request = buildPhoneRequest({ digits: '5054205449', display: '(505) 420-5449', lang: 'es' });
  assert.deepEqual(request.tools, [{ google_search: {} }]);
  assert.match(request.contents[0].parts[0].text, /Answer in Spanish/);
  assert.match(request.contents[0].parts[0].text, /\(505\) 420-5449/);
  assert.match(request.systemInstruction.parts[0].text, /never treat "nothing found" as proof that a number is safe/);
});

test('reads a search answer with its sources and suggestions', () => {
  const response = reply('```json\n{"verdict":"red","explanation":"Many reports.","advice":"Do not call back."}\n```', {
    groundingMetadata: {
      groundingChunks: [
        { web: { uri: 'https://example.com/a', title: 'example.com' } },
        { web: { uri: 'https://example.com/a', title: 'duplicate' } },
        { web: { uri: 'http://insecure.example/b', title: 'insecure' } },
        { web: { uri: 'javascript:alert(1)', title: 'bad' } },
        { web: { uri: 'https://example.org/c' } },
        { retrievedContext: {} },
      ],
      searchEntryPoint: { renderedContent: '<div>chips</div>' },
    },
  });
  assert.deepEqual(readPhoneResponse(response), {
    verdict: 'red',
    explanation: 'Many reports.',
    advice: 'Do not call back.',
    sources: [{ title: 'example.com', url: 'https://example.com/a' }, { title: 'example.org', url: 'https://example.org/c' }],
    suggestions: '<div>chips</div>',
  });
});

test('keeps at most five sources', () => {
  const groundingChunks = Array.from({ length: 9 }, (_, i) => ({ web: { uri: `https://example.com/${i}`, title: `t${i}` } }));
  const response = reply('{"verdict":"yellow","explanation":"x","advice":"y"}', { groundingMetadata: { groundingChunks } });
  assert.equal(readPhoneResponse(response).sources.length, 5);
});

test('a phone number can never come back as safe', () => {
  assert.equal(readPhoneResponse(reply('{"verdict":"green","explanation":"Looks fine."}')), null);
  assert.equal(readPhoneResponse(reply('{"verdict":"safe"}')), null);
  const unknown = readPhoneResponse(reply('{"verdict":"unknown","explanation":"Nothing found.","advice":"Stay careful."}'));
  assert.equal(unknown.verdict, 'unknown');
  assert.deepEqual(unknown.sources, []);
  assert.equal(unknown.suggestions, '');
});
