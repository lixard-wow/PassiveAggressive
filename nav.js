// Shared navigation — injected into every page
(function () {
  const NAV_HTML = [
    '<nav id="navbar">',
    '  <div class="nav-inner">',
    '    <a class="nav-logo" href="index.html">',
    '      <img src="logo.png" alt="PassiveAggressive" class="nav-logo-img" />',
    '      <span style="white-space:nowrap"><span style="color:var(--purple)">Passive</span><span style="color:#F4B800">Aggressive</span></span>',
    '    </a>',
    '    <ul class="nav-links">',
    '      <li><a href="index.html" data-page="index">Home</a></li>',
    '      <li><a href="roster.html" data-page="roster">Roster</a></li>',
    '      <li><a href="raids.html" data-page="raids">Mythic+</a></li>',
    '      <li><a href="raid.html" data-page="raid">Raid</a></li>',
    '      <li><a href="guides.html" data-page="guides">Guides</a></li>',
    '      <li><a href="news.html" data-page="news">News</a></li>',
    '      <li><a href="about.html" data-page="about">About</a></li>',
    '      <li><a href="rules.html" data-page="rules">Rules</a></li>',
    '      <li><a href="https://discord.gg/6kDYTZXSxY" class="btn-discord" target="_blank" rel="noopener">Discord</a></li>',
    '      <li><a href="apply.html" class="btn-apply" data-page="apply">Apply Now</a></li>',
    '    </ul>',
    '    <button class="hamburger" id="hamburger">&#9776;</button>',
    '  </div>',
    '  <ul class="mobile-menu" id="mobileMenu">',
    '    <li><a href="index.html" data-page="index">Home</a></li>',
    '    <li><a href="roster.html" data-page="roster">Roster</a></li>',
    '    <li><a href="raids.html" data-page="raids">Mythic+</a></li>',
    '    <li><a href="raid.html" data-page="raid">Raid</a></li>',
    '    <li><a href="guides.html" data-page="guides">Guides</a></li>',
    '    <li><a href="news.html" data-page="news">News</a></li>',
    '    <li><a href="about.html" data-page="about">About</a></li>',
    '    <li><a href="rules.html" data-page="rules">Rules</a></li>',
    '    <li><a href="https://discord.gg/6kDYTZXSxY" target="_blank" rel="noopener">Discord</a></li>',
    '    <li><a href="apply.html" data-page="apply">Apply Now</a></li>',
    '  </ul>',
    '</nav>',
  ].join('\n');

  document.body.insertAdjacentHTML('afterbegin', NAV_HTML);

  // Highlight the active page link
  var page = location.pathname.split('/').pop().replace('.html', '') || 'index';
  if (page.startsWith('mplus-') || page.startsWith('raid-')) page = 'guides';
  document.querySelectorAll('#navbar [data-page]').forEach(function(a) {
    if (a.dataset.page === page) a.classList.add('nav-active');
  });
})();
