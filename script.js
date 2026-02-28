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

const RANK_LABELS = {
  0: 'Guild Master',
  1: 'Officer',
  2: 'Officer Alt',
};

// =====================
// ROSTER STATE
// =====================
let liveRoster = [];
let currentFilter = 'all';
const thumbnailCache = {};
const statsCache = {};

const CURRENT_RAID = 'liberation-of-undermine';
const CURRENT_RAID_LABEL = 'Liberation of Undermine';

function raidSummary(progression) {
  if (!progression || !progression[CURRENT_RAID]) return null;
  const r = progression[CURRENT_RAID];
  if (r.mythic_bosses_killed > 0)  return { text: `${r.mythic_bosses_killed}/${r.total_bosses} M`, color: '#e8a836' };
  if (r.heroic_bosses_killed > 0)  return { text: `${r.heroic_bosses_killed}/${r.total_bosses} H`, color: '#a335ee' };
  if (r.normal_bosses_killed > 0)  return { text: `${r.normal_bosses_killed}/${r.total_bosses} N`, color: '#1eff00' };
  return { text: `0/${r.total_bosses}`, color: '#888' };
}

function normalizeRole(role) {
  if (!role) return 'DPS';
  const r = role.toUpperCase();
  if (r === 'TANK') return 'Tank';
  if (r === 'HEALER' || r === 'HEALING') return 'Healer';
  return 'DPS';
}

function buildRoster(filter = currentFilter) {
  currentFilter = filter;
  const grid = document.getElementById('rosterGrid');

  if (liveRoster.length === 0) {
    grid.innerHTML = '<p style="color:#888;text-align:center;grid-column:1/-1">Loading roster...</p>';
    return;
  }

  const filtered = filter === 'all'
    ? liveRoster
    : liveRoster.filter(m => m.role === filter);

  const counter = document.getElementById('rosterCounter');
  if (counter) counter.textContent = `${filtered.length} member${filtered.length !== 1 ? 's' : ''}`;

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="color:#888;text-align:center;grid-column:1/-1">No members found.</p>';
    return;
  }

  grid.innerHTML = filtered.map(member => {
    const cfg = CLASS_CONFIG[member.class] || { icon: '⚔️', color: '#888' };
    const roleClass = 'role-' + member.role.toLowerCase();
    const rankLabel = RANK_LABELS[member.rank];
    const thumb = thumbnailCache[member.name];
    const stats = statsCache[member.name];

    const avatarContent = thumb
      ? `<img src="${thumb}" alt="${member.name}" class="roster-avatar-img" />`
      : `<span class="roster-avatar-icon">${cfg.icon}</span>`;

    const mpScore = stats ? stats.mpScore : null;
    const mpColor = stats ? stats.mpColor : '#888';
    const raid    = stats ? raidSummary(stats.progression) : null;

    const statsHtml = `
      <div class="roster-stats">
        <span class="roster-stat" title="M+ Score">
          <span class="stat-icon">⚡</span>
          <span class="rs-score" style="color:${mpScore !== null ? mpColor : '#555'}">
            ${mpScore !== null ? Math.round(mpScore) : '—'}
          </span>
        </span>
        <span class="roster-stat" title="${CURRENT_RAID_LABEL}">
          <span class="stat-icon">⚔</span>
          <span class="rs-raid" style="color:${raid ? raid.color : '#555'}">
            ${raid ? raid.text : '—'}
          </span>
        </span>
      </div>
    `;

    return `
      <a class="roster-card" href="${member.profileUrl}" target="_blank" rel="noopener"
         style="text-decoration:none" data-name="${member.name}" data-realm="${member.realmSlug}" data-color="${cfg.color}">
        <div class="roster-avatar" style="background:${cfg.color}22; border: 1px solid ${cfg.color}44">
          ${avatarContent}
        </div>
        <div class="roster-name">${member.name}</div>
        <div class="roster-class">${member.spec ? member.spec + ' ' : ''}${member.class}</div>
        ${rankLabel ? `<span class="roster-role role-officer">${rankLabel}</span>` : `<span class="roster-role ${roleClass}">${member.role}</span>`}
        ${statsHtml}
      </a>
    `;
  }).join('');

  // lazy-load thumbnails for visible cards
  observeRosterCards();
}

