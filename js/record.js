// ═══════════════════════════════════════════
//   Clipp — Recording
// ═══════════════════════════════════════════

function openRecord() {
  showScreen('screen-record');
  setRecState('ready');
}

function closeRecord() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  stopTimer();
  stopWaveAnim();
  recordingBlob = null;
  const titleEl = document.getElementById('rec-title');
  if (titleEl) titleEl.value = '';
  setRecState('ready');
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active', 'exit'));
  document.getElementById('screen-app').classList.add('active');
}

function setRecState(state) {
  const label   = document.getElementById('rec-state-label');
  const review  = document.getElementById('rec-review');
  const btn     = document.getElementById('rec-btn');
  const spinner = document.getElementById('posting-spinner');
  const status  = document.getElementById('rec-status');

  review.classList.add('hidden');
  spinner.classList.add('hidden');
  label.className = 'rec-state-label state-' + state;

  if (state === 'ready') {
    label.textContent = '● ready';
    btn.classList.remove('recording-pulse');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>';
    status.textContent = 'press the button or Space to start';
    status.className = 'rec-status-msg status-info';
    stopWaveAnim();
  } else if (state === 'recording') {
    label.textContent = '● recording…';
    btn.classList.add('recording-pulse');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="8" y="8" width="8" height="8" rx="1"/></svg>';
    status.textContent = 'Space or 1 AirPod click to stop';
    status.className = 'rec-status-msg status-error';
    startWaveAnim();
  } else if (state === 'review') {
    label.textContent = '● reviewing';
    btn.classList.remove('recording-pulse');
    review.classList.remove('hidden');
    status.textContent = 'title it, then post or discard';
    status.className = 'rec-status-msg status-info';
    stopWaveAnim();
    document.getElementById('rec-title').focus();
  } else if (state === 'posting') {
    label.textContent = '● uploading…';
    review.classList.add('hidden');
    spinner.classList.remove('hidden');
    status.textContent = 'uploading to Supabase…';
    status.className = 'rec-status-msg status-info';
  }
}

async function toggleRecord() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    await startRecording();
  } else if (mediaRecorder.state === 'recording') {
    stopRecording();
  }
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    waveformData = [];
    recSeconds = 0;

    const ctx      = new AudioContext();
    // Resume AudioContext (required on iOS after user gesture)
    if (ctx.state === 'suspended') await ctx.resume();
    const source   = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    activeAnalyser = analyser;

    // Detect supported audio format (iOS doesn't support webm)
    const mimeType = getRecordingMimeType();
    const recOptions = mimeType ? { mimeType } : {};

    mediaRecorder = new MediaRecorder(stream, recOptions);
    mediaRecorder.addEventListener('dataavailable', e => audioChunks.push(e.data));
    mediaRecorder.addEventListener('stop', () => {
      const blobType = mediaRecorder.mimeType || mimeType || 'audio/webm';
      recordingBlob = new Blob(audioChunks, { type: blobType });
      stream.getTracks().forEach(t => t.stop());
      setRecState('review');
    });
    mediaRecorder.start();
    startTimer();
    setRecState('recording');

    const sampleInterval = setInterval(() => {
      if (!mediaRecorder || mediaRecorder.state !== 'recording') {
        clearInterval(sampleInterval);
        return;
      }
      const buf = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(buf);
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
      waveformData.push(parseFloat((avg / 128).toFixed(3)));
    }, 200);

  } catch (e) {
    document.getElementById('rec-status').textContent = 'microphone access denied';
    document.getElementById('rec-status').className = 'rec-status-msg status-error';
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    stopTimer();
  }
}

function discardClip() {
  recordingBlob = null;
  recSeconds = 0;
  document.getElementById('rec-title').value = '';
  setRecState('ready');
}

async function postClip() {
  if (!recordingBlob || !currentUser) return;
  setRecState('posting');

  const title     = document.getElementById('rec-title').value.trim() || 'untitled';
  const clipId    = 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const blobType  = recordingBlob.type || 'audio/webm';
  const ext       = blobType.includes('mp4') ? 'mp4' : blobType.includes('m4a') ? 'm4a' : 'webm';
  const audioPath = `${currentUser.id}/${clipId}.${ext}`;

  const { error: uploadErr } = await sb.storage
    .from('audio')
    .upload(audioPath, recordingBlob, { contentType: blobType, upsert: true });

  if (uploadErr) {
    document.getElementById('rec-status').textContent = 'upload failed: ' + uploadErr.message;
    document.getElementById('rec-status').className = 'rec-status-msg status-error';
    setRecState('review');
    return;
  }

  const hashtags   = (title.match(/#[a-z0-9_]+/gi) || []).map(t => t.slice(1).toLowerCase());
  const cleanTitle = title.replace(/#[a-z0-9_]+/gi, '').trim() || 'untitled';

  const { error: dbErr } = await sb.from('clips').insert({
    user_id:    currentUser.id,
    username:   currentUser.username,
    title:      cleanTitle,
    hashtags,
    audio_path: audioPath,
    duration:   recSeconds,
    waveform:   waveformData.slice(0, 100),
    likes:      0
  });

  if (dbErr) {
    document.getElementById('rec-status').textContent = 'post failed: ' + dbErr.message;
    document.getElementById('rec-status').className = 'rec-status-msg status-error';
    setRecState('review');
    return;
  }

  recordingBlob = null;
  recSeconds = 0;
  document.getElementById('rec-title').value = '';
  closeRecord();
  loadFeed();
}

// ── Timer ──
function startTimer() {
  recSeconds = 0;
  timerInterval = setInterval(() => {
    recSeconds++;
    document.getElementById('rec-timer').textContent = fmtDuration(recSeconds);
  }, 1000);
}
function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  document.getElementById('rec-timer').textContent = '00:00';
}

// ── Waveform animation ──
function startWaveAnim() { document.getElementById('rec-waveform').classList.add('animating'); }
function stopWaveAnim()  { document.getElementById('rec-waveform').classList.remove('animating'); }
