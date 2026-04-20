// ══════════════════════════════════════════
//  github.js — GitHub as a backend
//
//  Every post, like, and comment is a real
//  file in your GitHub repo. This module
//  handles reading and writing those files
//  via the GitHub Contents API.
//
//  WHY THIS WORKS:
//  GitHub's API lets you create/update files
//  in a repo using a Personal Access Token
//  (PAT). The files are publicly readable
//  (since the repo is public for GitHub Pages)
//  but only writable with the token.
//
//  SETUP REQUIRED (done once in Settings):
//  - Repo: "username/reponame" e.g. "alice/clip-app"
//  - Token: a GitHub PAT with "repo" scope
//  Both are stored in localStorage only.
// ══════════════════════════════════════════

const GitHub = (() => {

  const BASE = 'https://api.github.com';

  // ── Get stored config ──────────────────
  function getConfig() {
    const raw = localStorage.getItem('clip_github');
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch { return null; }
  }

  function isConfigured() {
    const c = getConfig();
    return !!(c?.repo && c?.token);
  }

  // ── Build auth headers ─────────────────
  function headers() {
    const c = getConfig();
    return {
      'Authorization': `token ${c.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
  }

  // ── Encode/decode file content ─────────
  // GitHub API requires base64 for file content
  function toBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  function fromBase64(b64) {
    return decodeURIComponent(escape(atob(b64)));
  }

  // ══════════════════════════════════════
  //  READ a file from the repo
  //  Returns { content, sha } or null
  //  sha is needed to update existing files
  // ══════════════════════════════════════
  async function readFile(path) {
    const c = getConfig();
    if (!c) throw new Error('GitHub not configured');

    const url = `${BASE}/repos/${c.repo}/contents/${path}`;
    const res = await fetch(url, { headers: headers() });

    if (res.status === 404) return null; // File doesn't exist yet
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub read failed: ${res.status}`);
    }

    const data = await res.json();
    return {
      content: fromBase64(data.content.replace(/\n/g, '')),
      sha: data.sha
    };
  }

  // ══════════════════════════════════════
  //  WRITE a file to the repo
  //  Creates it if new, updates if exists.
  //  sha must be passed when updating.
  // ══════════════════════════════════════
  async function writeFile(path, content, message, sha = null) {
    const c = getConfig();
    if (!c) throw new Error('GitHub not configured');

    const url = `${BASE}/repos/${c.repo}/contents/${path}`;
    const body = {
      message: message || `clip: update ${path}`,
      content: toBase64(content)
    };
    if (sha) body.sha = sha; // Required for updates

    const res = await fetch(url, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub write failed: ${res.status}`);
    }

    return await res.json();
  }

  // ══════════════════════════════════════
  //  UPLOAD an audio file (binary/base64)
  //  audioBlob: a Blob from MediaRecorder
  // ══════════════════════════════════════
  async function uploadAudio(path, audioBlob, message) {
    const c = getConfig();
    if (!c) throw new Error('GitHub not configured');

    // Convert blob to base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const b64 = btoa(binary);

    const url = `${BASE}/repos/${c.repo}/contents/${path}`;
    const body = {
      message: message || `clip: upload audio ${path}`,
      content: b64
    };

    const res = await fetch(url, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub audio upload failed: ${res.status}`);
    }

    return await res.json();
  }

  // ══════════════════════════════════════
  //  LIST files in a folder
  //  Returns array of { name, path, sha }
  // ══════════════════════════════════════
  async function listFolder(folderPath) {
    const c = getConfig();
    if (!c) throw new Error('GitHub not configured');

    const url = `${BASE}/repos/${c.repo}/contents/${folderPath}`;
    const res = await fetch(url, { headers: headers() });

    if (res.status === 404) return []; // Folder doesn't exist yet
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub list failed: ${res.status}`);
    }

    return await res.json();
  }

  // ══════════════════════════════════════
  //  GET raw public URL for an audio file
  //  Used for playback — no auth needed
  //  since the repo is public
  // ══════════════════════════════════════
  function rawUrl(path) {
    const c = getConfig();
    if (!c) return null;
    const [owner, repo] = c.repo.split('/');
    return `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
  }

  // ══════════════════════════════════════
  //  VALIDATE token + repo by fetching repo info
  // ══════════════════════════════════════
  async function testConnection() {
    const c = getConfig();
    if (!c) return { ok: false, error: 'not configured' };

    try {
      const res = await fetch(`${BASE}/repos/${c.repo}`, {
        headers: headers()
      });
      if (res.status === 404) return { ok: false, error: 'repo not found — check the name' };
      if (res.status === 401) return { ok: false, error: 'bad token — check your PAT' };
      if (!res.ok) return { ok: false, error: `error ${res.status}` };

      const data = await res.json();
      return { ok: true, repoName: data.full_name };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ══════════════════════════════════════
  //  APPEND a line to a text file
  //  Used for likes and comments.
  //  Reads current content, appends, writes back.
  // ══════════════════════════════════════
  async function appendLine(path, line, commitMessage) {
    const existing = await readFile(path);
    const currentContent = existing ? existing.content : '';
    const newContent = currentContent
      ? currentContent.trimEnd() + '\n' + line + '\n'
      : line + '\n';

    return await writeFile(path, newContent, commitMessage, existing?.sha || null);
  }

  // Public API
  return {
    isConfigured,
    getConfig,
    readFile,
    writeFile,
    uploadAudio,
    listFolder,
    rawUrl,
    testConnection,
    appendLine
  };

})();
