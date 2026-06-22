// Procedural audio synthesizer — no sound files needed.
// All sounds are generated via the Web Audio API.

let ctx = null;
let muted = false;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function master(vol = 1) {
  const g = getCtx().createGain();
  g.gain.value = muted ? 0 : vol;
  g.connect(getCtx().destination);
  return g;
}

// ─── Primitive builders ───────────────────────────────────────────────────────

function noise(dur, freq = null, q = 1, vol = 0.4) {
  const c = getCtx();
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;

  if (freq) {
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    src.connect(filter);
    filter.connect(master(vol));
  } else {
    src.connect(master(vol));
  }
  return src;
}

function tone(freq, dur, vol = 0.3, type = 'sine') {
  const c = getCtx();
  const osc = c.createOscillator();
  const g   = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  osc.connect(g);
  g.connect(master(1));
  return { osc, g };
}

// ─── Hoofbeat ────────────────────────────────────────────────────────────────

export function playHoofbeat(gallop = false) {
  const c = getCtx();
  const now = c.currentTime;
  const vol = gallop ? 0.55 : 0.35;

  // Low thud
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * 0.12), c.sampleRate);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  const src    = c.createBufferSource();
  src.buffer   = buf;

  const filter = c.createBiquadFilter();
  filter.type  = 'lowpass';
  filter.frequency.value = gallop ? 320 : 200;

  const env = c.createGain();
  env.gain.setValueAtTime(vol, now);
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.10);

  src.connect(filter);
  filter.connect(env);
  env.connect(master(1));
  src.start(now);
  src.stop(now + 0.12);
}

// ─── Eating (crunch) ─────────────────────────────────────────────────────────

export function playEat() {
  const c = getCtx();
  const now = c.currentTime;

  for (let i = 0; i < 3; i++) {
    const t = now + i * 0.11;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * 0.07), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let j = 0; j < d.length; j++) d[j] = Math.random() * 2 - 1;

    const src = c.createBufferSource();
    src.buffer = buf;

    const hi = c.createBiquadFilter();
    hi.type = 'bandpass';
    hi.frequency.value = 1800 + i * 300;
    hi.Q.value = 0.8;

    const lo = c.createBiquadFilter();
    lo.type = 'lowpass';
    lo.frequency.value = 3000;

    const env = c.createGain();
    env.gain.setValueAtTime(0.22, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    src.connect(hi);
    hi.connect(lo);
    lo.connect(env);
    env.connect(master(1));
    src.start(t);
    src.stop(t + 0.07);
  }
}

// ─── Drinking (lap/gulp) ─────────────────────────────────────────────────────

export function playDrink() {
  const c = getCtx();
  const now = c.currentTime;

  for (let i = 0; i < 2; i++) {
    const t = now + i * 0.22;
    const dur = 0.18;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let j = 0; j < d.length; j++) d[j] = Math.random() * 2 - 1;

    const src = c.createBufferSource();
    src.buffer = buf;

    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600;
    filter.Q.value = 1.5;

    const env = c.createGain();
    env.gain.setValueAtTime(0.001, t);
    env.gain.linearRampToValueAtTime(0.28, t + dur * 0.4);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(filter);
    filter.connect(env);
    env.connect(master(1));
    src.start(t);
    src.stop(t + dur);
  }
}

// ─── Brush swipe ─────────────────────────────────────────────────────────────

export function playBrush() {
  const c = getCtx();
  const now = c.currentTime;
  const dur = 0.25;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;

  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 2500;

  const env = c.createGain();
  env.gain.setValueAtTime(0.001, now);
  env.gain.linearRampToValueAtTime(0.18, now + 0.08);
  env.gain.exponentialRampToValueAtTime(0.001, now + dur);

  src.connect(filter);
  filter.connect(env);
  env.connect(master(1));
  src.start(now);
  src.stop(now + dur);
}

// ─── Happiness chime (pet / care action) ─────────────────────────────────────

export function playChime() {
  const c = getCtx();
  const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
  notes.forEach((freq, i) => {
    const t = c.currentTime + i * 0.10;
    const osc = c.createOscillator();
    const g   = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(g);
    g.connect(master(1));
    osc.start(t);
    osc.stop(t + 0.55);
  });
}

// ─── Fill trough (water splash) ──────────────────────────────────────────────

