import { onAuthStateChanged }   from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import {
  doc, getDoc, getDocs, collection,
  query, where, orderBy, limit,
  addDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

import {
  auth, db,
  COLLECTIONS,
  RAPIDAPI_KEY, RAPIDAPI_HOST,
  COMPETITION_ID, SEASON
} from "./firebase-config.js";

// ─────────────────────────────────────────────────────────────
// STATE — variables we use across functions
// ─────────────────────────────────────────────────────────────
let currentUser    = null;   // Firebase Auth user object
let userProfile    = null;   // Firestore user document
let todayMatches   = [];     // today's fixtures
let activePick     = null;   // which match the modal is open for
let selectedPick   = null;   // which pick option is selected
let wildcardActive = false;  // whether wildcard is toggled on
let countdownTimer = null;   // interval for countdown

// ─────────────────────────────────────────────────────────────
// ENTRY POINT — wait for Firebase Auth to confirm login
// If not logged in, redirect to login page
// ─────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  currentUser = user;
  await init();
});

// ─────────────────────────────────────────────────────────────
// INIT — runs after auth is confirmed
// Loads everything in parallel for speed
// ─────────────────────────────────────────────────────────────
async function init() {
  // Run all these at the same time — don't wait for one before starting next
  await Promise.all([
    loadUserProfile(),
    loadTodayMatches(),
    loadLatestNotification(),
  ]);
  setMatchDate();
}

