
import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";


/* =========================================
   1. GLOBAL VARIABLES
========================================= */

let currentUser = null;
let currentUserName = "Student";
let currentProfile = {};

let authReadyResolve;

const authStateReady = new Promise((resolve) => {
  authReadyResolve = resolve;
});


/* =========================================
   2. DOM ELEMENTS
========================================= */

const logoutButton = document.getElementById("logoutButton");

const addItemForm = document.getElementById("addItemForm");
const itemFormMessage = document.getElementById("itemFormMessage");
const addItemButton = document.getElementById("addItemButton");

const requestsList = document.getElementById("requestsList");
const itemsList = document.getElementById("itemsList");
const myRequestsList = document.getElementById("myRequestsList");
const myBorrowingsList = document.getElementById("myBorrowingsList");
const historyList = document.getElementById("historyList");


/* =========================================
   3. GENERAL HELPER FUNCTIONS
========================================= */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const characters = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return characters[character];
  });
}


function showMessage(element, message, type = "success") {
  if (!element) return;

  element.textContent = message;
  element.className = `message ${type}`;
}


function setButtonLoading(button, loading, loadingText = "Please wait...") {
  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}


function formatDate(value) {
  if (!value) return "Not available";

  let date;

  if (typeof value.toDate === "function") {
    date = value.toDate();
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}


function getTimestamp(value) {
  if (!value) return 0;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}


function formatStatus(status) {
  const labels = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    returned: "Returned",
    return_requested: "Return Requested"
  };

  return labels[status] || status || "Unknown";
}


function statusClass(status) {
  const classes = {
    pending: "pending",
    approved: "approved",
    rejected: "rejected",
    returned: "returned",
    return_requested: "pending"
  };

  return classes[status] || "pending";
}


function getItemIcon(category) {
  const icons = {
    textbooks: "📚",
    books: "📚",
    calculators: "🧮",
    laptops: "💻",
    electronics: "💻",
    cameras: "📷",
    photography: "📷",
    sports: "⚽",
    "sports equipment": "⚽",
    accessories: "🎒",
    tools: "🛠️",
    stationery: "✏️",
    other: "📦"
  };

  return icons[String(category || "").toLowerCase()] || "📦";
}


function createChatLink(requestId) {
  return `
    <a class="btn btn-secondary"
       href="chat.html?requestId=${encodeURIComponent(requestId)}">
       Open Chat
    </a>
  `;
}


function showEmptyMessage(element, message) {
  if (!element) return;

  element.innerHTML = `
    <div class="empty-state">
      <p>${escapeHTML(message)}</p>
    </div>
  `;
}


/* =========================================
   4. DASHBOARD NAVIGATION
========================================= */

const navigationLinks = document.querySelectorAll("[data-section]");
const pageSections = document.querySelectorAll(".page-section");
const pageTitle = document.getElementById("pageTitle");


function openDashboardSection(sectionId, clickedLink = null) {
  const targetSection = document.getElementById(sectionId);

  if (!targetSection) return;

  pageSections.forEach((section) => {
    section.classList.remove("active");
  });

  targetSection.classList.add("active");

  navigationLinks.forEach((link) => {
    link.classList.remove("active");
  });

  if (clickedLink) {
    clickedLink.classList.add("active");
  } else {
    const matchingLink = document.querySelector(
      `[data-section="${sectionId}"]`
    );

    if (matchingLink) {
      matchingLink.classList.add("active");
    }
  }

  const title = targetSection.dataset.title;

  if (pageTitle) {
    pageTitle.textContent =
      title || targetSection.querySelector("h2")?.textContent || "Dashboard";
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


navigationLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    const sectionId = link.dataset.section;

    if (!sectionId) return;

    event.preventDefault();
    openDashboardSection(sectionId, link);
  });
});


/* =========================================
   5. LOAD USER PROFILE
========================================= */

