// =====================
// BLIZZARD API CONFIG
// =====================
const BLIZZ_CLIENT_ID     = 'ee56dd6d524d4fb7a1deca9715c375f0';
const BLIZZ_CLIENT_SECRET = 'TwRZKDB2R74lXqGlOXyVbUeZuCme1a6n';

const BLIZZ_CLASS_MAP = {
  1: 'Warrior', 2: 'Paladin', 3: 'Hunter', 4: 'Rogue',
  5: 'Priest', 6: 'Death Knight', 7: 'Shaman', 8: 'Mage',
  9: 'Warlock', 10: 'Monk', 11: 'Druid', 12: 'Demon Hunter', 13: 'Evoker',
};

async function getBlizzardToken() {
  const creds = btoa(`${BLIZZ_CLIENT_ID}:${BLIZZ_CLIENT_SECRET}`);
  const res = await fetch('https://oauth.battle.net/token', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  return data.access_token;
}

// =====================
// CLASS CONFIG
// =====================
const CLASS_CONFIG = {
  'Death Knight':  { icon: '💀', color: '#C41E3A' },
  'Demon Hunter':  { icon: '🦇', color: '#A330C9' },
  'Druid':         { icon: '🌿', color: '#FF7C0A' },
  'Evoker':        { icon: '🐉', color: '#33937F' },
  'Hunter':        { icon: '🏹', color: '#AAD372' },
  'Mage':          { icon: '❄️', color: '#3FC7EB' },
  'Monk':          { icon: '🥋', color: '#00FF98' },
  'Paladin':       { icon: '✨', color: '#F48CBA' },
  'Priest':        { icon: '☀️', color: '#FFFFFF' },
  'Rogue':         { icon: '🗡️', color: '#FFF468' },
  'Shaman':        { icon: '⚡', color: '#0070DD' },
  'Warlock':       { icon: '🔮', color: '#8788EE' },
  'Warrior':       { icon: '⚔️', color: '#C69B3A' },
};

const ROLE_ICONS = {
  Tank:   'https://wow.zamimg.com/images/wow/icons/small/ability_warrior_defensivestance.jpg',
  Healer: null,
  DPS:    'https://wow.zamimg.com/images/wow/icons/small/ability_dualwield.jpg',
};

const RANK_LABELS = {
  0: 'Guild Master',
  1: 'Doc Jesus',
  2: 'Calm Direction',
  3: 'Subtle Pressure',
  4: 'Firm Suggestion',
  5: 'Learning Curve',
  6: "It's Fine",
  7: 'Fresh Prospect',
};

const RANK_DESCRIPTIONS = {
  0: 'Guild Master',
  1: 'Officer (Co-GM)',
  2: 'Officer',
  3: 'Officer',
  4: 'Veteran / Raider',
  5: 'Member',
  6: 'Social / Casual Member',
  7: 'Initiate / New Recruit',
};

// =====================
// ROSTER STATE
// =====================
let liveRoster = [];
let currentFilter = 'all';
let currentRankFilter = 'all';
let currentSort = 'rank';
let blizzToken = null;
const thumbnailCache = {};
const statsCache = {};
const statsPending = {};

// Seasons listed newest → oldest.
const SEASON_ORDER = [
  'season-tww-3',
  'season-tww-2',
  'season-tww-1',
  'season-df-3',
  'season-df-2',
  'season-df-1',
];

function seasonLabel(slug) {
  const m = slug?.match(/-(\d+)$/);
  return m ? 'S' + m[1] : '';
}

// Raids listed newest → oldest. Add new raid slugs to the front when a new tier releases.
const RAID_ORDER = [
  'manaforge-omega',
  'blackrock-depths',
  'liberation-of-undermine',
  'nerubar-palace',
  'nerub-ar-palace',
  'amirdrassil-the-dreams-hope',
  'aberrus-the-shadowed-crucible',
  'vault-of-the-incarnates',
];

function latestRaid(progression) {
  if (!progression) return null;
  // Try each raid newest-first; prefer one where the player has kills
  for (const slug of RAID_ORDER) {
    const r = progression[slug];
    if (r && (r.mythic_bosses_killed || r.heroic_bosses_killed || r.normal_bosses_killed)) {
      return r;
    }
  }
  // No kills found — return first recognised raid (for "0/8" display)
  for (const slug of RAID_ORDER) {
    if (progression[slug]) return progression[slug];
  }
  // Ultimate fallback: last key in the object
  const keys = Object.keys(progression);
  return keys.length ? progression[keys[keys.length - 1]] : null;
}

function raidSortValue(progression) {
  const r = latestRaid(progression);
  if (!r) return -1;
  return (r.mythic_bosses_killed || 0) * 10000
       + (r.heroic_bosses_killed || 0) * 100
       + (r.normal_bosses_killed || 0);
}

function raidSummary(progression) {
  const r = latestRaid(progression);
  if (!r) return null;
  const mythic = r.mythic_bosses_killed || 0;
  const heroic = r.heroic_bosses_killed || 0;
  const normal = r.normal_bosses_killed || 0;
  const total  = r.total_bosses || 8;
  if (!mythic && !heroic && !normal) return null;
  if (mythic > 0) return { text: `${mythic}/${total} M`, color: '#e8a836' };
  if (heroic > 0) return { text: `${heroic}/${total} H`, color: '#a335ee' };
  return { text: `${normal}/${total} N`, color: '#1eff00' };
}

function normalizeRole(role) {
  if (!role) return 'DPS';
  const r = role.toUpperCase();
  if (r === 'TANK') return 'Tank';
  if (r === 'HEALER' || r === 'HEALING') return 'Healer';
  return 'DPS';
}

// =====================
// BUILD RANK DROPDOWN
// =====================
function buildRankButtons() {
  const sel = document.getElementById('rankFilter');
  if (!sel) return;
  sel.innerHTML = `<option value="all">All Ranks</option>` +
    Object.keys(RANK_LABELS)
      .sort((a, b) => Number(a) - Number(b))
      .map(r => `<option value="${r}">${RANK_LABELS[r]}</option>`)
      .join('');
  sel.value = currentRankFilter === 'all' ? 'all' : String(currentRankFilter);
}

// =====================
// BUILD ROSTER
// =====================
function buildRoster(filter = currentFilter) {
  currentFilter = filter;
  const grid = document.getElementById('rosterGrid');

  if (liveRoster.length === 0) {
    grid.innerHTML = '<p style="color:#888;text-align:center;grid-column:1/-1">Loading roster...</p>';
    return;
  }

  let filtered = filter === 'all' ? liveRoster : liveRoster.filter(m => m.role === filter);
  if (currentRankFilter !== 'all') filtered = filtered.filter(m => m.rank === currentRankFilter);

  filtered = [...filtered].sort((a, b) => {
    const sa = statsCache[a.name];
    const sb = statsCache[b.name];
    switch (currentSort) {
      case 'name-asc':  return a.name.localeCompare(b.name);
      case 'name-desc': return b.name.localeCompare(a.name);
      case 'score': {
        const va = Math.max(sa?.mpScore ?? 0, sa?.mpPrev ?? 0);
        const vb = Math.max(sb?.mpScore ?? 0, sb?.mpPrev ?? 0);
        return vb - va || a.name.localeCompare(b.name);
      }
      case 'raid': {
        const va = raidSortValue(sa?.progression);
        const vb = raidSortValue(sb?.progression);
        return vb - va || a.name.localeCompare(b.name);
      }
      default: // rank
        return a.rank !== b.rank ? a.rank - b.rank : a.name.localeCompare(b.name);
    }
  });

  const counter = document.getElementById('rosterCounter');
  if (counter) counter.textContent = `${filtered.length} member${filtered.length !== 1 ? 's' : ''}`;

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="color:#888;text-align:center;grid-column:1/-1">No members found.</p>';
    return;
  }

  grid.innerHTML = filtered.map(member => {
    const cfg = CLASS_CONFIG[member.class] || { icon: '⚔️', color: '#888' };
    const roleClass = 'role-' + member.role.toLowerCase();
    const rankLabel = RANK_LABELS[member.rank] ?? `Rank ${member.rank}`;
    const rankDesc  = RANK_DESCRIPTIONS[member.rank] ?? '';
    const thumb = thumbnailCache[member.name];
    const stats = statsCache[member.name];

    const avatarContent = thumb
      ? `<img src="${thumb}" alt="${member.name}" class="roster-avatar-img" />`
      : `<span class="roster-avatar-icon">${cfg.icon}</span>`;

    const mpScore     = stats ? stats.mpScore     : null;
    const mpColor     = stats ? stats.mpColor     : '#888';
    const mpScoreSlug = stats ? stats.mpScoreSlug : null;
    const mpPrev      = stats ? stats.mpPrev      : null;
    const mpPrevColor = stats ? stats.mpPrevColor : '#888';
    const mpPrevSlug  = stats ? stats.mpPrevSlug  : null;
    const raid        = stats ? raidSummary(stats.progression) : null;

    const statsHtml = `
      <div class="roster-stats">
        <span class="roster-stat" title="Current Season M+">
          <img class="stat-icon-img" src="https://wow.zamimg.com/images/wow/icons/small/achievement_challengemode_gold.jpg" alt="M+" />
          <span class="rs-season-label rs-curr-label">${mpScoreSlug ? seasonLabel(mpScoreSlug) : ''}</span>
          <span class="rs-score" style="color:${mpScore !== null ? mpColor : '#555'}">
            ${mpScore !== null ? Math.round(mpScore) : '—'}
          </span>
        </span>
        <span class="roster-stat" title="Previous Season M+">
          <img class="stat-icon-img" src="https://wow.zamimg.com/images/wow/icons/small/achievement_challengemode_gold.jpg" alt="M+" />
          <span class="rs-season-label rs-prev-label">${mpPrevSlug ? seasonLabel(mpPrevSlug) : ''}</span>
          <span class="rs-prev-score" style="color:${mpPrev !== null ? mpPrevColor : '#555'}">
            ${mpPrev !== null ? Math.round(mpPrev) : '—'}
          </span>
        </span>
        <span class="roster-stat" title="Raid Progress">
          <img class="stat-icon-img" src="https://wow.zamimg.com/images/wow/icons/small/achievement_boss_archimonde.jpg" alt="Raid" />
          <span class="rs-raid" style="color:${raid ? raid.color : '#555'}">
            ${raid ? raid.text : '—'}
          </span>
        </span>
      </div>`;

    return `
      <a class="roster-card" href="${member.profileUrl}" target="_blank" rel="noopener"
         style="text-decoration:none" data-name="${member.name}" data-realm="${member.realmSlug}" data-color="${cfg.color}">
        <div class="roster-avatar" style="background:${cfg.color}22; border: 1px solid ${cfg.color}44">
          ${avatarContent}
        </div>
        <div class="roster-name">${member.name}</div>
        <div class="roster-class">${member.spec ? member.spec + ' ' : ''}${member.class}</div>
        <div class="roster-badges">
          <span class="roster-role ${roleClass}" title="${member.role}">${ROLE_ICONS[member.role] ? `<img src="${ROLE_ICONS[member.role]}" class="role-icon" alt="${member.role}" />` : `<span class="role-icon-plus">✚</span>`}</span>
          <span class="roster-rank" title="${rankDesc}">${rankLabel}</span>
        </div>
        ${statsHtml}
      </a>`;
  }).join('');

  observeRosterCards();
}

