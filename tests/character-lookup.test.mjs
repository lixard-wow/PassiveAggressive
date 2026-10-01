import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const lookupSource = readFileSync(new URL('../character-lookup.js', import.meta.url), 'utf8');
const formSource = readFileSync(new URL('../apply.js', import.meta.url), 'utf8');
const realmData = { realms: [
  { name: 'Area 52', slug: 'area-52' }, { name: 'Aerie Peak', slug: 'aerie-peak' },
  { name: "Kel'Thuzad", slug: 'kelthuzad' },
] };
const profile = {
  name: 'Thàlindra', realm: { name: 'Aerie Peak', slug: 'aerie-peak' },
  character_class: { name: 'Priest' }, active_spec: { name: 'Discipline', id: 256 },
};
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

class Element {
  constructor(value = '') {
    this.value = value; this.textContent = ''; this.dataset = {}; this.attrs = {};
    this.children = []; this.listeners = new Map(); this.style = {}; this.hidden = true;
    this.disabled = false; this.classList = { add() {}, toggle() {} };
  }
  get options() { return this.children; }
  get selectedOptions() { return this.children.filter(option => option.value === this.value); }
  appendChild(node) { this.children.push(...(node.fragment ? node.children : [node])); }
  replaceChildren(node) { this.children = []; if (node) this.appendChild(node); }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  dispatchEvent(event) { for (const fn of this.listeners.get(event.type) ?? []) fn.call(this, event); }
  setAttribute(name, value) { this.attrs[name] = value; }
  removeAttribute(name) { delete this.attrs[name]; }
  reportValidity() { return !!this.value; }
  focus() { this.focused = true; }
  set innerHTML(html) {
    this.children = [...html.matchAll(/<option(?: value="([^"]*)")?>([^<]*)<\/option>/g)].map(match => {
      const option = new Element(match[1] ?? match[2]); option.textContent = match[2]; return option;
    });
  }
}

const found = [
  { name: 'Thàlindra', realm: 'Aerie Peak', realmSlug: 'aerie-peak', className: 'Priest' },
  { name: 'Thalindra', realm: 'Area 52', realmSlug: 'area-52', className: 'Mage' },
];

async function setup({ search = async () => response({ results: found }), fetchProfile = async () => response(profile), fetchRealms = async () => response(realmData), tokenStatus = 200 } = {}) {
  const elements = new Map();
  const values = { charName: 'thàlindra', realm: 'Area 52', charClass: 'Mage', charSpec: 'Frost', role: 'DPS' };
  const get = id => {
    if (!elements.has(id)) elements.set(id, new Element(values[id] ?? ''));
    return elements.get(id);
  };
  const option = new Element('Area 52'); option.dataset.slug = 'area-52'; get('realm').appendChild(option);
  const calls = [];
  let timerID = 0;
  const timers = new Map();
  const fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/character-search')) return search(JSON.parse(options.body));
    if (url.endsWith('/blizzard-token')) return response({ access_token: 'mock-token' }, tokenStatus);
    if (url.includes('/realm/index')) return fetchRealms();
    if (url.includes('/profile/wow/character/')) return fetchProfile(url, options);
    throw new Error('Unexpected test URL');
  };
  const document = { getElementById: get, createElement: () => new Element(),
    createDocumentFragment: () => Object.assign(new Element(), { fragment: true }) };
  const context = vm.createContext({ document, fetch, AbortSignal, AbortController, DOMException, Event,
    setTimeout: (fn, delay) => { timers.set(++timerID, { fn, delay }); return timerID; },
    clearTimeout: id => timers.delete(id),
    window: { matchMedia: () => ({ matches: true }) }, TypeError, console });
  vm.runInContext(formSource, context);
  vm.runInContext(lookupSource, context);
  for (let i = 0; i < 10 && get('realmListStatus').textContent === 'Updating the US realm list…'; i++) {
    await new Promise(setImmediate);
  }
  return { get, calls, timers, lookup: async () => {
      get('charName').dispatchEvent(new Event('blur'));
      for (let i = 0; i < 10; i++) await new Promise(setImmediate);
    },
    runTimers: async () => {
      for (const [id, timer] of [...timers]) { timers.delete(id); timer.fn(); }
      for (let i = 0; i < 10; i++) await new Promise(setImmediate);
    } };
}

test('loads Blizzard realm names and slugs while keeping the selected realm', async () => {
  const form = await setup();
  assert.equal(form.get('realm').value, 'Area 52');
  assert.equal(form.get('realm').options.length, 4);
  assert.equal(form.get('realm').options.find(o => o.value === "Kel'Thuzad").dataset.slug, 'kelthuzad');
  assert.match(form.get('realmListStatus').textContent, /from Blizzard/);
});

