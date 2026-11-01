
import { auth, db } from "./firebase-config.js";

import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";


const form = document.getElementById("registerForm");
const message = document.getElementById("message");
const button = document.getElementById("registerButton");


function getValue(id) {
  return document.getElementById(id).value.trim();
}


function showMessage(text, isError = true) {
  message.style.color = isError ? "#b42318" : "#187b57";
  message.textContent = text;
}


function friendlyError(error) {

  const codes = {
    "auth/email-already-in-use":
      "An account with this email already exists. Please sign in instead.",

    "auth/invalid-email":
      "Please enter a valid email address.",

    "auth/weak-password":
      "Choose a stronger password with at least 8 characters.",

    "auth/operation-not-allowed":
      "Email/Password sign-in is not enabled in Firebase.",

    "auth/network-request-failed":
      "Network error. Check your internet connection.",

    "auth/unauthorized-domain":
      "This website domain is not authorized in Firebase Authentication settings.",

    "permission-denied":
      "Firestore permission denied. Please check your Firestore security rules.",

    "auth/too-many-requests":
      "Too many attempts. Please wait and try again."
  };

  return codes[error.code] ||
    error.message ||
    "Could not create your account. Please try again.";
}


form.addEventListener("submit", async (event) => {

  event.preventDefault();


  // Collect registration details

  const fullName = getValue("fullName");
  const studentId = getValue("studentId");
  const university = getValue("university");
  const faculty = getValue("faculty");
  const department = getValue("department");
  const contact = getValue("contact");

  const email = getValue("email").toLowerCase();

  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;


  // Validate form

  if (fullName.length < 2) {
    showMessage("Please enter your full name.");
    return;
  }

  if (!studentId || !university || !faculty || !contact) {
    showMessage("Please complete all required student details.");
    return;
  }

  if (password !== confirmPassword) {
    showMessage("The passwords do not match.");
    return;
  }

  if (password.length < 8) {
    showMessage("Your password must contain at least 8 characters.");
    return;
  }


  // Disable button

  button.disabled = true;
  button.textContent = "Creating account…";

  showMessage("Creating your CampusShare account…", false);


  let createdUser = null;


  try {

    // 1. Create Firebase Authentication account

    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    createdUser = credential.user;


    // 2. Save user's display name

    await updateProfile(createdUser, {
      displayName: fullName
    });


    // 3. Create student profile in Firestore

    const userProfile = {

      uid: createdUser.uid,

      displayName: fullName,

      email: email,

      studentId: studentId,

      university: university,

      faculty: faculty,

      department: department,

      contact: contact,

      createdAt: serverTimestamp(),

      updatedAt: serverTimestamp()

    };


    await setDoc(
      doc(db, "users", createdUser.uid),
      userProfile
    );


    // 4. Send email verification

    await sendEmailVerification(createdUser);


    // 5. Sign out until email is verified

    await signOut(auth);


    // 6. Success message

    form.reset();

    showMessage(
      "Account created successfully! A verification link has been sent to your email. Please verify your email and then sign in.",
      false
    );


    // Redirect to login

    setTimeout(() => {
      window.location.replace("login.html");
    }, 4000);


  } catch (error) {

    console.error("Registration error:", error);


    if (createdUser && error.code !== "auth/email-already-in-use") {

      showMessage(
        "Your Firebase account may already have been created, but another step failed. Do not register again with this email. Please contact support or sign in after correcting the issue.",
        true
      );

    } else {

      showMessage(friendlyError(error));

    }

    button.disabled = false;
    button.textContent = "Create Account →";

  }

});
