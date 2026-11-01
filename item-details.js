
import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

// URL-ல் இருந்து item ID பெறுதல்
const params = new URLSearchParams(window.location.search);
const itemId = params.get("item");

// HTML elements
const detailsMessage = document.getElementById("detailsMessage");
const detailsSection = document.getElementById("item-details");

const borrowForm = document.getElementById("borrowForm");
const borrowButton = document.getElementById("borrowButton");
const borrowMessage = document.getElementById("borrowMessage");

const currentItemRef = itemId
  ? doc(db, "items", itemId)
  : null;

let currentUser = null;
let currentItem = null;
let itemLoaded = false;
let requestSubmitted = false;

// Category emoji
function getCategoryIcon(category) {
  const icons = {
    Books: "📚",
    Electronics: "💻",
    Photography: "📷",
    Sports: "⚽",
    Tools: "🛠️",
    Stationery: "✏️",
    Other: "📦"
  };

  return icons[category] || "📦";
}

// Message display
function showMessage(element, message, type = "info") {
  if (!element) return;

  element.textContent = message;
  element.className = `details-message ${type}`;
}

function setBorrowButtonState(disabled, text) {
  if (!borrowButton) return;

  borrowButton.disabled = disabled;

  if (text) {
    borrowButton.textContent = text;
  }
}

// Fee formatting
function formatFee(fee) {
  const amount = Number(fee || 0);

  return amount <= 0
    ? "Free"
    : `Rs. ${amount.toLocaleString("en-LK")}`;
}

// Display item details
function displayItem(item) {
  if (!detailsSection) return;

  const fields = {
    itemName: item.name || "Untitled item",
    itemCategory: item.category || "Other",
    itemDescription: item.description || "No description provided.",
    itemCondition: item.condition || "Not specified",
    itemLocation: item.location || "Not specified",
    itemFee: formatFee(item.fee),
    itemDuration: item.maxDuration
      ? `${item.maxDuration} days`
      : "Not specified",
    ownerName: item.ownerName || "CampusLend member"
  };

  Object.entries(fields).forEach(([id, value]) => {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = value;
    }
  });

  // Category icon
  const itemIcon = document.getElementById("itemIcon");

  if (itemIcon) {
    itemIcon.textContent = getCategoryIcon(item.category);
  }

  // Availability
  const availability = document.getElementById("itemAvailability");

  if (availability) {
    const isAvailable =
      item.available === true && !item.activeRequestId;

    availability.textContent = isAvailable
      ? "Available"
      : "Currently unavailable";

    availability.className = isAvailable
      ? "availability-badge available"
      : "availability-badge unavailable";
  }

  detailsSection.hidden = false;

  if (detailsMessage) {
    detailsMessage.textContent = "";
  }
}

// Update borrow button
function updateAvailability() {
  if (!currentItem || !itemLoaded) return;

  const available =
    currentItem.available === true &&
    !currentItem.activeRequestId;

  if (!available) {
    setBorrowButtonState(true, "Currently Unavailable");
    return;
  }

  if (currentUser && currentItem.ownerId === currentUser.uid) {
    setBorrowButtonState(true, "Your Own Item");
    return;
  }

  if (!currentUser) {
    setBorrowButtonState(false, "Login to Request");
    return;
  }

  if (!currentUser.emailVerified) {
    setBorrowButtonState(true, "Verify Email First");
    return;
  }

  setBorrowButtonState(false, "Send Borrow Request");
}

// Load item
async function loadItem() {
  if (!itemId || !currentItemRef) {
    showMessage(detailsMessage, "Invalid item link.", "error");
    setBorrowButtonState(true);
    return;
  }

  try {
    const snapshot = await getDoc(currentItemRef);

    if (!snapshot.exists()) {
      showMessage(detailsMessage, "Item not found.", "error");
      setBorrowButtonState(true);
      return;
    }

    currentItem = {
      id: snapshot.id,
      ...snapshot.data()
    };

    itemLoaded = true;

    displayItem(currentItem);
    updateAvailability();

  } catch (error) {
    console.error("Item loading failed:", error);

    showMessage(
      detailsMessage,
      "Unable to load item details. Please try again.",
      "error"
    );

    setBorrowButtonState(true);
  }
}

