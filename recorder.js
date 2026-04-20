// ══════════════════════════════════════════
//  recorder.js — Recording, review, and posting
//
//  STATE MACHINE:
//  idle → recording → reviewing → posting → idle
//
//  CONTROLS (AirPods + keyboard fallback):
//  ┌─────────────────┬────────────────────┐
//  │ AirPods         │ Keyboard           │
//  ├─────────────────┼────────────────────┤
//  │ 1 click         │ Space / Enter      │ stop recording
//  │ 3 rapid clicks  │ P                  │ confirm & post
//  │ Long press      │ hold Space (500ms) │ pause / resume
//  └─────────────────┴────────────────────┘
//
//  RECORDING FORMAT:
//  Uses webm/opus (best browser support).
//  On post, uploads as .webm — the .mp3
//  naming is kept in metadata, extension
//  is webm in reality. Future step can
//  add server-side transcoding.
// ══════════════════════════════════════════

const Recorder = (() => {

  // ── State ──────────────────────────────
  let state = 'idle';       // idle | recording | reviewing | posting
  let mediaRecorder = null;
  let audioChunks = [];
  let audioBlob = null;
  let audioPlayer = null;   // HTMLAudioElement for review playback
  let recordingStream = null;
  let recordStartTime = null;
  let recordDuration = 0;
  let timerInterval = null;

  // Click tracking for multi-click detection
  let clickCount = 0;
  let clickTimer = null;
  const CLICK_WINDOW_MS = 400; // time to collect rapid clicks
  let spaceHoldTimer = null;
  const LONG_PRESS_MS = 500;

  // ── UI element refs (set on init) ──────
  let ui = {};

  // ══════════════════════════════════════
  //  INIT — call once when main app loads
  // ══════════════════════════════════════
  function init() {
    ui = {
      screen:       document.getElementById('screen-record'),
      stateLabel:   document.getElementById('rec-state-label'),
      timer:        document.getElementById('rec-timer'),
      waveform:     document.getElementById('rec-waveform'),
      postTitle:    document.getElementById('rec-post-title'),
      postHashtags: document.getElementById('rec-post-hashtags'),
      postActions:  document.getElementById('rec-post-actions'),
      recordBtn:    document.getElementById('rec-btn-record'),
      stopBtn:      document.getElementById('rec-btn-stop'),
      postBtn:      document.getElementById('rec-btn-post'),
      discardBtn:   document.getElementById('rec-btn-discard'),
      statusMsg:    document.getElementById('rec-status-msg'),
      kbHint:       document.getElementById('rec-kb-hint'),
    };

    setupKeyboardFallback();
    setupMediaSession();
  }

  // ══════════════════════════════════════
  //  START RECORDING
  // ══════════════════════════════════════
  async function startRecording() {
    if (state !== 'idle') return;

    try {
      recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      showStatus('microphone access denied — check browser permissions', 'error');
      return;
    }

    audioChunks = [];
    audioBlob = null;

    // webm/opus has the best browser support for MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    mediaRecorder = new MediaRecorder(recordingStream, { mimeType });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      audioBlob = new Blob(audioChunks, { type: mimeType });
      onRecordingComplete();
    };

    mediaRecorder.start(100); // Collect data every 100ms
    state = 'recording';
    recordStartTime = Date.now();

    setStateUI('recording');
    startTimer();
  }

  // ══════════════════════════════════════
  //  STOP RECORDING
  // ══════════════════════════════════════
  function stopRecording() {
    if (state !== 'recording') return;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    if (recordingStream) {
      recordingStream.getTracks().forEach(t => t.stop());
    }
    stopTimer();
    state = 'reviewing';
  }

  // ══════════════════════════════════════
  //  AFTER RECORDING — auto-play for review
  // ══════════════════════════════════════
  function onRecordingComplete() {
    const objectUrl = URL.createObjectURL(audioBlob);
    audioPlayer = new Audio(objectUrl);

    // Get account settings for playback speed
    const account = JSON.parse(localStorage.getItem('clip_account') || '{}');
    audioPlayer.playbackRate = account.settings?.playbackSpeed || 1;

    audioPlayer.play();
    setStateUI('reviewing');
    showStatus('reviewing — press P or click "post" to publish, or discard', 'info');

    // Update MediaSession so headphone controls work during review
    updateMediaSession('CLIP — reviewing your clip', 'Tap to post or discard');
  }

  // ══════════════════════════════════════
  //  POST — write files to GitHub
  // ══════════════════════════════════════
  async function post() {
    if (state !== 'reviewing') return;
    if (!audioBlob) return;

    const title = ui.postTitle?.value?.trim() || 'untitled clip';
    const hashtags = ui.postHashtags?.value?.trim() || '';

    if (!GitHub.isConfigured()) {
      showStatus('github not set up — go to settings first', 'error');
      return;
    }

    state = 'posting';
    setStateUI('posting');
    showStatus('uploading to github…', 'info');

    const account = JSON.parse(localStorage.getItem('clip_account') || '{}');
    const { userId, username } = account;

    // Get next post index
    const postIndex = await getNextPostIndex(userId);
    const baseName = `${userId}.${postIndex}`;
    const audioPath = `content/${baseName}.webm`;
    const metaPath  = `content/${baseName}.txt`;

    // Format duration
    const dur = Math.round(recordDuration / 1000);
    const durStr = [
      String(Math.floor(dur / 3600)).padStart(2, '0'),
      String(Math.floor((dur % 3600) / 60)).padStart(2, '0'),
      String(dur % 60).padStart(2, '0')
    ].join(':');

    // Metadata .txt content
    const metadata = [
      `title: ${title}`,
      `hashtags: ${hashtags}`,
      `duration: 00:${durStr.slice(3)}`,
      `posted: ${new Date().toISOString()}`,
      `userid: ${userId}`,
      `username: ${username}`,
      `postindex: ${postIndex}`
    ].join('\n') + '\n';

    try {
      // Upload audio first
      showStatus('uploading audio…', 'info');
      await GitHub.uploadAudio(audioPath, audioBlob, `clip: post ${baseName} audio`);

      // Upload metadata
      showStatus('saving metadata…', 'info');
      await GitHub.writeFile(metaPath, metadata, `clip: post ${baseName} metadata`);

      // Update local post list
      saveLocalPost({ userId, username, postIndex, title, hashtags, duration: durStr, posted: new Date().toISOString() });

      showStatus('posted! ✓', 'success');
      state = 'idle';
      setStateUI('idle');

      // Return to feed after a moment
      setTimeout(() => {
        goTo('screen-main');
        Feed.load(); // Refresh the feed
        MyPosts.load(); // Refresh my clips
      }, 1200);

    } catch (e) {
      showStatus(`upload failed: ${e.message}`, 'error');
      state = 'reviewing'; // Let them try again
      setStateUI('reviewing');
    }
  }

  // ══════════════════════════════════════
  //  DISCARD — throw away the recording
  // ══════════════════════════════════════
  function discard() {
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer = null;
    }
    audioBlob = null;
    audioChunks = [];
    state = 'idle';
    setStateUI('idle');
    showStatus('discarded', 'info');
    setTimeout(() => goTo('screen-main'), 600);
  }

  // ══════════════════════════════════════
  //  PAUSE / RESUME during review
  // ══════════════════════════════════════
  function togglePlayback() {
    if (state !== 'reviewing' || !audioPlayer) return;
    if (audioPlayer.paused) {
      audioPlayer.play();
      showStatus('playing…', 'info');
    } else {
      audioPlayer.pause();
      showStatus('paused', 'info');
    }
  }

  // ══════════════════════════════════════
  //  GET NEXT POST INDEX
  //  Reads the local post list to find the
  //  highest index, then adds 1.
  // ══════════════════════════════════════
  async function getNextPostIndex(userId) {
    const posts = JSON.parse(localStorage.getItem('clip_posts') || '[]');
    const mine = posts.filter(p => p.userId === userId);
    if (mine.length === 0) return 1;
    return Math.max(...mine.map(p => p.postIndex)) + 1;
  }

  // ══════════════════════════════════════
  //  SAVE POST TO LOCAL LIST
  // ══════════════════════════════════════
  function saveLocalPost(post) {
    const posts = JSON.parse(localStorage.getItem('clip_posts') || '[]');
    posts.unshift(post); // newest first
    localStorage.setItem('clip_posts', JSON.stringify(posts));
  }

  // ══════════════════════════════════════
  //  TIMER
  // ══════════════════════════════════════
  function startTimer() {
    recordDuration = 0;
    timerInterval = setInterval(() => {
      recordDuration = Date.now() - recordStartTime;
      if (ui.timer) ui.timer.textContent = formatDuration(recordDuration);
    }, 100);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    recordDuration = Date.now() - recordStartTime;
  }

  function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  // ══════════════════════════════════════
  //  UI STATE MACHINE
  //  Updates all visible elements to match
  //  the current state.
  // ══════════════════════════════════════
  function setStateUI(s) {
    if (!ui.stateLabel) return;

    const labels = {
      idle:      '● ready',
      recording: '⏺ recording',
      reviewing: '▶ reviewing',
      posting:   '↑ posting…'
    };
    ui.stateLabel.textContent = labels[s] || s;
    ui.stateLabel.className = 'rec-state-label state-' + s;

    // Show/hide panels based on state
    const panels = {
      'rec-panel-idle':      s === 'idle',
      'rec-panel-recording': s === 'recording',
      'rec-panel-reviewing': s === 'reviewing',
      'rec-panel-posting':   s === 'posting',
    };
    Object.entries(panels).forEach(([id, show]) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', !show);
    });

    // Animate the waveform bars
    if (ui.waveform) {
      ui.waveform.classList.toggle('animating', s === 'recording');
    }
  }

  // ══════════════════════════════════════
  //  KEYBOARD FALLBACK
  //  Mirrors AirPods controls for PC testing
  // ══════════════════════════════════════
  function setupKeyboardFallback() {
    document.addEventListener('keydown', (e) => {
      // Only active when record screen is showing
      if (currentScreen !== 'screen-record') return;

      // Don't intercept when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (state === 'idle') {
          startRecording();
          return;
        }
        if (state === 'recording') {
          // Start long-press timer
          if (!spaceHoldTimer) {
            spaceHoldTimer = setTimeout(() => {
              // Long press = pause (during review), or stop (during recording)
              if (state === 'reviewing') togglePlayback();
              spaceHoldTimer = null;
            }, LONG_PRESS_MS);
          }
          return;
        }
        if (state === 'reviewing') {
          togglePlayback();
        }
      }

      if (e.code === 'KeyP' && state === 'reviewing') {
        e.preventDefault();
        post();
      }

      if (e.code === 'KeyD' && state === 'reviewing') {
        e.preventDefault();
        discard();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (spaceHoldTimer) {
          // Released before long-press threshold = single click = stop
          clearTimeout(spaceHoldTimer);
          spaceHoldTimer = null;
          if (state === 'recording') stopRecording();
        }
      }
    });
  }

  // ══════════════════════════════════════
  //  MEDIA SESSION
  //  This is what makes AirPods buttons work.
  //  The browser exposes headphone button
  //  events through the MediaSession API.
  //  We register handlers for:
  //  - previoustrack = single click (custom mapping)
  //  - nexttrack     = single click
  //  - pause/play    = long press on AirPods
  // ══════════════════════════════════════
  function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;

    // "Play" button / single AirPods click during recording = stop
    navigator.mediaSession.setActionHandler('pause', () => {
      if (state === 'recording') stopRecording();
      else if (state === 'reviewing') togglePlayback();
    });

    navigator.mediaSession.setActionHandler('play', () => {
      if (state === 'idle') startRecording();
      else if (state === 'reviewing') togglePlayback();
    });

    // Double-click on AirPods = next track = post confirm
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      handleClick();
    });

    // Triple-click mapped to previoustrack in some implementations
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      handleClick();
    });
  }

  function updateMediaSession(title, artist) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist });
  }

  // Multi-click handler — counts rapid clicks
  function handleClick() {
    clickCount++;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      const count = clickCount;
      clickCount = 0;
      if (count === 1 && state === 'recording') stopRecording();
      if (count === 1 && state === 'reviewing') togglePlayback();
      if (count >= 3 && state === 'reviewing') post();
    }, CLICK_WINDOW_MS);
  }

  function showStatus(msg, type = 'info') {
    if (!ui.statusMsg) return;
    ui.statusMsg.textContent = msg;
    ui.statusMsg.className = 'rec-status-msg status-' + type;
  }

  // Public API
  return { init, startRecording, stopRecording, post, discard, togglePlayback };

})();
