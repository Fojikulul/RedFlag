// Cloudflare Worker that serves the site and runs the AI check.
//
// Files in the site (index.html, css, js, assets) are served by Cloudflare
// directly. Only POST /api/check reaches this code. API keys live here as
// Worker secrets and never reach the browser. Message text is used for the
// one request and is not logged or stored. GET /api/stats returns usage
// counts (how many checks, by day), which hold nothing about the messages.

import Anthropic from '@anthropic-ai/sdk';

import { InputError, secondOpinion } from './check.js';
import { recordCheck, usageSummary } from './usage.js';

const API_PATH = '/api/check';
const STATS_PATH = '/api/stats';

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  // The site's own pages may always call it; other sites only if listed.
  if (origin !== new URL(request.url).origin && !allowed.includes(origin)) return null;
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

function providerCall(env) {
  if (env.AI_PROVIDER === 'claude') {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    return (params) => (params.betas ? client.beta.messages.create(params) : client.messages.create(params));
  }
  return (model, params) => env.AI.run(model, params);
}

async function check(request, env, ctx) {
  const cors = corsHeaders(request, env);
  if (!cors) return json(403, { error: 'origin_not_allowed' });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, cors);

  // Ten checks a minute per visitor keeps one person from using up the
  // daily allowance for everyone.
  if (env.RATE_LIMITER) {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    if (!success) return json(429, { error: 'too_many_requests' }, cors);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'invalid_json' }, cors);
  }

  // Counted once the message is known to be valid, whatever the AI does.
  const count = (verdict) => {
    if (env.DB) ctx.waitUntil(recordCheck(env.DB, verdict).catch(() => console.error('usage count failed')));
  };

  try {
    const opinion = await secondOpinion(body, {
      provider: env.AI_PROVIDER || 'workers-ai',
      call: providerCall(env),
      model: env.MODEL || undefined,
    });
    count(opinion?.verdict ?? null);
    if (!opinion) return json(502, { error: 'no_opinion' }, cors);
    return json(200, opinion, cors);
  } catch (error) {
    if (error instanceof InputError) return json(400, { error: 'invalid_input', message: error.message }, cors);
    count(null);
    if (error instanceof Anthropic.RateLimitError) return json(503, { error: 'busy' }, cors);
    // Log the kind of failure only, never the message the person pasted.
    // Running out of the free daily allowance also ends up here.
    console.error('ai check failed:', error?.status ?? error?.name);
    return json(502, { error: 'upstream_failed' }, cors);
  }
}

async function stats(env) {
  if (!env.DB) return json(404, { error: 'no_stats' });
  const response = json(200, await usageSummary(env.DB));
  // Counts can be a few minutes old; this keeps the database reads low.
  response.headers.set('Cache-Control', 'public, max-age=300');
  return response;
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === API_PATH) return check(request, env, ctx);
    if (pathname === STATS_PATH && request.method === 'GET') return stats(env);
    // Anything else that isn't a file of the site.
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  },
};