export function playSplash() {
  const c = getCtx();
  const now = c.currentTime;
  const dur = 0.5;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;

  const lo = c.createBiquadFilter();
  lo.type = 'bandpass';
  lo.frequency.value = 800;
  lo.Q.value = 0.5;

  const env = c.createGain();
  env.gain.setValueAtTime(0.35, now);
  env.gain.exponentialRampToValueAtTime(0.001, now + dur);

  src.connect(lo);
  lo.connect(env);
  env.connect(master(1));
  src.start(now);
  src.stop(now + dur);
}

// ─── Bird chirp (ambient) ────────────────────────────────────────────────────

export function playBirdChirp() {
  const c = getCtx();
  const now = c.currentTime;
  const baseFreq = 1800 + Math.random() * 600;
  const numNotes = 2 + Math.floor(Math.random() * 3);

  for (let i = 0; i < numNotes; i++) {
    const t = now + i * 0.09;
    const freq = baseFreq + (Math.random() - 0.5) * 400;
    const osc = c.createOscillator();
    const g   = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.linearRampToValueAtTime(freq * 1.15, t + 0.06);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g);
    g.connect(master(1));
    osc.start(t);
    osc.stop(t + 0.09);
  }
}

// ─── Wind (ambient, looping via scheduled chunks) ────────────────────────────

let windNode = null;
let windGain = null;

export function startWind() {
  if (windNode) return;
  const c = getCtx();
  const dur = 4;

  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  windNode = c.createBufferSource();
  windNode.buffer = buf;
  windNode.loop = true;

  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 300;

  windGain = c.createGain();
  windGain.gain.value = muted ? 0 : 0.03;

  windNode.connect(filter);
  filter.connect(windGain);
  windGain.connect(c.destination);
  windNode.start();
}

export function stopWind() {
  if (!windNode) return;
  windNode.stop();
  windNode.disconnect();
  windNode = null;
  windGain = null;
}

// ─── Background music (procedural chiptune) ──────────────────────────────────

const TEMPO    = 116;          // BPM
const BEAT     = 60 / TEMPO;  // seconds per beat
const LOOKAHEAD = 0.25;        // schedule this far ahead (s)
const TICK      = 80;          // scheduler interval (ms)

// Frequencies (Hz) — C major
const C3=130.81,D3=146.83,E3=164.81,F3=174.61,G3=196.00,A3=220.00,B3=246.94;
const C4=261.63,D4=293.66,E4=329.63,F4=349.23,G4=392.00,A4=440.00,B4=493.88;
const C5=523.25,D5=587.33,E5=659.25,F5=698.46,G5=783.99,A5=880.00,B5=987.77;

// Each entry: [freq (0=rest), duration in beats]
// 8-bar melody — square wave lead
const MELODY = [
  [C5,0.5],[E5,0.5],[G5,0.5],[E5,0.5],[C5,1],[G5,1],        // bar 1 — bouncy opening
  [D5,0.5],[F5,0.5],[A5,0.5],[F5,0.5],[D5,1],[A5,1],        // bar 2
  [E5,0.5],[G5,0.5],[C5,0.5],[E5,0.5],[G5,1],[0,1],         // bar 3 — rest for breath
  [C5,0.5],[D5,0.5],[E5,0.5],[G5,0.5],[A5,2],               // bar 4 — rising run
  [G5,0.5],[E5,0.5],[C5,0.5],[D5,0.5],[E5,1],[C5,1],        // bar 5
  [F5,0.5],[A5,0.5],[G5,0.5],[F5,0.5],[E5,0.5],[D5,0.5],[C5,1], // bar 6 — descending run
  [G5,1],[A5,0.5],[G5,0.5],[E5,0.5],[D5,0.5],[C5,1],        // bar 7
  [E5,0.5],[G5,0.5],[A5,0.5],[G5,0.5],[C5,2],               // bar 8 — resolve
];

// Bass line — triangle wave (2-beat notes)
const BASS = [
  [C3,2],[G3,2],  // bar 1
  [D3,2],[A3,2],  // bar 2
  [C3,2],[G3,2],  // bar 3
  [F3,2],[C3,2],  // bar 4
  [C3,2],[G3,2],  // bar 5
  [F3,2],[C3,2],  // bar 6
  [G3,2],[A3,2],  // bar 7
  [C3,4],         // bar 8
];

// Chord stabs on beats — sine wave bell
const CHORDS = [
  [[C4,E4,G4], 0.5],   // beat 1
  [[G3,B3,D4], 0.5],   // beat 5
  [[D4,F4,A4], 0.5],   // beat 9
  [[F3,A3,C4], 0.5],   // beat 13
  [[C4,E4,G4], 0.5],   // beat 17
  [[F3,A3,C4], 0.5],   // beat 21
  [[G3,B3,D4], 0.5],   // beat 25
  [[C4,E4,G4], 0.5],   // beat 29
];

