// CampusShare Firebase configuration
// Firebase web config is intended to be used in client-side apps.
// Protect your data with Firebase Security Rules; never put service-account keys here.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCeJApfiX4ETx6X6jhD59cDnyq-kCXasUw",
  authDomain: "campusshare-800d2.firebaseapp.com",
  projectId: "campusshare-800d2",
  storageBucket: "campusshare-800d2.firebasestorage.app",
  messagingSenderId: "1037106995526",
  appId: "1:1037106995526:web:f5f70e66aa97485763c547"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
