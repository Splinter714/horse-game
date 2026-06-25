// Ambient audio — the looping wind bed and the procedural day/night chiptune music
// engine. These connect directly to their category bus (via busFor) since they're
// long-lived sources, not one-shots. Extracted from the monolithic sounds.js (#167).

import { getCtx, busFor } from './core.js';

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
  windGain.connect(busFor('ambient'));
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
  musicGain.connect(busFor('music'));

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