// =====================
// STATS HELPERS
// =====================
function getBestScore(season) {
  let best = 0, bestColor = '#888';
  for (const k of ['all', 'dps', 'healer', 'tank']) {
    const s = season?.scores?.[k] ?? 0;
    if (s > best) { best = s; bestColor = season?.segments?.[k]?.color ?? '#888'; }
  }
  return { score: best > 0 ? best : null, color: bestColor, slug: season?.season ?? null };
}

function parseStats(data) {
  if (!data || data.statusCode || data.error) {
    return { mpScore: null, mpColor: '#888', mpScoreSlug: null, mpPrev: null, mpPrevColor: '#888', mpPrevSlug: null, progression: null };
  }
  const seasons = [...(data.mythic_plus_scores_by_season ?? [])].sort((a, b) => {
    const ai = SEASON_ORDER.indexOf(a.season);
    const bi = SEASON_ORDER.indexOf(b.season);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  const curr = seasons[0] ? getBestScore(seasons[0]) : { score: null, color: '#888', slug: null };
  const prev = seasons[1] ? getBestScore(seasons[1]) : { score: null, color: '#888', slug: null };
  return {
    mpScore: curr.score, mpColor: curr.color, mpScoreSlug: curr.slug,
    mpPrev:  prev.score, mpPrevColor: prev.color, mpPrevSlug: prev.slug,
    progression: data.raid_progression ?? null,
  };
}

function fetchStats(name, realmSlug) {
  if (statsCache[name]) return Promise.resolve();
  if (statsPending[name]) return statsPending[name];
  const p = fetch(
    `https://raider.io/api/v1/characters/profile?region=us&realm=${realmSlug}&name=${encodeURIComponent(name)}&fields=mythic_plus_scores_by_season:current,mythic_plus_scores_by_season:previous,raid_progression`
  )
    .then(r => r.json())
    .then(data => { statsCache[name] = parseStats(data); })
    .catch(() => { statsCache[name] = { mpScore: null, mpColor: '#888', mpScoreSlug: null, mpPrev: null, mpPrevColor: '#888', mpPrevSlug: null, progression: null }; })
    .finally(() => { delete statsPending[name]; });
  statsPending[name] = p;
  return p;
}

async function fetchAllStats() {
  const grid = document.getElementById('rosterGrid');
  if (grid) grid.style.opacity = '0.5';
  await Promise.all(liveRoster.map(m => fetchStats(m.name, m.realmSlug)));
  if (grid) grid.style.opacity = '';
}

// =====================
// LAZY THUMBNAIL & STATS
// =====================
const thumbObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const card = entry.target;
    const name  = card.dataset.name;
    const realm = card.dataset.realm || 'area-52';
    if (!name || (thumbnailCache[name] && statsCache[name])) return;

    thumbObserver.unobserve(card);

    // Blizzard: portrait (fall back to Raider.io if unavailable)
    if (!thumbnailCache[name]) {
      const setAvatar = (url) => {
        thumbnailCache[name] = url;
        const avatarDiv = card.querySelector('.roster-avatar');
        if (avatarDiv) avatarDiv.innerHTML = `<img src="${url}" alt="${name}" class="roster-avatar-img" />`;
      };

      const blizzMediaPromise = blizzToken
        ? fetch(
            `https://us.api.blizzard.com/profile/wow/character/${realm}/${encodeURIComponent(name.toLowerCase())}/character-media?namespace=profile-us&locale=en_US`,
            { headers: { 'Authorization': `Bearer ${blizzToken}` } }
          )
            .then(r => r.json())
            .then(data => data.assets?.find(a => a.key === 'avatar')?.value || null)
            .catch(() => null)
        : Promise.resolve(null);

      blizzMediaPromise.then(avatar => {
        if (avatar) { setAvatar(avatar); return; }
        // Raider.io fallback for portrait
        fetch(`https://raider.io/api/v1/characters/profile?region=us&realm=${realm}&name=${encodeURIComponent(name)}&fields=thumbnail_url`)
          .then(r => r.json())
          .then(data => { if (data.thumbnail_url) setAvatar(data.thumbnail_url); })
          .catch(() => {});
      });
    }

    // Raider.io: stats only
    if (!statsCache[name]) {
      fetchStats(name, realm).then(() => {
        const s = statsCache[name];
        if (!s) return;
        const raid        = raidSummary(s.progression);
        const currLabelEl = card.querySelector('.rs-curr-label');
        const scoreEl     = card.querySelector('.rs-score');
        const prevLabelEl = card.querySelector('.rs-prev-label');
        const prevEl      = card.querySelector('.rs-prev-score');
        const raidEl      = card.querySelector('.rs-raid');
        if (currLabelEl) currLabelEl.textContent = s.mpScoreSlug ? seasonLabel(s.mpScoreSlug) : '';
        if (scoreEl)     { scoreEl.textContent = s.mpScore !== null ? Math.round(s.mpScore) : '—'; scoreEl.style.color = s.mpScore ? s.mpColor : '#555'; }
        if (prevLabelEl) prevLabelEl.textContent = s.mpPrevSlug ? seasonLabel(s.mpPrevSlug) : '';
        if (prevEl)      { prevEl.textContent = s.mpPrev !== null ? Math.round(s.mpPrev) : '—'; prevEl.style.color = s.mpPrev ? s.mpPrevColor : '#555'; }
        if (raidEl)      { raidEl.textContent = raid ? raid.text : '—'; raidEl.style.color = raid ? raid.color : '#555'; }
      });
    }
  });
}, { rootMargin: '100px' });

