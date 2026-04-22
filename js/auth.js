// ═══════════════════════════════════════════
//   Clipp — Authentication
//   Signup, login, sign out (with passwords)
// ═══════════════════════════════════════════

// ── Username validation ──
async function validateUsername() {
  const usernameInput = document.getElementById('username-input');
  if (!usernameInput) return;
  const val  = usernameInput.value.trim().toLowerCase();
  const wrap = document.getElementById('username-wrap');
  const msg  = document.getElementById('username-msg');
  const stat = document.getElementById('username-status');
  const btn  = document.getElementById('create-btn');
  const prev = document.getElementById('userid-preview');
  const disp = document.getElementById('userid-display');

  btn.disabled = true;
  wrap.classList.remove('valid', 'error');
  stat.textContent = '';
  prev.classList.remove('visible');
  msg.className = 'validation-msg';

  if (!val) { msg.textContent = ''; return; }
  if (!/^[a-z0-9_]+$/.test(val)) {
    wrap.classList.add('error');
    stat.textContent = '✗';
    msg.textContent = 'only lowercase letters, numbers, underscores';
    return;
  }
  if (val.length < 2) {
    msg.textContent = 'at least 2 characters';
    return;
  }
  stat.textContent = '…';

  const { data } = await sb.from('users').select('id').eq('username', val).maybeSingle();
  if (data) {
    wrap.classList.add('error');
    stat.textContent = '✗';
    msg.textContent = 'username taken';
    return;
  }

  wrap.classList.add('valid');
  stat.textContent = '✓';
  msg.className = 'validation-msg ok';
  msg.textContent = 'available';
  const uid = 'u_' + Math.random().toString(36).slice(2, 8);
  disp.textContent = uid;
  prev.classList.add('visible');
  btn.disabled = false;
  btn.dataset.uid = uid;
}

// ── Create account (with password) ──
async function createAccount() {
  const usernameInput = document.getElementById('username-input');
  const passwordInput = document.getElementById('signup-password');
  const username = usernameInput ? usernameInput.value.trim().toLowerCase() : '';
  const password = passwordInput ? passwordInput.value : '';
  const uid      = document.getElementById('create-btn').dataset.uid;
  const msg      = document.getElementById('username-msg');

  if (!uid || !username) return;

  // Validate password
  if (!password || password.length < 6) {
    msg.textContent = 'password must be at least 6 characters';
    msg.className = 'validation-msg';
    return;
  }

  const passwordHash = await hashPassword(password);

  const user = {
    id: uid,
    username,
    password_hash: passwordHash,
    joined_at: new Date().toISOString()
  };
  const { error } = await sb.from('users').insert(user);
  if (error) {
    msg.textContent = 'error: ' + error.message;
    return;
  }

  currentUser = user;
  localStorage.setItem('clipp_user', JSON.stringify(user));
  document.getElementById('welcome-name').textContent = '@' + username;
  showScreen('screen-siri');
}

// ── Sign in (with password) ──
async function signIn() {
  const username = document.getElementById('login-input').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  const msg      = document.getElementById('login-msg');
  if (!username) return;

  if (!password) {
    msg.textContent = 'please enter your password';
    return;
  }

  const { data, error } = await sb.from('users').select('*').eq('username', username).maybeSingle();
  if (!data || error) {
    msg.textContent = 'username not found';
    return;
  }

  // Check password
  const passwordHash = await hashPassword(password);
  if (data.password_hash && data.password_hash !== passwordHash) {
    msg.textContent = 'incorrect password';
    return;
  }

  currentUser = data;
  localStorage.setItem('clipp_user', JSON.stringify(data));
  enterApp();
}

// ── Sign out ──
function signOut() {
  currentUser = null;
  localStorage.removeItem('clipp_user');
  location.reload();
}

// ── Toggle password visibility ──
function togglePasswordVisibility(btn) {
  const input = btn.parentElement.querySelector('input');
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  // Update icon
  const svg = btn.querySelector('svg');
  if (isPassword) {
    svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
  } else {
    svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/>';
  }
}

// ── Change password ──
async function changePassword() {
  if (!currentUser) return;
  const currentPw = document.getElementById('current-password').value;
  const newPw     = document.getElementById('new-password').value;
  const msg       = document.getElementById('password-change-msg');

  if (!currentPw || !newPw) {
    msg.textContent = 'fill in both fields';
    msg.className = 'validation-msg';
    return;
  }
  if (newPw.length < 6) {
    msg.textContent = 'new password must be at least 6 characters';
    msg.className = 'validation-msg';
    return;
  }

  // Verify current password
  const { data } = await sb.from('users').select('password_hash').eq('id', currentUser.id).maybeSingle();
  if (data && data.password_hash) {
    const currentHash = await hashPassword(currentPw);
    if (currentHash !== data.password_hash) {
      msg.textContent = 'current password is incorrect';
      msg.className = 'validation-msg';
      return;
    }
  }

  // Update password
  const newHash = await hashPassword(newPw);
  const { error } = await sb.from('users').update({ password_hash: newHash }).eq('id', currentUser.id);
  if (error) {
    msg.textContent = 'error: ' + error.message;
    msg.className = 'validation-msg';
    return;
  }

  msg.textContent = 'password updated ✓';
  msg.className = 'validation-msg ok';
  document.getElementById('current-password').value = '';
  document.getElementById('new-password').value = '';
  currentUser.password_hash = newHash;
  localStorage.setItem('clipp_user', JSON.stringify(currentUser));
}
