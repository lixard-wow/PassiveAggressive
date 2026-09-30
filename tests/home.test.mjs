import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)[1];
async function loadHome(fetch) {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, { textContent: '—', style: {}, attrs: {},
      setAttribute(name, value) { this.attrs[name] = value; } });
    return elements.get(id);
  };
  const result = vm.runInNewContext(`${script}\nblizzPromise;`, {
    document: { getElementById: get }, window: { matchMedia: () => ({ matches: true }) },
    fetch, AbortSignal, setInterval: () => 1, clearInterval() {}, console,
  });
  await result;
  return get;
}

test('displays an unavailable count when roster services fail instead of estimating members', async () => {
  for (const fetch of [async () => ({ ok: false }), async () => { throw new TypeError('Network'); }]) {
    const get = await loadHome(fetch);
    assert.equal(get('statMembers').textContent, '—');
    assert.match(get('statMembers').attrs['aria-label'], /unavailable/);
    assert.equal(get('heroStats').style.opacity, '1');
  }
});

test('shows the actual count including zero and respects reduced motion', async () => {
  for (const count of [0, 42]) {
    let calls = 0;
    const get = await loadHome(async () => {
      calls++;
      return { ok: true, json: async () => calls === 1
        ? { access_token: 'mock-token' } : { members: Array(count).fill({}) } };
    });
    assert.equal(get('statMembers').textContent, count);
    assert.equal(get('heroStats').style.opacity, '1');
  }
});