const PATTERN_BEATS = 32; // 8 bars × 4 beats

let musicGain      = null;
let musicTimer     = null;
let nextMelodyTime = 0;
let nextBassTime   = 0;
let nextChordTime  = 0;
let melodyIdx      = 0;
let bassIdx        = 0;
let chordIdx       = 0;

function scheduleMelodyNote(time, freq, dur) {
  if (!freq) return;
  const c = getCtx();
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  const noteDur = dur * BEAT * 0.85; // slight staccato
  env.gain.setValueAtTime(0.001, time);
  env.gain.linearRampToValueAtTime(0.10, time + 0.015);
  env.gain.setValueAtTime(0.09, time + noteDur * 0.6);
  env.gain.exponentialRampToValueAtTime(0.001, time + noteDur);
  osc.connect(env);
  env.connect(musicGain);
  osc.start(time);
  osc.stop(time + noteDur + 0.02);
}

function scheduleBassNote(time, freq, dur) {
  if (!freq) return;
  const c = getCtx();
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  const noteDur = dur * BEAT * 0.75;
  env.gain.setValueAtTime(0.001, time);
  env.gain.linearRampToValueAtTime(0.13, time + 0.02);
  env.gain.exponentialRampToValueAtTime(0.001, time + noteDur);
  osc.connect(env);
  env.connect(musicGain);
  osc.start(time);
  osc.stop(time + noteDur + 0.02);
}

function scheduleChord(time, freqs) {
  freqs.forEach(freq => {
    const c = getCtx();
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.001, time);
    env.gain.linearRampToValueAtTime(0.04, time + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.55);
    osc.connect(env);
    env.connect(musicGain);
    osc.start(time);
    osc.stop(time + 0.6);
  });
}

function schedulerTick() {
  const c = getCtx();
  if (c.state === 'suspended') return;

  const now   = c.currentTime;
  const ahead = now + LOOKAHEAD;

  // If the scheduler fell behind (e.g. context was suspended on iOS while
  // currentTime kept advancing), jump cursors to now so we don't try to
  // schedule hundreds of back-notes in one burst — that freezes the browser.
  if (nextMelodyTime < now) nextMelodyTime = now;
  if (nextBassTime   < now) nextBassTime   = now;
  if (nextChordTime  < now) nextChordTime  = now;

  // Melody voice
  while (nextMelodyTime < ahead) {
    const [freq, dur] = MELODY[melodyIdx];
    scheduleMelodyNote(nextMelodyTime, freq, dur);
    nextMelodyTime += dur * BEAT;
    melodyIdx = (melodyIdx + 1) % MELODY.length;
  }

  // Bass voice (independent cursor)
  while (nextBassTime < ahead) {
    const [freq, dur] = BASS[bassIdx];
    scheduleBassNote(nextBassTime, freq, dur);
    nextBassTime += dur * BEAT;
    bassIdx = (bassIdx + 1) % BASS.length;
  }

  // Chord stabs every 4 beats
  while (nextChordTime < ahead) {
    const [freqs] = CHORDS[chordIdx];
    scheduleChord(nextChordTime, freqs);
    nextChordTime += 4 * BEAT;
    chordIdx = (chordIdx + 1) % CHORDS.length;
  }
}

export function startMusic() {
  if (musicTimer) return;
  const c = getCtx();
  musicGain = c.createGain();
  musicGain.gain.value = muted ? 0 : 0.07;
  musicGain.connect(c.destination);

  const start = c.currentTime + 0.1;
  nextMelodyTime = start;
  nextBassTime   = start;
  nextChordTime  = start;
  melodyIdx = 0;
  bassIdx   = 0;
  chordIdx  = 0;

  musicTimer = setInterval(schedulerTick, TICK);
  schedulerTick();
}

export function stopMusic() {
  if (!musicTimer) return;
  clearInterval(musicTimer);
  musicTimer = null;
  if (musicGain) {
    musicGain.disconnect();
    musicGain = null;
  }
}

// ─── Mute toggle ─────────────────────────────────────────────────────────────

export function toggleMute() {
  muted = !muted;
  if (windGain)  windGain.gain.value  = muted ? 0 : 0.07;
  if (musicGain) musicGain.gain.value = muted ? 0 : 0.07;
  return muted;
}

export function isMuted() { return muted; }
