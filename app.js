// ══════════════════════════════════════════
//  CLIP — app.js
//  Step 1: Account creation + Siri setup
//
//  What this file does:
//  1. Screen navigation system
//  2. Username validation
//  3. User ID generation (e.g. u_a3f9k2)
//  4. Saving account to localStorage
//  5. Loading account on return visits
//  6. Tab switching in main app
//  7. Sign out
// ══════════════════════════════════════════


// ─────────────────────────────────────────
// 1. SCREEN NAVIGATION
//    Screens are layered <div>s. We toggle
//    the .active class to show/hide them
//    with a CSS fade+slide transition.
// ─────────────────────────────────────────

let currentScreen = 'screen-splash';

function goTo(screenId) {
  // Remove active from current screen (triggers exit CSS)
  const current = document.getElementById(currentScreen);
  if (current) {
    current.classList.add('exit');
    // After transition ends, remove both active and exit
    setTimeout(() => {
      current.classList.remove('active', 'exit');
    }, 350);
  }

  // Activate the new screen after a tiny delay so the
  // fade-out of the old one is visible first
  setTimeout(() => {
    const next = document.getElementById(screenId);
    if (next) {
      next.classList.add('active');
      currentScreen = screenId;
    }
  }, 80);
}


// ─────────────────────────────────────────
// 2. USER ID GENERATION
//    Format: u_ + 6 random alphanumeric chars
//    e.g. u_a3f9k2
//    We generate this once and store it —
//    the user never picks it, it never changes.
// ─────────────────────────────────────────

function generateUserId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'u_';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}


// ─────────────────────────────────────────
// 3. USERNAME VALIDATION
//    Rules:
//    - 3–20 characters
//    - only lowercase letters, numbers, underscores
//    - cannot start with a number
// ─────────────────────────────────────────

function validateUsername(value) {
  if (value.length === 0) return { ok: false, msg: '' };
  if (value.length < 3) return { ok: false, msg: 'at least 3 characters' };
  if (value.length > 20) return { ok: false, msg: 'max 20 characters' };
  if (/^\d/.test(value)) return { ok: false, msg: "can't start with a number" };
  if (!/^[a-z0-9_]+$/.test(value)) return { ok: false, msg: 'lowercase letters, numbers, and _ only' };
  return { ok: true, msg: '' };
}


// ─────────────────────────────────────────
// 4. LIVE USERNAME INPUT HANDLER
//    As the user types, we validate and
//    show the generated user ID preview.
// ─────────────────────────────────────────

// We generate the ID once when the page loads,
// not on every keystroke, so it stays stable.
let pendingUserId = generateUserId();

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('username-input');
  const validationMsg = document.getElementById('validation-msg');
  const createBtn = document.getElementById('create-btn');
  const userIdValue = document.getElementById('userid-value');
  const userIdPreview = document.getElementById('userid-preview');
  const wrap = document.getElementById('username-wrap');
  const statusIcon = document.getElementById('username-status');

  if (input) {
    input.addEventListener('input', () => {
      // Force lowercase as they type
      const raw = input.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (input.value !== raw) input.value = raw;

      const result = validateUsername(raw);

      // Update validation message
      validationMsg.textContent = result.msg;
      validationMsg.className = 'validation-msg';

      // Update wrapper border + icon
      wrap.classList.remove('error', 'valid');
      if (raw.length === 0) {
        statusIcon.textContent = '';
        userIdPreview.classList.remove('visible');
        userIdValue.textContent = '—';
        createBtn.disabled = true;
        return;
      }

      if (result.ok) {
        wrap.classList.add('valid');
        statusIcon.textContent = '✓';
        userIdValue.textContent = pendingUserId;
        userIdPreview.classList.add('visible');
        createBtn.disabled = false;
      } else {
        wrap.classList.add('error');
        statusIcon.textContent = '✗';
        userIdPreview.classList.remove('visible');
        createBtn.disabled = true;
      }
    });
  }

  // Check if user already has an account on load
  checkExistingAccount();
  loadGitHubConfig();
  checkHashDeepLink();
});


// ─────────────────────────────────────────
// 5. CREATE ACCOUNT
//    Saves to localStorage with the schema:
//    {
//      username: "yourname",
//      userId:   "u_a3f9k2",
//      joinDate: "2026-04-20T...",
//      settings: { playbackSpeed: 1, voiceCommands: true }
//    }
// ─────────────────────────────────────────

