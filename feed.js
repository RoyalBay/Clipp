// ══════════════════════════════════════════
//  feed.js — Audio feed + likes + comments
//
//  HOW THE FEED WORKS:
//  1. Lists all files in the content/ folder
//     via GitHub API (public, no auth needed)
//  2. Finds all .txt metadata files
//  3. Reads each one to get title, user, etc.
//  4. Renders a card for each post
//  5. Audio plays from the raw GitHub URL
//
//  LIKES format (content/u_abc.1.likes.txt):
//    username.2026-04-20T08:32:00Z
//    username2.2026-04-20T09:00:00Z
//
//  COMMENTS format (content/u_abc.1.comments.txt):
//    username.2026-04-20T08:32:00Z.great clip!
//    username2.2026-04-20T09:00:00Z.love this
// ══════════════════════════════════════════

const Feed = (() => {

  let posts = [];           // Array of parsed post objects
  let currentIndex = -1;    // Which post is playing
  let currentAudio = null;  // Active HTMLAudioElement
  let isLoading = false;

  // ══════════════════════════════════════
  //  LOAD — fetch all posts from GitHub
  // ══════════════════════════════════════
  async function load() {
    if (!GitHub.isConfigured()) {
      renderNotConfigured();
      return;
    }

    isLoading = true;
    renderLoading();

    try {
      // List all files in content/
      const files = await GitHub.listFolder('content');

      // Filter to just .txt metadata files (not .likes or .comments)
      const metaFiles = files.filter(f =>
        f.name.endsWith('.txt') &&
        !f.name.endsWith('.likes.txt') &&
        !f.name.endsWith('.comments.txt')
      );

      if (metaFiles.length === 0) {
        renderEmpty();
        isLoading = false;
        return;
      }

      // Fetch each metadata file
      const fetchedPosts = await Promise.all(
        metaFiles.map(f => fetchPost(f))
      );

      // Sort newest first (by posted date)
      posts = fetchedPosts
        .filter(Boolean) // Remove any that failed
        .sort((a, b) => new Date(b.posted) - new Date(a.posted));

      renderFeed();
    } catch (e) {
      renderError(e.message);
    }

    isLoading = false;
  }

  // ══════════════════════════════════════
  //  FETCH & PARSE a single post's metadata
  // ══════════════════════════════════════
  async function fetchPost(fileInfo) {
    try {
      const result = await GitHub.readFile(fileInfo.path);
      if (!result) return null;

      const post = parseMeta(result.content);
      post.metaPath = fileInfo.path;

      // Derive audio path: same name but .webm
      post.audioPath = fileInfo.path.replace('.txt', '.webm');
      post.audioUrl = GitHub.rawUrl(post.audioPath);

      // Derive likes/comments paths
      post.likesPath    = fileInfo.path.replace('.txt', '.likes.txt');
      post.commentsPath = fileInfo.path.replace('.txt', '.comments.txt');

      // Post ID = "userid.postindex"
      post.postId = `${post.userid}.${post.postindex}`;

      return post;
    } catch (e) {
      console.warn('Failed to load post:', fileInfo.path, e);
      return null;
    }
  }

  // ══════════════════════════════════════
  //  PARSE .txt metadata into an object
  //
  //  title: Morning thought
  //  hashtags: #mindset #morning
  //  duration: 00:00:42
  //  posted: 2026-04-20T08:32:00Z
  //  userid: u_a3f9k2
  //  username: alice
  //  postindex: 1
  // ══════════════════════════════════════
  function parseMeta(text) {
    const obj = {};
    text.split('\n').forEach(line => {
      const colon = line.indexOf(':');
      if (colon === -1) return;
      const key = line.slice(0, colon).trim();
      const val = line.slice(colon + 1).trim();
      obj[key] = val;
    });
    return obj;
  }

  // ══════════════════════════════════════
  //  RENDER the feed
  // ══════════════════════════════════════
  function renderFeed() {
    const container = document.getElementById('feed-list');
    if (!container) return;

    container.innerHTML = '';

    posts.forEach((post, index) => {
      const card = createPostCard(post, index);
      container.appendChild(card);
    });
  }

  function createPostCard(post, index) {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.dataset.index = index;

    const timeAgo = getTimeAgo(post.posted);
    const hashtagsHtml = post.hashtags
      ? post.hashtags.split(' ').map(h =>
          `<span class="hashtag">${h}</span>`
        ).join('')
      : '';

    card.innerHTML = `
      <div class="post-card-inner">
        <div class="post-header">
          <span class="post-username">@${post.username || post.userid}</span>
          <span class="post-time">${timeAgo}</span>
        </div>
        <div class="post-title">${escHtml(post.title || 'untitled')}</div>
        <div class="post-hashtags">${hashtagsHtml}</div>
        <div class="post-waveform" id="waveform-${index}">
          ${generateWaveformSVG()}
        </div>
        <div class="post-controls">
          <button class="post-play-btn" id="play-btn-${index}" onclick="Feed.playPost(${index})">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <div class="post-progress-wrap">
            <div class="post-progress-bar" id="progress-${index}">
              <div class="post-progress-fill" id="progress-fill-${index}"></div>
            </div>
            <span class="post-duration">${post.duration || '—'}</span>
          </div>
        </div>
        <div class="post-actions">
          <button class="post-action-btn" onclick="Feed.likePost(${index}, this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span class="like-count" id="like-count-${index}">—</span>
          </button>
          <button class="post-action-btn" onclick="Feed.openComments(${index})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span id="comment-count-${index}">—</span>
          </button>
        </div>
      </div>
    `;

    // Load like/comment counts async (don't block render)
    loadCounts(post, index);

    return card;
  }

  // ══════════════════════════════════════
  //  PLAY a post
  // ══════════════════════════════════════
  function playPost(index) {
    const post = posts[index];
    if (!post) return;

    // Stop currently playing
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
      updatePlayBtn(currentIndex, false);
      if (index === currentIndex) {
        currentIndex = -1;
        return; // Clicking play on the same post toggles it off
      }
    }

    currentIndex = index;
    const account = JSON.parse(localStorage.getItem('clip_account') || '{}');

    currentAudio = new Audio(post.audioUrl);
    currentAudio.playbackRate = account.settings?.playbackSpeed || 1;

    currentAudio.addEventListener('timeupdate', () => {
      const pct = (currentAudio.currentTime / currentAudio.duration) * 100;
      const fill = document.getElementById(`progress-fill-${index}`);
      if (fill) fill.style.width = pct + '%';
    });

    currentAudio.addEventListener('ended', () => {
      updatePlayBtn(index, false);
      currentIndex = -1;
    });

    currentAudio.play().catch(e => console.warn('Playback error:', e));
    updatePlayBtn(index, true);

    // Update MediaSession for AirPods
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: post.title || 'untitled',
        artist: '@' + (post.username || post.userid)
      });
    }
  }

  function updatePlayBtn(index, playing) {
    const btn = document.getElementById(`play-btn-${index}`);
    if (!btn) return;
    btn.innerHTML = playing
      ? `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
    btn.classList.toggle('playing', playing);
  }

  // ══════════════════════════════════════
  //  LIKE a post
  // ══════════════════════════════════════
  async function likePost(index, btn) {
    const post = posts[index];
    if (!post) return;

    const account = JSON.parse(localStorage.getItem('clip_account') || '{}');
    if (!account.username) {
      alert('sign in to like posts');
      return;
    }

    if (!GitHub.isConfigured()) {
      alert('github not configured — go to settings');
      return;
    }

    btn.disabled = true;
    btn.classList.add('liking');

    try {
      const line = `${account.username}.${new Date().toISOString()}`;
      await GitHub.appendLine(post.likesPath, line, `clip: like ${post.postId}`);

      // Update count display
      const countEl = document.getElementById(`like-count-${index}`);
      if (countEl) {
        const current = parseInt(countEl.textContent) || 0;
        countEl.textContent = current + 1;
      }
      btn.classList.add('liked');
    } catch (e) {
      alert('failed to like: ' + e.message);
    }

    btn.disabled = false;
    btn.classList.remove('liking');
  }

  // ══════════════════════════════════════
  //  COMMENTS
  // ══════════════════════════════════════
  function openComments(index) {
    const post = posts[index];
    if (!post) return;

    const overlay = document.getElementById('comments-overlay');
    const list = document.getElementById('comments-list');
    const input = document.getElementById('comment-input');
    const title = document.getElementById('comments-post-title');

    if (title) title.textContent = post.title || 'untitled';
    if (overlay) overlay.classList.remove('hidden');

    // Load comments
    loadComments(post, list);

    // Wire up submit
    const submitBtn = document.getElementById('comment-submit');
    if (submitBtn) {
      submitBtn.onclick = () => submitComment(post, index, input, list);
    }

    // Close on overlay background click
    if (overlay) {
      overlay.onclick = (e) => {
        if (e.target === overlay) overlay.classList.add('hidden');
      };
    }
  }

  async function loadComments(post, listEl) {
    if (!listEl) return;
    listEl.innerHTML = '<div class="comments-loading">loading…</div>';

    try {
      const result = await GitHub.readFile(post.commentsPath);
      if (!result || !result.content.trim()) {
        listEl.innerHTML = '<div class="comments-empty">no comments yet — be the first</div>';
        return;
      }

      const lines = result.content.trim().split('\n').filter(Boolean);
      listEl.innerHTML = lines.map(line => {
        // Format: username.ISO_DATE.comment text
        const firstDot = line.indexOf('.');
        const secondDot = line.indexOf('.', firstDot + 1);
        // Find the third dot (after the ISO date) — ISO date has dots? No, but
        // the separator is dots, and ISO date contains colons/dashes. We split on
        // the pattern: everything before the 2nd dot is "username.date", rest is comment
        const username = line.slice(0, firstDot);
        const rest = line.slice(firstDot + 1);
        const dateDot = rest.indexOf('.');
        const date = rest.slice(0, dateDot);
        const text = rest.slice(dateDot + 1);
        const timeAgo = getTimeAgo(date);
        return `
          <div class="comment-item">
            <span class="comment-user">@${escHtml(username)}</span>
            <span class="comment-time">${timeAgo}</span>
            <p class="comment-text">${escHtml(text)}</p>
          </div>
        `;
      }).join('');
    } catch (e) {
      listEl.innerHTML = '<div class="comments-empty">no comments yet</div>';
    }
  }

  async function submitComment(post, postIndex, inputEl, listEl) {
    const text = inputEl?.value?.trim();
    if (!text) return;

    const account = JSON.parse(localStorage.getItem('clip_account') || '{}');
    if (!account.username) { alert('sign in to comment'); return; }
    if (!GitHub.isConfigured()) { alert('github not configured'); return; }

    const btn = document.getElementById('comment-submit');
    if (btn) btn.disabled = true;

    try {
      const line = `${account.username}.${new Date().toISOString()}.${text}`;
      await GitHub.appendLine(post.commentsPath, line, `clip: comment on ${post.postId}`);

      inputEl.value = '';

      // Update count
      const countEl = document.getElementById(`comment-count-${postIndex}`);
      if (countEl) {
        const current = parseInt(countEl.textContent) || 0;
        countEl.textContent = current + 1;
      }

      // Reload comments
      loadComments(post, listEl);
    } catch (e) {
      alert('failed to post comment: ' + e.message);
    }

    if (btn) btn.disabled = false;
  }

  // ══════════════════════════════════════
  //  LOAD LIKE + COMMENT COUNTS
  //  (fetches the files, counts lines)
  // ══════════════════════════════════════
  async function loadCounts(post, index) {
    try {
      const [likesData, commentsData] = await Promise.all([
        GitHub.readFile(post.likesPath),
        GitHub.readFile(post.commentsPath)
      ]);

      const likeCount = likesData
        ? likesData.content.trim().split('\n').filter(Boolean).length
        : 0;
      const commentCount = commentsData
        ? commentsData.content.trim().split('\n').filter(Boolean).length
        : 0;

      const likeEl = document.getElementById(`like-count-${index}`);
      const commentEl = document.getElementById(`comment-count-${index}`);
      if (likeEl) likeEl.textContent = likeCount;
      if (commentEl) commentEl.textContent = commentCount;
    } catch (e) {
      // Counts just stay as "—" if this fails — not critical
    }
  }

  // ══════════════════════════════════════
  //  WAVEFORM DECORATION
  //  Just a visual decoration — random
  //  bars that look like an audio waveform
  // ══════════════════════════════════════
  function generateWaveformSVG() {
    const bars = 40;
    const w = 4; const gap = 2;
    const totalW = bars * (w + gap);
    let paths = '';
    for (let i = 0; i < bars; i++) {
      const h = Math.floor(Math.random() * 18) + 4;
      const x = i * (w + gap);
      const y = (24 - h) / 2;
      paths += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>`;
    }
    return `<svg viewBox="0 0 ${totalW} 24" fill="var(--border2)" xmlns="http://www.w3.org/2000/svg" class="waveform-svg">${paths}</svg>`;
  }

  // ── Rendering states ───────────────────
  function renderLoading() {
    const c = document.getElementById('feed-list');
    if (c) c.innerHTML = '<div class="feed-status">loading clips…</div>';
  }
  function renderEmpty() {
    const c = document.getElementById('feed-list');
    if (c) c.innerHTML = '<div class="feed-status">no clips yet — be the first to post</div>';
  }
  function renderError(msg) {
    const c = document.getElementById('feed-list');
    if (c) c.innerHTML = `<div class="feed-status error">couldn't load feed: ${escHtml(msg)}</div>`;
  }
  function renderNotConfigured() {
    const c = document.getElementById('feed-list');
    if (c) c.innerHTML = `<div class="feed-status">connect github in settings to see the feed</div>`;
  }

  // ── Helpers ────────────────────────────
  function getTimeAgo(isoString) {
    if (!isoString) return '';
    const diff = Date.now() - new Date(isoString).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { load, playPost, likePost, openComments };

})();
