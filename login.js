
import { auth } from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged,
  reload,
  signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";


// HTML Elements

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const togglePassword = document.getElementById("togglePassword");
const message = document.getElementById("message");

const submitButton = document.getElementById("loginButton");
const verificationPanel = document.getElementById("verificationPanel");

const resendButton = document.getElementById("resendVerification");
const checkButton = document.getElementById("checkVerification");

const forgotLink = document.getElementById("forgotLink");
const rememberInput = document.getElementById("remember");


// Get selected login role

function getSelectedRole() {
  return document.querySelector(
    'input[name="loginRole"]:checked'
  )?.value || "student";
}


// Display message

function showMessage(text, isError = true) {
  message.style.color = isError ? "#b42318" : "#187b57";
  message.textContent = text;
}


// Friendly Firebase errors

function friendlyError(error) {
  const codes = {
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/email-already-in-use": "This email is already registered.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/network-request-failed": "Network error. Check your internet connection.",
    "auth/operation-not-allowed": "Email/Password sign-in is not enabled in Firebase.",
    "auth/unauthorized-domain": "This website domain is not authorized in Firebase Authentication settings.",
    "auth/requires-recent-login": "Please sign in again before performing this action."
  };

  return codes[error.code] || error.message || "Something went wrong. Please try again.";
}


// Show / Hide password

if (togglePassword) {
  togglePassword.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";

    passwordInput.type = isHidden ? "text" : "password";
    togglePassword.textContent = isHidden ? "Hide" : "Show";

    togglePassword.setAttribute(
      "aria-label",
      isHidden ? "Hide password" : "Show password"
    );
  });
}


// Check admin permission and redirect

async function redirectUser(user) {
  await reload(user);

  if (!user.emailVerified) {
    verificationPanel.style.display = "block";
    showMessage(
      "Please verify your email before accessing CampusLend.",
      true
    );
    return;
  }

  // Get Firebase Custom Claims
  const tokenResult = await user.getIdTokenResult(true);
  const isAdmin = tokenResult.claims.admin === true;

  const selectedRole = getSelectedRole();

  // Admin login
  if (selectedRole === "admin") {
    if (!isAdmin) {
      await signOut(auth);

      verificationPanel.style.display = "none";

      showMessage(
        "Access denied. This account is not authorised as an administrator.",
        true
      );

      return;
    }

    showMessage("Admin login successful. Opening Admin Panel...", false);
    window.location.replace("admin.html");
    return;
  }

  // Student login
  showMessage("Login successful. Opening your dashboard...", false);
  window.location.replace("dashboard.html");
}


// Authentication state listener

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    verificationPanel.style.display = "none";
    return;
  }

  try {
    await reload(user);

    if (!user.emailVerified) {
      verificationPanel.style.display = "block";

      showMessage(
        "Your email is not verified yet. Please verify your email to continue.",
        true
      );
    }
  } catch (error) {
    console.error("Authentication state error:", error);
    showMessage(friendlyError(error));
  }
});


// Login form

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  const remember = rememberInput.checked;

  if (!email || !password) {
    showMessage("Please enter your email and password.");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Signing in...";

  verificationPanel.style.display = "none";
  showMessage("Checking your account...", false);

  try {
    await setPersistence(
      auth,
      remember ? browserLocalPersistence : browserSessionPersistence
    );

    const credential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    await redirectUser(credential.user);

  } catch (error) {
    console.error("Login error:", error);
    showMessage(friendlyError(error));
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Sign In →";
  }
});


// Resend verification email

resendButton.addEventListener("click", async () => {
  const user = auth.currentUser;

  if (!user) {
    showMessage("Please sign in first to resend the verification email.");
    return;
  }

  resendButton.disabled = true;
  resendButton.textContent = "Sending...";

  try {
    await reload(user);

    if (user.emailVerified) {
      await redirectUser(user);
      return;
    }

    await sendEmailVerification(user);

    showMessage(
      "A new verification email has been sent. Please check your inbox and Spam folder.",
      false
    );

  } catch (error) {
    console.error("Resend verification error:", error);
    showMessage(friendlyError(error));
  } finally {
    resendButton.disabled = false;
    resendButton.textContent = "Resend verification email";
  }
});


// Check email verification

checkButton.addEventListener("click", async () => {
  const user = auth.currentUser;

  if (!user) {
    showMessage("Your login session has expired. Please sign in again.");
    return;
  }

  checkButton.disabled = true;
  checkButton.textContent = "Checking...";

  try {
    await reload(user);

    if (user.emailVerified) {
      verificationPanel.style.display = "none";
      await redirectUser(user);
    } else {
      showMessage(
        "Your email is still not verified. Please open the latest verification email and click its link.",
        true
      );
    }

  } catch (error) {
    console.error("Verification check error:", error);
    showMessage(friendlyError(error));
  } finally {
    checkButton.disabled = false;
    checkButton.textContent = "I have verified – Check again";
  }
});


// Forgot password

forgotLink.addEventListener("click", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim().toLowerCase();

  if (!email) {
    showMessage("Enter your email address first, then click Forgot password?.");
    emailInput.focus();
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);

    showMessage(
      "If an account exists for this email, a password reset email has been sent. Check your inbox and Spam folder.",
      false
    );

  } catch (error) {
    console.error("Password reset error:", error);
    showMessage(friendlyError(error));
  }
});
