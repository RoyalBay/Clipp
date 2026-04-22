// ═══════════════════════════════════════════
//   Clipp — Feed (TikTok-style snap-scroll)
// ═══════════════════════════════════════════

async function loadFeed() {
  const list = document.getElementById('feed-list');
  list.innerHTML = '<div class="feed-status">loading Clipps…</div>';

  const { data, error } = await sb
    .from('clips')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    list.innerHTML = '<div class="feed-status error">error loading feed</div>';
    return;
  }
  if (!data.length) {
    list.innerHTML = '<div class="feed-status">no Clipps yet. be the first!</div>';
    return;
  }

  list.innerHTML = data.map((clip, i) => renderFeedCard(clip, i === 0)).join('');

  // Set up IntersectionObserver for auto-play
  setupAutoPlay();
}

function renderFeedCard(clip, isFirst) {
  const waveformSvg = renderWaveform(clip.waveform || [], 280, 80);
  const liked = isLiked(clip.id);
  const modActions = isMod() ? `
    <div class="mod-actions" style="display:flex">
      <button class="mod-delete-btn" onclick="modDeleteClip('${clip.id}')" title="Delete clip">🗑 delete</button>
      <button class="mod-ban-btn" onclick="modBanUser('${clip.user_id}','${esc(clip.username)}')" title="Ban user">⛔ ban</button>
    </div>` : '';

  return `
    <article class="feed-card" data-clip-id="${clip.id}" data-audio-path="${clip.audio_path}">
      <div class="feed-card__center">
        <div class="feed-card__waveform">${waveformSvg}</div>
        <button class="feed-card__play" id="play-${clip.id}" onclick="playFeedAudio('${clip.id}','${clip.audio_path}',this)">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="8,4 20,12 8,20"/></svg>
        </button>
        <div class="feed-card__progress">
          <div class="feed-card__progress-bar" onclick="seekAudio(event, '${clip.id}')">
            <div class="feed-card__progress-fill" id="prog-${clip.id}"></div>
          </div>
          <span class="feed-card__time" id="dur-${clip.id}">${fmtDuration(clip.duration)}</span>
        </div>
      </div>

      <div class="feed-card__info">
        <div class="feed-card__username">@${esc(clip.username)}</div>
        <div class="feed-card__title">${esc(clip.title || 'untitled')}</div>
        ${clip.hashtags?.length ? `<div class="feed-card__hashtags">${clip.hashtags.map(t => `<span class="feed-card__tag">#${esc(t)}</span>`).join('')}</div>` : ''}
        <div class="feed-card__time-ago">${timeAgo(clip.created_at)}</div>
        ${modActions}
      </div>

      <div class="feed-card__actions">
        <button class="feed-action ${liked ? 'liked' : ''}" id="like-${clip.id}" onclick="toggleLike('${clip.id}',${clip.likes})">
          <svg viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M12 21s-8-5.5-8-11.5a5 5 0 0 1 9.5-2.3A5 5 0 0 1 20 9.5C20 15.5 12 21 12 21z"/>
          </svg>
          <span id="likes-${clip.id}">${clip.likes}</span>
        </button>
        <button class="feed-action" onclick="openComments('${clip.id}','${esc(clip.title || 'untitled')}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
          <span>💬</span>
        </button>
        <button class="feed-action" onclick="shareClip('${clip.id}','${esc(clip.title || 'untitled')}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>
          </svg>
          <span>share</span>
        </button>
      </div>

      ${isFirst ? `
      <div class="feed-card__scroll-hint">
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 2v10M3 8l4 4 4-4"/></svg>
        swipe
      </div>` : ''}
    </article>`;
}

// ── Auto-play via IntersectionObserver ──
function setupAutoPlay() {
  const cards = document.querySelectorAll('.feed-card');
  if (!cards.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
        const card = entry.target;
        const clipId = card.dataset.clipId;
        const audioPath = card.dataset.audioPath;
        const btn = card.querySelector('.feed-card__play');

        // Auto-play if not already playing
        if (!activeAudio || activeAudio._clipId !== clipId) {
          playFeedAudio(clipId, audioPath, btn);
        }
      }
    });
  }, { threshold: 0.6 });

  cards.forEach(card => observer.observe(card));
}

// ── Play audio in feed card ──
function playFeedAudio(clipId, audioPath, btn) {
  // Stop any playing audio
  if (activeAudio && activeAudio._clipId !== clipId) {
    activeAudio.pause();
    // Reset all play buttons and card states
    document.querySelectorAll('.feed-card').forEach(c => c.classList.remove('playing'));
    document.querySelectorAll('.feed-card__play').forEach(b => {
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="8,4 20,12 8,20"/></svg>';
    });
    document.querySelectorAll('.feed-card__progress-fill').forEach(p => p.style.width = '0%');
  }

  playAudio(clipId, audioPath, btn);

  // Toggle card playing state
  const card = btn.closest('.feed-card');
  if (audioCache[clipId] && !audioCache[clipId].paused) {
    card.classList.add('playing');
  } else {
    card.classList.remove('playing');
  }
}

// ── Share clip ──
function shareClip(clipId, title) {
  if (navigator.share) {
    navigator.share({
      title: 'Clipp — ' + title,
      text: 'Listen to this clip on Clipp!',
      url: window.location.href
    }).catch(() => {});
  } else {
    // Fallback: copy URL
    navigator.clipboard.writeText(window.location.href).then(() => {
      // Brief visual feedback
      const btn = document.querySelector(`[data-clip-id="${clipId}"] .feed-action:last-child span`);
      if (btn) { btn.textContent = 'copied!'; setTimeout(() => btn.textContent = 'share', 1500); }
    });
  }
}

// ── Load My Clipps ──
async function loadMine() {
  if (!currentUser) return;
  const list = document.getElementById('mine-list');
  list.innerHTML = '<div class="feed-status">loading…</div>';

  const { data, error } = await sb
    .from('clips')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error || !data) { list.innerHTML = '<div class="feed-status error">error loading</div>'; return; }
  if (!data.length)   { list.innerHTML = '<div class="feed-status">no Clipps yet. record one!</div>'; return; }

  list.innerHTML = data.map((clip, i) => `
    <div class="my-post-row">
      <div class="my-post-index">${String(i + 1).padStart(2, '0')}</div>
      <div class="my-post-info">
        <div class="my-post-title">${esc(clip.title || 'untitled')}</div>
        <div class="my-post-meta">
          <span>${fmtDuration(clip.duration)}</span>
          <span>·</span>
          <span>${timeAgo(clip.created_at)}</span>
        </div>
      </div>
      <button class="my-post-play" onclick="playAudio('${clip.id}','${clip.audio_path}',this)">
        <svg viewBox="0 0 16 16" fill="currentColor"><polygon points="5,3 13,8 5,13"/></svg>
      </button>
    </div>`).join('');
}

// ── Waveform SVG rendering ──
function renderWaveform(data, w, h) {
  w = w || 300;
  h = h || 24;
  if (!data?.length) {
    data = Array.from({ length: 40 }, () => Math.random() * 0.8 + 0.1);
  }
  const mid  = h / 2;
  const step = w / data.length;
  const bars = data.map((v, i) => {
    const bh = Math.max(2, v * h);
    const x  = i * step + step / 2;
    const y  = mid - bh / 2;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(1, step * 0.6).toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="var(--accent)" opacity="${(0.3 + v * 0.7).toFixed(2)}"/>`;
  }).join('');
  return `<svg class="waveform-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${bars}</svg>`;
}
