
import { auth, db } from "./firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
    addDoc,
    collection,
    doc,
    getDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

// ------------------------------------
// HTML ELEMENTS
// ------------------------------------

const resourceForm = document.getElementById("resourceForm");
const submitButton = document.getElementById("submitButton");
const formMessage = document.getElementById("formMessage");

let currentUser = null;
let userProfile = {};
let authReady = false;
let isSubmitting = false;

// ------------------------------------
// CONSTANTS
// ------------------------------------

const ALLOWED_CATEGORIES = [
    "Books",
    "Electronics",
    "Photography",
    "Sports",
    "Tools",
    "Stationery",
    "Other"
];

const ALLOWED_CONDITIONS = [
    "New",
    "Like New",
    "Good",
    "Fair"
];

const ALLOWED_DURATIONS = [1, 2, 3, 5, 7, 14];

const ALLOWED_AVAILABILITY = [
    "Available",
    "Unavailable"
];

// ------------------------------------
// MESSAGE
// ------------------------------------

function showMessage(message, type = "error") {
    if (!formMessage) return;

    formMessage.textContent = message;
    formMessage.className = `form-message ${type}`;
}

// ------------------------------------
// FORM CONTROL
// ------------------------------------

function setFormEnabled(enabled) {
    if (!resourceForm) return;

    [...resourceForm.elements].forEach(element => {
        element.disabled = !enabled;
    });
}

function setSubmitting(submitting) {
    if (!submitButton) return;

    submitButton.disabled = submitting;

    submitButton.textContent = submitting
        ? "Publishing..."
        : "Submit Resource →";
}

// ------------------------------------
// LOAD USER PROFILE
// ------------------------------------

async function loadUserProfile(user) {
    try {
        const profileRef = doc(db, "users", user.uid);
        const profileSnapshot = await getDoc(profileRef);

        userProfile = profileSnapshot.exists()
            ? profileSnapshot.data()
            : {};

    } catch (error) {
        console.error("Profile loading failed:", error);

        // Resource can still be published using account details.
        userProfile = {};
    }
}

// ------------------------------------
// AUTHENTICATION CHECK
// ------------------------------------

onAuthStateChanged(auth, async user => {

    authReady = false;
    currentUser = user;

    setFormEnabled(false);

    if (!user) {
        window.location.replace("login.html");
        return;
    }

    try {
        await user.reload();

        currentUser = auth.currentUser;

        if (!currentUser || !currentUser.emailVerified) {
            showMessage(
                "Please verify your email before adding a resource."
            );

            await signOut(auth);
            window.location.replace("login.html");
            return;
        }

        await loadUserProfile(currentUser);

        authReady = true;
        setFormEnabled(true);

        showMessage(
            "Your account is verified. You can now add a resource.",
            "success"
        );

    } catch (error) {
        console.error("Authentication error:", error);

        showMessage(
            "Unable to verify your account. Please sign in again."
        );

        setFormEnabled(false);
    }
});

// ------------------------------------
// FORM SUBMISSION
// ------------------------------------

resourceForm?.addEventListener("submit", async event => {

    event.preventDefault();

    if (isSubmitting) return;

    if (!authReady || !currentUser) {
        showMessage(
            "Please sign in with a verified account first."
        );
        return;
    }

    // --------------------------------
    // GET FORM VALUES
    // --------------------------------

    const name = document
        .getElementById("resourceName")
        .value.trim();

    const category = document
        .getElementById("category")
        .value;

    const condition = document
        .getElementById("condition")
        .value;

    const description = document
        .getElementById("description")
        .value.trim();

    const availability = document
        .getElementById("availability")
        .value;

    const fee = Number(
        document.getElementById("fee").value
    );

    const maxDuration = Number(
        document.getElementById("maxDays").value
    );

    const location = document
        .getElementById("location")
        .value.trim();

    const ownershipConfirmed = document
        .getElementById("confirmOwnership")
        .checked;

    // --------------------------------
    // VALIDATION
    // --------------------------------

    if (
        !name ||
        !category ||
        !condition ||
        !description ||
        !location
    ) {
        showMessage("Please complete all required fields.");
        return;
    }

    if (name.length > 100) {
        showMessage("Resource name must not exceed 100 characters.");
        return;
    }

    if (description.length > 1000) {
        showMessage("Description must not exceed 1000 characters.");
        return;
    }

    if (location.length > 150) {
        showMessage("Pickup location must not exceed 150 characters.");
        return;
    }

    if (!ALLOWED_CATEGORIES.includes(category)) {
        showMessage("Please select a valid category.");
        return;
    }

    if (!ALLOWED_CONDITIONS.includes(condition)) {
        showMessage("Please select a valid item condition.");
        return;
    }

    if (!ALLOWED_AVAILABILITY.includes(availability)) {
        showMessage("Please select a valid availability status.");
        return;
    }

    if (
        !Number.isFinite(fee) ||
        fee < 0 ||
        fee > 1000000
    ) {
        showMessage("Please enter a valid borrowing fee.");
        return;
    }

    if (!ALLOWED_DURATIONS.includes(maxDuration)) {
        showMessage("Please select a valid borrowing period.");
        return;
    }

    if (!ownershipConfirmed) {
        showMessage(
            "Please confirm that you have permission to list this resource."
        );
        return;
    }

    if (!resourceForm.reportValidity()) {
        return;
    }

    // --------------------------------
    // PUBLISH RESOURCE
    // --------------------------------

    isSubmitting = true;
    setSubmitting(true);

    try {

        // Refresh authentication status.
        await currentUser.reload();

        currentUser = auth.currentUser;

        if (!currentUser || !currentUser.emailVerified) {
            throw new Error(
                "Please verify your email before publishing."
            );
        }

        const available = availability === "Available";

        const ownerName =
            userProfile?.displayName ||
            currentUser.displayName ||
            currentUser.email ||
            "CampusLend member";

        // Save resource to Firestore.
        await addDoc(collection(db, "items"), {

            name: name,
            category: category,
            condition: condition,
            description: description,
            location: location,

            fee: fee,
            maxDuration: maxDuration,

            ownerId: currentUser.uid,
            ownerName: ownerName,

            available: available,
            activeRequestId: null,

            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()

        });

        showMessage(
            "Resource published successfully!",
            "success"
        );

        resourceForm.reset();

        // Redirect after successful publishing.
        window.setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 1500);

    } catch (error) {

        console.error(
            "Resource publishing failed:",
            error
        );

        let errorMessage =
            "Unable to publish your resource. Please try again.";

        if (error.code === "permission-denied") {
            errorMessage =
                "Permission denied. Please check your account and Firestore Security Rules.";
        } else if (error.code === "unavailable") {
            errorMessage =
                "Network unavailable. Please check your internet connection.";
        } else if (error.message) {
            errorMessage = error.message;
        }

        showMessage(errorMessage);

    } finally {

        isSubmitting = false;
        setSubmitting(false);

    }

});