async function loadUserProfile() {
  if (!currentUser) return;

  const userRef = doc(db, "users", currentUser.uid);
  const userSnapshot = await getDoc(userRef);

  const profile = userSnapshot.exists()
    ? userSnapshot.data()
    : {};

  currentProfile = profile;

  currentUserName =
    profile.displayName ||
    currentUser.displayName ||
    currentUser.email?.split("@")[0] ||
    "Student";

  // Existing dashboard name fields
  const userName = document.getElementById("userName");
  const welcomeName = document.getElementById("welcomeName");
  const sidebarName = document.getElementById("sidebar-name");

  if (userName) userName.textContent = currentUserName;
  if (welcomeName) welcomeName.textContent = currentUserName;
  if (sidebarName) sidebarName.textContent = currentUserName;

  // Profile fields
  setProfileField("full-name", profile.displayName || currentUserName);
  setProfileField("student-id", profile.studentId || "");
  setProfileField("email", profile.email || currentUser.email || "");
  setProfileField("phone", profile.contact || "");
  setProfileField("faculty", profile.faculty || "");
  setProfileField("department", profile.department || "");
  setProfileField("university", profile.university || "");
  setProfileField("academic-year", profile.academicYear || "");

  const accountStatus = document.getElementById("account-status");

  if (accountStatus) {
    accountStatus.value = currentUser.emailVerified
      ? "Verified Account"
      : "Not Verified";
  }

  const avatar = document.getElementById("profile-avatar");

  if (avatar) {
    avatar.textContent = currentUserName.charAt(0).toUpperCase();
  }
}


function setProfileField(id, value) {
  const field = document.getElementById(id);

  if (field) {
    field.value = value;
  }
}


/* =========================================
   6. PROFILE EDITING
========================================= */

const profileForm = document.getElementById("profile-form");
const editProfileButton = document.getElementById("edit-profile-button");
const cancelEditButton = document.getElementById("cancel-edit-button");
const formActions = document.getElementById("form-actions");
const profileMessage = document.getElementById("profile-message");


function setProfileEditing(enabled) {
  const editableFields = [
    "full-name",
    "phone",
    "faculty",
    "department",
    "university",
    "academic-year"
  ];

  editableFields.forEach((id) => {
    const field = document.getElementById(id);

    if (field) {
      field.disabled = !enabled;
    }
  });

  if (editProfileButton) {
    editProfileButton.style.display = enabled ? "none" : "inline-block";
  }

  if (formActions) {
    formActions.style.display = enabled ? "flex" : "none";
  }
}


if (editProfileButton) {
  editProfileButton.addEventListener("click", () => {
    if (profileMessage) {
      profileMessage.textContent = "";
    }

    setProfileEditing(true);
  });
}


if (cancelEditButton) {
  cancelEditButton.addEventListener("click", async () => {
    await loadUserProfile();
    setProfileEditing(false);

    if (profileMessage) {
      profileMessage.textContent = "";
    }
  });
}


if (profileForm) {
  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) return;

    const fullName = document.getElementById("full-name")?.value.trim();
    const phone = document.getElementById("phone")?.value.trim();
    const faculty = document.getElementById("faculty")?.value.trim();
    const department = document.getElementById("department")?.value.trim();
    const university = document.getElementById("university")?.value.trim();
    const academicYear = document.getElementById("academic-year")?.value.trim();

    if (!fullName) {
      showMessage(profileMessage, "Please enter your full name.", "error");
      return;
    }

    const saveButton = profileForm.querySelector(
      'button[type="submit"]'
    );

    setButtonLoading(saveButton, true, "Saving...");

    try {
      const userRef = doc(db, "users", currentUser.uid);

      await updateDoc(userRef, {
        displayName: fullName,
        contact: phone,
        faculty,
        department,
        university,
        academicYear,
        updatedAt: serverTimestamp()
      });

      await updateProfile(currentUser, {
        displayName: fullName
      });

      currentUserName = fullName;

      await loadUserProfile();

      setProfileEditing(false);

      showMessage(
        profileMessage,
        "Your profile has been updated successfully.",
        "success"
      );

    } catch (error) {
      console.error("Profile update error:", error);

      showMessage(
        profileMessage,
        "Unable to update your profile. Please try again.",
        "error"
      );

    } finally {
      setButtonLoading(saveButton, false);
    }
  });
}


/* =========================================
   7. LOAD BORROW REQUESTS RECEIVED
========================================= */

