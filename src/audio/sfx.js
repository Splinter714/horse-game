// Sound effects + animal voices — procedural one-shots for care actions and creatures
// (hoofbeat, eat, drink, brush, peck, gather, chime, splash, milk) plus the horse/bird
// vocals. All route through the effects bus via the shared primitives in ./core.js.
// Extracted from the monolithic sounds.js (issue #167).

import { getCtx, master, busGain, noise, tone } from './core.js';

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

// Per-food eating character (#126). Both stay slow + organic (3 chews), but the
// balance of bright "snap" vs. low "chew body" differs so feeding reads by ear:
//  • crunchy (apple/carrot) — bright, sharp top snaps, light body.
//  • munchy  (hay)          — soft, dull top, heavy low chewing body.
const EAT_PROFILES = {
  crunchy: { spacing: 0.12,  hiBase: 2300, hiStep: 320, hiQ: 1.2, lp: 4200,
             topGain: 0.26, topDecay: 0.045, bodyLP: 300, bodyGain: 0.14 },
  munchy:  { spacing: 0.135, hiBase: 1100, hiStep: 160, hiQ: 0.6, lp: 2400,
             topGain: 0.12, topDecay: 0.07,  bodyLP: 440, bodyGain: 0.34 },
};

function eatProfile(food) {
  if (food === 'apple' || food === 'carrot' || food === 'crunchy') return EAT_PROFILES.crunchy;
  return EAT_PROFILES.munchy; // hay / default
}

export function playEat(food = 'hay') {
  const c = getCtx();
  const now = c.currentTime;
  const p = eatProfile(food);

  for (let i = 0; i < 3; i++) {
    // Slight organic jitter in the chew spacing so it doesn't sound mechanical.
    // Positive-only so `t` can never fall before `now` (a fresh/suspended audio
    // context has currentTime ~0, and a negative absolute time throws).
    const t = now + i * p.spacing + Math.random() * 0.02;
    const dur = 0.09;

    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let j = 0; j < d.length; j++) d[j] = Math.random() * 2 - 1;

    // ── Top crunch/snap — bright + sharp for crunchy, dull for munchy ──
    const src = c.createBufferSource();
    src.buffer = buf;

    const hi = c.createBiquadFilter();
    hi.type = 'bandpass';
    hi.frequency.value = p.hiBase + i * p.hiStep;
    hi.Q.value = p.hiQ;

    const lo = c.createBiquadFilter();
    lo.type = 'lowpass';
    lo.frequency.value = p.lp;

    const env = c.createGain();
    env.gain.setValueAtTime(p.topGain, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + p.topDecay);

    src.connect(hi);
    hi.connect(lo);
    lo.connect(env);
    env.connect(master(1));
    src.start(t);
    src.stop(t + dur);

    // ── Low-mid chew "body" — light for crunchy, heavy for the munchy chew ──
    const bsrc = c.createBufferSource();
    bsrc.buffer = buf;

    const body = c.createBiquadFilter();
    body.type = 'lowpass';
    body.frequency.value = p.bodyLP + i * 40;
    body.Q.value = 0.7;

    const bodyEnv = c.createGain();
    bodyEnv.gain.setValueAtTime(0.001, t);
    bodyEnv.gain.linearRampToValueAtTime(p.bodyGain, t + 0.012);
    bodyEnv.gain.exponentialRampToValueAtTime(0.001, t + dur);

    bsrc.connect(body);
    body.connect(bodyEnv);
    bodyEnv.connect(master(1));
    bsrc.start(t);
    bsrc.stop(t + dur);
  }
}

// ─── Drinking (lap/gulp) ─────────────────────────────────────────────────────

export function playDrink() {
  const c = getCtx();
  const now = c.currentTime;

  // Three wet slurps (#124). Each is a resonant bandpass that sweeps upward —
  // mimicking liquid suction — with a low "gulp" body swallowed underneath, so it
  // reads as slurpy/wet rather than a dry tap.
  for (let i = 0; i < 3; i++) {
    const t = now + i * 0.2 + Math.random() * 0.03;
    const dur = 0.22;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let j = 0; j < d.length; j++) d[j] = Math.random() * 2 - 1;

    // ── Slurp: resonant bandpass sweeping up = wet suction ──
    const src = c.createBufferSource();
    src.buffer = buf;

    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 4.5; // resonant → "wet"
    const f0 = 380 + Math.random() * 90;
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(f0 * 2.6, t + dur * 0.85);

    const env = c.createGain();
    env.gain.setValueAtTime(0.001, t);
    env.gain.linearRampToValueAtTime(0.26, t + dur * 0.35);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(filter);
    filter.connect(env);
    env.connect(master(1));
    src.start(t);
    src.stop(t + dur);

    // ── Low "gulp" body, swallowed a beat after the slurp peaks ──
    const bsrc = c.createBufferSource();
    bsrc.buffer = buf;

    const lo = c.createBiquadFilter();
    lo.type = 'lowpass';
    lo.frequency.value = 260;
    lo.Q.value = 0.8;

    const bodyEnv = c.createGain();
    bodyEnv.gain.setValueAtTime(0.001, t + dur * 0.4);
    bodyEnv.gain.linearRampToValueAtTime(0.2, t + dur * 0.6);
    bodyEnv.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.1);

    bsrc.connect(lo);
    lo.connect(bodyEnv);
    bodyEnv.connect(master(1));
    bsrc.start(t);
    bsrc.stop(t + dur * 1.1);
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

