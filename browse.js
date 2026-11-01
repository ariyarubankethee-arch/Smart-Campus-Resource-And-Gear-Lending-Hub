
import { db } from "./firebase-config.js";

import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const resourceGrid = document.getElementById("resourceGrid");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const resultCount = document.getElementById("resultCount");
const noResults = document.getElementById("noResults");
const resetSearch = document.getElementById("resetSearch");
const browseMessage = document.getElementById("browseMessage");

const categoryButtons = document.querySelectorAll("[data-category]");

const params = new URLSearchParams(window.location.search);

let allResources = [];
let selectedCategory = params.get("category") || "all";
let searchTerm = params.get("search") || "";

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

function formatFee(fee) {
  const amount = Number(fee || 0);

  return amount <= 0
    ? "Free"
    : `Rs. ${amount.toLocaleString("en-LK")}`;
}

function showBrowseMessage(message) {
  if (!browseMessage) return;

  browseMessage.textContent = message;
  browseMessage.style.display = "block";
}

function hideBrowseMessage() {
  if (!browseMessage) return;

  browseMessage.textContent = "";
  browseMessage.style.display = "none";
}

function updateCategoryButtons() {
  categoryButtons.forEach(button => {
    const category = button.dataset.category || "all";

    button.classList.toggle(
      "active",
      category.toLowerCase() === selectedCategory.toLowerCase()
    );
  });
}

function renderResources(resources) {
  if (!resourceGrid) return;

  resourceGrid.innerHTML = "";

  if (resultCount) {
    resultCount.textContent =
      `${resources.length} item${resources.length === 1 ? "" : "s"} found`;
  }

  const hasNoResults = resources.length === 0;

  if (noResults) {
    noResults.hidden = !hasNoResults;
  }

  if (hasNoResults) return;

  resources.forEach(resource => {
    const card = document.createElement("article");
    card.className = "resource-card";

    const icon = categoryIcons[resource.category] || "📦";

    card.innerHTML = `
      <div class="resource-image">
        <span>${icon}</span>
      </div>

      <div class="resource-content">
        <span class="resource-category">
          ${escapeHTML(resource.category || "Other")}
        </span>

        <h3>${escapeHTML(resource.name || "Untitled item")}</h3>

        <p>${escapeHTML(resource.description || "No description available.")}</p>

        <div class="resource-details">
          <span>📍 ${escapeHTML(resource.location || "Location not specified")}</span>
          <span>💰 ${formatFee(resource.fee)}</span>
        </div>

        <p class="resource-owner">
          Owner: ${escapeHTML(resource.ownerName || "CampusLend member")}
        </p>

        <a
          class="resource-view-btn"
          href="item-details.html?item=${encodeURIComponent(resource.id)}"
        >
          View Details
        </a>
      </div>
    `;

    resourceGrid.appendChild(card);
  });
}

function applyFilters() {
  const term = (searchInput?.value ?? searchTerm)
    .trim()
    .toLowerCase();

  searchTerm = term;

  const filtered = allResources.filter(resource => {
    const matchesCategory =
      selectedCategory.toLowerCase() === "all" ||
      (resource.category || "").toLowerCase() ===
        selectedCategory.toLowerCase();

    const searchableText = [
      resource.name,
      resource.description,
      resource.category,
      resource.location,
      resource.ownerName
    ].join(" ").toLowerCase();

    return matchesCategory && searchableText.includes(term);
  });

  renderResources(filtered);
  updateCategoryButtons();
  hideBrowseMessage();
}

async function loadResources() {
  if (!resourceGrid) return;

  resourceGrid.innerHTML = "<p>Loading available items...</p>";

  try {
    const itemsQuery = query(
      collection(db, "items"),
      where("available", "==", true)
    );

    const snapshot = await getDocs(itemsQuery);

    allResources = snapshot.docs
      .map(itemDoc => ({
        id: itemDoc.id,
        ...itemDoc.data()
      }))
      .filter(resource => !resource.activeRequestId)
      .sort((a, b) => {
        const dateA = a.createdAt?.toMillis?.() || 0;
        const dateB = b.createdAt?.toMillis?.() || 0;
        return dateB - dateA;
      });

    if (searchInput) {
      searchInput.value = searchTerm;
    }

    applyFilters();

  } catch (error) {
    console.error("Unable to load resources:", error);

    resourceGrid.innerHTML = "";

    if (resultCount) {
      resultCount.textContent = "Unable to load resources";
    }

    if (noResults) noResults.hidden = true;

    showBrowseMessage(
      "Unable to load items. Please refresh the page and try again."
    );
  }
}

function resetFilters() {
  selectedCategory = "all";
  searchTerm = "";

  if (searchInput) {
    searchInput.value = "";
  }

  const newUrl = new URL(window.location.href);
  newUrl.search = "";

  window.history.replaceState({}, "", newUrl);

  applyFilters();
}

categoryButtons.forEach(button => {
  button.addEventListener("click", () => {
    selectedCategory = button.dataset.category || "all";
    applyFilters();
  });
});

searchButton?.addEventListener("click", () => {
  searchTerm = searchInput?.value.trim() || "";
  applyFilters();
});

searchInput?.addEventListener("input", () => {
  searchTerm = searchInput.value.trim();
  applyFilters();
});

searchInput?.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchTerm = searchInput.value.trim();
    applyFilters();
  }
});

resetSearch?.addEventListener("click", resetFilters);

loadResources();
