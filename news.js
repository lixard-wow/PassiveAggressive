// =====================
// Guild News — Static Posts
// To add/edit/remove posts, update the POSTS array below.
// Fields: date, title, content, tag
// Tags: Announcement | Recruitment | Events | Update
// =====================

const POSTS = [
  {
    date: "2026-03-08",
    title: "Welcome to the PassiveAggressive Website!",
    content: "Our guild website is now live! Check out the Roster, M+ Guides, and Raid pages. More updates coming soon.",
    tag: "Announcement"
  },
  {
    date: "2026-03-08",
    title: "Midnight Season 1 Recruitment Open",
    content: "We are actively recruiting skilled players for Mythic raiding and high-key M+ progression. Check the Apply page and reach out on Discord.",
    tag: "Recruitment"
  },
  {
    date: "2026-03-08",
    title: "M+ Guide Pages Are Live",
    content: "Detailed strategy guides for all current Midnight dungeons are now available. Each guide includes role-by-role breakdowns, trash priorities, and boss tips.",
    tag: "Update"
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
