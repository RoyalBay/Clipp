// ══════════════════════════════════════════
//  myposts.js — "My Clipps" tab
//
//  Shows the logged-in user's own posts.
//  Data comes from localStorage (written
//  at post time) so it's instant, no API call.
//  Each row shows: title, duration, post #, date.
// ══════════════════════════════════════════

const MyPosts = (() => {

  function load() {
    const container = document.getElementById('my-posts-list');
    if (!container) return;

    const account = JSON.parse(localStorage.getItem('Clipp_account') || '{}');
    const allPosts = JSON.parse(localStorage.getItem('Clipp_posts') || '[]');
    const mine = allPosts.filter(p => p.userId === account.userId);

    container.innerHTML = '';

    if (mine.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🎙</span>
          <p>no Clipps yet<br/>press <strong>record</strong> to make your first one</p>
        </div>`;
      return;
    }

    mine.forEach(post => {
      const row = document.createElement('div');
      row.className = 'my-post-row';

      const date = new Date(post.posted);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      row.innerHTML = `
        <div class="my-post-index">#${post.postIndex}</div>
        <div class="my-post-info">
          <div class="my-post-title">${escHtml(post.title || 'untitled')}</div>
          <div class="my-post-meta">
            <span>${post.duration || '—'}</span>
            <span>·</span>
            <span>${dateStr}</span>
            ${post.hashtags ? `<span>·</span><span class="my-post-tags">${escHtml(post.hashtags)}</span>` : ''}
          </div>
        </div>
        <button class="my-post-play" onclick="MyPosts.playPost('${post.userId}', ${post.postIndex})">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
      `;
      container.appendChild(row);
    });
  }

  function playPost(userId, postIndex) {
    if (!GitHub.isConfigured()) {
      alert('github not configured — go to settings');
      return;
    }
    const url = GitHub.rawUrl(`content/${userId}.${postIndex}.webm`);
    const audio = new Audio(url);
    const account = JSON.parse(localStorage.getItem('Clipp_account') || '{}');
    audio.playbackRate = account.settings?.playbackSpeed || 1;
    audio.play().catch(e => alert('playback failed: ' + e.message));
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { load, playPost };

})();