function createAccount() {
  const username = document.getElementById('username-input').value.trim();
  const validation = validateUsername(username);
  if (!validation.ok) return;

  const account = {
    username: username,
    userId: pendingUserId,
    joinDate: new Date().toISOString(),
    settings: {
      playbackSpeed: 1,
      voiceCommands: true
    }
  };

  // Save to localStorage (persists across page closes)
  localStorage.setItem('clip_account', JSON.stringify(account));

  // Show confirm screen with the details
  document.getElementById('confirm-username').textContent = '@' + username;
  document.getElementById('confirm-userid').textContent = pendingUserId;

  goTo('screen-confirm');
}


// ─────────────────────────────────────────
// 6. CHECK FOR EXISTING ACCOUNT
//    Called on page load. If an account
//    exists in localStorage, skip onboarding
//    and go straight to the main app.
// ─────────────────────────────────────────

function checkExistingAccount() {
  const raw = localStorage.getItem('clip_account');
  if (!raw) return; // No account → stay on splash

  try {
    const account = JSON.parse(raw);
    if (account.username && account.userId) {
      loadMainApp(account);
      // Skip animation, jump straight to main
      // (use a tiny delay so DOM is ready)
      setTimeout(() => goTo('screen-main'), 10);
    }
  } catch (e) {
    // Corrupted data — clear it and start fresh
    localStorage.removeItem('clip_account');
  }
}


// ─────────────────────────────────────────
// 7. LOAD MAIN APP
//    Populates all the account-specific
//    UI elements with the user's data.
// ─────────────────────────────────────────

function loadMainApp(account) {
  if (!account) {
    const raw = localStorage.getItem('clip_account');
    if (!raw) return;
    account = JSON.parse(raw);
  }

  // Top bar
  const topbarUser = document.getElementById('topbar-username');
  if (topbarUser) topbarUser.textContent = '@' + account.username;

  // Settings tab
  const settingsUsername = document.getElementById('settings-username');
  const settingsUserid = document.getElementById('settings-userid');
  const settingsJoined = document.getElementById('settings-joined');

  if (settingsUsername) settingsUsername.textContent = '@' + account.username;
  if (settingsUserid) settingsUserid.textContent = account.userId;
  if (settingsJoined) {
    const date = new Date(account.joinDate);
    settingsJoined.textContent = date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  // Settings controls — load saved preferences
  const speedSelect = document.getElementById('settings-speed');
  const voiceToggle = document.getElementById('settings-voice');
  if (speedSelect && account.settings?.playbackSpeed) {
    speedSelect.value = account.settings.playbackSpeed;
  }
  if (voiceToggle && account.settings?.voiceCommands !== undefined) {
    voiceToggle.checked = account.settings.voiceCommands;
  }

  // Listen for settings changes and save them
  if (speedSelect) {
    speedSelect.addEventListener('change', () => saveSettings());
  }
  if (voiceToggle) {
    voiceToggle.addEventListener('change', () => saveSettings());
  }
}


// ─────────────────────────────────────────
// 8. SAVE SETTINGS
//    Updates the stored account whenever
//    a setting changes.
// ─────────────────────────────────────────

function saveSettings() {
  const raw = localStorage.getItem('clip_account');
  if (!raw) return;

  const account = JSON.parse(raw);
  const speedSelect = document.getElementById('settings-speed');
  const voiceToggle = document.getElementById('settings-voice');

  account.settings = {
    playbackSpeed: speedSelect ? parseFloat(speedSelect.value) : 1,
    voiceCommands: voiceToggle ? voiceToggle.checked : true
  };

  localStorage.setItem('clip_account', JSON.stringify(account));
}


// ─────────────────────────────────────────
// 9. FINISH SETUP
//    Called after Siri walkthrough is done.
//    Loads the main app and navigates to it.
// ─────────────────────────────────────────

function finishSetup() {
  loadMainApp();
  goTo('screen-main');
}


// ─────────────────────────────────────────
// 10. LOGIN (returning users)
//     In this step, "login" just checks
//     localStorage for a matching username.
//     (Supabase real auth comes in a later step)
// ─────────────────────────────────────────

function loginAccount() {
  const input = document.getElementById('login-username');
  const msg = document.getElementById('login-msg');
  const username = input.value.trim().toLowerCase();

  const raw = localStorage.getItem('clip_account');
  if (!raw) {
    msg.textContent = 'no account found — try creating one';
    return;
  }

  const account = JSON.parse(raw);
  if (account.username === username) {
    msg.textContent = '';
    loadMainApp(account);
    goTo('screen-main');
  } else {
    msg.textContent = 'username not found on this device';
  }
}


// ─────────────────────────────────────────
// 11. SIGN OUT
//     Clears localStorage and returns to splash.
// ─────────────────────────────────────────

function signOut() {
  if (confirm('sign out? your clips and data stay saved.')) {
    localStorage.removeItem('clip_account');
    // Reset the pending ID so a fresh one is generated
    pendingUserId = generateUserId();
    // Clear the username input for a clean state
    const input = document.getElementById('username-input');
    if (input) input.value = '';
    goTo('screen-splash');
  }
}


// ─────────────────────────────────────────
// 12. TAB SWITCHING (main app)
//     Shows/hides the three main content panels.
// ─────────────────────────────────────────

function switchTab(tabName, btn) {
  // Hide all tab content panels
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.add('hidden');
  });

  // Deactivate all nav buttons
  document.querySelectorAll('.nav-btn').forEach(el => {
    el.classList.remove('active');
  });

  // Show the selected tab
  const tab = document.getElementById('tab-' + tabName);
  if (tab) tab.classList.remove('hidden');

  // Activate the clicked button
  if (btn) btn.classList.add('active');
}