// Get date input
function getDateValue(id) {
  return document.getElementById(id)?.value || "";
}

// Date validation
function validateDates(startDate, endDate) {
  if (!startDate || !endDate) {
    throw new Error("Please select both start and end dates.");
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    throw new Error("Please enter valid dates.");
  }

  if (start < today) {
    throw new Error("Start date cannot be in the past.");
  }

  if (end <= start) {
    throw new Error("Return date must be after the start date.");
  }

  const duration = Math.ceil(
    (end.getTime() - start.getTime()) / 86400000
  );

  if (
    currentItem.maxDuration > 0 &&
    duration > currentItem.maxDuration
  ) {
    throw new Error(
      `Maximum borrowing duration is ${currentItem.maxDuration} days.`
    );
  }

  return { startDate, endDate };
}

// Submit borrow request
async function submitBorrowRequest(event) {
  event.preventDefault();

  if (!currentUser) {
    showMessage(
      borrowMessage,
      "Please login before requesting this item.",
      "error"
    );

    window.location.href = "login.html";
    return;
  }

  if (requestSubmitted) return;

  setBorrowButtonState(true, "Checking...");

  try {
   await currentUser.reload();
await currentUser.getIdToken(true);
currentUser = auth.currentUser;

    if (!currentUser?.emailVerified) {
      showMessage(
        borrowMessage,
        "Please verify your email before requesting an item.",
        "error"
      );

      updateAvailability();
      return;
    }

    if (!currentItem || !itemLoaded) {
      throw new Error("Item details are not ready.");
    }

    if (currentItem.ownerId === currentUser.uid) {
      throw new Error("You cannot borrow your own item.");
    }

    const { startDate, endDate } = validateDates(
      getDateValue("startDate"),
      getDateValue("endDate")
    );

    setBorrowButtonState(true, "Sending Request...");

    const requestRef = doc(collection(db, "borrowRequests"));

    await runTransaction(db, async transaction => {
      const itemSnapshot = await transaction.get(currentItemRef);

      if (!itemSnapshot.exists()) {
        throw new Error("This item no longer exists.");
      }

      const item = itemSnapshot.data();

      if (item.ownerId === currentUser.uid) {
        throw new Error("You cannot borrow your own item.");
      }

      if (item.available !== true || item.activeRequestId) {
        throw new Error("Sorry, this item is no longer available.");
      }

      transaction.set(requestRef, {
        itemId,
        itemName: item.name || "",
        ownerId: item.ownerId,
        ownerName: item.ownerName || "",
        borrowerId: currentUser.uid,
        borrowerName:
          currentUser.displayName ||
          currentUser.email ||
          "CampusLend member",
        status: "pending",
        startDate,
        endDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      transaction.update(currentItemRef, {
        available: false,
        activeRequestId: requestRef.id,
        updatedAt: serverTimestamp()
      });
    });

    requestSubmitted = true;

    currentItem.available = false;
    currentItem.activeRequestId = requestRef.id;

    setBorrowButtonState(true, "Request Sent");

    showMessage(
      borrowMessage,
      "Your borrow request has been sent successfully. You can track it from your dashboard.",
      "success"
    );

    displayItem(currentItem);

  } catch (error) {
    console.error("Borrow request failed:", error);

    showMessage(
      borrowMessage,
      error.message || "Unable to send your request.",
      "error"
    );

    updateAvailability();

  } finally {
    if (!requestSubmitted) {
      updateAvailability();
    }
  }
}

// Form event
borrowForm?.addEventListener("submit", submitBorrowRequest);

// Login state
onAuthStateChanged(auth, async user => {
  currentUser = user;

  if (user) {
    try {
      await user.reload();
      currentUser = auth.currentUser;
    } catch (error) {
      console.error("Authentication refresh failed:", error);
    }
  }

  updateAvailability();
});

// Load page
loadItem();
