// ═══════════════════════════════════════════
//   Clipp — Comments + Moderation
// ═══════════════════════════════════════════

async function openComments(clipId, title) {
  currentCommentClipId = clipId;
  document.getElementById('comments-clip-title').textContent = title;
  document.getElementById('comments-overlay').classList.remove('hidden');
  const list = document.getElementById('comments-list');
  list.innerHTML = '<div class="comments-loading">loading…</div>';

  const { data } = await sb.from('comments').select('*').eq('clip_id', clipId).order('created_at');
  if (!data?.length) {
    list.innerHTML = '<div class="comments-empty">no comments yet</div>';
    return;
  }

  list.innerHTML = data.map(c => {
    const modBtn = isMod() ? `<button class="mod-delete-btn" onclick="modDeleteComment('${c.id}','${clipId}')" style="margin-left:auto">delete</button>` : '';
    return `
    <div class="comment-item">
      <div class="comment-header">
        <span class="comment-user">@${esc(c.username)}</span>
        <span class="comment-time">${timeAgo(c.created_at)}</span>
        ${modBtn}
      </div>
      <div class="comment-text">${esc(c.body)}</div>
    </div>`;
  }).join('');
}

function closeComments() {
  document.getElementById('comments-overlay').classList.add('hidden');
  currentCommentClipId = null;
}

async function postComment() {
  if (!currentUser || !currentCommentClipId) return;
  const input = document.getElementById('comment-input');
  const body  = input.value.trim();
  if (!body) return;

  input.value = '';
  const { error } = await sb.from('comments').insert({
    clip_id:  currentCommentClipId,
    user_id:  currentUser.id,
    username: currentUser.username,
    body
  });
  if (!error) openComments(currentCommentClipId, document.getElementById('comments-clip-title').textContent);
}

// ── Likes ──
function isLiked(clipId) {
  const liked = JSON.parse(localStorage.getItem('clipp_liked') || '[]');
  return liked.includes(clipId);
}

function setLiked(clipId, val) {
  let liked = JSON.parse(localStorage.getItem('clipp_liked') || '[]');
  if (val) liked = [...new Set([...liked, clipId])];
  else     liked = liked.filter(id => id !== clipId);
  localStorage.setItem('clipp_liked', JSON.stringify(liked));
}

async function toggleLike(clipId, currentCount) {
  if (!currentUser) return;
  const btn   = document.getElementById('like-' + clipId);
  const count = document.getElementById('likes-' + clipId);
  const liked = isLiked(clipId);

  if (liked) {
    await sb.from('likes').delete().eq('clip_id', clipId).eq('user_id', currentUser.id);
    await sb.from('clips').update({ likes: Math.max(0, currentCount - 1) }).eq('id', clipId);
    setLiked(clipId, false);
    btn.classList.remove('liked');
    count.textContent = Math.max(0, currentCount - 1);
    btn.querySelector('svg').setAttribute('fill', 'none');
  } else {
    await sb.from('likes').upsert({ clip_id: clipId, user_id: currentUser.id });
    await sb.from('clips').update({ likes: currentCount + 1 }).eq('id', clipId);
    setLiked(clipId, true);
    btn.classList.add('liked');
    count.textContent = currentCount + 1;
    btn.querySelector('svg').setAttribute('fill', 'currentColor');
  }
}

// ═══ MODERATION ═══

async function modDeleteClip(clipId) {
  if (!isMod()) return;
  if (!confirm('Delete this clip?')) return;

  // Delete related data
  await sb.from('comments').delete().eq('clip_id', clipId);
  await sb.from('likes').delete().eq('clip_id', clipId);
  await sb.from('clips').delete().eq('id', clipId);

  // Refresh feed
  loadFeed();
}

async function modDeleteComment(commentId, clipId) {
  if (!isMod()) return;
  if (!confirm('Delete this comment?')) return;

  await sb.from('comments').delete().eq('id', commentId);
  openComments(clipId, document.getElementById('comments-clip-title').textContent);
}

async function modBanUser(userId, username) {
  if (!isMod()) return;
  if (!confirm(`Ban @${username}? This will delete their account and all their clips.`)) return;

  // Delete all their clips' comments and likes
  const { data: clips } = await sb.from('clips').select('id').eq('user_id', userId);
  if (clips) {
    for (const clip of clips) {
      await sb.from('comments').delete().eq('clip_id', clip.id);
      await sb.from('likes').delete().eq('clip_id', clip.id);
    }
  }

  // Delete all their clips
  await sb.from('clips').delete().eq('user_id', userId);

  // Delete their comments on other clips
  await sb.from('comments').delete().eq('user_id', userId);

  // Delete their likes
  await sb.from('likes').delete().eq('user_id', userId);

  // Delete the user
  await sb.from('users').delete().eq('id', userId);

  alert(`@${username} has been banned.`);
  loadFeed();
}
