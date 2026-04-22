// ═══════════════════════════════════════════
//   Clipp — Main App Entry Point
// ═══════════════════════════════════════════

// ── Init ──
window.addEventListener('DOMContentLoaded', () => {
  // Attach username input listener
  const usernameInput = document.getElementById('username-input');
  if (usernameInput) {
    usernameInput.addEventListener('input', debounce(validateUsername, 350));
  }

  // Check for saved session
  const saved = localStorage.getItem('clipp_user');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      enterApp();
      // Deep link: "Hey Siri, Clipp it"
      if (location.hash === '#record') {
        history.replaceState(null, '', location.pathname);
        setTimeout(openRecord, 300);
      }
    } catch (e) {
      localStorage.removeItem('clipp_user');
    }
  }

  // Unlock audio on mobile (iOS requires user gesture before audio can play)
  document.addEventListener('touchstart', unlockAudioOnMobile, { once: true });
  document.addEventListener('click', unlockAudioOnMobile, { once: true });
});

// ── Screen navigation ──
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active', 'exit');
    if (s.id !== id) s.classList.add('exit');
  });
  setTimeout(() => document.querySelectorAll('.screen').forEach(s => s.classList.remove('exit')), 350);
  const t = document.getElementById(id);
  if (t) {
    t.classList.remove('exit');
    t.classList.add('active');
  }
}

function enterApp() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active', 'exit'));
  const app = document.getElementById('screen-app');
  app.classList.add('active');

  // Add mod-active class to body if moderator
  if (isMod()) {
    document.body.classList.add('mod-active');
  }

  populateSettings();
  loadFeed();
}

// ── Settings ──
function populateSettings() {
  if (!currentUser) return;
  document.getElementById('topbar-username').textContent = '@' + currentUser.username;
  document.getElementById('s-username').textContent  = '@' + currentUser.username;
  document.getElementById('s-userid').textContent    = currentUser.id;
  document.getElementById('s-joined').textContent    = new Date(currentUser.joined_at).toLocaleDateString();

  // Show mod badge if applicable
  const modBadge = document.getElementById('mod-badge');
  if (modBadge) {
    modBadge.style.display = isMod() ? 'inline-flex' : 'none';
  }
}

// ── Tab / Navigation switching ──
function switchTab(name, btn) {
  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // Update tab panes
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');

  if (name === 'feed')     loadFeed();
  if (name === 'mine')     loadMine();
}

// ── Keyboard shortcuts ──
document.addEventListener('keydown', e => {
  const recScreen = document.getElementById('screen-record').classList.contains('active');
  if (!recScreen) return;
  if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
    e.preventDefault();
    toggleRecord();
  }
  if (e.code === 'KeyP' && e.target.tagName !== 'INPUT') postClip();
  if (e.code === 'KeyD' && e.target.tagName !== 'INPUT') discardClip();
});