// ─────────────────────────────────────────
// 13. OPEN RECORD SCREEN
// ─────────────────────────────────────────
function openRecord() {
  Recorder.init();
  goTo('screen-record');
}

function recBack() {
  Recorder.discard();
  goTo('screen-main');
}

// ─────────────────────────────────────────
// 14. GITHUB CONFIG — save + test
// ─────────────────────────────────────────
async function saveGitHubConfig() {
  const repo  = document.getElementById('gh-repo')?.value?.trim();
  const token = document.getElementById('gh-token')?.value?.trim();
  const statusEl = document.getElementById('gh-status');

  if (!repo || !token) {
    if (statusEl) { statusEl.textContent = 'enter both repo and token'; statusEl.style.color = 'var(--danger)'; }
    return;
  }

  localStorage.setItem('clip_github', JSON.stringify({ repo, token }));
  if (statusEl) { statusEl.textContent = 'testing…'; statusEl.style.color = 'var(--text2)'; }

  const result = await GitHub.testConnection();
  if (result.ok) {
    if (statusEl) { statusEl.textContent = '✓ connected to ' + result.repoName; statusEl.style.color = 'var(--success)'; }
    Feed.load();
  } else {
    if (statusEl) { statusEl.textContent = '✗ ' + result.error; statusEl.style.color = 'var(--danger)'; }
  }
}

// ─────────────────────────────────────────
// 15. LOAD GITHUB CONFIG into settings fields
// ─────────────────────────────────────────
function loadGitHubConfig() {
  const raw = localStorage.getItem('clip_github');
  if (!raw) return;
  try {
    const c = JSON.parse(raw);
    const repoEl  = document.getElementById('gh-repo');
    const tokenEl = document.getElementById('gh-token');
    const statusEl = document.getElementById('gh-status');
    if (repoEl && c.repo) repoEl.value = c.repo;
    if (tokenEl && c.token) tokenEl.value = c.token;
    if (statusEl) { statusEl.textContent = '✓ connected to ' + c.repo; statusEl.style.color = 'var(--success)'; }
  } catch {}
}

// ─────────────────────────────────────────
// 16. HASH-BASED DEEP LINK
//     "Hey Siri, clip it" opens the URL with
//     #record at the end. We detect that and
//     jump straight to the record screen.
// ─────────────────────────────────────────
function checkHashDeepLink() {
  if (window.location.hash === '#record') {
    const raw = localStorage.getItem('clip_account');
    if (raw) {
      const account = JSON.parse(raw);
      loadMainApp(account);
      // Clear the hash silently so reload doesn't re-trigger
      history.replaceState(null, '', window.location.pathname);
      setTimeout(() => openRecord(), 100);
    }
  }
}