// ─── Chicken peck (light tap on ground/feed) ─────────────────────────────────

// A single short, light peck tap: a tiny high click of filtered noise plus a
// quick tonal tick for the "beak" snap. Callers fire it a few times in a row
// (see chickenGoEat) to read as repeated pecking.
export function playPeck() {
  const c = getCtx();
  const now = c.currentTime;
  const dur = 0.045;

  // Click: high band of noise, very short.
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;

  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2800 + Math.random() * 600;
  bp.Q.value = 1.4;

  const env = c.createGain();
  env.gain.setValueAtTime(0.10, now);
  env.gain.exponentialRampToValueAtTime(0.001, now + dur);

  src.connect(bp);
  bp.connect(env);
  env.connect(master(1));
  src.start(now);
  src.stop(now + dur);

  // Tick: tiny tonal beak snap an octave-ish above, even shorter.
  const osc = c.createOscillator();
  const g   = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(2400 + Math.random() * 400, now);
  osc.frequency.exponentialRampToValueAtTime(1600, now + 0.02);
  g.gain.setValueAtTime(0.06, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
  osc.connect(g);
  g.connect(master(1));
  osc.start(now);
  osc.stop(now + 0.03);
}

// ─── Gathering (per-source pickup) ───────────────────────────────────────────

// Small noise burst helper used by the gather sounds: `shape` is the bandpass/
// lowpass/highpass type, `freq` the centre, `q` the resonance, and the gain
// envelope ramps up over `attack` then decays to silence by `dur`.
function gatherBurst(now, dur, shape, freq, q, vol, attack = 0.01) {
  const c = getCtx();
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;

  const filt = c.createBiquadFilter();
  filt.type = shape;
  filt.frequency.value = freq;
  filt.Q.value = q;

  const env = c.createGain();
  env.gain.setValueAtTime(0.001, now);
  env.gain.linearRampToValueAtTime(vol, now + attack);
  env.gain.exponentialRampToValueAtTime(0.001, now + dur);

  src.connect(filt);
  filt.connect(env);
  env.connect(master(1));
  src.start(now);
  src.stop(now + dur);
}

// A distinct pickup sound per gather source so the action reads by ear.
// Routed (like everything) through the effects bus via master().
export function playGather(content) {
  const c = getCtx();
  const now = c.currentTime;

  switch (content) {
    case 'water':
      // Water keeps its existing splash.
      playSplash();
      return;

    case 'carrot': {
      // Pull-from-soil: a low gritty earthy tug that swells then releases with
      // a soft thud as it comes free.
      const filt = c.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(220, now);
      filt.frequency.linearRampToValueAtTime(600, now + 0.16);
      filt.Q.value = 0.6;
      const buf = c.createBuffer(1, Math.ceil(c.sampleRate * 0.22), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      const env = c.createGain();
      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(0.26, now + 0.13);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      src.connect(filt); filt.connect(env); env.connect(master(1));
      src.start(now); src.stop(now + 0.22);
      // Soft low thud on release.
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now + 0.13);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.24);
      g.gain.setValueAtTime(0.18, now + 0.13);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.connect(g); g.connect(master(1));
      osc.start(now + 0.13); osc.stop(now + 0.26);
      return;
    }

    case 'apple': {
      // Pluck from tree: a quick taut snap (plucked tone) with a little leaf rustle.
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.07);
      g.gain.setValueAtTime(0.22, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
      osc.connect(g); g.connect(master(1));
      osc.start(now); osc.stop(now + 0.10);
      // Leafy rustle just after the snap.
      gatherBurst(now + 0.02, 0.14, 'highpass', 3500, 0.7, 0.10, 0.03);
      return;
    }

    case 'hay': {
      // Rustle/gather of dry straw: a few overlapping airy highpass noise
      // sweeps, soft and dry.
      gatherBurst(now,        0.26, 'highpass', 3000, 0.6, 0.14, 0.06);
      gatherBurst(now + 0.05, 0.22, 'bandpass', 4200, 0.8, 0.10, 0.05);
      gatherBurst(now + 0.11, 0.18, 'highpass', 2600, 0.6, 0.09, 0.05);
      return;
    }

    case 'egg': {
      // Soft pick-up / gentle clink: a tiny soft thunk plus a delicate two-note clink.
      gatherBurst(now, 0.06, 'lowpass', 500, 0.7, 0.10, 0.01);
      [1318.5, 1760].forEach((freq, i) => {
        const t = now + 0.03 + i * 0.05;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.10, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
        osc.connect(g); g.connect(master(1));
        osc.start(t); osc.stop(t + 0.10);
      });
      return;
    }

    default:
      // Seed and any other content: a light dry scatter.
      gatherBurst(now, 0.14, 'highpass', 2200, 0.6, 0.10, 0.03);
      return;
  }
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

// ─── Milking (squirt into the pail) ──────────────────────────────────────────

// A few rhythmic milk squirts streaming into a pail. Each stroke is two layers:
//   1. a thin, pressurized "ssst" — resonant bandpass noise sweeping DOWN, the jet
//      of milk leaving the teat; and
//   2. a wet "ploop" as the stream hits the surface — a short resonant body whose
//      pitch RISES stroke to stroke, the way a filling glass/pail climbs in pitch
//      as the air cavity shrinks. Strokes alternate teats with a little timing/pitch
//      jitter so it reads as hand-milking, not a metronome. Used when milking the cow.
export function playMilk() {
  const c = getCtx();
  const now = c.currentTime;
  const STROKES = 5;
  const gap = 0.26; // a touch more room so each long "ssst" lands before the next

  for (let i = 0; i < STROKES; i++) {
    // Clamp to >= now: the first stroke's negative jitter must not schedule a
    // negative AudioParam time when the context was only just created (currentTime
    // ~0, e.g. milking immediately after boot) — that throws a RangeError.
    const t = Math.max(now, now + i * gap + (Math.random() - 0.5) * 0.02);
    // Shared noise buffer per stroke — long enough to carry the sustained jet hiss.
    const sDur = 0.26;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * sDur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let j = 0; j < d.length; j++) d[j] = Math.random() * 2 - 1;

    // ── 1. Pressurized jet: a sustained, airy "sssssst" — wide bandpass noise
    //    sweeping down. Longer and louder so the stream is clearly audible before
    //    it hits the milk (the lower Q makes it hiss/"shhh" rather than whistle). ──
    const jet = c.createBufferSource();
    jet.buffer = buf;
    const jf = c.createBiquadFilter();
    jf.type = 'bandpass';
    jf.Q.value = 1.4; // wide → breathy hiss, not a tone
    const j0 = 3200 + Math.random() * 400;
    jf.frequency.setValueAtTime(j0, t);
    jf.frequency.exponentialRampToValueAtTime(1500, t + 0.16);
    // A gentle high-shelf-ish second pass would help, but one wide band reads fine.
    const jEnv = c.createGain();
    jEnv.gain.setValueAtTime(0.001, t);
    jEnv.gain.linearRampToValueAtTime(0.34, t + 0.025); // louder
    jEnv.gain.setValueAtTime(0.34, t + 0.11);           // hold the hiss…
    jEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.2); // …then trail off
    jet.connect(jf); jf.connect(jEnv); jEnv.connect(master(1));
    jet.start(t); jet.stop(t + 0.2);

    // ── 2. Wet "ploop" as the stream hits the milk, pitch rising as the pail fills.
    //    Lands AFTER the jet has been heard for a moment, so squirt-then-splash reads. ──
    const fill = STROKES > 1 ? i / (STROKES - 1) : 0;
    const fHz = 300 + fill * 240 + (Math.random() - 0.5) * 20; // ~300 → ~540 Hz
    const tp = t + 0.1; // the splash lands a beat into the jet

    const plopN = c.createBufferSource();
    plopN.buffer = buf;
    const pf = c.createBiquadFilter();
    pf.type = 'bandpass';
    pf.Q.value = 6;
    pf.frequency.setValueAtTime(fHz * 0.85, tp);
    pf.frequency.exponentialRampToValueAtTime(fHz, tp + 0.09);
    const pEnv = c.createGain();
    pEnv.gain.setValueAtTime(0.001, tp);
    pEnv.gain.linearRampToValueAtTime(0.2, tp + 0.02);
    pEnv.gain.exponentialRampToValueAtTime(0.001, tp + 0.14);
    plopN.connect(pf); pf.connect(pEnv); pEnv.connect(master(1));
    plopN.start(tp); plopN.stop(tp + 0.14);

    // A soft sine tone under the splash gives the "ploop" a pitched, watery body.
    const tone = c.createOscillator();
    tone.type = 'sine';
    tone.frequency.setValueAtTime(fHz * 0.9, tp);
    tone.frequency.linearRampToValueAtTime(fHz * 1.15, tp + 0.1);
    const tEnv = c.createGain();
    tEnv.gain.setValueAtTime(0.001, tp);
    tEnv.gain.linearRampToValueAtTime(0.11, tp + 0.02);
    tEnv.gain.exponentialRampToValueAtTime(0.001, tp + 0.13);
    tone.connect(tEnv); tEnv.connect(master(1));
    tone.start(tp); tone.stop(tp + 0.13);
  }
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
  osc.frequency.exponentialRampToValueAtTime(240, now + 0.42); // longer, sadder downward slide

  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1100;
  band.Q.value = 2.0;

  const env = c.createGain();
  env.gain.setValueAtTime(0.001, now);
  env.gain.linearRampToValueAtTime(0.22, now + 0.02);
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  osc.connect(band);
  band.connect(env);
  env.connect(master(1));
  osc.start(now);
  osc.stop(now + 0.52);
}

