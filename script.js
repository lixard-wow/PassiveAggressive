// =====================
// NAVBAR SCROLL EFFECT
// =====================
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  nav.style.background = window.scrollY > 50
    ? 'rgba(5,5,10,0.98)'
    : 'rgba(10,10,15,0.92)';
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
// DIFFICULTY TABS
// =====================
document.querySelectorAll('.diff-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const section = btn.closest('.boss-section');
    section.querySelectorAll('.diff-tab').forEach(t => t.classList.remove('active'));
    section.querySelectorAll('.diff-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    section.querySelector(`.diff-panel[data-diff="${btn.dataset.diff}"]`).classList.add('active');
  });
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

document.querySelectorAll('.about-card, .news-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  revealObserver.observe(el);
});
