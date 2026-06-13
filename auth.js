
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

import {
  doc, getDoc, setDoc, updateDoc,
  collection, query, where, getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

import {
  auth, db, googleProvider,
  COLLECTIONS, ROLES, STATUS,
  isSuperAdmin
} from "./firebase-config.js";

// ── HANDLE REDIRECT SCREENS ───────────────────────────────────
// If dashboard redirected here with a screen param, show it immediately
const urlParams = new URLSearchParams(window.location.search);
const screenParam = urlParams.get('screen');
if (screenParam) {
  document.addEventListener('DOMContentLoaded', () => {
    showScreen('screen-' + screenParam);
  });
}

// ── AUTH STATE LISTENER ───────────────────────────────────────
// Runs on page load — if already logged in, check their status
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  // User is logged in — check if they have an active league
  const userRef  = doc(db, COLLECTIONS.users, user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) return; // New user — let signup complete

  const userData = userSnap.data();

  // Super admin goes straight to super admin dashboard
if (isSuperAdmin(user.uid)) {
    sessionStorage.setItem('activeLeagueId', 'c4k9oD9ejANTqtkLlc0Y082kYnl2');
    window.location.href = "dashboard.html";
    return;
  }

  // Check if user has any leagues
  const leagues = userData.leagues || {};
  const leagueIds = Object.keys(leagues);

  if (leagueIds.length === 0) {
    // No league yet — show league code entry
    showScreen('screen-league');
    return;
  }

  // Check status in first league
  // If in multiple leagues, we'll handle league switching later
  const firstLeagueId = leagueIds[0];
  const leagueStatus  = leagues[firstLeagueId]?.status;

  if (leagueStatus === STATUS.approved) {
    // Save active league to sessionStorage for other pages
    sessionStorage.setItem('activeLeagueId', firstLeagueId);
    window.location.href = "dashboard.html";
  } else if (leagueStatus === STATUS.pending) {
    showScreen('screen-pending');
  } else if (leagueStatus === STATUS.rejected) {
    showScreen('screen-rejected');
  } else {
    showScreen('screen-league');
  }
});

// ── CREATE USER PROFILE ───────────────────────────────────────
async function createUserProfile(user, displayName) {
  const userRef = doc(db, COLLECTIONS.users, user.uid);
  await setDoc(userRef, {
    uid:         user.uid,
    displayName: displayName || user.displayName || "Player",
    email:       user.email,
    photoURL:    user.photoURL || null,
    isSuperAdmin: isSuperAdmin(user.uid),
    leagues:     {},   // empty — filled when they join a league
    createdAt:   serverTimestamp(),
  }, { merge: true });
}

// ── SIGN IN ───────────────────────────────────────────────────
async function handleSignIn() {
  clearErrors();
  const email = document.getElementById('signin-email').value.trim();
  const pass  = document.getElementById('signin-password').value;
  let valid   = true;

  if (!isValidEmail(email)) { showError('signin-email-err', 'Please enter a valid email'); valid = false; }
  if (!pass)                 { showError('signin-pass-err', 'Please enter your password'); valid = false; }
  if (!valid) return;

  const btn = document.querySelector('#form-signin .submit-btn');
  btn.classList.add('loading');

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    // onAuthStateChanged handles redirect
  } catch (err) {
    btn.classList.remove('loading');
    if (err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password'  ||
        err.code === 'auth/invalid-credential') {
      showError('signin-pass-err', 'Incorrect email or password');
    } else if (err.code === 'auth/too-many-requests') {
      showError('signin-pass-err', 'Too many attempts. Try again later');
    } else {
      showError('signin-pass-err', 'Something went wrong. Try again');
    }
  }
}

// ── SIGN UP ───────────────────────────────────────────────────
async function handleSignUp() {
  clearErrors();
  const name  = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pass  = document.getElementById('signup-password').value;
  let valid   = true;

  if (!name)                { showError('signup-name-err', 'Please enter your name'); valid = false; }
  if (!isValidEmail(email)) { showError('signup-email-err', 'Please enter a valid email'); valid = false; }
  if (pass.length < 8)      { showError('signup-pass-err', 'Password must be at least 8 characters'); valid = false; }
  if (!valid) return;

  const btn = document.querySelector('#form-signup .submit-btn');
  btn.classList.add('loading');

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, pass);
    const user       = credential.user;
    await updateProfile(user, { displayName: name });
    await createUserProfile(user, name);
    btn.classList.remove('loading');
    // Show league code screen
    showScreen('screen-league');
  } catch (err) {
    btn.classList.remove('loading');
    if (err.code === 'auth/email-already-in-use') {
      showError('signup-email-err', 'An account with this email already exists');
    } else if (err.code === 'auth/weak-password') {
      showError('signup-pass-err', 'Password is too weak');
    } else {
      showError('signup-email-err', 'Something went wrong. Try again');
    }
  }
}

