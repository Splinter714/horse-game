// Procedural audio synthesizer — no sound files needed.
// All sounds are generated via the Web Audio API.

let ctx = null;
let muted = false;

// ─── Mixer buses ───────────────────────────────────────────────────────────────
// Every sound routes through one of three category buses, which feed a single
// master bus, which feeds the speakers:
//
//     sound → (effects | music | ambient) bus → master → destination
//
// Each bus has its own 0–1 volume; master has a volume and a mute. Persisted to
// localStorage and re-applied on load via applyAudioSettings(). Per-sound `vol`
// numbers passed to the builders below are *relative* mix levels within a bus.
const DEFAULT_VOLUMES = { master: 1, music: 1, ambient: 1, effects: 1 };
let volumes = { ...DEFAULT_VOLUMES };

let masterBus = null;   // → destination; gain = mute ? 0 : volumes.master
let effectsBus = null;  // care actions, hoofbeats, animal voices
let musicBus = null;    // day/night background tracks
let ambientBus = null;  // wind, bird chirps

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  ensureBuses();
  return ctx;
}

// Build the bus graph once, lazily (the context only exists after first sound).
function ensureBuses() {
  if (masterBus) return;
  masterBus = ctx.createGain();
  masterBus.gain.value = muted ? 0 : volumes.master;
  masterBus.connect(ctx.destination);

  effectsBus = ctx.createGain();
  musicBus   = ctx.createGain();
  ambientBus = ctx.createGain();
  effectsBus.gain.value = volumes.effects;
  musicBus.gain.value   = volumes.music;
  ambientBus.gain.value = volumes.ambient;
  effectsBus.connect(masterBus);
  musicBus.connect(masterBus);
  ambientBus.connect(masterBus);
}

// A per-sound gain node connected to a named category bus. `bus` is one of
// 'effects' | 'music' | 'ambient'; defaults to effects (the common SFX case).
function busGain(vol = 1, bus = 'effects') {
  ensureBuses();
  const g = getCtx().createGain();
  g.gain.value = vol;
  g.connect(bus === 'music' ? musicBus : bus === 'ambient' ? ambientBus : effectsBus);
  return g;
}

// Back-compat alias — most SFX builders below route to the effects bus.
function master(vol = 1) {
  return busGain(vol, 'effects');
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
    g.connect(busGain(1, 'ambient'));
    osc.start(t);
    osc.stop(t + 0.09);
  }
}

// ─── Horse nicker (friendly greeting) ────────────────────────────────────────

// A soft, low, pulsing whinny — the "hello / I'm pleased to see you" sound a
// content or well-tended horse makes when you come over.
export function playNicker() {
  const c = getCtx();
  const now = c.currentTime;
  // A short voiced tone that flutters (the rhythmic "rrr" of a nicker) and
  // settles lower, run through a formant-ish bandpass so it reads as a voice.
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(240, now);
  osc.frequency.linearRampToValueAtTime(300, now + 0.06);
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.55);

  // Amplitude flutter ~22 Hz gives the pulsing nicker texture.
  const flutter = c.createOscillator();
  flutter.type = 'sine';
  flutter.frequency.value = 22;
  const flutterGain = c.createGain();
  flutterGain.gain.value = 0.10;
  flutter.connect(flutterGain);

  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 700;
  band.Q.value = 1.2;

  const env = c.createGain();
  env.gain.setValueAtTime(0.001, now);
  env.gain.linearRampToValueAtTime(0.22, now + 0.05);
  env.gain.setValueAtTime(0.22, now + 0.4);
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  flutterGain.connect(env.gain); // pulse the amplitude

  osc.connect(band);
  band.connect(env);
  env.connect(master(1));
  osc.start(now);   osc.stop(now + 0.6);
  flutter.start(now); flutter.stop(now + 0.6);
}

// ─── Horse squeal (grumpy / neglected reaction) ──────────────────────────────

