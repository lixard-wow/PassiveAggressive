// Public retail-US profiles, using the site's existing Blizzard token proxy.
// A profile lookup confirms public character data, not account ownership.
(function () {
  const nameInput = document.getElementById('charName');
  const realmSelect = document.getElementById('realm');
  const status = document.getElementById('characterLookupStatus');
  if (!nameInput || !realmSelect || !status || !document.getElementById('charSuggestions')) return;

  const classSelect = document.getElementById('charClass');
  const specSelect = document.getElementById('charSpec');
  const roleSelect = document.getElementById('role');
  const realmStatus = document.getElementById('realmListStatus');
  const workerURL = 'https://pa-proxy.pnutjr-lw.workers.dev';
  const tankSpecs = new Set([250, 581, 104, 268, 66, 73]);
  const healerSpecs = new Set([105, 270, 65, 256, 257, 264, 1468]);
  let tokenPromise = null;
  let requestVersion = 0;
  let lookupController = null;
  let fillingProfile = false;
  let composingName = false;
  let searchTimer = null;
  let searchVersion = 0;
  let searchController = null;
  let suggestions = [];
  let activeIndex = -1;
  let realmChosen = false;
  let lastLookupKey = '';
  const list = document.getElementById('charSuggestions');

  function getToken() {
    if (!tokenPromise) {
      tokenPromise = fetch(`${workerURL}/blizzard-token`, {
        method: 'POST', signal: AbortSignal.timeout(10000),
      }).then(async response => {
        if (!response.ok) throw new Error('Blizzard connection unavailable');
        const data = await response.json();
        if (typeof data.access_token !== 'string' || !data.access_token) throw new Error('Blizzard connection unavailable');
        return data.access_token;
      }).catch(error => { tokenPromise = null; throw error; });
    }
    return tokenPromise;
  }

  async function blizzard(path, signal) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await getToken();
      if (signal.aborted) throw new DOMException('Lookup cancelled', 'AbortError');
      const response = await fetch(`https://us.api.blizzard.com${path}`, {
        headers: { Authorization: `Bearer ${token}` }, signal,
      });
      if (response.status === 401 && attempt === 0) { tokenPromise = null; continue; }
      if (!response.ok) {
        const error = new Error('Blizzard request failed');
        error.status = response.status;
        throw error;
      }
      return response.json();
    }
  }

  function realmSlug() {
    return realmSelect.selectedOptions[0]?.dataset.slug || realmSelect.value
      .normalize('NFC').toLowerCase().trim().replace(/['’]/g, '').replace(/\s+/g, '-');
  }

  function ensureOption(select, value, slug) {
    let option = Array.from(select.options).find(item => item.value === value);
    if (!option) {
      option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    }
    if (slug) option.dataset.slug = slug;
    select.value = value;
  }

  async function loadRealms() {
    realmStatus.textContent = 'Updating the US realm list…';
    try {
      const data = await blizzard('/data/wow/realm/index?namespace=dynamic-us&locale=en_US', AbortSignal.timeout(15000));
      const realms = data.realms?.filter(realm => typeof realm.name === 'string' &&
        typeof realm.slug === 'string' && /^[a-z0-9-]+$/.test(realm.slug));
      if (!realms?.length) throw new Error('Realm list unavailable');
      const selected = realmSelect.value;
      // Keep the existing selection valid while the asynchronous list arrives.
      if (selected && !realms.some(realm => realm.name === selected)) throw new Error('Selected realm unavailable');
      const options = document.createDocumentFragment();
      const placeholder = document.createElement('option');
      placeholder.value = ''; placeholder.textContent = 'Select a realm';
      options.appendChild(placeholder);
      realms.sort((a, b) => a.name.localeCompare(b.name)).forEach(realm => {
        const option = document.createElement('option');
        option.value = realm.name; option.textContent = realm.name; option.dataset.slug = realm.slug;
        options.appendChild(option);
      });
      realmSelect.replaceChildren(options);
      realmSelect.value = selected || 'Area 52';
      realmStatus.textContent = 'US realms from Blizzard. Area 52 is our home realm; choose your character’s realm.';
    } catch {
      realmStatus.textContent = 'Using the saved US realm list. Character lookup is optional; you can enter your details manually.';
    }
  }

  function invalidateLookup() {
    if (fillingProfile) return;
    requestVersion++;
    lookupController?.abort();
    lastLookupKey = '';
    status.hidden = true;
  }

  function hideSuggestions() {
    clearTimeout(searchTimer);
    searchTimer = null;
    searchVersion++;
    searchController?.abort();
    suggestions = [];
    activeIndex = -1;
    list.replaceChildren();
    list.hidden = true;
    nameInput.setAttribute('aria-expanded', 'false');
    nameInput.removeAttribute('aria-activedescendant');
  }

  function setActive(index) {
    activeIndex = index;
    Array.from(list.children).forEach((item, i) => {
      item.setAttribute('aria-selected', String(i === index));
      item.classList.toggle('active', i === index);
    });
    if (index >= 0) {
      nameInput.setAttribute('aria-activedescendant', list.children[index].id);
      list.children[index].scrollIntoView?.({ block: 'nearest' });
    } else nameInput.removeAttribute('aria-activedescendant');
  }

  function showSuggestions(results) {
    suggestions = results;
    activeIndex = -1;
    const items = document.createDocumentFragment();
    results.forEach((result, index) => {
      const item = document.createElement('li');
      item.id = `charSuggestion${index}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', 'false');
      const name = document.createElement('span');
      name.className = 'suggestion-name'; name.textContent = result.name;
      const meta = document.createElement('span');
      meta.className = 'suggestion-meta'; meta.textContent = `${result.realm} · ${result.className}`;
      item.appendChild(name); item.appendChild(meta);
      // mousedown keeps focus in the input so its blur handler doesn't close the list first.
      item.addEventListener('mousedown', event => event.preventDefault());
      item.addEventListener('click', () => chooseSuggestion(index));
      items.appendChild(item);
    });
    list.replaceChildren(items);
    list.hidden = !results.length;
    nameInput.setAttribute('aria-expanded', String(results.length > 0));
    nameInput.removeAttribute('aria-activedescendant');
  }

  function chooseSuggestion(index) {
    const choice = suggestions[index];
    if (!choice) return;
    hideSuggestions();
    nameInput.value = choice.name;
    ensureOption(realmSelect, choice.realm, choice.realmSlug);
    realmChosen = true;
    lookupCharacter();
  }

  async function searchCharacters() {
    searchTimer = null;
    const term = nameInput.value.trim().normalize('NFC');
    if (composingName || term.length < 2) return;
    const version = ++searchVersion;
    searchController?.abort();
    searchController = new AbortController();
    // The realm only narrows the search once the applicant has chosen one; the preselected home realm doesn't.
    const body = { term, ...(realmChosen && realmSelect.value ? { realm: realmSlug() } : {}) };
    try {
      const response = await fetch(`${workerURL}/character-search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        signal: AbortSignal.any([searchController.signal, AbortSignal.timeout(8000)]),
      });
      if (!response.ok) throw new Error('Search unavailable');
      const data = await response.json();
      if (version !== searchVersion) return;
      showSuggestions(Array.isArray(data.results) ? data.results.slice(0, 25) : []);
    } catch {
      // Suggestions are a convenience; typing a full name still gets checked when you leave the field.
      if (version === searchVersion) hideSuggestions();
    }
  }

  const plain = text => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

  // keepList: while typing the same realm filter applies, so the current list can be
  // narrowed instantly instead of blinking empty until the server answers.
  function scheduleSearch(keepList = false) {
    invalidateLookup();
    const term = nameInput.value.trim().normalize('NFC');
    const local = keepList === true && term.length >= 2
      ? suggestions.filter(item => plain(item.name).startsWith(plain(term))) : [];
    hideSuggestions();
    if (composingName || term.length < 2) return;
    if (local.length) showSuggestions(local);
    searchTimer = setTimeout(searchCharacters, 120);
  }
  nameInput.addEventListener('input', () => scheduleSearch(true));
  nameInput.addEventListener('compositionstart', () => {
    composingName = true;
    invalidateLookup();
    hideSuggestions();
  });
  nameInput.addEventListener('compositionend', () => {
    composingName = false;
    scheduleSearch();
  });
  nameInput.addEventListener('blur', () => {
    hideSuggestions();
    lookupCharacter();
  });
  nameInput.addEventListener('keydown', event => {
    if (list.hidden || !suggestions.length) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((activeIndex + 1) % suggestions.length); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(activeIndex <= 0 ? suggestions.length - 1 : activeIndex - 1); }
    else if (event.key === 'Enter' && activeIndex >= 0) { event.preventDefault(); chooseSuggestion(activeIndex); }
    else if (event.key === 'Escape') { event.preventDefault(); hideSuggestions(); }
  });
  realmSelect.addEventListener('change', () => {
    realmChosen = !!realmSelect.value;
    scheduleSearch();
    lookupCharacter();
  });
  // Do not let an in-flight response overwrite a class/spec/role being edited.
  [classSelect, specSelect, roleSelect].forEach(select => select.addEventListener('change', invalidateLookup));

  async function lookupCharacter() {
    const name = nameInput.value.trim().normalize('NFC');
    if (composingName || name.length < 2 || !realmSelect.value || nameInput.validity?.valid === false) return;
    const slug = realmSlug();
    const key = `${slug}/${name.toLowerCase()}`;
    if (key === lastLookupKey) return;
    lastLookupKey = key;
    const version = ++requestVersion;
    lookupController?.abort();
    lookupController = new AbortController();
    const signal = AbortSignal.any([lookupController.signal, AbortSignal.timeout(15000)]);
    status.hidden = false; status.dataset.state = 'loading';
    status.textContent = 'Checking Blizzard…';
    try {
      const path = `/profile/wow/character/${encodeURIComponent(slug)}/${encodeURIComponent(name.toLowerCase())}?namespace=profile-us&locale=en_US`;
      const data = await blizzard(path, signal);
      if (version !== requestVersion) return;
      if (typeof data.name !== 'string' || !data.name || typeof data.realm?.name !== 'string' ||
          !data.realm.name || typeof data.realm.slug !== 'string' ||
          typeof data.character_class?.name !== 'string' || !data.character_class.name) {
        throw new Error('Incomplete character data');
      }
      nameInput.value = data.name;
      ensureOption(realmSelect, data.realm.name, data.realm.slug);
      ensureOption(classSelect, data.character_class.name);
      // Rebuild spec choices without cancelling our own successful lookup.
      fillingProfile = true;
      try { classSelect.dispatchEvent(new Event('change')); }
      finally { fillingProfile = false; }
      if (typeof data.active_spec?.name === 'string' && data.active_spec.name) {
        ensureOption(specSelect, data.active_spec.name);
        roleSelect.value = tankSpecs.has(data.active_spec.id) ? 'Tank'
          : healerSpecs.has(data.active_spec.id) ? 'Healer' : 'DPS';
      }
      status.hidden = false; status.dataset.state = 'success';
      lastLookupKey = `${data.realm.slug}/${data.name.toLowerCase()}`;
      status.textContent = `Character found: ${data.name} — ${data.realm.name}`;
    } catch (error) {
      if (version !== requestVersion) return;
      status.dataset.state = 'error';
      lastLookupKey = '';
      status.textContent = error.status === 404
        ? 'Character not found on that realm. Check the spelling, accents, and realm, or fill in your details manually.'
        : 'Blizzard lookup is unavailable right now. You can still fill in your character details and submit your application.';
    }
  }

  loadRealms();
})();
