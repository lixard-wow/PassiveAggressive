// =====================
// ROSTER DATA
// =====================
const roster = [
  { name: 'Thalindra',  class: 'Protection Warrior', role: 'Tank',    icon: '🛡️', color: '#4a90d9' },
  { name: 'Kragmor',    class: 'Blood Death Knight', role: 'Tank',    icon: '⚔️', color: '#4a90d9' },
  { name: 'Elyssara',   class: 'Holy Paladin',       role: 'Healer',  icon: '✨', color: '#52b788' },
  { name: 'Windwhispr', class: 'Resto Druid',        role: 'Healer',  icon: '🌿', color: '#52b788' },
  { name: 'Vex',        class: 'Discipline Priest',  role: 'Healer',  icon: '☀️', color: '#52b788' },
  { name: 'Pyraxis',    class: 'Fire Mage',          role: 'DPS',     icon: '🔥', color: '#e63946' },
  { name: 'Shadowstep', class: 'Subtlety Rogue',     role: 'DPS',     icon: '🗡️', color: '#e63946' },
  { name: 'Grimbolt',   class: 'Fury Warrior',       role: 'DPS',     icon: '💀', color: '#e63946' },
  { name: 'Zephyrix',   class: 'Balance Druid',      role: 'DPS',     icon: '🌙', color: '#e63946' },
  { name: 'Arcanis',    class: 'Arcane Mage',        role: 'DPS',     icon: '💫', color: '#e63946' },
  { name: 'Thornveil',  class: 'Beast Master Hunter',role: 'DPS',     icon: '🏹', color: '#e63946' },
  { name: 'Solarflare', class: 'Enhancement Shaman', role: 'DPS',     icon: '⚡', color: '#e63946' },
];

function buildRoster(filter = 'all') {
  const grid = document.getElementById('rosterGrid');
  const filtered = filter === 'all' ? roster : roster.filter(m => m.role === filter);

  grid.innerHTML = filtered.map(member => {
    const roleClass = 'role-' + member.role.toLowerCase();
    return `
      <div class="roster-card" data-role="${member.role}">
        <div class="roster-avatar" style="background:${member.color}22; border: 1px solid ${member.color}44">
          ${member.icon}
        </div>
        <div class="roster-name">${member.name}</div>
        <div class="roster-class">${member.class}</div>
        <span class="roster-role ${roleClass}">${member.role}</span>
      </div>
    `;
  }).join('');
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
      animateCount(document.getElementById('statMembers'), 42);
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
buildRoster();