async function loadReceivedRequests() {
  if (!currentUser || !requestsList) return;

  try {
    const requestsQuery = query(
      collection(db, "borrowRequests"),
      where("ownerId", "==", currentUser.uid)
    );

    const snapshot = await getDocs(requestsQuery);

    if (snapshot.empty) {
      showEmptyMessage(
        requestsList,
        "You have not received any borrow requests yet."
      );
      return;
    }

    const requests = snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data()
    }));

    requests.sort(
      (a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt)
    );

    requestsList.innerHTML = requests.map((request) => {
      const status = request.status || "pending";

      let actionButtons = "";

      if (status === "pending") {
        actionButtons = `
          <button class="btn btn-primary"
                  data-action="accept"
                  data-request-id="${escapeHTML(request.id)}">
            Accept
          </button>

          <button class="btn btn-danger"
                  data-action="reject"
                  data-request-id="${escapeHTML(request.id)}">
            Reject
          </button>
        `;
      }

      if (status === "return_requested") {
        actionButtons = `
          <button class="btn btn-primary"
                  data-action="confirm-return"
                  data-request-id="${escapeHTML(request.id)}">
            Confirm Return
          </button>
        `;
      }

      return `
        <div class="request-card">
          <div class="request-card-header">
            <h3>${escapeHTML(request.itemName || "Resource")}</h3>

            <span class="status-badge ${statusClass(status)}">
              ${escapeHTML(formatStatus(status))}
            </span>
          </div>

          <p>
            <strong>Borrower:</strong>
            ${escapeHTML(request.borrowerName || "Student")}
          </p>

          <p>
            <strong>Start Date:</strong>
            ${formatDate(request.startDate)}
          </p>

          <p>
            <strong>End Date:</strong>
            ${formatDate(request.endDate)}
          </p>

          <p>
            <strong>Requested On:</strong>
            ${formatDate(request.createdAt)}
          </p>

          <div class="card-actions">
            ${createChatLink(request.id)}
            ${actionButtons}
          </div>
        </div>
      `;
    }).join("");

  } catch (error) {
    console.error("Received requests error:", error);

    showEmptyMessage(
      requestsList,
      "Unable to load received requests."
    );
  }
}


/* =========================================
   8. ACCEPT / REJECT BORROW REQUEST
========================================= */

async function updateBorrowRequest(requestId, action) {
  if (!currentUser) return;

  try {
    await runTransaction(db, async (transaction) => {
      const requestRef = doc(db, "borrowRequests", requestId);
      const requestSnapshot = await transaction.get(requestRef);

      if (!requestSnapshot.exists()) {
        throw new Error("Borrow request not found.");
      }

      const request = requestSnapshot.data();

      if (request.ownerId !== currentUser.uid) {
        throw new Error("You are not allowed to update this request.");
      }

      if (request.status !== "pending") {
        throw new Error("This request has already been processed.");
      }

      const itemRef = doc(db, "items", request.itemId);
      const itemSnapshot = await transaction.get(itemRef);

      if (!itemSnapshot.exists()) {
        throw new Error("Resource not found.");
      }

      const item = itemSnapshot.data();

      if (item.ownerId !== currentUser.uid) {
        throw new Error("You do not own this resource.");
      }

      if (action === "accept") {
        if (
          item.available === false ||
          (item.activeRequestId && item.activeRequestId !== requestId)
        ) {
          throw new Error("This resource is no longer available.");
        }

        transaction.update(requestRef, {
          status: "approved",
          updatedAt: serverTimestamp()
        });

        transaction.update(itemRef, {
          available: false,
          activeRequestId: requestId,
          updatedAt: serverTimestamp()
        });

      } else if (action === "reject") {
        transaction.update(requestRef, {
          status: "rejected",
          updatedAt: serverTimestamp()
        });

        transaction.update(itemRef, {
          available: true,
          activeRequestId: null,
          updatedAt: serverTimestamp()
        });
      }
    });

    alert(
      action === "accept"
        ? "Borrow request accepted."
        : "Borrow request rejected."
    );

    await refreshDashboard();

  } catch (error) {
    console.error("Request update error:", error);
    alert(error.message || "Unable to update the request.");
  }
}