test('fills canonical accented name, realm, class, spec, and role from a public profile', async () => {
  const form = await setup();
  await form.lookup();
  assert.equal(form.get('charName').value, 'Thàlindra');
  assert.equal(form.get('realm').value, 'Aerie Peak');
  assert.equal(form.get('realm').selectedOptions[0].dataset.slug, 'aerie-peak');
  assert.equal(form.get('charClass').value, 'Priest');
  assert.equal(form.get('charSpec').value, 'Discipline');
  assert.equal(form.get('role').value, 'Healer');
  assert.equal(form.get('characterLookupStatus').dataset.state, 'success');
  const call = form.calls.find(c => c.url.includes('/profile/wow/character/'));
  assert.match(call.url, /area-52\/th%C3%A0lindra\?namespace=profile-us/);
  assert.equal(call.options.headers.Authorization, 'Bearer mock-token');
});

test('uses Blizzard realm slugs rather than guessing punctuation', async () => {
  const form = await setup();
  form.get('realm').value = "Kel'Thuzad";
  await form.lookup();
  assert.match(form.calls.find(c => c.url.includes('/profile/wow/character/')).url, /\/kelthuzad\//);
});

test('preserves manual details on missing, invalid, or unavailable profiles', async () => {
  for (const fetchProfile of [async () => response({}, 404), async () => response({}, 503),
    async () => response({ name: 'Incomplete' }), async () => { throw new TypeError('Network'); }]) {
    const form = await setup({ fetchProfile });
    await form.lookup();
    assert.equal(form.get('charName').value, 'thàlindra');
    assert.equal(form.get('charClass').value, 'Mage');
    assert.equal(form.get('realm').value, 'Area 52');
    assert.equal(form.get('characterLookupStatus').dataset.state, 'error');
  }
});

test('keeps the saved realm list and manual entry if the token or realm service fails', async () => {
  for (const options of [{ tokenStatus: 503 }, { fetchRealms: async () => response({}, 503) }]) {
    const form = await setup(options);
    assert.equal(form.get('realm').value, 'Area 52');
    assert.equal(form.get('realm').options.length, 1);
    assert.match(form.get('realmListStatus').textContent, /saved US realm list/);
  }
});

test('ignores an old response after the applicant changes their character or class', async () => {
  for (const [id, event] of [['charName', 'input'], ['charClass', 'change']]) {
    let resolve;
    const form = await setup({ fetchProfile: async () => new Promise(r => { resolve = r; }) });
    form.get('charName').dispatchEvent(new Event('blur'));
    await new Promise(setImmediate);
    const pending = Promise.resolve();
    assert.equal(form.get('characterLookupStatus').dataset.state, 'loading');
    form.get(id).value = 'New choice'; form.get(id).dispatchEvent(new Event(event));
    resolve(response(profile)); await pending;
    assert.equal(form.get(id).value, 'New choice');
    assert.equal(form.get('characterLookupStatus').hidden, true);
  }
});

test('refreshes an expired Blizzard token once and then completes the lookup', async () => {
  let attempt = 0;
  const form = await setup({ fetchProfile: async () => ++attempt === 1 ? response({}, 401) : response(profile) });
  await form.lookup();
  assert.equal(form.get('characterLookupStatus').dataset.state, 'success');
  assert.equal(form.calls.filter(c => c.url.endsWith('/blizzard-token')).length, 2);
  assert.equal(attempt, 2);
});

const searches = form => form.calls.filter(c => c.url.endsWith('/character-search'));
const profileCalls = form => form.calls.filter(c => c.url.includes('/profile/wow/character/'));
const type = (form, value) => {
  form.get('charName').value = value;
  form.get('charName').dispatchEvent(new Event('input'));
};

test('typing searches once after a pause and shows a popup list', async () => {
  const form = await setup();
  for (const name of ['Th', 'Thà', 'Thàl']) type(form, name);
  assert.equal(form.timers.size, 1);
  assert.equal([...form.timers.values()][0].delay, 250);
  assert.equal(searches(form).length, 0);
  await form.runTimers();
  assert.equal(searches(form).length, 1);
  assert.deepEqual(JSON.parse(searches(form)[0].options.body), { term: 'Thàl' });
  const list = form.get('charSuggestions');
  assert.equal(list.hidden, false);
  assert.equal(list.children.length, 2);
  assert.equal(list.children[0].children[0].textContent, 'Thàlindra');
  assert.equal(list.children[0].children[1].textContent, 'Aerie Peak · Priest');
  assert.equal(form.get('charName').attrs['aria-expanded'], 'true');
  assert.equal(profileCalls(form).length, 0);
});

test('skips short names and waits for IME composition to finish', async () => {
  const form = await setup();
  for (const name of ['', 'T']) { type(form, name); assert.equal(form.timers.size, 0); }
  form.get('charName').dispatchEvent(new Event('compositionstart'));
  type(form, 'Thàlindra');
  assert.equal(form.timers.size, 0);
  form.get('charName').dispatchEvent(new Event('compositionend'));
  assert.equal(form.timers.size, 1);
  await form.runTimers();
  assert.equal(searches(form).length, 1);
});

test('the preselected home realm does not narrow the search, a chosen realm does', async () => {
  const form = await setup();
  type(form, 'Thal');
  await form.runTimers();
  assert.equal('realm' in JSON.parse(searches(form)[0].options.body), false);
  form.get('realm').value = "Kel'Thuzad";
  form.get('realm').dispatchEvent(new Event('change'));
  await form.runTimers();
  assert.deepEqual(JSON.parse(searches(form)[1].options.body), { term: 'Thal', realm: 'kelthuzad' });
});

test('clicking a suggestion fills name and realm, closes the list, and fills class and spec', async () => {
  const form = await setup();
  type(form, 'Thal');
  await form.runTimers();
  form.get('charSuggestions').children[0].dispatchEvent(new Event('click'));
  for (let i = 0; i < 10; i++) await new Promise(setImmediate);
  assert.equal(form.get('charSuggestions').hidden, true);
  assert.equal(form.get('charName').value, 'Thàlindra');
  assert.equal(form.get('realm').value, 'Aerie Peak');
  assert.equal(form.get('charClass').value, 'Priest');
  assert.equal(form.get('charSpec').value, 'Discipline');
  assert.equal(profileCalls(form).length, 1);
  assert.match(profileCalls(form)[0].url, /aerie-peak\/th%C3%A0lindra/);
});

test('arrow keys, Enter and Escape drive the popup', async () => {
  const form = await setup();
  type(form, 'Thal');
  await form.runTimers();
  const key = k => {
    const e = new Event('keydown'); e.key = k; e.preventDefault = () => {};
    form.get('charName').dispatchEvent(e);
  };
  key('ArrowDown'); key('ArrowDown');
  assert.equal(form.get('charName').attrs['aria-activedescendant'], 'charSuggestion1');
  key('Escape');
  assert.equal(form.get('charSuggestions').hidden, true);
  type(form, 'Thal'); await form.runTimers();
  key('ArrowUp');
  assert.equal(form.get('charName').attrs['aria-activedescendant'], 'charSuggestion1');
  key('Enter');
  for (let i = 0; i < 10; i++) await new Promise(setImmediate);
  assert.match(profileCalls(form)[0].url, /area-52\/thalindra\?/);
});

test('a failed or empty search hides the popup and leaves manual lookup working', async () => {
  for (const search of [async () => response({}, 404), async () => { throw new TypeError('Network'); },
    async () => response({ results: [] })]) {
    const form = await setup({ search });
    type(form, 'Thal');
    await form.runTimers();
    assert.equal(form.get('charSuggestions').hidden, true);
    await form.lookup();
    assert.equal(form.get('characterLookupStatus').dataset.state, 'success');
  }
});

test('an old search response cannot reopen the popup after the name changes', async () => {
  let resolve;
  const form = await setup({ search: () => new Promise(r => { resolve = r; }) });
  type(form, 'Thal');
  await form.runTimers();
  type(form, 'T');
  resolve(response({ results: found }));
  for (let i = 0; i < 5; i++) await new Promise(setImmediate);
  assert.equal(form.get('charSuggestions').hidden, true);
});

test('typing never triggers an automatic profile lookup by itself', async () => {
  const form = await setup();
  type(form, 'Thalindra');
  await form.runTimers();
  assert.equal(profileCalls(form).length, 0);
});

test('shows the green found message and the not-found message without any button', async () => {
  let form = await setup();
  await form.lookup();
  assert.equal(form.get('characterLookupStatus').dataset.state, 'success');
  assert.equal(form.get('characterLookupStatus').textContent, 'Character found: Thàlindra — Aerie Peak');
  form = await setup({ fetchProfile: async () => response({}, 404) });
  await form.lookup();
  assert.equal(form.get('characterLookupStatus').dataset.state, 'error');
  assert.match(form.get('characterLookupStatus').textContent, /not found/);
});

test('leaving the field twice with the same name checks Blizzard only once', async () => {
  const form = await setup();
  await form.lookup();
  await form.lookup();
  assert.equal(profileCalls(form).length, 1);
});
