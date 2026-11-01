
import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

// --------------------------------------------------
// 1. HTML ELEMENTS
// --------------------------------------------------

const adminMessage = document.getElementById("adminMessage");
const adminLogout = document.getElementById("adminLogout");

const totalUsersElement = document.getElementById("totalUsers");
const totalResourcesElement = document.getElementById("totalResources");
const pendingRequestsElement = document.getElementById("pendingRequests");
const approvedRequestsElement = document.getElementById("approvedRequests");

const recentRequestsTable = document.getElementById("recentRequestsTable");
const allRequestsTable = document.getElementById("allRequestsTable");
const resourcesTable = document.getElementById("resourcesTable");
const studentsTable = document.getElementById("studentsTable");

const requestSearch = document.getElementById("requestSearch");
const requestStatusFilter = document.getElementById("requestStatusFilter");

const resourceSearch = document.getElementById("resourceSearch");
const resourceCategoryFilter = document.getElementById("resourceCategoryFilter");

const studentSearch = document.getElementById("studentSearch");
const pageTitle = document.getElementById("pageTitle");

// --------------------------------------------------
// 2. DATA STORAGE
// --------------------------------------------------

let usersData = [];
let resourcesData = [];
let requestsData = [];

let currentAdmin = null;

// --------------------------------------------------
// 3. HELPER FUNCTIONS
// --------------------------------------------------

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function showMessage(message, type = "") {
  if (!adminMessage) return;

  adminMessage.textContent = message;
  adminMessage.className = "admin-message";

  if (type) {
    adminMessage.classList.add(type);
  }
}

function clearMessage() {
  if (adminMessage) {
    adminMessage.textContent = "";
    adminMessage.className = "admin-message";
  }
}

function getDateValue(value) {
  if (!value) return 0;

  if (value.toDate) {
    return value.toDate().getTime();
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(value) {
  const timestamp = getDateValue(value);

  if (!timestamp) return "—";

  return new Date(timestamp).toLocaleDateString();
}

function getStatusClass(status) {
  return String(status || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

function getStatusLabel(status) {
  const labels = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    return_requested: "Return Requested",
    returned: "Returned"
  };

  return labels[String(status || "").toLowerCase()] || status || "Unknown";
}

function getStatusBadge(status) {
  return `
    <span class="status-badge ${escapeHTML(getStatusClass(status))}">
      ${escapeHTML(getStatusLabel(status))}
    </span>
  `;
}

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

// --------------------------------------------------
// 4. ADMIN AUTHENTICATION
// --------------------------------------------------

async function verifyAdmin(user) {
  await user.reload();

  if (!user.emailVerified) {
    throw new Error("Please verify your email before accessing the Admin Dashboard.");
  }

  const tokenResult = await user.getIdTokenResult(true);

  if (tokenResult.claims.admin !== true) {
    throw new Error("Your account does not have administrator permission.");
  }

  return true;
}

// --------------------------------------------------
// 5. LOAD FIRESTORE DATA
// --------------------------------------------------

async function loadAllData() {
  if (!currentAdmin) return;

  showMessage("Loading dashboard data...");

  try {
    const [usersSnapshot, resourcesSnapshot, requestsSnapshot] =
      await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "items")),
        getDocs(collection(db, "borrowRequests"))
      ]);

    usersData = usersSnapshot.docs.map(document => ({
      id: document.id,
      ...document.data()
    }));

    resourcesData = resourcesSnapshot.docs.map(document => ({
      id: document.id,
      ...document.data()
    }));

    requestsData = requestsSnapshot.docs.map(document => ({
      id: document.id,
      ...document.data()
    }));

    updateStatistics();
    renderRecentRequests();
    renderRequests();
    renderResources();
    renderStudents();

    clearMessage();

  } catch (error) {
    console.error("Dashboard loading error:", error);

    showMessage(
      "Unable to load data. Please check your Firestore security rules.",
      "error"
    );
  }
}

// --------------------------------------------------
// 6. UPDATE DASHBOARD STATISTICS
// --------------------------------------------------

function updateStatistics() {
  const pendingCount = requestsData.filter(
    request => request.status === "pending"
  ).length;

  const approvedCount = requestsData.filter(
    request => request.status === "approved"
  ).length;

  setText(totalUsersElement, usersData.length);
  setText(totalResourcesElement, resourcesData.length);
  setText(pendingRequestsElement, pendingCount);
  setText(approvedRequestsElement, approvedCount);
}

// --------------------------------------------------
// 7. RECENT REQUESTS
// --------------------------------------------------

