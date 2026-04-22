// ═══════════════════════════════════════════
//   Clipp — Global State
// ═══════════════════════════════════════════

let currentUser    = null;
let playbackSpeed  = 1;
let activeAudio    = null;
let mediaRecorder  = null;
let audioChunks    = [];
let recordingBlob  = null;
let timerInterval  = null;
let recSeconds     = 0;
let waveformData   = [];
let activeAnalyser = null;
let animFrame      = null;
let currentCommentClipId = null;

// Moderation: is the current user the official @clipp account?
function isMod() {
  return currentUser && currentUser.id === MOD_USER_ID;
}