/* =========================================
   9. LOAD MY LISTED RESOURCES
========================================= */

async function loadMyItems() {
  if (!currentUser || !itemsList) return;

  try {
    const itemsQuery = query(
      collection(db, "items"),
      where("ownerId", "==", currentUser.uid)
    );

    const snapshot = await getDocs(itemsQuery);

    if (snapshot.empty) {
      showEmptyMessage(
        itemsList,
        "You have not listed any resources yet."
      );
      return;
    }

    const items = snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data()
    }));

    items.sort(
      (a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt)
    );

    itemsList.innerHTML = items.map((item) => {
      const available = item.available !== false;

      return `
        <div class="item-card">
          <div class="item-card-header">
            <span class="item-icon">
              ${getItemIcon(item.category)}
            </span>

            <span class="status-badge ${available ? "approved" : "pending"}">
              ${available ? "Available" : "Borrowed"}
            </span>
          </div>

          <h3>${escapeHTML(item.name || "Untitled Resource")}</h3>

          <p>
            <strong>Category:</strong>
            ${escapeHTML(item.category || "Other")}
          </p>

          <p>
            <strong>Location:</strong>
            ${escapeHTML(item.location || "Not specified")}
          </p>

          <div class="card-actions">
            <a class="btn btn-secondary"
               href="item-details.html?item=${encodeURIComponent(item.id)}">
              View Resource
            </a>

            <button class="btn btn-danger"
                    data-action="delete-item"
                    data-item-id="${escapeHTML(item.id)}">
              Delete Resource
            </button>
          </div>
        </div>
      `;
    }).join("");

  } catch (error) {
    console.error("My items error:", error);

    showEmptyMessage(
      itemsList,
      "Unable to load your listed resources."
    );
  }
}


/* =========================================
   10. DELETE MY RESOURCE
========================================= */

async function deleteMyItem(itemId) {
  if (!currentUser || !itemId) return;

  const confirmed = confirm(
    "Are you sure you want to delete this resource?"
  );

  if (!confirmed) return;

  try {
    const itemRef = doc(db, "items", itemId);
    const itemSnapshot = await getDoc(itemRef);

    if (!itemSnapshot.exists()) {
      alert("This resource does not exist.");
      return;
    }

    const item = itemSnapshot.data();

    if (item.ownerId !== currentUser.uid) {
      alert("You are not allowed to delete this resource.");
      return;
    }

    // Do not delete a resource that is currently borrowed.
    if (
      item.available === false ||
      item.activeRequestId
    ) {
      alert(
        "This resource cannot be deleted while it is borrowed or has an active request."
      );
      return;
    }

    // Check for pending or active requests linked to this resource.
    const requestsQuery = query(
      collection(db, "borrowRequests"),
      where("itemId", "==", itemId),
where("ownerId", "==", currentUser.uid)
    );

    const requestsSnapshot = await getDocs(requestsQuery);

    const hasActiveRequest = requestsSnapshot.docs.some((document) => {
      const status = document.data().status;

      return [
        "pending",
        "approved",
        "return_requested"
      ].includes(status);
    });

    if (hasActiveRequest) {
      alert(
        "This resource has an active borrow request. You cannot delete it now."
      );
      return;
    }

    await deleteDoc(itemRef);

    alert("Resource deleted successfully.");

    await refreshDashboard();

  } catch (error) {
    console.error("Delete resource error:", error);

    alert(
      error.message ||
      "Unable to delete this resource. Please try again."
    );
  }
}


/* =========================================
   11. LOAD MY BORROW REQUESTS
========================================= */

