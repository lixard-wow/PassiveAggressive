import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const origin = 'https://passiveaggressive.us';
const values = {
  Character: '`Tester-Area52`', Class: 'Mage', Spec: 'Frost', Role: 'DPS',
  'Player Type': 'Key Pusher', Discord: 'tester', BattleTag: '`Tester#1234`',
  'M+ Experience': 'Working on +12 keys.', About: 'Looking for a regular group.',
};
function application() {
  return { rulesAgree: true, website: '',
    embeds: [{ fields: Object.entries(values).map(([name, value]) => ({ name, value })) }] };
}
function request(body, overrides = {}) {
  return new Request('https://proxy.test/apply', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...overrides },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
function environment(success = true) {
  return { DISCORD_WEBHOOK_URL: 'https://discord.test/mock',
    APPLICATION_RATE_LIMITER: { async limit() { return { success }; } } };
}
function mockFetch(t, implementation) {
  const previous = globalThis.fetch;
  globalThis.fetch = implementation;
  t.after(() => { globalThis.fetch = previous; });
}

test('accepts valid forms and strips arbitrary Discord content, mentions, and identity', async t => {
  let forwarded;
  mockFetch(t, async (url, options) => {
    assert.equal(url, 'https://discord.test/mock');
    forwarded = JSON.parse(options.body);
    return new Response(null, { status: 204 });
  });
  const body = application();
  body.content = '@everyone'; body.username = 'Fake Officer';
  body.allowed_mentions = { parse: ['everyone'] };
  body.embeds[0].title = 'Forged title';
  const response = await worker.fetch(request(body), environment());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(forwarded.allowed_mentions, { parse: [] });
  assert.equal(forwarded.content, undefined);
  assert.equal(forwarded.username, undefined);
  assert.equal(forwarded.embeds[0].title, 'New Guild Application');
  assert.equal(forwarded.embeds[0].fields.length, 9);
});

test('continues to accept already-open legacy forms', async t => {
  mockFetch(t, async () => new Response(null, { status: 204 }));
  const body = application(); delete body.rulesAgree; delete body.website;
  assert.equal((await worker.fetch(request(body), environment())).status, 200);
});

test('rejects arbitrary messages, invalid fields, bots, and declined rules before forwarding', async t => {
  mockFetch(t, async () => { assert.fail('Invalid application reached Discord'); });
  const cases = [null, { content: 'spam' }, [], { embeds: [{ fields: [] }] }];
  const long = application(); long.embeds[0].fields.at(-1).value = 'x'.repeat(1001); cases.push(long);
  const wrong = application(); wrong.embeds[0].fields[1].value = 'Not a class'; cases.push(wrong);
  const duplicate = application(); duplicate.embeds[0].fields[1] = duplicate.embeds[0].fields[0]; cases.push(duplicate);
  const bot = application(); bot.website = 'https://spam.test'; cases.push(bot);
  const declined = application(); declined.rulesAgree = false; cases.push(declined);
  const blank = application(); blank.embeds[0].fields.at(-1).value = '  '; cases.push(blank);
  for (const body of cases) assert.equal((await worker.fetch(request(body), environment())).status, 400);
});

test('rejects unrelated or absent origins and allows the correct preflight', async t => {
  mockFetch(t, async () => { assert.fail('Off-site request reached Discord'); });
  assert.equal((await worker.fetch(request(application(), { Origin: 'https://unrelated.test' }), environment())).status, 403);
  const noOrigin = request(application()); noOrigin.headers.delete('Origin');
  assert.equal((await worker.fetch(noOrigin, environment())).status, 403);
  const preflight = new Request('https://proxy.test/apply', { method: 'OPTIONS', headers: { Origin: origin } });
  const response = await worker.fetch(preflight, environment());
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
});

test('enforces limits and fails closed without backend configuration', async t => {
  mockFetch(t, async () => { assert.fail('Blocked request reached Discord'); });
  const response = await worker.fetch(request(application()), environment(false));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '60');
  assert.equal((await worker.fetch(request(application()), {})).status, 503);
  const noIP = request(application()); noIP.headers.delete('CF-Connecting-IP');
  assert.equal((await worker.fetch(noIP, environment())).status, 503);
});

test('bounds streamed and declared bodies and rejects malformed JSON/content types', async t => {
  mockFetch(t, async () => { assert.fail('Invalid body reached Discord'); });
  assert.equal((await worker.fetch(request('x'.repeat(16385)), environment())).status, 413);
  assert.equal((await worker.fetch(request(application(), { 'Content-Length': '20000' }), environment())).status, 413);
  assert.equal((await worker.fetch(request('{'), environment())).status, 400);
  assert.equal((await worker.fetch(request(application(), { 'Content-Type': 'text/plain' }), environment())).status, 415);
});

test('reports failed or unreachable webhooks rather than confirming delivery', async t => {
  mockFetch(t, async () => new Response(null, { status: 500 }));
  assert.equal((await worker.fetch(request(application()), environment())).status, 502);
  globalThis.fetch = async () => { throw new TypeError('Network unavailable'); };
  assert.equal((await worker.fetch(request(application()), environment())).status, 502);
});

test('retains Blizzard token behavior and safely handles provider errors', async t => {
  const tokenRequest = () => new Request('https://proxy.test/blizzard-token', { method: 'POST', headers: { Origin: origin } });
  const env = { BLIZZ_CLIENT_ID: 'test-id', BLIZZ_CLIENT_SECRET: 'test-secret' };
  mockFetch(t, async () => Response.json({ access_token: 'mock-token' }));
  const response = await worker.fetch(tokenRequest(), env);
  assert.deepEqual(await response.json(), { access_token: 'mock-token' });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  globalThis.fetch = async () => new Response(null, { status: 401 });
  assert.equal((await worker.fetch(tokenRequest(), env)).status, 502);
});
