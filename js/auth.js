import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

import { auth, db, googleProvider, COLLECTIONS } from "./firebase-config.js";

// ── AUTH STATE LISTENER ───────────────────────────────────────
// If user already logged in, skip straight to dashboard
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "dashboard.html";
});

// ── CREATE USER PROFILE IN FIRESTORE ─────────────────────────
async function createUserProfile(user, displayName) {
  const userRef = doc(db, COLLECTIONS.users, user.uid);
  await setDoc(userRef, {
    uid:         user.uid,
    displayName: displayName || user.displayName || "Player",
    email:       user.email,
    photoURL:    user.photoURL || null,
    points:      0,
    streak:      0,
    wildcards:   3,
    isAdmin:     false,
    joinedAt:    serverTimestamp(),
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
    showToast('Welcome back!', 'success');
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
    showToast('Welcome to WOS PREDICTS!', 'success');
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
    showToast('Signed in with Google!', 'success');
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      showToast('Google sign-in failed. Try again', 'error');
    }
  }
}

// ── FORGOT PASSWORD ───────────────────────────────────────────
async function showForgot() {
  const email = document.getElementById('signin-email').value.trim();
  if (!isValidEmail(email)) { showError('signin-email-err', 'Enter your email above first'); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    showToast('Reset link sent to ' + email, 'success');
  } catch (err) {
    showError('signin-email-err', 'Email not found');
  }
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
window.switchAuthTab = switchAuthTab;
window.togglePwd     = togglePwd;

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const isSignin = document.getElementById('form-signin').style.display !== 'none';
  if (isSignin) handleSignIn(); else handleSignUp();
});
// ── LOAD COMPETITION INFO ─────────────────────────────────────
// Pulls live competition name and prize from Firestore
// so landing page never has hardcoded values
async function loadCompetitionInfo() {
  try {
    const { db, COLLECTIONS } = await import("./firebase-config.js");
    const { getDocs, collection } = await import("https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js");
    
    const snap = await getDocs(collection(db, COLLECTIONS.competition));
    if (snap.empty) return;
    
    const comp = snap.docs[0].data();
    
    if (comp.totalMatches) {
      document.getElementById('landing-matches').textContent = comp.totalMatches;
    }
    if (comp.prizePool) {
      document.getElementById('landing-prize').textContent = comp.prizePool;
    }
  } catch(e) {
    // Silently fail — dashes show if no competition set up yet
  }
}

// Call on page load
loadCompetitionInfo();