// =====================
// LAZY THUMBNAIL LOADING
// =====================
const thumbObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const card = entry.target;
    const name = card.dataset.name;
    const realm = card.dataset.realm || 'area-52';
    if (!name || (thumbnailCache[name] && statsCache[name])) return;

    thumbObserver.unobserve(card);

    fetch(`https://raider.io/api/v1/characters/profile?region=us&realm=${realm}&name=${encodeURIComponent(name)}&fields=thumbnail_url,mythic_plus_scores_by_season:current,raid_progression`)
      .then(r => r.json())
      .then(data => {
        // avatar
        if (data.thumbnail_url) {
          thumbnailCache[name] = data.thumbnail_url;
          const avatarDiv = card.querySelector('.roster-avatar');
          if (avatarDiv) avatarDiv.innerHTML = `<img src="${data.thumbnail_url}" alt="${name}" class="roster-avatar-img" />`;
        }

        // stats
        const season = data.mythic_plus_scores_by_season?.[0];
        const mpScore = season?.scores?.all ?? null;
        const mpColor = season?.segments?.all?.color ?? '#888';
        const progression = data.raid_progression ?? null;

        statsCache[name] = { mpScore, mpColor, progression };

        const raid = raidSummary(progression);
        const scoreEl = card.querySelector('.rs-score');
        const raidEl  = card.querySelector('.rs-raid');
        if (scoreEl) {
          scoreEl.textContent = mpScore !== null ? Math.round(mpScore) : '—';
          scoreEl.style.color = mpScore ? mpColor : '#555';
        }
        if (raidEl) {
          raidEl.textContent = raid ? raid.text : '—';
          raidEl.style.color = raid ? raid.color : '#555';
        }
      })
      .catch(() => {});
  });
}, { rootMargin: '100px' });

function observeRosterCards() {
  document.querySelectorAll('.roster-card[data-name]').forEach(card => {
    const name = card.dataset.name;
    if (!thumbnailCache[name] || !statsCache[name]) {
      thumbObserver.observe(card);
    }
  });
}

// =====================
// FETCH LIVE ROSTER
// =====================
async function fetchRoster() {
  const grid = document.getElementById('rosterGrid');
  grid.innerHTML = '<p style="color:#888;text-align:center;grid-column:1/-1">Loading roster...</p>';

  try {
    // Fetch Blizzard (full roster) + Raider.io (roles/specs) in parallel
    const [token, rioRes] = await Promise.all([
      getBlizzardToken(),
      fetch('https://raider.io/api/v1/guilds/profile?region=us&realm=area-52&name=PassiveAggressive&fields=members'),
    ]);

    const blizzRes = await fetch(
      'https://us.api.blizzard.com/data/wow/guild/area-52/passiveaggressive/roster?namespace=profile-us&locale=en_US',
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!blizzRes.ok) throw new Error('Blizzard API error');
    const blizzData = await blizzRes.json();

    // Build Raider.io lookup map (name → {spec, role, profileUrl, realm})
    const rioMap = {};
    if (rioRes.ok) {
      const rioData = await rioRes.json();
      for (const m of rioData.members) {
        rioMap[m.character.name.toLowerCase()] = {
          spec:       m.character.active_spec_name || '',
          role:       normalizeRole(m.character.active_spec_role),
          profileUrl: m.character.profile_url,
          realm:      m.character.realm,
        };
      }
    }

    // Merge: Blizzard is source of truth for membership
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
        profileUrl: rio?.profileUrl || `https://raider.io/characters/us/${realmSlug}/${name}`,
      };
    });

    // Sort: GM → Officers → rest alphabetically
    liveRoster.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.name.localeCompare(b.name);
    });

    const statEl = document.getElementById('statMembers');
    if (statEl) statEl.textContent = liveRoster.length;

    buildRoster(currentFilter);
  } catch (err) {
    grid.innerHTML = '<p style="color:#888;text-align:center;grid-column:1/-1">Could not load roster. Check back later.</p>';
  }
}

// =====================
// FILTER BUTTONS
// =====================
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    buildRoster(btn.dataset.filter);
  });
});

// =====================
// COUNTER ANIMATION
// =====================
function animateCount(el, target, duration = 1800) {
  let start = 0;
  const step = Math.ceil(target / (duration / 16));
  const timer = setInterval(() => {
    start = Math.min(start + step, target);
    el.textContent = start;
    if (start >= target) clearInterval(timer);
  }, 16);
}

const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCount(document.getElementById('statMembers'), liveRoster.length || 30);
      animateCount(document.getElementById('statBosses'), 187);
      animateCount(document.getElementById('statYears'),  5);
      statsObserver.disconnect();
    }
  });
}, { threshold: 0.5 });

statsObserver.observe(document.querySelector('.hero-stats'));

// =====================
// NAVBAR SCROLL EFFECT
// =====================
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  if (window.scrollY > 50) {
    nav.style.background = 'rgba(5,5,10,0.98)';
  } else {
    nav.style.background = 'rgba(10,10,15,0.92)';
  }
});

// =====================
// MOBILE MENU
// =====================
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

hamburger.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
});

mobileMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => mobileMenu.classList.remove('open'));
});

// =====================
// APPLY FORM
// =====================
document.getElementById('applyForm').addEventListener('submit', (e) => {
  e.preventDefault();
  document.getElementById('applyForm').style.display = 'none';
  document.getElementById('applySuccess').classList.add('show');
  window.scrollTo({ top: document.getElementById('apply').offsetTop - 80, behavior: 'smooth' });
});

// =====================
// SCROLL REVEAL
// =====================
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.about-card, .roster-card, .news-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  revealObserver.observe(el);
});

// =====================
// INIT
// =====================
fetchRoster();
