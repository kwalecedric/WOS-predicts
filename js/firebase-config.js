// ─────────────────────────────────────────────────────────────
// firebase-config.js
// This file is the bridge between our app and Firebase.
// Every other page imports from here — never copy keys elsewhere.
// ─────────────────────────────────────────────────────────────

// STEP 1 — Import only the Firebase services we need.
// We use the modular SDK (v9+) loaded from Google's CDN.
// Each import is a specific service:
//   initializeApp   → starts the Firebase connection
//   getAuth         → handles login/logout/user sessions
//   getFirestore    → handles our database (picks, matches, chat etc.)
//   GoogleAuthProvider → lets users sign in with Google

import { initializeApp }        from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore }         from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

// ─────────────────────────────────────────────────────────────
// STEP 2 — Your Firebase project credentials.
// These tell Firebase WHICH project to connect to.
// These are safe to include in frontend code —
// security comes from Firestore Rules, not hiding these keys.
// ─────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey:            "AIzaSyBHglkJ1qLqXzk0R946divpBbykGlikZmM",
  authDomain:        "wos-predicts.firebaseapp.com",
  projectId:         "wos-predicts",
  storageBucket:     "wos-predicts.firebasestorage.app",
  messagingSenderId: "902061124852",
  appId:             "1:902061124852:web:9ad8df20735c1a5b4a02a1",
};

// ─────────────────────────────────────────────────────────────
// STEP 3 — Initialise Firebase with our config.
// This creates ONE app instance shared across all pages.
// ─────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);

// ─────────────────────────────────────────────────────────────
// STEP 4 — Create service instances.
// auth → manages who is logged in
// db   → our Firestore database
// googleProvider → used when user clicks "Sign in with Google"
// ─────────────────────────────────────────────────────────────

export const auth           = getAuth(app);
export const db             = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// ─────────────────────────────────────────────────────────────
// STEP 5 — App-wide constants.
// These are shared settings used across every page.
// Change RAPIDAPI_KEY here and it updates everywhere.
// ─────────────────────────────────────────────────────────────

export const RAPIDAPI_KEY  = "be356bced3msh57c6ef63b89280ap113f79jsn40f7e7727aa3";
export const RAPIDAPI_HOST = "api-football186.p.rapidapi.com";

// Competition ID for the active tournament.
// For World Cup 2026 on API-Football the ID is 1.
// When we switch to AFCON or another comp, we just change this number.
export const COMPETITION_ID = 1;
export const SEASON         = 2026;

// ─────────────────────────────────────────────────────────────
// STEP 6 — Firestore collection names.
// Defined once here so we never mistype a collection name
// anywhere else in the app.
// ─────────────────────────────────────────────────────────────

export const COLLECTIONS = {
  users:         "users",         // player profiles
  matches:       "matches",       // fixtures fetched from API
  picks:         "picks",         // each player's predictions
  results:       "results",       // match results entered by admin
  leaderboard:   "leaderboard",   // points tally per player
  chat:          "chat",          // group chat messages
  notifications: "notifications", // admin announcements
  competition:   "competition",   // active competition settings
};
// Super Admin UID — only this user can assign/remove admins
// Replace this with your actual UID after you create your account
export const SUPER_ADMIN_UID = "YOUR_UID_HERE";