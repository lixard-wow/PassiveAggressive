// =====================
// Firebase Config — Replace with your project's config
// =====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// ========================
// PASTE YOUR FIREBASE CONFIG HERE
// ========================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =====================
// DOM References
// =====================
const adminBar = document.getElementById("adminBar");
const loginBar = document.getElementById("loginBar");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const newsFeed = document.getElementById("newsFeed");
const newsEmpty = document.getElementById("newsEmpty");
const newsModal = document.getElementById("newsModal");

let isOfficer = false;

// =====================
// Auth State Listener
// =====================
onAuthStateChanged(auth, (user) => {
  isOfficer = !!user;
  adminBar.style.display = user ? "flex" : "none";
  loginBar.style.display = user ? "none" : "flex";
  loginForm.style.display = "none";
  loginError.textContent = "";
  loadNews();
});

// =====================
// Login / Logout
// =====================
document.getElementById("btnShowLogin").addEventListener("click", () => {
  loginBar.style.display = "none";
  loginForm.style.display = "flex";
  document.getElementById("loginEmail").focus();
});

document.getElementById("btnCancelLogin").addEventListener("click", () => {
  loginForm.style.display = "none";
  loginBar.style.display = "flex";
  loginError.textContent = "";
});

document.getElementById("btnLogin").addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  loginError.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    loginError.textContent = "Invalid credentials. Try again.";
  }
});

document.getElementById("loginPassword").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("btnLogin").click();
});

document.getElementById("btnLogout").addEventListener("click", async () => {
  await signOut(auth);
});

// =====================
// Load News
// =====================
async function loadNews() {
  newsFeed.innerHTML = "";
  try {
    const q = query(collection(db, "news"), orderBy("date", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      newsEmpty.style.display = "block";
      return;
    }
    newsEmpty.style.display = "none";

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const card = createCard(docSnap.id, data);
      newsFeed.appendChild(card);
    });
  } catch (err) {
    console.error("Error loading news:", err);
    newsEmpty.textContent = "Failed to load news. Check Firebase config.";
    newsEmpty.style.display = "block";
  }
}

// =====================
// Render a News Card
// =====================
function createCard(id, data) {
  const article = document.createElement("article");
  article.className = "news-card";

  const dateObj = data.date?.toDate ? data.date.toDate() : new Date(data.date);
  const dateStr = dateObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });

  // Escape HTML to prevent XSS
  const esc = (s) => {
    const d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  };

  let adminBtns = "";
  if (isOfficer) {
    adminBtns = `
      <div class="news-admin-btns">
        <button class="news-admin-btn news-edit-btn" data-id="${id}">Edit</button>
        <button class="news-admin-btn news-delete-btn" data-id="${id}">Delete</button>
      </div>`;
  }

  article.innerHTML = `
    <div class="news-date">${esc(dateStr)}</div>
    <h3>${esc(data.title)}</h3>
    <p>${esc(data.content)}</p>
    <span class="news-tag">${esc(data.tag)}</span>
    ${adminBtns}
  `;

  if (isOfficer) {
    article.querySelector(".news-edit-btn")?.addEventListener("click", () => openEditModal(id, data));
    article.querySelector(".news-delete-btn")?.addEventListener("click", () => deletePost(id));
  }

  return article;
}

// =====================
// Modal — New Post
// =====================
document.getElementById("btnNewPost").addEventListener("click", () => {
  document.getElementById("modalTitle").textContent = "New Post";
  document.getElementById("editPostId").value = "";
  document.getElementById("postTitle").value = "";
  document.getElementById("postContent").value = "";
  document.getElementById("postTag").value = "Announcement";
  document.getElementById("postDate").value = new Date().toISOString().split("T")[0];
  newsModal.style.display = "flex";
  document.getElementById("postTitle").focus();
});

// =====================
// Modal — Edit Post
// =====================
function openEditModal(id, data) {
  document.getElementById("modalTitle").textContent = "Edit Post";
  document.getElementById("editPostId").value = id;
  document.getElementById("postTitle").value = data.title || "";
  document.getElementById("postContent").value = data.content || "";
  document.getElementById("postTag").value = data.tag || "Announcement";

  const dateObj = data.date?.toDate ? data.date.toDate() : new Date(data.date);
  document.getElementById("postDate").value = dateObj.toISOString().split("T")[0];

  newsModal.style.display = "flex";
  document.getElementById("postTitle").focus();
}

// =====================
// Modal — Cancel
// =====================
document.getElementById("btnCancelPost").addEventListener("click", () => {
  newsModal.style.display = "none";
});

newsModal.addEventListener("click", (e) => {
  if (e.target === newsModal) newsModal.style.display = "none";
});

// =====================
// Save Post (Create or Edit)
// =====================
document.getElementById("btnSavePost").addEventListener("click", async () => {
  const id = document.getElementById("editPostId").value;
  const title = document.getElementById("postTitle").value.trim();
  const content = document.getElementById("postContent").value.trim();
  const tag = document.getElementById("postTag").value;
  const dateVal = document.getElementById("postDate").value;

  if (!title || !content) {
    alert("Title and content are required.");
    return;
  }

  const postData = {
    title,
    content,
    tag,
    date: Timestamp.fromDate(new Date(dateVal + "T12:00:00"))
  };

  try {
    if (id) {
      await updateDoc(doc(db, "news", id), postData);
    } else {
      postData.createdAt = Timestamp.now();
      await addDoc(collection(db, "news"), postData);
    }
    newsModal.style.display = "none";
    loadNews();
  } catch (err) {
    console.error("Error saving post:", err);
    alert("Failed to save post. Check console for details.");
  }
});

// =====================
// Delete Post
// =====================
async function deletePost(id) {
  if (!confirm("Delete this post? This cannot be undone.")) return;
  try {
    await deleteDoc(doc(db, "news", id));
    loadNews();
  } catch (err) {
    console.error("Error deleting post:", err);
    alert("Failed to delete post.");
  }
}
