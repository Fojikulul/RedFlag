// Calls to Google's Gemini API, used for the phone number web search. Kept
// apart from the Worker so the request building and answer reading can be
// tested without the network.

import { LANGUAGES } from './check.js';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const LANGUAGE_NAMES = { en: 'English', uk: 'Ukrainian', ru: 'Russian', es: 'Spanish' };

export class GeminiError extends Error {
  constructor(status) {
    super(`Gemini answered ${status}`);
    this.status = status;
  }
}

/** Sends one generateContent request. `fetchImpl` is swapped out in tests. */
export async function callGemini({ apiKey, model = DEFAULT_GEMINI_MODEL, body, fetchImpl = fetch }) {
  const response = await fetchImpl(`${API_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new GeminiError(response.status);
  return response.json();
}

/** The answer text, or null when the model stopped early or was blocked. */
export function answerText(response) {
  const candidate = response?.candidates?.[0];
  if (!candidate || (candidate.finishReason && candidate.finishReason !== 'STOP')) return null;
  const text = (candidate.content?.parts ?? [])
    .filter((part) => typeof part.text === 'string' && !part.thought)
    .map((part) => part.text)
    .join('');
  return text.trim() === '' ? null : text;
}

// Answers with search turned on may wrap the JSON in a sentence or a code
// fence, so take the outermost object.
export function parseJson(text) {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Phone lookup: Gemini searches Google for the number and sums up what
// people say about it.

export const PHONE_PROMPT = `You help people, many of them older adults, find out whether a phone number that called or texted them has been reported as a scam.

Search the web for the number. Look for scam and spam reports, complaint sites, news and warnings. Only use what you find. Never guess, and never treat "nothing found" as proof that a number is safe.

Verdicts:
- red: several reports say this number is used for scams, fraud or impersonation.
- yellow: some reports of spam, robocalls or suspicious calls, or reports that are unclear.
- unknown: you found no reports about this exact number.

If the number belongs to a real company or office, say so, but remind them that scammers can fake caller ID to show a real number.

Answer with only a JSON object: {"verdict": "red" | "yellow" | "unknown", "explanation": "...", "advice": "..."}.
Write the explanation and advice in the language you are told to use, at about a 6th-grade reading level: short, kind and calm. The explanation is two or three sentences about what people reported. The advice is one concrete next step.`;

const PHONE_VERDICTS = ['red', 'yellow', 'unknown'];

/** The number has already been checked to be digits only, so it can't carry instructions. */
export function buildPhoneRequest({ digits, display, lang }) {
  return {
    systemInstruction: { parts: [{ text: PHONE_PROMPT }] },
    contents: [{
      role: 'user',
      parts: [{ text: `Answer in ${LANGUAGE_NAMES[LANGUAGES.includes(lang) ? lang : 'en']}.\n\nPhone number: ${display} (digits: ${digits})` }],
    }],
    tools: [{ google_search: {} }],
    generationConfig: { thinkingConfig: { thinkingLevel: 'low' } },
  };
}

/**
 * Reads a search answer. Google's terms ask for the search suggestions to be
 * shown with the answer, so they are passed through for the page to display.
 */
export function readPhoneResponse(response) {
  const parsed = parseJson(answerText(response));
  if (!parsed || !PHONE_VERDICTS.includes(parsed.verdict)) return null;

  const metadata = response.candidates[0].groundingMetadata ?? {};
  const seen = new Set();
  const sources = [];
  for (const chunk of metadata.groundingChunks ?? []) {
    const url = chunk.web?.uri;
    if (!url || !url.startsWith('https://') || seen.has(url)) continue;
    seen.add(url);
    sources.push({ title: String(chunk.web.title || new URL(url).hostname), url });
    if (sources.length === 5) break;
  }

  return {
    verdict: parsed.verdict,
    explanation: String(parsed.explanation ?? ''),
    advice: String(parsed.advice ?? ''),
    sources,
    suggestions: typeof metadata.searchEntryPoint?.renderedContent === 'string' ? metadata.searchEntryPoint.renderedContent : '',
  };
}