// ── GOOGLE SIGN IN ────────────────────────────────────────────
async function googleAuth() {
  try {
    showToast('Opening Google sign-in...', '');
    const result = await signInWithPopup(auth, googleProvider);
    await createUserProfile(result.user, result.user.displayName);
    // onAuthStateChanged handles redirect
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      showToast('Google sign-in failed. Try again', 'error');
    }
  }
}

// ── JOIN LEAGUE WITH CODE ─────────────────────────────────────
async function joinLeague() {
  const code = document.getElementById('league-code-input').value.trim().toUpperCase();
  if (!code) { showError('league-code-err', 'Please enter a league code'); return; }

  const btn = document.getElementById('join-league-btn');
  btn.classList.add('loading');

  try {
    // Search for league with this code
    const leaguesRef = collection(db, COLLECTIONS.leagues);
    const q          = query(leaguesRef, where('code', '==', code));
    const snap       = await getDocs(q);

    if (snap.empty) {
      btn.classList.remove('loading');
      showError('league-code-err', 'Invalid code. Check with your group admin');
      return;
    }

    const leagueDoc  = snap.docs[0];
    const league     = leagueDoc.data();
    const leagueId   = leagueDoc.id;

    // Check if code has expired
    if (league.codeExpiresAt && league.codeExpiresAt.toMillis() < Date.now()) {
      btn.classList.remove('loading');
      showError('league-code-err', 'This league code has expired. Contact your admin');
      return;
    }

    // Check league status
    if (league.status !== 'active') {
      btn.classList.remove('loading');
      showError('league-code-err', 'This league is no longer active');
      return;
    }

    // Add user to league as pending
    const user    = auth.currentUser;
    const userRef = doc(db, COLLECTIONS.users, user.uid);

    await updateDoc(userRef, {
      [`leagues.${leagueId}`]: {
        status:   STATUS.pending,
        role:     ROLES.player,
        joinedAt: serverTimestamp(),
        points:   0,
        streak:   0,
        wildcards: 3,
      }
    });

    btn.classList.remove('loading');
    showScreen('screen-pending');

  } catch (err) {
    btn.classList.remove('loading');
    console.error('Error joining league:', err);
    showError('league-code-err', 'Something went wrong. Try again');
  }
}

// ── FORGOT PASSWORD ───────────────────────────────────────────
async function showForgot() {
  const email = document.getElementById('signin-email').value.trim();
  if (!isValidEmail(email)) {
    showError('signin-email-err', 'Enter your email above first');
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    showToast('Reset link sent to ' + email, 'success');
  } catch (err) {
    showError('signin-email-err', 'Email not found');
  }
}

// ── SCREEN MANAGER ────────────────────────────────────────────
// Controls which screen is visible on the auth page
function showScreen(screenId) {
  document.querySelectorAll('.auth-screen').forEach(s => s.style.display = 'none');
  const screen = document.getElementById(screenId);
  if (screen) screen.style.display = 'block';
}

// ── UI HELPERS ────────────────────────────────────────────────
function switchAuthTab(tab) {
  document.getElementById('tab-signin').classList.toggle('active', tab === 'signin');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('form-signin').style.display = tab === 'signin' ? 'block' : 'none';
  document.getElementById('form-signup').style.display = tab === 'signup' ? 'block' : 'none';
  clearErrors();
}

function togglePwd(inputId, btn) {
  const input  = document.getElementById(inputId);
  const isText = input.type === 'text';
  input.type   = isText ? 'password' : 'text';
  btn.querySelector('svg').innerHTML = isText
    ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
    : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.add('show'); }
}

function clearErrors() {
  document.querySelectorAll('.form-error').forEach(e => e.classList.remove('show'));
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(window._t);
  window._t = setTimeout(() => t.classList.remove('show'), 3000);
}

// ── EXPOSE TO HTML ────────────────────────────────────────────
window.handleSignIn  = handleSignIn;
window.handleSignUp  = handleSignUp;
window.googleAuth    = googleAuth;
window.showForgot    = showForgot;
window.joinLeague    = joinLeague;
window.switchAuthTab = switchAuthTab;
window.togglePwd     = togglePwd;

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const activeScreen = document.querySelector('.auth-screen[style*="block"]');
  if (activeScreen?.id === 'screen-league') joinLeague();
  else {
    const isSignin = document.getElementById('form-signin').style.display !== 'none';
    if (isSignin) handleSignIn(); else handleSignUp();
  }
});