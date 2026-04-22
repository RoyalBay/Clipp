// ═══════════════════════════════════════════
//   Clipp — Audio Playback
// ═══════════════════════════════════════════

const audioCache = {};

async function playAudio(clipId, audioPath, btn) {
  // Stop other playing audio
  if (activeAudio && activeAudio._clipId !== clipId) {
    activeAudio.pause();
    document.querySelectorAll('.feed-card__play, .my-post-play').forEach(b => {
      b.classList.remove('playing');
      // Reset icon based on button type
      if (b.classList.contains('feed-card__play')) {
        b.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="8,4 20,12 8,20"/></svg>';
      } else {
        b.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor"><polygon points="5,3 13,8 5,13"/></svg>';
      }
    });
    document.querySelectorAll('.feed-card__progress-fill').forEach(p => p.style.width = '0%');
    document.querySelectorAll('.feed-card').forEach(c => c.classList.remove('playing'));
  }

  if (!audioCache[clipId]) {
    const { data } = sb.storage.from('audio').getPublicUrl(audioPath);
    const audio = new Audio(data.publicUrl);
    audio._clipId = clipId;
    audio.playbackRate = playbackSpeed;

    audio.addEventListener('timeupdate', () => {
      const pct = (audio.currentTime / audio.duration) * 100 || 0;
      const prog = document.getElementById('prog-' + clipId);
      if (prog) prog.style.width = pct + '%';
      const dur = document.getElementById('dur-' + clipId);
      if (dur) dur.textContent = fmtDuration(audio.currentTime) + ' / ' + fmtDuration(audio.duration);
    });

    audio.addEventListener('ended', () => {
      btn.classList.remove('playing');
      const card = btn.closest('.feed-card');
      if (card) card.classList.remove('playing');
      if (btn.classList.contains('feed-card__play')) {
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="8,4 20,12 8,20"/></svg>';
      } else {
        btn.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor"><polygon points="5,3 13,8 5,13"/></svg>';
      }
    });

    audioCache[clipId] = audio;
  }

  const audio = audioCache[clipId];
  activeAudio = audio;

  if (audio.paused) {
    audio.play();
    btn.classList.add('playing');
    if (btn.classList.contains('feed-card__play')) {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
    } else {
      btn.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="3" width="3" height="10" rx="1"/><rect x="9" y="3" width="3" height="10" rx="1"/></svg>';
    }
  } else {
    audio.pause();
    btn.classList.remove('playing');
    if (btn.classList.contains('feed-card__play')) {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="8,4 20,12 8,20"/></svg>';
    } else {
      btn.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor"><polygon points="5,3 13,8 5,13"/></svg>';
    }
  }
}

function seekAudio(e, clipId) {
  const audio = audioCache[clipId];
  if (!audio) return;
  const bar = e.currentTarget;
  const pct = e.offsetX / bar.offsetWidth;
  audio.currentTime = pct * audio.duration;
}

function setSpeed(btn) {
  document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  playbackSpeed = parseFloat(btn.dataset.speed);
  Object.values(audioCache).forEach(a => a.playbackRate = playbackSpeed);
}
