// Cloudflare Worker behind the site's AI double-check and phone lookup.
//
// API keys live here as Worker secrets and never reach the browser.
// Messages and phone numbers are used for the one request and are never
// logged or stored.

import Anthropic from '@anthropic-ai/sdk';

import { InputError, parseInput, secondOpinion } from './check.js';
import { importReports } from './ftc-import.js';
import {
  buildCheckRequest, buildPhoneRequest, callGemini, GeminiError, readCheckResponse, readPhoneResponse,
} from './gemini.js';
import { lookupPhone } from './phone.js';

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(status, body, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

async function withinLimit(limiter, request) {
  if (!limiter) return true;
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { success } = await limiter.limit({ key: ip });
  return success;
}

const isBusy = (error) => error instanceof Anthropic.RateLimitError
  || (error instanceof GeminiError && [429, 503].includes(error.status));

async function checkMessage(body, env) {
  if (env.AI_PROVIDER === 'claude') {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const createMessage = (params) => (params.betas ? client.beta.messages.create(params) : client.messages.create(params));
    return secondOpinion(body, createMessage, env.MODEL || undefined);
  }
  const input = parseInput(body);
  const response = await callGemini({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || undefined, body: buildCheckRequest(input) });
  return readCheckResponse(response);
}

async function searchWeb(input, env) {
  const response = await callGemini({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || undefined, body: buildPhoneRequest(input) });
  return readPhoneResponse(response);
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request.headers.get('Origin') ?? '', env);
    if (!cors) return json(403, { error: 'origin_not_allowed' });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, cors);

    const { pathname } = new URL(request.url);
    const lookup = pathname === '/lookup';
    if (!lookup && pathname !== '/' && pathname !== '/check') return json(404, { error: 'not_found' }, cors);

    // Per-visitor limits keep one person from running up the bill. A web
    // search costs more than a message check, so lookups get fewer.
    if (!(await withinLimit(lookup ? env.LOOKUP_LIMITER : env.RATE_LIMITER, request))) {
      return json(429, { error: 'too_many_requests' }, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'invalid_json' }, cors);
    }

    try {
      if (lookup) {
        const result = await lookupPhone(body, {
          db: env.REPORTS,
          searchWeb: env.GEMINI_API_KEY ? (input) => searchWeb(input, env) : null,
        });
        return json(200, result, cors);
      }

      const opinion = await checkMessage(body, env);
      if (!opinion) return json(502, { error: 'no_opinion' }, cors);
      return json(200, opinion, cors);
    } catch (error) {
      if (error instanceof InputError) return json(400, { error: 'invalid_input', message: error.message }, cors);
      if (isBusy(error)) return json(503, { error: 'busy' }, cors);
      // Log the kind of failure only, never what the person sent.
      console.error('request failed:', error?.status ?? error?.name);
      return json(502, { error: 'upstream_failed' }, cors);
    }
  },

  // Runs on the cron in wrangler.toml to keep the FTC report copy current.
  async scheduled(event, env, ctx) {
    if (!env.REPORTS || !env.FTC_API_KEY) return;
    ctx.waitUntil(
      importReports({ db: env.REPORTS, apiKey: env.FTC_API_KEY, pages: Number(env.FTC_PAGES_PER_RUN) || undefined })
        .then((count) => console.log('ftc import rows:', count))
        .catch((error) => console.error('ftc import failed:', error?.message)),
    );
  },
};
