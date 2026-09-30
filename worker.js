/**
 * PassiveAggressive — Cloudflare Worker proxy.
 * Set BLIZZ_CLIENT_ID, BLIZZ_CLIENT_SECRET and DISCORD_WEBHOOK_URL as secrets.
 * Deploy with `npx wrangler deploy` to install wrangler.toml's rate limiter too.
 * See README.md for deployment.
 */
const ALLOWED_ORIGIN = 'https://passiveaggressive.us';
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Vary': 'Origin',
};
const FIELD_LIMITS = {
  'Character': 150, 'Class': 50, 'Spec': 50, 'Role': 20,
  'Player Type': 30, 'Discord': 100, 'BattleTag': 102,
  'M+ Experience': 1000, 'About': 1000,
};
const CLASSES = new Set(['Death Knight', 'Demon Hunter', 'Druid', 'Evoker',
  'Hunter', 'Mage', 'Monk', 'Paladin', 'Priest', 'Rogue', 'Shaman', 'Warlock', 'Warrior']);
const MAX_BODY_BYTES = 16384;

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json',
      'Cache-Control': 'no-store', ...extraHeaders },
  });
}

async function readBody(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) throw new RangeError('body_too_large');
  if (!request.body) throw new SyntaxError('missing_body');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new RangeError('body_too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function applicationFields(body) {
  // Read the existing form format, but never forward a caller's Discord payload.
  // Already-open forms may omit the new honeypot and rulesAgree properties.
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      (body.website !== undefined && body.website !== '') ||
      (body.rulesAgree !== undefined && body.rulesAgree !== true) ||
      !Array.isArray(body.embeds) || body.embeds.length !== 1) return null;
  const rawFields = body.embeds[0]?.fields;
  if (!Array.isArray(rawFields) || rawFields.length !== Object.keys(FIELD_LIMITS).length) return null;
  const values = new Map();
  for (const field of rawFields) {
    if (!field || !Object.hasOwn(FIELD_LIMITS, field.name) ||
        typeof field.value !== 'string' || values.has(field.name)) return null;
    const value = field.value.trim();
    if (!value || value.length > FIELD_LIMITS[field.name] || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) return null;
    values.set(field.name, value);
  }
  if (!CLASSES.has(values.get('Class')) ||
      !['Tank', 'Healer', 'DPS'].includes(values.get('Role')) ||
      !['Key Pusher', 'Casual Runner', 'Social'].includes(values.get('Player Type'))) return null;
  return Object.keys(FIELD_LIMITS).map(name => ({
    name, value: values.get(name), inline: !['M+ Experience', 'About'].includes(name),
  }));
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (!['/apply', '/blizzard-token'].includes(pathname)) return json({ error: 'not_found' }, 404);
    // CORS alone restricts browsers; explicitly reject off-site requests too.
    if (request.headers.get('Origin') !== ALLOWED_ORIGIN) return json({ error: 'origin_not_allowed' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST, OPTIONS' });

    if (pathname === '/blizzard-token') {
      if (!env.BLIZZ_CLIENT_ID || !env.BLIZZ_CLIENT_SECRET) return json({ error: 'service_unavailable' }, 503);
      try {
        const res = await fetch('https://oauth.battle.net/token', {
          method: 'POST', signal: AbortSignal.timeout(10000),
          headers: {
            'Authorization': `Basic ${btoa(`${env.BLIZZ_CLIENT_ID}:${env.BLIZZ_CLIENT_SECRET}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          }, body: 'grant_type=client_credentials',
        });
        if (!res.ok) return json({ error: 'token_fetch_failed' }, 502);
        const { access_token } = await res.json();
        if (!access_token) return json({ error: 'token_fetch_failed' }, 502);
        return json({ access_token });
      } catch { return json({ error: 'token_fetch_failed' }, 502); }
    }

    if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return json({ error: 'invalid_content_type' }, 415);
    // Fail closed if the required binding/secrets are missing after deployment.
    if (!env.APPLICATION_RATE_LIMITER || !env.DISCORD_WEBHOOK_URL) return json({ error: 'service_unavailable' }, 503);
    try {
      // Five attempts/minute per edge and IP permits household retries while
      // limiting anonymous spam. Origin checks are not bot authentication.
      const ip = request.headers.get('CF-Connecting-IP');
      if (!ip) return json({ error: 'service_unavailable' }, 503);
      const { success } = await env.APPLICATION_RATE_LIMITER.limit({ key: `apply:${ip}` });
      if (!success) return json({ error: 'rate_limited' }, 429, { 'Retry-After': '60' });
    } catch { return json({ error: 'service_unavailable' }, 503); }

    let body;
    try { body = await readBody(request); }
    catch (error) { return json({ error: error instanceof RangeError ? 'body_too_large' : 'invalid_json' }, error instanceof RangeError ? 413 : 400); }
    const fields = applicationFields(body);
    if (!fields) return json({ error: 'invalid_application' }, 400);
    const payload = {
      allowed_mentions: { parse: [] },
      embeds: [{ title: 'New Guild Application', color: 0xC8A96E,
        fields, timestamp: new Date().toISOString() }],
    };
    try {
      const res = await fetch(env.DISCORD_WEBHOOK_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return json({ error: 'webhook_failed' }, 502);
      return json({ ok: true });
    } catch { return json({ error: 'webhook_failed' }, 502); }
  },
};
