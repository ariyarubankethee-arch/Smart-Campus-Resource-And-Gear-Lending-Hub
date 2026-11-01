
import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const ADMIN_UID = "40bJuS4yXgMmI9Giq38R4PUPWhD3";

const itemsGrid = document.getElementById("homeItemsGrid");
const loadingMessage = document.getElementById("homeItemsMessage");
const emptyMessage = document.getElementById("homeEmptyMessage");
const searchForm = document.getElementById("homeSearchForm");
const searchInput = document.getElementById("homeSearch");

const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

const dashboardLink = document.getElementById("dashboardNavLink");
const loginLink = document.getElementById("loginNavLink");
const registerLink = document.getElementById("registerNavLink");
const adminLink = document.getElementById("adminNavLink");
const logoutButton = document.getElementById("navLogoutButton");

let allItems = [];
let currentUser = null;

const categoryIcons = {
  Books: "📚",
  Electronics: "💻",
  Photography: "📷",
  Sports: "⚽",
  Tools: "🛠️",
  Stationery: "✏️",
  Other: "📦"
};

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function showMessage(message, type = "info") {
  if (!loadingMessage) return;

  loadingMessage.textContent = message;
  loadingMessage.className = `home-message ${type}`;
  loadingMessage.hidden = false;
}

function formatFee(fee) {
  const amount = Number(fee || 0);

  return amount <= 0
    ? "Free"
    : `Rs. ${amount.toLocaleString("en-LK")}`;
}

function renderItems(items) {
  if (!itemsGrid) return;

  itemsGrid.innerHTML = "";

  if (items.length === 0) {
    if (emptyMessage) emptyMessage.hidden = false;
    if (loadingMessage) loadingMessage.hidden = true;
    return;
  }

  if (emptyMessage) emptyMessage.hidden = true;
  if (loadingMessage) loadingMessage.hidden = true;

  items.slice(0, 8).forEach(item => {
    const card = document.createElement("article");
    card.className = "item-card";

    const icon = categoryIcons[item.category] || "📦";

    card.innerHTML = `
      <div class="item-image">
        <span>${icon}</span>
      </div>

      <div class="item-content">
        <span class="item-category">
          ${escapeHTML(item.category || "Other")}
        </span>

        <h3>${escapeHTML(item.name || "Untitled item")}</h3>

        <p>${escapeHTML(item.description || "No description available.")}</p>

        <div class="item-meta">
          <span>📍 ${escapeHTML(item.location || "Location not specified")}</span>
          <span>💰 ${formatFee(item.fee)}</span>
        </div>

        <p class="item-owner">
          Owner: ${escapeHTML(item.ownerName || "CampusLend member")}
        </p>

        <a class="borrow-btn"
           href="item-details.html?item=${encodeURIComponent(item.id)}">
          View Details
        </a>
      </div>
    `;

    itemsGrid.appendChild(card);
  });
}

function applySearch() {
  const term = (searchInput?.value || "").trim().toLowerCase();

  const filteredItems = allItems.filter(item => {
    return [
      item.name,
      item.description,
      item.category,
      item.location,
      item.ownerName
    ].some(value =>
      String(value || "").toLowerCase().includes(term)
    );
  });

  renderItems(filteredItems);
}

async function loadItems() {
  if (!itemsGrid) return;

  showMessage("Loading available resources...");

  try {
    const itemsQuery = query(
      collection(db, "items"),
      where("available", "==", true)
    );

    const snapshot = await getDocs(itemsQuery);

    allItems = snapshot.docs
      .map(document => ({
        id: document.id,
        ...document.data()
      }))
      .filter(item => !item.activeRequestId)
      .sort((a, b) => {
        const dateA = a.createdAt?.toMillis?.() || 0;
        const dateB = b.createdAt?.toMillis?.() || 0;
        return dateB - dateA;
      });

    applySearch();

  } catch (error) {
    console.error("Loading resources failed:", error);
    showMessage("Unable to load resources. Please refresh the page.", "error");
  }
}

function updateNavigation(user, isAdmin = false) {
  if (dashboardLink) dashboardLink.hidden = !user;
  if (loginLink) loginLink.hidden = !!user;
  if (registerLink) registerLink.hidden = !!user;
  if (logoutButton) logoutButton.hidden = !user;

  if (adminLink) {
    adminLink.hidden = !(user && isAdmin);
  }
}

onAuthStateChanged(auth, async user => {
  currentUser = user;
  let isAdmin = false;

  if (user) {
    try {
      await user.reload();
      currentUser = auth.currentUser;

      if (!currentUser?.emailVerified) {
        await signOut(auth);
        currentUser = null;
      } else {
        const token = await currentUser.getIdTokenResult(true);

        isAdmin =
          currentUser.uid === ADMIN_UID &&
          token.claims.admin === true;
      }
    } catch (error) {
      console.error("Authentication check failed:", error);
    }
  }

  updateNavigation(currentUser, isAdmin);
});

searchForm?.addEventListener("submit", event => {
  event.preventDefault();

  const term = searchInput?.value.trim() || "";

  window.location.href = term
    ? `browse.html?search=${encodeURIComponent(term)}`
    : "browse.html";
});

menuToggle?.addEventListener("click", () => {
  const isOpen = navLinks?.classList.toggle("open") || false;

  menuToggle.setAttribute("aria-expanded", String(isOpen));
});

navLinks?.addEventListener("click", event => {
  if (event.target.closest("a")) {
    navLinks.classList.remove("open");
    menuToggle?.setAttribute("aria-expanded", "false");
  }
});

logoutButton?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.reload();
  } catch (error) {
    console.error("Logout failed:", error);
    alert("Unable to log out. Please try again.");
  }
});

loadItems();
