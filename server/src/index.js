// Cloudflare Worker that gives the site an AI second opinion.
//
// The API key lives here as a Worker secret and never reaches the browser.
// Message text is used for the one request and is not logged or stored.

import Anthropic from '@anthropic-ai/sdk';

import { InputError, secondOpinion } from './check.js';

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

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request.headers.get('Origin') ?? '', env);
    if (!cors) return json(403, { error: 'origin_not_allowed' });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, cors);

    // Ten checks a minute per visitor keeps one person from running up the bill.
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

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const createMessage = (params) => (params.betas ? client.beta.messages.create(params) : client.messages.create(params));

    try {
      const opinion = await secondOpinion(body, createMessage, env.MODEL || undefined);
      if (!opinion) return json(502, { error: 'no_opinion' }, cors);
      return json(200, opinion, cors);
    } catch (error) {
      if (error instanceof InputError) return json(400, { error: 'invalid_input', message: error.message }, cors);
      if (error instanceof Anthropic.RateLimitError) return json(503, { error: 'busy' }, cors);
      // Log the kind of failure only, never the message the person pasted.
      console.error('second opinion failed:', error?.status ?? error?.name);
      return json(502, { error: 'upstream_failed' }, cors);
    }
  },
};