function observeRosterCards() {
  document.querySelectorAll('.roster-card[data-name]').forEach(card => {
    if (!thumbnailCache[card.dataset.name] || !statsCache[card.dataset.name]) {
      thumbObserver.observe(card);
    }
  });
}

// =====================
// FETCH ROSTER
// =====================
async function fetchRoster() {
  const grid = document.getElementById('rosterGrid');
  grid.innerHTML = '<p style="color:#888;text-align:center;grid-column:1/-1">Loading roster...</p>';

  // Always fetch Raider.io (fallback + enrichment)
  const rioRes = await fetch(
    'https://raider.io/api/v1/guilds/profile?region=us&realm=area-52&name=PassiveAggressive&fields=members'
  ).catch(() => null);

  const rioMap = {};
  const rioMembers = [];
  if (rioRes?.ok) {
    const rioData = await rioRes.json();
    for (const m of rioData.members) {
      const key = m.character.name.toLowerCase();
      rioMap[key] = {
        spec:       m.character.active_spec_name || '',
        role:       normalizeRole(m.character.active_spec_role),
        profileUrl: m.character.profile_url,
        realmSlug:  m.character.realm.toLowerCase().replace(/\s+/g, '-').replace(/'/g, ''),
      };
      rioMembers.push(m);
    }
  }

  // Try Blizzard for full roster
  let useBlizzard = false;
  try {
    blizzToken = await getBlizzardToken();
    const blizzRes = await fetch(
      'https://us.api.blizzard.com/data/wow/guild/area-52/passiveaggressive/roster?namespace=profile-us&locale=en_US',
      { headers: { 'Authorization': `Bearer ${blizzToken}` } }
    );
    if (blizzRes.ok) {
      const blizzData = await blizzRes.json();
      liveRoster = blizzData.members.map(m => {
        const name      = m.character.name;
        const realmSlug = m.character.realm.slug;
        const rio       = rioMap[name.toLowerCase()];
        return {
          name,
          class:      BLIZZ_CLASS_MAP[m.character.playable_class.id] || 'Unknown',
          spec:       rio?.spec  || '',
          role:       rio?.role  || 'DPS',
          rank:       m.rank,
          realmSlug,
          profileUrl: rio?.profileUrl || `https://worldofwarcraft.blizzard.com/en-us/character/us/${realmSlug}/${encodeURIComponent(name)}`,
        };
      });
      useBlizzard = true;
    }
  } catch (err) {
    console.warn('Blizzard API unavailable, falling back to Raider.io:', err);
  }

  // Fallback: use Raider.io members only
  if (!useBlizzard) {
    if (rioMembers.length === 0) {
      grid.innerHTML = '<p style="color:#888;text-align:center;grid-column:1/-1">Could not load roster. Check back later.</p>';
      return;
    }
    liveRoster = rioMembers.map(m => ({
      name:       m.character.name,
      class:      m.character.class,
      spec:       m.character.active_spec_name || '',
      role:       normalizeRole(m.character.active_spec_role),
      rank:       m.rank,
      realmSlug:  m.character.realm.toLowerCase().replace(/\s+/g, '-').replace(/'/g, ''),
      profileUrl: m.character.profile_url,
    }));
  }

  liveRoster.sort((a, b) => a.rank !== b.rank ? a.rank - b.rank : a.name.localeCompare(b.name));

  buildRankButtons();
  buildRoster(currentFilter);

  // Eagerly fetch all stats then re-render so scores show without needing to scroll
  fetchAllStats().then(() => buildRoster(currentFilter));
}

// =====================
// FILTER & SORT
// =====================
document.getElementById('roleFilter')?.addEventListener('change', e => {
  currentFilter = e.target.value;
  buildRoster(currentFilter);
});

document.getElementById('rankFilter')?.addEventListener('change', e => {
  currentRankFilter = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
  buildRoster(currentFilter);
});

document.getElementById('sortSelect')?.addEventListener('change', async e => {
  currentSort = e.target.value;
  if (currentSort === 'score' || currentSort === 'raid') {
    await fetchAllStats();
  }
  buildRoster(currentFilter);
});

// =====================
// INIT
// =====================
fetchRoster();