function renderRecentRequests() {
  if (!recentRequestsTable) return;

  const recentRequests = [...requestsData]
    .sort((a, b) => getDateValue(b.createdAt) - getDateValue(a.createdAt))
    .slice(0, 5);

  if (recentRequests.length === 0) {
    recentRequestsTable.innerHTML = `
      <tr>
        <td colspan="5">No recent borrowing requests.</td>
      </tr>
    `;
    return;
  }

  recentRequestsTable.innerHTML = recentRequests.map(request => `
    <tr>
      <td>${escapeHTML(request.itemName || "Unknown resource")}</td>
      <td>${escapeHTML(request.borrowerName || "Unknown student")}</td>
      <td>${escapeHTML(request.ownerName || "Unknown owner")}</td>
      <td>${getStatusBadge(request.status)}</td>
      <td>${formatDate(request.createdAt)}</td>
    </tr>
  `).join("");
}

// --------------------------------------------------
// 8. ALL BORROWING REQUESTS
// --------------------------------------------------

function renderRequests() {
  if (!allRequestsTable) return;

  const searchText = requestSearch?.value.trim().toLowerCase() || "";
  const selectedStatus = requestStatusFilter?.value || "all";

  const filteredRequests = [...requestsData]
    .filter(request => {
      const searchableText = [
        request.itemName,
        request.borrowerName,
        request.ownerName,
        request.id
      ].join(" ").toLowerCase();

      const matchesSearch = searchableText.includes(searchText);

      const matchesStatus =
        selectedStatus === "all" ||
        String(request.status || "").toLowerCase() ===
          selectedStatus.toLowerCase();

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => getDateValue(b.createdAt) - getDateValue(a.createdAt));

  if (filteredRequests.length === 0) {
    allRequestsTable.innerHTML = `
      <tr>
        <td colspan="6">No borrowing requests found.</td>
      </tr>
    `;
    return;
  }

  allRequestsTable.innerHTML = filteredRequests.map(request => {
    const isPending = request.status === "pending";

    return `
      <tr>
        <td>${escapeHTML(request.itemName || "Unknown resource")}</td>
        <td>${escapeHTML(request.borrowerName || "Unknown student")}</td>
        <td>${escapeHTML(request.ownerName || "Unknown owner")}</td>
        <td>${getStatusBadge(request.status)}</td>
        <td>${formatDate(request.createdAt)}</td>
        <td>
          ${
            isPending
              ? `
                <button
                  class="action-button approve-button"
                  data-request-id="${escapeHTML(request.id)}"
                  data-action="approve">
                  Approve
                </button>

                <button
                  class="action-button reject-button"
                  data-request-id="${escapeHTML(request.id)}"
                  data-action="reject">
                  Reject
                </button>
              `
              : "—"
          }
        </td>
      </tr>
    `;
  }).join("");
}

// --------------------------------------------------
// 9. APPROVE OR REJECT REQUEST
// --------------------------------------------------

async function updateRequestStatus(requestId, action) {
  if (!currentAdmin) return;

  const request = requestsData.find(item => item.id === requestId);

  if (!request) {
    showMessage("Request not found.", "error");
    return;
  }

  if (request.status !== "pending") {
    showMessage("This request has already been processed.", "error");
    return;
  }

  const newStatus = action === "approve" ? "approved" : "rejected";

  const confirmation = confirm(
    `Are you sure you want to ${action} this borrowing request?`
  );

  if (!confirmation) return;

  try {
    showMessage("Updating request...");

    // Update the borrowing request.
    await updateDoc(doc(db, "borrowRequests", requestId), {
      status: newStatus
    });

    // If rejected, make the resource available again.
    if (newStatus === "rejected" && request.itemId) {
      await updateDoc(doc(db, "items", request.itemId), {
        available: true,
        activeRequestId: null
      });
    }

    showMessage(`Request ${newStatus} successfully.`, "success");

    await loadAllData();

  } catch (error) {
    console.error("Request update error:", error);

    showMessage(
      "Unable to update the request. Please check Firestore permissions.",
      "error"
    );
  }
}

// Handle approve/reject button clicks.
allRequestsTable?.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");

  if (!button) return;

  const requestId = button.dataset.requestId;
  const action = button.dataset.action;

  updateRequestStatus(requestId, action);
});

// --------------------------------------------------
// 10. RESOURCES TABLE
// --------------------------------------------------