async function loadMyRequests() {
  if (!currentUser || !myRequestsList) return;

  try {
    const requestsQuery = query(
      collection(db, "borrowRequests"),
      where("borrowerId", "==", currentUser.uid)
    );

    const snapshot = await getDocs(requestsQuery);

    if (snapshot.empty) {
      showEmptyMessage(
        myRequestsList,
        "You have not made any borrow requests yet."
      );
      return;
    }

    const requests = snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data()
    }));

    requests.sort(
      (a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt)
    );

    myRequestsList.innerHTML = requests.map((request) => {
      const status = request.status || "pending";

      return `
        <div class="request-card">
          <div class="request-card-header">
            <h3>${escapeHTML(request.itemName || "Resource")}</h3>

            <span class="status-badge ${statusClass(status)}">
              ${escapeHTML(formatStatus(status))}
            </span>
          </div>

          <p>
            <strong>Owner:</strong>
            ${escapeHTML(request.ownerName || "Student")}
          </p>

          <p>
            <strong>Start Date:</strong>
            ${formatDate(request.startDate)}
          </p>

          <p>
            <strong>End Date:</strong>
            ${formatDate(request.endDate)}
          </p>

          <div class="card-actions">
            ${createChatLink(request.id)}
          </div>
        </div>
      `;
    }).join("");

  } catch (error) {
    console.error("My requests error:", error);

    showEmptyMessage(
      myRequestsList,
      "Unable to load your borrow requests."
    );
  }
}


/* =========================================
   12. LOAD MY CURRENT BORROWINGS
========================================= */

async function loadMyBorrowings() {
  if (!currentUser || !myBorrowingsList) return;

  try {
    const requestsQuery = query(
      collection(db, "borrowRequests"),
      where("borrowerId", "==", currentUser.uid)
    );

    const snapshot = await getDocs(requestsQuery);

    const borrowings = snapshot.docs
      .map((document) => ({
        id: document.id,
        ...document.data()
      }))
      .filter((request) => {
        return [
          "approved",
          "return_requested"
        ].includes(request.status);
      });

    if (borrowings.length === 0) {
      showEmptyMessage(
        myBorrowingsList,
        "You do not have any active borrowings."
      );
      return;
    }

    myBorrowingsList.innerHTML = borrowings.map((request) => {
      const status = request.status;

      let returnButton = "";

      if (status === "approved") {
        returnButton = `
          <button class="btn btn-primary"
                  data-action="request-return"
                  data-request-id="${escapeHTML(request.id)}">
            Request Return
          </button>
        `;
      } else {
        returnButton = `
          <span class="status-badge pending">
            Waiting for owner confirmation
          </span>
        `;
      }

      return `
        <div class="request-card">
          <div class="request-card-header">
            <h3>${escapeHTML(request.itemName || "Resource")}</h3>

            <span class="status-badge ${statusClass(status)}">
              ${escapeHTML(formatStatus(status))}
            </span>
          </div>

          <p>
            <strong>Owner:</strong>
            ${escapeHTML(request.ownerName || "Student")}
          </p>

          <p>
            <strong>Return Date:</strong>
            ${formatDate(request.endDate)}
          </p>

          <div class="card-actions">
            ${createChatLink(request.id)}
            ${returnButton}
          </div>
        </div>
      `;
    }).join("");

  } catch (error) {
    console.error("My borrowings error:", error);

    showEmptyMessage(
      myBorrowingsList,
      "Unable to load your borrowings."
    );
  }
}


/* =========================================
   13. REQUEST RETURN
========================================= */

