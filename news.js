// =====================
// Guild News — Static Posts
// To add/edit/remove posts, update the POSTS array below.
// Fields: date, title, content, tag
// Tags: Announcement | Recruitment | Events | Update
// =====================

const POSTS = [
  {
    date: "2026-03-15",
    title: "Tactyks Video Guides Added to All Dungeon Pages",
    content: "We have added links to Tactyks video guides on each of our dungeon pages. If you are not familiar with Tactyks, he is one of the best Mythic+ educators in the game — his guides are clear, efficient, and actually explain the mechanics that matter rather than just listing abilities. Full credit to him for putting these together. We are just making it easier for our members to find them. Head to any dungeon guide page and you will see the link at the top. Highly recommend watching before the season kicks off on March 24.",
    tag: "Update"
  },
  {
    date: "2026-03-15",
    title: "Mythic 0 World Tours — Free Champion Gear Before You Touch a Key",
    content: "One of the best things about Season 1 is that Mythic 0 dungeons now drop Champion gear (246 ilvl) with a daily lockout — meaning you can run each of the eight dungeons once per day and walk away with a full set of upgrades before you even touch a Mythic+ key. The strategy is simple: do a full M0 world tour in the first few days, hitting all eight dungeons in one session. Pair that with Bountiful Delves and Nightmare Preys for extra slots and you will have a solid baseline to push from. Once you have filled your Champion slots, move straight into low keys (M+2 to M+5) to start stacking Hero gear. There is no reason to wait on score — the faster you get your Champion gear sorted, the faster you are pushing real keys with the group.",
    tag: "Update"
  },
  {
    date: "2026-03-09",
    title: "Midnight Season 1 M+ Launches March 24 — We're Ready",
    content: "Two weeks out and we're locked in. PassiveAggressive has been preparing routes, reviewing dungeon mechanics, and getting comps sorted ahead of the Midnight Season 1 M+ launch on March 24. We'll be running keys from day one across all eight dungeons — four new (Maisara Caverns, Windrunner Spire, Nexus-Point Xenas, Murder Row) and four returning (Magister's Terrace, Pit of Saron, Seat of the Triumvirate, Skyreach). If you want to push score with a group that actually knows the routes, now is a good time to get in. Drop by Discord or hit the Apply page.",
    tag: "Announcement"
  },
  {
    date: "2026-03-09",
    title: "Dungeon Guides Are Live for All 8 Midnight Dungeons",
    content: "We've put together full boss-by-boss guides for every dungeon in Midnight Season 1. Each guide covers Tank, Healer, and DPS responsibilities, trash priorities, and the mechanics that will actually kill your group if you ignore them. These are the guides our own group uses to prep — not copy-pasted Wowhead summaries. Check the Guides page and get familiar before the season starts. Maisara Caverns in particular is going to separate the prepared groups from the ones wiping on the first boss for two hours.",
    tag: "Update"
  },
  {
    date: "2026-03-09",
    title: "Recruiting for Midnight Season 1 — Mythic+ Players, Apply Now",
    content: "We're looking for players ahead of the new season. PassiveAggressive is a Mythic+ focused guild and that's where most of our time goes. We push score each season, run coordinated groups, and hang out in Discord between keys. We're cross-faction on Area 52, so Alliance players are welcome — no faction switch required. What matters is that you show up, you know your class, and you're not going to blame the healer every time you stand in something. If that sounds like your kind of guild, fill out the application or come hang out in Discord first.",
    tag: "Recruitment"
  },
  {
    date: "2026-03-09",
    title: "Raid Schedule for Midnight — Voidspire and Dreamrift Open March 17",
    content: "A quick note on raid for those who care: The Voidspire and The Dreamrift open March 17. March on Quel'Danas opens March 31. We run one optional raid night on Sundays at 7:00 PM Server Time. The goal is AOTC and tier pieces that make our keys faster — not progression for its own sake. If you show up, play your role, and don't make the same mistake three pulls in a row, you'll fit right in. Raid is secondary to M+ for us, but we take it seriously when we're there.",
    tag: "Announcement"
  },
  {
    date: "2026-03-08",
    title: "Guild Website Is Live",
    content: "The PassiveAggressive website is up. You can find the full guild roster, M+ and raid guides, our schedule, and an application form if you want to join. Most of what you need to know about us is on the About page. If you have questions that aren't answered there, the fastest way to get them answered is Discord. We've been pushing keys together since Dragonflight and the site is just a way to make it easier for people to find us and get up to speed.",
    tag: "Announcement"
  }
];

// =====================
// Render Posts
// =====================
const feed  = document.getElementById("newsFeed");
const empty = document.getElementById("newsEmpty");

function renderPosts() {
  feed.innerHTML = "";

  if (!POSTS || POSTS.length === 0) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  // Sort newest first
  const sorted = [...POSTS].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach((post) => {
    const dateStr = new Date(post.date + "T12:00:00").toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });

    const article = document.createElement("article");
    article.className = "news-card";
    article.innerHTML = `
      <div class="news-date">${dateStr}</div>
      <h3>${post.title}</h3>
      <p>${post.content}</p>
      <span class="news-tag">${post.tag}</span>
    `;
    feed.appendChild(article);
  });
}

renderPosts();