function renderResources() {
  if (!resourcesTable) return;

  const searchText = resourceSearch?.value.trim().toLowerCase() || "";
  const selectedCategory = resourceCategoryFilter?.value || "all";

  const filteredResources = resourcesData.filter(resource => {
    const searchableText = [
      resource.name,
      resource.category,
      resource.ownerName
    ].join(" ").toLowerCase();

    const matchesSearch = searchableText.includes(searchText);

    const matchesCategory =
      selectedCategory === "all" ||
      resource.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  if (filteredResources.length === 0) {
    resourcesTable.innerHTML = `
      <tr>
        <td colspan="5">No resources found.</td>
      </tr>
    `;
    return;
  }

  resourcesTable.innerHTML = filteredResources.map(resource => `
    <tr>
      <td>${escapeHTML(resource.name || "Untitled resource")}</td>
      <td>${escapeHTML(resource.category || "Other")}</td>
      <td>${escapeHTML(resource.ownerName || "Unknown owner")}</td>
      <td>
        ${
          resource.available === true
            ? '<span class="status-badge approved">Available</span>'
            : '<span class="status-badge pending">Unavailable</span>'
        }
      </td>
      <td>${escapeHTML(resource.id)}</td>
    </tr>
  `).join("");
}

// --------------------------------------------------
// 11. STUDENTS TABLE
// --------------------------------------------------

function renderStudents() {
  if (!studentsTable) return;

  const searchText = studentSearch?.value.trim().toLowerCase() || "";

  const filteredStudents = usersData.filter(user => {
    const searchableText = [
      user.displayName,
      user.email,
      user.studentId,
      user.university,
      user.faculty,
      user.department
    ].join(" ").toLowerCase();

    return searchableText.includes(searchText);
  });

  if (filteredStudents.length === 0) {
    studentsTable.innerHTML = `
      <tr>
        <td colspan="6">No students found.</td>
      </tr>
    `;
    return;
  }

  studentsTable.innerHTML = filteredStudents.map(user => `
    <tr>
      <td>${escapeHTML(user.displayName || "Unknown")}</td>
      <td>${escapeHTML(user.email || "—")}</td>
      <td>${escapeHTML(user.studentId || "—")}</td>
      <td>${escapeHTML(user.university || "—")}</td>
      <td>${escapeHTML(user.faculty || "—")}</td>
      <td>${escapeHTML(user.department || "—")}</td>
    </tr>
  `).join("");
}

// --------------------------------------------------
// 12. SEARCH AND FILTER EVENTS
// --------------------------------------------------

requestSearch?.addEventListener("input", renderRequests);
requestStatusFilter?.addEventListener("change", renderRequests);

resourceSearch?.addEventListener("input", renderResources);
resourceCategoryFilter?.addEventListener("change", renderResources);

studentSearch?.addEventListener("input", renderStudents);

// --------------------------------------------------
// 13. SIDEBAR NAVIGATION
// --------------------------------------------------

function showSection(sectionName) {
  document.querySelectorAll(".dashboard-section").forEach(section => {
    section.classList.remove("active");
  });

  document.querySelectorAll(".nav-link").forEach(button => {
    button.classList.remove("active");
  });

  const selectedSection = document.getElementById(sectionName);

  if (!selectedSection) return;

  selectedSection.classList.add("active");

  const selectedButton = document.querySelector(
    `.nav-link[data-section="${sectionName}"]`
  );

  selectedButton?.classList.add("active");

  const titles = {
    overview: "Overview",
    requests: "Borrowing Requests",
    resources: "Resources",
    students: "Students"
  };

  setText(pageTitle, titles[sectionName] || "Admin Dashboard");
}

document.querySelectorAll(".nav-link[data-section]").forEach(button => {
  button.addEventListener("click", () => {
    showSection(button.dataset.section);
  });
});

document.querySelectorAll("[data-go-to]").forEach(button => {
  button.addEventListener("click", () => {
    showSection(button.dataset.goTo);
  });
});

// --------------------------------------------------
// 14. ADMIN LOGOUT
// --------------------------------------------------

adminLogout?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.replace("login.html");
  } catch (error) {
    console.error("Logout error:", error);
    showMessage("Unable to log out. Please try again.", "error");
  }
});

// --------------------------------------------------
// 15. CHECK LOGIN AND START DASHBOARD
// --------------------------------------------------

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  try {
    await verifyAdmin(user);

    currentAdmin = user;

    showSection("overview");

    await loadAllData();

  } catch (error) {
    console.error("Admin verification failed:", error);

    currentAdmin = null;

    await signOut(auth);

    window.location.replace("login.html");
  }
});
