// Public retail-US profiles, using the site's existing Blizzard token proxy.
// A profile lookup confirms public character data, not account ownership.
(function () {
  const nameInput = document.getElementById('charName');
  const realmSelect = document.getElementById('realm');
  const button = document.getElementById('characterLookup');
  const status = document.getElementById('characterLookupStatus');
  if (!nameInput || !realmSelect || !button || !status) return;

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
  let lookupTimer = null;
  let composingName = false;

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
    clearTimeout(lookupTimer);
    lookupTimer = null;
    requestVersion++;
    lookupController?.abort();
    button.disabled = false;
    button.textContent = 'Look up Character';
    status.hidden = true;
  }
  function scheduleLookup() {
    invalidateLookup();
    if (composingName || nameInput.value.trim().length < 2 || !realmSelect.value) return;
    lookupTimer = setTimeout(() => {
      lookupTimer = null;
      lookupCharacter(true);
    }, 700);
  }
  nameInput.addEventListener('input', scheduleLookup);
  nameInput.addEventListener('compositionstart', () => {
    composingName = true;
    invalidateLookup();
  });
  nameInput.addEventListener('compositionend', () => {
    composingName = false;
    scheduleLookup();
  });
  realmSelect.addEventListener('change', scheduleLookup);
  // Do not let an in-flight response overwrite a class/spec/role being edited.
  [classSelect, specSelect, roleSelect].forEach(select => select.addEventListener('change', invalidateLookup));

  async function lookupCharacter(automatic = false) {
    if (button.disabled) return;
    clearTimeout(lookupTimer);
    lookupTimer = null;
    if (!automatic && (!nameInput.reportValidity() || !realmSelect.reportValidity())) return;
    const name = nameInput.value.trim().normalize('NFC');
    if (automatic && (composingName || name.length < 2 || !realmSelect.value || nameInput.validity?.valid === false)) return;
    if (!name) { nameInput.focus(); return; }
    const slug = realmSlug();
    const version = ++requestVersion;
    lookupController = new AbortController();
    const signal = AbortSignal.any([lookupController.signal, AbortSignal.timeout(15000)]);
    button.disabled = true; button.textContent = 'Looking up…';
    status.hidden = false; status.dataset.state = 'loading';
    status.textContent = 'Checking your character with Blizzard…';
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
      status.textContent = `Found ${data.name} — ${data.realm.name}. Name, realm, and class filled from Blizzard${data.active_spec?.name ? ', along with your active spec and role' : ''}. You can change spec or role for this application.`;
    } catch (error) {
      if (version !== requestVersion) return;
      status.dataset.state = 'error';
      status.textContent = error.status === 404
        ? automatic
          ? 'No matching character yet on this realm. Finish typing the full name, including accents, or enter your details manually.'
          : 'Character not found on that realm. Check the spelling, accents, and realm, or fill in your details manually.'
        : 'Blizzard lookup is unavailable right now. You can still fill in your character details and submit your application.';
    } finally {
      if (version === requestVersion) {
        button.disabled = false; button.textContent = 'Look up Character';
      }
    }
  }
  button.addEventListener('click', () => lookupCharacter());

  loadRealms();
})();