// ─────────────────────────────────────────────────────────────
// LOAD USER PROFILE FROM FIRESTORE
// Gets the player's name, points, streak, wildcards, rank
// ─────────────────────────────────────────────────────────────
async function loadUserProfile() {
  try {
    const userRef  = doc(db, COLLECTIONS.users, currentUser.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return;

    userProfile = userSnap.data();

    // Update greeting
    const name = userProfile.displayName || "Player";
    document.getElementById('greeting').textContent = `Hey ${name} 👋`;

    // Update avatar — first letter of name
    document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase();

    // Update stats
    document.getElementById('stat-points').textContent   = userProfile.points   ?? 0;
    document.getElementById('stat-streak').textContent   = userProfile.streak   ?? 0;
    document.getElementById('stat-wildcards').textContent= userProfile.wildcards ?? 3;

    // Calculate rank — count users with more points
    const usersSnap = await getDocs(collection(db, COLLECTIONS.users));
    const allUsers  = usersSnap.docs.map(d => d.data());
    const rank      = allUsers.filter(u => u.points > userProfile.points).length + 1;
    document.getElementById('stat-rank').textContent = '#' + rank;

    // Show streak banner if streak >= 3
    if (userProfile.streak >= 3) {
      const banner = document.getElementById('streak-banner');
      document.getElementById('streak-banner-text').textContent =
        `${userProfile.streak} correct in a row! Next pick = double points 🔥`;
      banner.style.display = 'flex';
    }

  } catch (err) {
    console.error('Error loading profile:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// LOAD TODAY'S MATCHES
// First checks Firestore — if matches already saved, use those.
// If not, fetch from API and save to Firestore.
// This saves API requests — we only call the API once per day.
// ─────────────────────────────────────────────────────────────
async function loadTodayMatches() {
  try {
    const today     = getTodayString(); // e.g. "2026-06-12"
    const matchesRef= collection(db, COLLECTIONS.matches);
    const q         = query(matchesRef, where("date", "==", today));
    const snap      = await getDocs(q);

    if (!snap.empty) {
      // Matches already in Firestore — use them
      todayMatches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      // Not in Firestore — fetch from API and save
      todayMatches = await fetchMatchesFromAPI(today);
      await saveMatchesToFirestore(todayMatches);
    }

    await renderMatches();

  } catch (err) {
    console.error('Error loading matches:', err);
    document.getElementById('matches-list').innerHTML =
      '<div class="empty-state">Could not load fixtures. Try again later.</div>';
  }
}

// ─────────────────────────────────────────────────────────────
// FETCH MATCHES FROM API-FOOTBALL
// Called only when matches aren't in Firestore yet
// ─────────────────────────────────────────────────────────────
async function fetchMatchesFromAPI(date) {
  const timezone = encodeURIComponent('Africa/Douala');
  const url = `https://${RAPIDAPI_HOST}/competition_matches_list?date=${date}&timezone=${timezone}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key':  RAPIDAPI_KEY,
    }
  });

  if (!response.ok) throw new Error('API fetch failed');

  const data = await response.json();

  // API returns items grouped by competition
  // Each item has cname and a matches array inside
  // We filter for World Cup only using cid 1382
  const competitions = data.response?.items || [];

  // Find World Cup competition — cid 1382
  // If not found fall back to first competition
const competitions = data.response?.items || [];
 const worldCup = competitions.find(c => c.cid === "1382" || c.cid === 1382 || c.cname?.toLowerCase().includes('world cup')) || competitions[0];
 console.log('World Cup object:', worldCup);
 console.log('Matches:', worldCup?.matches);
 
  if (!worldCup || !worldCup.matches) return [];

  // Map each match to our format
  return worldCup.matches.map(match => ({
    apiId:    match.mid                        || '',
    homeTeam: match.teams?.home?.tname         || 'Home',
    awayTeam: match.teams?.away?.tname         || 'Away',
    homeLogo: match.teams?.home?.logo          || '',
    awayLogo: match.teams?.away?.logo          || '',
    homeAbbr: match.teams?.home?.abbr          || '',
    awayAbbr: match.teams?.away?.abbr          || '',
    kickoff:  match.datestart                  || '',
    group:    worldCup.cname                   || 'Group Stage',
    date:     date,
    status:   match.status === '3' ? 'live'
            : match.status === '5' ? 'finished'
            : 'upcoming',
  }));
}
// ─────────────────────────────────────────────────────────────
// SAVE MATCHES TO FIRESTORE
// Saves API data so we don't call the API again tomorrow
// ─────────────────────────────────────────────────────────────
async function saveMatchesToFirestore(matches) {
  for (const match of matches) {
    await addDoc(collection(db, COLLECTIONS.matches), {
      ...match,
      createdAt: serverTimestamp(),
    });
  }
}

// ─────────────────────────────────────────────────────────────
// RENDER MATCHES
// Builds match cards for today's fixtures
// Also loads each player's existing pick for each match
// ─────────────────────────────────────────────────────────────
async function renderMatches() {
  const container = document.getElementById('matches-list');

  if (todayMatches.length === 0) {
    container.innerHTML = '<div class="empty-state">No matches today. Check back tomorrow! ⚽</div>';
    return;
  }

  // Load all of today's picks for this user in one query
  const picksRef  = collection(db, COLLECTIONS.picks);
  const picksQuery= query(picksRef, where("userId", "==", currentUser.uid));
  const picksSnap = await getDocs(picksQuery);
  const myPicks   = {};
  picksSnap.docs.forEach(d => {
    const data = d.data();
    myPicks[data.matchId] = { id: d.id, ...data };
  });

  container.innerHTML = '';

  todayMatches.forEach(match => {
    const existingPick = myPicks[match.id];
    const isLocked     = isMatchLocked(match.kickoff);
    const card         = buildMatchCard(match, existingPick, isLocked);
    container.appendChild(card);
  });

  // Start countdown timers
  startCountdowns();
}

// ─────────────────────────────────────────────────────────────
// BUILD MATCH CARD
// Creates a single match card DOM element
// ─────────────────────────────────────────────────────────────
function buildMatchCard(match, existingPick, isLocked) {
  const card = document.createElement('div');
  card.className = 'match-card' + (existingPick ? ' picked' : '') + (isLocked ? ' locked' : '');
  card.id = 'match-card-' + match.id;

  const statusText  = isLocked ? '🔒 Locked' : '⏰ Open';
  const statusClass = isLocked ? 'locked' : 'open';
  const kickoffDisplay = formatKickoff(match.kickoff);

  // Home logo or abbreviation fallback
  const homeImgHTML = match.homeLogo
    ? `<img src="${match.homeLogo}" style="width:36px;height:36px;object-fit:contain;"
        onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
       <span style="display:none;font-size:13px;font-weight:700;color:var(--text);">${match.homeAbbr}</span>`
    : `<span style="font-size:13px;font-weight:700;color:var(--text);">${match.homeAbbr || '?'}</span>`;

  // Away logo or abbreviation fallback
  const awayImgHTML = match.awayLogo
    ? `<img src="${match.awayLogo}" style="width:36px;height:36px;object-fit:contain;"
        onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
       <span style="display:none;font-size:13px;font-weight:700;color:var(--text);">${match.awayAbbr}</span>`
    : `<span style="font-size:13px;font-weight:700;color:var(--text);">${match.awayAbbr || '?'}</span>`;

  // Footer
  let footerHTML = '';
  if (existingPick) {
    const pickLabel = getPickLabel(existingPick.pick);
    const wcBadge = existingPick.wildcard
      ? '<span style="color:var(--amber);font-size:11px;">🃏 Wildcard</span>' : '';
    footerHTML = `
      <div class="pick-submitted">
        ✅ <span>${pickLabel}</span>
        ${existingPick.pick === 'correct_score'
          ? `<span style="color:var(--text-muted);font-size:11px;">(${existingPick.scoreHome}–${existingPick.scoreAway})</span>` : ''}
        ${existingPick.pick === 'motm'
          ? `<span style="color:var(--text-muted);font-size:11px;">(${existingPick.motmPlayer})</span>` : ''}
      </div>
      ${wcBadge}`;
  } else if (isLocked) {
    footerHTML = `
      <div class="pick-submitted-label">No pick submitted</div>
      <button class="predict-btn locked-btn" disabled>Locked</button>`;
  } else {
    footerHTML = `
      <div class="pick-submitted-label">No pick yet</div>
      <button class="predict-btn" onclick="openModal('${match.id}')">Predict</button>`;
  }

  card.innerHTML = `
    <div class="match-card-top">
      <span class="match-group">${match.group}</span>
      <span class="match-status-badge ${statusClass}">${statusText}</span>
    </div>
    <div class="match-teams-row">
      <div class="team-block">
        <div class="team-flag">${homeImgHTML}</div>
        <div class="team-name">${match.homeTeam}</div>
      </div>
      <div class="match-center">
        <div class="vs-text">VS</div>
        <div class="kickoff-time">${kickoffDisplay}</div>
        <div class="countdown" id="countdown-${match.id}"></div>
      </div>
      <div class="team-block">
        <div class="team-flag">${awayImgHTML}</div>
        <div class="team-name">${match.awayTeam}</div>
      </div>
    </div>
    <div class="match-card-footer">${footerHTML}</div>
  `;

  return card;
}

// ─────────────────────────────────────────────────────────────
// OPEN PREDICT MODAL
// ─────────────────────────────────────────────────────────────
window.openModal = function(matchId) {
  activePick     = todayMatches.find(m => m.id === matchId);
  selectedPick   = null;
  wildcardActive = false;

  if (!activePick) return;

  // Set match header in modal
 document.getElementById('modal-match-header').innerHTML = `
  <div class="modal-team">
    <div class="modal-flag">
      ${activePick.homeLogo
        ? `<img src="${activePick.homeLogo}" style="width:32px;height:32px;object-fit:contain;">`
        : activePick.homeAbbr}
    </div>
    <div class="modal-team-name">${activePick.homeTeam}</div>
  </div>
  <div class="modal-vs">VS</div>
  <div class="modal-team">
    <div class="modal-flag">
      ${activePick.awayLogo
        ? `<img src="${activePick.awayLogo}" style="width:32px;height:32px;object-fit:contain;">`
        : activePick.awayAbbr}
    </div>
    <div class="modal-team-name">${activePick.awayTeam}</div>
  </div>
`;

  // Update team labels on pick options and score inputs
  document.getElementById('pick-home-label').textContent = activePick.homeTeam + ' win';
  document.getElementById('pick-away-label').textContent = activePick.awayTeam + ' win';
  document.getElementById('score-home-label').textContent = activePick.homeTeam;
  document.getElementById('score-away-label').textContent = activePick.awayTeam;

  // Reset all pick options
  document.querySelectorAll('.pick-option').forEach(el => el.classList.remove('selected'));
  document.getElementById('score-input-wrap').style.display = 'none';
  document.getElementById('motm-input-wrap').style.display  = 'none';
  document.getElementById('score-home').value = '';
  document.getElementById('score-away').value = '';
  document.getElementById('motm-player').value = '';

  // Reset wildcard
  document.getElementById('wildcard-toggle').classList.remove('on');
  wildcardActive = false;

  // Show modal
  document.getElementById('modal-overlay').classList.add('show');
  document.getElementById('predict-modal').classList.add('show');

  // Start countdown in modal
  updateModalCountdown();
};

// ─────────────────────────────────────────────────────────────
// CLOSE MODAL
// ─────────────────────────────────────────────────────────────
window.closeModal = function() {
  document.getElementById('modal-overlay').classList.remove('show');
  document.getElementById('predict-modal').classList.remove('show');
  activePick   = null;
  selectedPick = null;
};

// ─────────────────────────────────────────────────────────────
// SELECT PICK OPTION
// ─────────────────────────────────────────────────────────────
document.querySelectorAll('.pick-option').forEach(el => {
  el.addEventListener('click', () => {
    // Remove selected from all
    document.querySelectorAll('.pick-option').forEach(o => o.classList.remove('selected'));
    // Add to clicked
    el.classList.add('selected');
    selectedPick = el.dataset.pick;

    // Show/hide score input
    document.getElementById('score-input-wrap').style.display =
      selectedPick === 'correct_score' ? 'block' : 'none';

    // Show/hide MOTM input
    document.getElementById('motm-input-wrap').style.display =
      selectedPick === 'motm' ? 'block' : 'none';
  });
});

// ─────────────────────────────────────────────────────────────
// TOGGLE WILDCARD
// ─────────────────────────────────────────────────────────────
window.toggleWildcard = function() {
  // Check if player has wildcards left
  const wcsLeft = userProfile?.wildcards ?? 0;
  if (!wildcardActive && wcsLeft <= 0) {
    showToast('No wildcards remaining!', 'error');
    return;
  }
  wildcardActive = !wildcardActive;
  document.getElementById('wildcard-toggle').classList.toggle('on', wildcardActive);
};

// ─────────────────────────────────────────────────────────────
// LOCK IN PICK — saves to Firestore
// ─────────────────────────────────────────────────────────────
window.lockInPick = async function() {
  if (!selectedPick) { showToast('Choose a prediction first!', 'error'); return; }
  if (!activePick)   return;

  // Validate score input
  const scoreHome = parseInt(document.getElementById('score-home').value);
  const scoreAway = parseInt(document.getElementById('score-away').value);
  if (selectedPick === 'correct_score') {
    if (isNaN(scoreHome) || isNaN(scoreAway)) {
      showToast('Enter the score prediction!', 'error');
      return;
    }
  }

  // Validate MOTM input
  const motmPlayer = document.getElementById('motm-player').value.trim();
  if (selectedPick === 'motm' && !motmPlayer) {
    showToast('Enter the player name!', 'error');
    return;
  }

  // Check deadline — 15 minutes before kickoff
  if (isMatchLocked(activePick.kickoff)) {
    showToast('Deadline passed! Pick locked.', 'error');
    closeModal();
    return;
  }

  const btn = document.getElementById('lock-in-btn');
  btn.classList.add('loading');

  try {
    // Save pick to Firestore
    const pickData = {
      userId:      currentUser.uid,
      matchId:     activePick.id,
      pick:        selectedPick,
      wildcard:    wildcardActive,
      submittedAt: serverTimestamp(),
      // Only save these if relevant
      ...(selectedPick === 'correct_score' && { scoreHome, scoreAway }),
      ...(selectedPick === 'motm'          && { motmPlayer }),
    };

    await addDoc(collection(db, COLLECTIONS.picks), pickData);

    // If wildcard used, decrement player's wildcard count
    if (wildcardActive) {
      const userRef = doc(db, COLLECTIONS.users, currentUser.uid);
      await setDoc(userRef, {
        wildcards: (userProfile.wildcards ?? 3) - 1
      }, { merge: true });
      userProfile.wildcards = (userProfile.wildcards ?? 3) - 1;
      document.getElementById('stat-wildcards').textContent = userProfile.wildcards;
    }

    btn.classList.remove('loading');
    closeModal();
    showToast('✅ Pick locked in!', 'success');

    // Refresh matches to show new pick badge
    await renderMatches();

  } catch (err) {
    btn.classList.remove('loading');
    console.error('Error saving pick:', err);
    showToast('Failed to save pick. Try again.', 'error');
  }
};

// ─────────────────────────────────────────────────────────────
// LOAD LATEST NOTIFICATION
// ─────────────────────────────────────────────────────────────
async function loadLatestNotification() {
  try {
    const notifRef = collection(db, COLLECTIONS.notifications);
    const q        = query(notifRef, orderBy('createdAt', 'desc'), limit(1));
    const snap     = await getDocs(q);

    if (snap.empty) return;

    const notif  = snap.docs[0].data();
    const banner = document.getElementById('notif-banner');
    document.getElementById('notif-banner-text').textContent = notif.message;
    banner.style.display = 'flex';

    // Show red dot on bell if notification is less than 24hrs old
    const age = Date.now() - notif.createdAt?.toMillis();
    if (age < 86400000) {
      document.getElementById('notif-dot').classList.add('show');
    }

  } catch (err) {
    console.error('Error loading notifications:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// COUNTDOWN TIMERS
// Updates every second for all visible match cards
// ─────────────────────────────────────────────────────────────
function startCountdowns() {
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    todayMatches.forEach(match => {
      const el = document.getElementById('countdown-' + match.id);
      if (!el) return;
      el.textContent = getCountdown(match.kickoff);
    });
  }, 1000);
}

function updateModalCountdown() {
  if (!activePick) return;
  document.getElementById('modal-countdown').textContent =
    'Kicks off in ' + getCountdown(activePick.kickoff);
}

function getCountdown(kickoff) {
  if (!kickoff) return '';
  const diff = new Date(kickoff).getTime() - Date.now();
  if (diff <= 0) return 'Started';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

// Returns today's date as "YYYY-MM-DD"
function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

// Formats kickoff ISO string to "20:00" display
function formatKickoff(kickoff) {
  if (!kickoff) return '--:--';
  const d = new Date(kickoff);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// A match is locked 15 minutes before kickoff
function isMatchLocked(kickoff) {
  if (!kickoff) return false;
  return Date.now() >= new Date(kickoff).getTime() - 15 * 60 * 1000;
}

// Sets today's date in section header
function setMatchDate() {
  document.getElementById('match-date').textContent =
    new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Human-readable pick labels
function getPickLabel(pick) {
  const labels = {
    home_win:      'Home win',
    draw:          'Draw',
    away_win:      'Away win',
    correct_score: 'Exact score',
    five_yellows:  '5+ yellows',
    red_card:      'Red card',
    motm:          'MOTM',
    prolongation:  'Extra time',
    penalties:     'Penalties',
  };
  return labels[pick] || pick;
}

// Competition name from Firestore
async function loadCompetitionName() {
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.competition));
    if (!snap.empty) {
      document.getElementById('competition-name').textContent =
        snap.docs[0].data().name || 'Active Competition';
    }
  } catch(e) {}
}

function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(window._t);
  window._t = setTimeout(() => t.classList.remove('show'), 3000);
}