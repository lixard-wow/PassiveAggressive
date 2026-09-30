// =====================
// NAVBAR SCROLL EFFECT
// =====================
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  // backgroundColor only — `background` shorthand would reset the
  // texture image set in CSS back to none on every scroll event.
  nav.style.backgroundColor = window.scrollY > 50
    ? 'rgba(5,5,10,0.98)'
    : 'rgba(10,10,15,0.92)';
});

// =====================
// MOBILE MENU
// =====================
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

function setMenuOpen(open) {
  if (!hamburger || !mobileMenu) return;
  mobileMenu.classList.toggle('open', open);
  hamburger.setAttribute('aria-expanded', String(open));
  hamburger.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
}
if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', () => setMenuOpen(!mobileMenu.classList.contains('open')));
  mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenuOpen(false)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && mobileMenu.classList.contains('open')) {
      setMenuOpen(false);
      hamburger.focus();
    }
  });
  window.matchMedia('(max-width: 1100px)').addEventListener('change', () => setMenuOpen(false));
}

// =====================
// DIFFICULTY TOGGLE
// =====================
document.querySelectorAll('.diff-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const diff = btn.dataset.diff;
    document.querySelectorAll('.diff-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.diff-panel').forEach(p => {
      p.classList.toggle('active', p.dataset.diff === diff);
    });
  });
});

// =====================
// SCROLL REVEAL
// =====================
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.about-card, .news-card').forEach(el => {
  if (prefersReducedMotion.matches) return;
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  revealObserver.observe(el);
});

// =====================
// BACK TO TOP
// =====================
const backToTopBtn = document.createElement('button');
backToTopBtn.id = 'backToTop';
backToTopBtn.setAttribute('aria-label', 'Back to top');
backToTopBtn.innerHTML = '&#8679;';
document.body.appendChild(backToTopBtn);
window.addEventListener('scroll', () => {
  backToTopBtn.classList.toggle('visible', window.scrollY > 400);
});
backToTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: prefersReducedMotion.matches ? 'auto' : 'smooth' });
});