async function requestReturn(requestId) {
  if (!currentUser) return;

  const confirmed = confirm(
    "Do you want to request the return of this resource?"
  );

  if (!confirmed) return;

  try {
    await runTransaction(db, async (transaction) => {
      const requestRef = doc(db, "borrowRequests", requestId);
      const requestSnapshot = await transaction.get(requestRef);

      if (!requestSnapshot.exists()) {
        throw new Error("Borrow request not found.");
      }

      const request = requestSnapshot.data();

      if (request.borrowerId !== currentUser.uid) {
        throw new Error("You are not allowed to update this request.");
      }

      if (request.status !== "approved") {
        throw new Error("This borrowing cannot be returned now.");
      }

      transaction.update(requestRef, {
        status: "return_requested",
        returnRequestedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    alert("Return request sent to the resource owner.");

    await refreshDashboard();

  } catch (error) {
    console.error("Return request error:", error);

    alert(error.message || "Unable to request return.");
  }
}


/* =========================================
   14. CONFIRM RETURN
========================================= */

async function confirmReturn(requestId) {
  if (!currentUser) return;

  const confirmed = confirm(
    "Confirm that the resource has been returned?"
  );

  if (!confirmed) return;

  try {
    await runTransaction(db, async (transaction) => {
      const requestRef = doc(db, "borrowRequests", requestId);
      const requestSnapshot = await transaction.get(requestRef);

      if (!requestSnapshot.exists()) {
        throw new Error("Borrow request not found.");
      }

      const request = requestSnapshot.data();

      if (request.ownerId !== currentUser.uid) {
        throw new Error("You are not allowed to confirm this return.");
      }

      if (request.status !== "return_requested") {
        throw new Error("This return request is no longer active.");
      }

      const itemRef = doc(db, "items", request.itemId);
      const itemSnapshot = await transaction.get(itemRef);

      if (!itemSnapshot.exists()) {
        throw new Error("Resource not found.");
      }

      const item = itemSnapshot.data();

      if (
        item.ownerId !== currentUser.uid ||
        item.activeRequestId !== requestId
      ) {
        throw new Error("Resource ownership or request details do not match.");
      }

      transaction.update(requestRef, {
        status: "returned",
        returnedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      transaction.update(itemRef, {
        available: true,
        activeRequestId: null,
        updatedAt: serverTimestamp()
      });
    });

    alert("Return confirmed successfully.");

    await refreshDashboard();

  } catch (error) {
    console.error("Confirm return error:", error);

    alert(error.message || "Unable to confirm return.");
  }
}


/* =========================================
   15. LOAD HISTORY
========================================= */

async function loadHistory() {
  if (!currentUser || !historyList) return;

  try {
    const borrowerQuery = query(
      collection(db, "borrowRequests"),
      where("borrowerId", "==", currentUser.uid)
    );

    const ownerQuery = query(
      collection(db, "borrowRequests"),
      where("ownerId", "==", currentUser.uid)
    );

    const [borrowerSnapshot, ownerSnapshot] = await Promise.all([
      getDocs(borrowerQuery),
      getDocs(ownerQuery)
    ]);

    const requestMap = new Map();

    borrowerSnapshot.docs.forEach((document) => {
      requestMap.set(document.id, {
        id: document.id,
        ...document.data()
      });
    });

    ownerSnapshot.docs.forEach((document) => {
      requestMap.set(document.id, {
        id: document.id,
        ...document.data()
      });
    });

    const history = Array.from(requestMap.values()).filter((request) => {
      return [
        "returned",
        "rejected"
      ].includes(request.status);
    });

    history.sort((a, b) => {
      const aDate = getTimestamp(a.updatedAt || a.createdAt);
      const bDate = getTimestamp(b.updatedAt || b.createdAt);

      return bDate - aDate;
    });

    if (history.length === 0) {
      showEmptyMessage(
        historyList,
        "Your borrowing history is empty."
      );
      return;
    }

    historyList.innerHTML = history.map((request) => {
      const isOwner = request.ownerId === currentUser.uid;

      return `
        <div class="request-card">
          <div class="request-card-header">
            <h3>${escapeHTML(request.itemName || "Resource")}</h3>

            <span class="status-badge ${statusClass(request.status)}">
              ${escapeHTML(formatStatus(request.status))}
            </span>
          </div>

          <p>
            <strong>Role:</strong>
            ${isOwner ? "Resource Owner" : "Borrower"}
          </p>

          <p>
            <strong>
              ${isOwner ? "Borrower:" : "Owner:"}
            </strong>

            ${escapeHTML(
              isOwner
                ? request.borrowerName || "Student"
                : request.ownerName || "Student"
            )}
          </p>

          <p>
            <strong>Completed / Updated:</strong>
            ${formatDate(request.updatedAt || request.createdAt)}
          </p>

          <div class="card-actions">
            ${createChatLink(request.id)}
          </div>
        </div>
      `;
    }).join("");

  } catch (error) {
    console.error("History error:", error);

    showEmptyMessage(
      historyList,
      "Unable to load your history."
    );
  }
}


/* =========================================
   16. ADD NEW RESOURCE
========================================= */

async function handleAddItem(event) {
  event.preventDefault();

  if (!currentUser) {
    showMessage(
      itemFormMessage,
      "Please log in to add a resource.",
      "error"
    );
    return;
  }

  if (!currentUser.emailVerified) {
    showMessage(
      itemFormMessage,
      "Please verify your email before adding a resource.",
      "error"
    );
    return;
  }

  const name = document.getElementById("itemName")?.value.trim();
  const category = document.getElementById("itemCategory")?.value;
  const description = document.getElementById("itemDescription")?.value.trim();
  const location = document.getElementById("itemLocation")?.value.trim();

  if (!name || !category || !description || !location) {
    showMessage(
      itemFormMessage,
      "Please complete all required fields.",
      "error"
    );
    return;
  }

  setButtonLoading(addItemButton, true, "Adding Resource...");

  try {
    await currentUser.reload();

    currentUser = auth.currentUser;

    if (!currentUser || !currentUser.emailVerified) {
      throw new Error("Please verify your email before adding a resource.");
    }

    await addDoc(collection(db, "items"), {
      name,
      category,
      description,
      location,

      condition: "Good",
      fee: 0,
      maxDuration: 0,

      ownerId: currentUser.uid,
      ownerName: currentUserName,

      available: true,
      activeRequestId: null,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    addItemForm.reset();

    showMessage(
      itemFormMessage,
      "Resource added successfully!",
      "success"
    );

    await refreshDashboard();

  } catch (error) {
    console.error("Add resource error:", error);

    showMessage(
      itemFormMessage,
      error.message || "Unable to add resource.",
      "error"
    );

  } finally {
    setButtonLoading(addItemButton, false);
  }
}


if (addItemForm) {
  addItemForm.addEventListener("submit", handleAddItem);
}


/* =========================================
   17. DASHBOARD REFRESH
========================================= */

async function refreshDashboard() {
  await Promise.all([
    loadReceivedRequests(),
    loadMyItems(),
    loadMyRequests(),
    loadMyBorrowings(),
    loadHistory()
  ]);
}


/* =========================================
   18. ACTION BUTTON EVENT HANDLER
========================================= */

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");

  if (!button) return;

  const action = button.dataset.action;
  const requestId = button.dataset.requestId;
  const itemId = button.dataset.itemId;

  button.disabled = true;

  try {
    switch (action) {
      case "accept":
        await updateBorrowRequest(requestId, "accept");
        break;

      case "reject":
        await updateBorrowRequest(requestId, "reject");
        break;

      case "request-return":
        await requestReturn(requestId);
        break;

      case "confirm-return":
        await confirmReturn(requestId);
        break;

      case "delete-item":
        await deleteMyItem(itemId);
        break;
    }

  } finally {
    button.disabled = false;
  }
});


/* =========================================
   19. LOGOUT
========================================= */

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "Logging out...";

    try {
      await signOut(auth);

      // Replace the current history entry instead of adding a new one.
      window.location.replace("login.html");

    } catch (error) {
      console.error("Logout error:", error);

      alert("Unable to log out. Please try again.");

      logoutButton.disabled = false;
      logoutButton.textContent = "Logout";
    }
  });
}


/* =========================================
   20. BROWSER BACK / CACHE PROTECTION
========================================= */

// If the browser restores this page from its back-forward cache,
// check Firebase authentication again.
window.addEventListener("pageshow", async (event) => {
  if (!event.persisted) return;

  await authStateReady;

  if (!auth.currentUser) {
    window.location.replace("login.html");
  } else {
    window.location.reload();
  }
});


/* =========================================
   21. FIREBASE AUTHENTICATION CHECK
========================================= */

onAuthStateChanged(auth, async (user) => {
  // Let pageshow know that the first authentication check completed.
  authReadyResolve();

  if (!user) {
    currentUser = null;
    window.location.replace("login.html");
    return;
  }

  try {
    await user.reload();
    await user.getIdToken(true);

    currentUser = auth.currentUser;

    if (!currentUser || !currentUser.emailVerified) {
      await signOut(auth);
      window.location.replace("login.html");
      return;
    }

    await loadUserProfile();

    await refreshDashboard();

  } catch (error) {
    console.error("Dashboard initialization error:", error);

    alert(
      "Unable to load your dashboard. Please log in again."
    );

    await signOut(auth);

    window.location.replace("login.html");
  }
});
