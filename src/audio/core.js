// Audio core — the Web Audio context, the mixer bus graph (effects/music/ambient →
// master → speakers), the low-level primitive builders (noise/tone) every sound uses,
// and the mixer controls (mute + per-bus volume). The sfx and ambient modules import
// the primitives from here; this file owns the shared audio state. Extracted from the
// monolithic sounds.js (issue #167).

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

export function getCtx() {
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
export function busGain(vol = 1, bus = 'effects') {
  ensureBuses();
  const g = getCtx().createGain();
  g.gain.value = vol;
  g.connect(bus === 'music' ? musicBus : bus === 'ambient' ? ambientBus : effectsBus);
  return g;
}

// Back-compat alias — most SFX builders below route to the effects bus.
export function master(vol = 1) {
  return busGain(vol, 'effects');
}

// The category bus node for a name ('effects'|'music'|'ambient'), built lazily. Lets
// long-lived ambient sources (wind/music) connect straight to their bus.
export function busFor(bus) {
  ensureBuses();
  return bus === 'music' ? musicBus : bus === 'ambient' ? ambientBus : effectsBus;
}
// ─── Primitive builders ───────────────────────────────────────────────────────

export function noise(dur, freq = null, q = 1, vol = 0.4) {
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

export function tone(freq, dur, vol = 0.3, type = 'sine') {
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
