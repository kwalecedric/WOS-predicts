import { initializeApp }             from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore }              from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

// ── FIREBASE CONFIG ───────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBHglkJ1qLqXzk0R946divpBbykGlikZmM",
  authDomain:        "wos-predicts.firebaseapp.com",
  projectId:         "wos-predicts",
  storageBucket:     "wos-predicts.firebasestorage.app",
  messagingSenderId: "902061124852",
  appId:             "1:902061124852:web:9ad8df20735c1a5b4a02a1",
};

const app = initializeApp(firebaseConfig);

export const auth           = getAuth(app);
export const db             = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// ── SUPER ADMIN ───────────────────────────────────────────────
// Only this UID has super admin privileges
// Replace with your actual UID from Firebase Auth
export const SUPER_ADMIN_UID = "c4k9oD9ejANTqtkLlc0Y082kYnI2";

// ── API CONFIG ────────────────────────────────────────────────
export const RAPIDAPI_KEY  = "be356bced3msh57c6ef63b89280ap113f79jsn40f7e7727aa3";
export const RAPIDAPI_HOST = "api-football186.p.rapidapi.com";

// ── FIRESTORE COLLECTIONS ─────────────────────────────────────
export const COLLECTIONS = {
  users:         "users",         // player profiles
  leagues:       "leagues",       // each league/group
  matches:       "matches",       // fixtures (global, shared across leagues)
  picks:         "picks",         // predictions (tagged by leagueId + userId)
  results:       "results",       // match results entered by admin
  chat:          "chat",          // league chat messages (subcollection per league)
  notifications: "notifications", // admin announcements (subcollection per league)
  competition:   "competition",   // active competition settings (global)
};

// ── LEAGUE CODE GENERATOR ─────────────────────────────────────
// Generates a readable 8-char code e.g. "SQVB-7K2M"
// No confusing chars: no 0/O, no 1/I
export function generateLeagueCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ── ROLE CONSTANTS ────────────────────────────────────────────
export const ROLES = {
  player:    'player',
  subAdmin:  'sub_admin',
  owner:     'owner',
  observer:  'observer',
};

// ── LEAGUE MEMBER STATUS ──────────────────────────────────────
export const STATUS = {
  pending:  'pending',
  approved: 'approved',
  rejected: 'rejected',
};

// ── HELPERS ───────────────────────────────────────────────────

// Check if user is super admin
export function isSuperAdmin(uid) {
  return uid === SUPER_ADMIN_UID;
}

// Check user's role in a specific league
export function getUserLeagueRole(userDoc, leagueId) {
  return userDoc?.leagues?.[leagueId]?.role || null;
}

// Check user's status in a specific league
export function getUserLeagueStatus(userDoc, leagueId) {
  return userDoc?.leagues?.[leagueId]?.status || null;
}

// Check if user is admin or owner in a league
export function isLeagueAdmin(userDoc, leagueId) {
  const role = getUserLeagueRole(userDoc, leagueId);
  return role === ROLES.owner || role === ROLES.subAdmin;
}

// Format a timestamp to readable date
export function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}