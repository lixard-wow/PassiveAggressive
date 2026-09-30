import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../apply.js', import.meta.url), 'utf8');
function formWith(fetch) {
  const elements = new Map();
  const inputs = { charName: 'Tester', realm: 'Area 52', charClass: 'Mage', charSpec: 'Frost', role: 'DPS',
    playerType: 'Key Pusher', experience: 'Working on +12 keys.', about: 'Looking for a regular group.',
    discord: 'tester', battletag: 'Tester#1234', website: '' };
  const get = id => {
    if (!elements.has(id)) elements.set(id, {
      value: inputs[id] ?? '', checked: id === 'rulesAgree', hidden: true, disabled: false, style: {}, attrs: {},
      listeners: {}, classList: { values: new Set(), add(v) { this.values.add(v); } },
      addEventListener(type, fn) { this.listeners[type] = fn; },
      setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; },
      reportValidity() { return true; }, focus() { this.focused = true; }, scrollIntoView() {},
    });
    return elements.get(id);
  };
  vm.runInNewContext(source, { document: { getElementById: get },
    window: { matchMedia: () => ({ matches: true }) }, fetch, AbortSignal, TypeError, console });
  return { get, submit: () => get('applyForm').listeners.submit({ preventDefault() {} }) };
}

test('keeps the form visible and prevents duplicate requests until receipt is confirmed', async () => {
  let resolve, calls = 0;
  const form = formWith(async () => { calls++; return new Promise(r => { resolve = r; }); });
  const pending = form.submit();
  assert.equal(form.get('applySubmit').disabled, true);
  assert.equal(form.get('applyForm').style.display, undefined);
  assert.equal(form.get('applySuccess').classList.values.has('show'), false);
  await form.submit(); assert.equal(calls, 1);
  resolve({ ok: true, json: async () => ({ ok: true }) });
  await pending;
  assert.equal(form.get('applyForm').style.display, 'none');
  assert.equal(form.get('applySuccess').classList.values.has('show'), true);
  assert.equal(form.get('applySuccess').focused, true);
});

test('preserves answers and restores the submit button on server errors', async () => {
  for (const status of [400, 413, 429, 500, 502, 503]) {
    const form = formWith(async () => ({ ok: false, status }));
    await form.submit();
    assert.equal(form.get('applyForm').style.display, undefined);
    assert.equal(form.get('applySuccess').classList.values.has('show'), false);
    assert.equal(form.get('about').value, 'Looking for a regular group.');
    assert.equal(form.get('applyStatus').hidden, false);
    assert.equal(form.get('applySubmit').disabled, false);
    assert.equal(form.get('applyForm').attrs['aria-busy'], undefined);
  }
});

test('explains uncertain delivery for timeouts and network failures', async () => {
  for (const error of [Object.assign(new Error('timeout'), { name: 'TimeoutError' }), new TypeError('network')]) {
    const form = formWith(async () => { throw error; });
    await form.submit();
    assert.match(form.get('applyStatus').textContent, /before resubmitting/);
    assert.equal(form.get('applySubmit').disabled, false);
    assert.equal(form.get('applySuccess').classList.values.has('show'), false);
  }
});

test('requires an explicit receipt and sends the compatible safe payload', async () => {
  let payload;
  const form = formWith(async (url, options) => {
    payload = JSON.parse(options.body);
    return { ok: true, json: async () => ({ ok: false }) };
  });
  await form.submit();
  assert.equal(form.get('applySuccess').classList.values.has('show'), false);
  assert.equal(payload.embeds[0].fields.length, 9);
  assert.deepEqual(payload.allowed_mentions, { parse: [] });
  assert.equal(payload.rulesAgree, true);
  assert.equal(payload.website, '');
});
