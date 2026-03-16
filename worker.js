/**
 * PassiveAggressive — Cloudflare Worker proxy
 *
 * Keeps Blizzard API credentials and the Discord webhook URL off the
 * client-side entirely. Set the following secrets with:
 *   wrangler secret put BLIZZ_CLIENT_ID
 *   wrangler secret put BLIZZ_CLIENT_SECRET
 *   wrangler secret put DISCORD_WEBHOOK_URL
 *
 * Deploy:
 *   npm install -g wrangler
 *   wrangler login
 *   wrangler deploy worker.js --name pa-proxy --compatibility-date 2024-01-01
 *
 * Then replace WORKER_URL in roster.js and apply.html with your worker URL,
 * e.g. https://pa-proxy.YOUR_CF_ACCOUNT.workers.dev
 */

const ALLOWED_ORIGIN = 'https://passiveaggressive.us';

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const { pathname } = new URL(request.url);

    // ── /blizzard-token ──────────────────────────────────────────────────────
    if (pathname === '/blizzard-token' && request.method === 'POST') {
      const creds = btoa(`${env.BLIZZ_CLIENT_ID}:${env.BLIZZ_CLIENT_SECRET}`);
      const res = await fetch('https://oauth.battle.net/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${creds}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!res.ok) {
        return new Response(JSON.stringify({ error: 'token_fetch_failed' }), {
          status: 502,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      const { access_token } = await res.json();
      return new Response(JSON.stringify({ access_token }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── /apply ───────────────────────────────────────────────────────────────
    if (pathname === '/apply' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'invalid_json' }), {
          status: 400,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      const res = await fetch(env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        return new Response(JSON.stringify({ error: 'webhook_failed' }), {
          status: 502,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404, headers: CORS });
  },
};