// A short, sharp, higher squeal — the irritated sound a horse that wasn't
// cared for makes when you interact with it.
export function playSqueal() {
  const c = getCtx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.exponentialRampToValueAtTime(360, now + 0.22);

  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1100;
  band.Q.value = 2.0;

  const env = c.createGain();
  env.gain.setValueAtTime(0.001, now);
  env.gain.linearRampToValueAtTime(0.22, now + 0.02);
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

  osc.connect(band);
  band.connect(env);
  env.connect(master(1));
  osc.start(now);
  osc.stop(now + 0.3);
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
  windGain.gain.value = 0.03; // relative mix level; mute/volume handled by buses

  windNode.connect(filter);
  filter.connect(windGain);
  windGain.connect(ambientBus);
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

// ── Nighttime music — warm, peaceful lullaby in C major ──────────────────────
// Gentle major-key phrasing (C–F–G–Am, resolving home to C), longer notes and
// soft rests for a starry, restful feel rather than a spooky minor one.
const NIGHT_MELODY = [
  [G4,1],[C5,1],[E5,0.5],[D5,0.5],[C5,1],          // bar 1 — soft rise, lands warm
  [G4,1],[E4,1],[G4,2],                            // bar 2 — settle gently
  [A4,1],[C5,1],[D5,0.5],[C5,0.5],[A4,1],          // bar 3
  [G4,1],[E4,1],[0,2],                             // bar 4 — breath
  [E4,1],[G4,1],[C5,0.5],[E5,0.5],[D5,1],          // bar 5 — soft peak
  [C5,1],[A4,1],[G4,2],                            // bar 6 — descend
  [F4,1],[A4,1],[G4,0.5],[E4,0.5],[D4,1],          // bar 7
  [E4,1],[G4,1],[C5,2],                            // bar 8 — resolve home to C
];

const NIGHT_BASS = [
  [C3,4],          // bar 1 — long sustained roots, C major
  [F3,4],          // bar 2 — F
  [A3,4],          // bar 3 — Am (gentle, not dark)
  [G3,4],          // bar 4 — G
  [C3,4],          // bar 5 — C
  [F3,4],          // bar 6 — F
  [G3,2],[A3,2],   // bar 7 — G → Am
  [C3,4],          // bar 8 — home
];

const NIGHT_CHORDS = [
  [[C4,E4,G4], 0.5],   // beat 1  — C
  [[F3,A3,C4], 0.5],   // beat 5  — F
  [[A3,C4,E4], 0.5],   // beat 9  — Am
  [[G3,B3,D4], 0.5],   // beat 13 — G
  [[C4,E4,G4], 0.5],   // beat 17 — C
  [[F3,A3,C4], 0.5],   // beat 21 — F
  [[G3,B3,D4], 0.5],   // beat 25 — G
  [[C4,E4,G4], 0.5],   // beat 29 — C, home
];

// Active patterns the scheduler reads — swapped by setMusicMode().
let activeMelody = MELODY;
let activeBass   = BASS;
let activeChords = CHORDS;
let nightMode    = false;

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
  const noteDur = dur * BEAT * 0.8;
  env.gain.setValueAtTime(0.001, time);
  env.gain.linearRampToValueAtTime(0.26, time + 0.02);
  env.gain.setValueAtTime(0.22, time + noteDur * 0.5);
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
    const [freq, dur] = activeMelody[melodyIdx % activeMelody.length];
    scheduleMelodyNote(nextMelodyTime, freq, dur);
    nextMelodyTime += dur * BEAT;
    melodyIdx = (melodyIdx + 1) % activeMelody.length;
  }

  // Bass voice (independent cursor)
  while (nextBassTime < ahead) {
    const [freq, dur] = activeBass[bassIdx % activeBass.length];
    scheduleBassNote(nextBassTime, freq, dur);
    nextBassTime += dur * BEAT;
    bassIdx = (bassIdx + 1) % activeBass.length;
  }

  // Chord stabs every 4 beats
  while (nextChordTime < ahead) {
    const [freqs] = activeChords[chordIdx % activeChords.length];
    scheduleChord(nextChordTime, freqs);
    nextChordTime += 4 * BEAT;
    chordIdx = (chordIdx + 1) % activeChords.length;
  }
}

// Base music volume depends on day/night — night is quieter and gentler.
function musicVolume() {
  return nightMode ? 0.05 : 0.07;
}

export function startMusic() {
  if (musicTimer) return;
  const c = getCtx();
  musicGain = c.createGain();
  musicGain.gain.value = musicVolume(); // relative; mute/volume handled by buses
  musicGain.connect(musicBus);

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

// Switch between the daytime and nighttime tracks. Swaps the active patterns
// and resets the voice cursors so the new track starts cleanly from its top.
export function setMusicMode(isNight) {
  if (isNight === nightMode) return;
  nightMode = isNight;
  activeMelody = isNight ? NIGHT_MELODY : MELODY;
  activeBass   = isNight ? NIGHT_BASS   : BASS;
  activeChords = isNight ? NIGHT_CHORDS : CHORDS;
  melodyIdx = 0;
  bassIdx   = 0;
  chordIdx  = 0;
  if (musicGain) musicGain.gain.value = musicVolume();
}

// ─── Mixer controls (mute + per-bus volume) ──────────────────────────────────
// All mute/volume now lives on the buses, so individual sounds need no special
// casing. onChange (set by applyAudioSettings) is fired so the host can persist.

let onChange = null;

function applyMasterGain() {
  if (masterBus) masterBus.gain.value = muted ? 0 : volumes.master;
}

export function toggleMute() {
  muted = !muted;
  applyMasterGain();
  onChange?.(getAudioSettings());
  return muted;
}

export function isMuted() { return muted; }

// Set one bus's volume (0–1). 'master' also respects the mute flag.
export function setVolume(bus, value) {
  const v = Math.max(0, Math.min(1, value));
  if (!(bus in volumes)) return;
  volumes[bus] = v;
  if (bus === 'master') applyMasterGain();
  else if (masterBus) {
    const node = bus === 'music' ? musicBus : bus === 'ambient' ? ambientBus : effectsBus;
    if (node) node.gain.value = v;
  }
  onChange?.(getAudioSettings());
}

export function getAudioSettings() {
  return { muted, volumes: { ...volumes } };
}

// Apply persisted settings (called once at boot). `onChangeCb` is invoked
// whenever the user later changes mute/volume so the host can re-save.
export function applyAudioSettings(settings = {}, onChangeCb = null) {
  if (typeof settings.muted === 'boolean') muted = settings.muted;
  if (settings.volumes) {
    for (const k of Object.keys(DEFAULT_VOLUMES)) {
      const v = settings.volumes[k];
      if (typeof v === 'number') volumes[k] = Math.max(0, Math.min(1, v));
    }
  }
  onChange = onChangeCb;
  // Re-apply to live buses if they already exist.
  if (masterBus) {
    applyMasterGain();
    effectsBus.gain.value = volumes.effects;
    musicBus.gain.value   = volumes.music;
    ambientBus.gain.value = volumes.ambient;
  }
}
