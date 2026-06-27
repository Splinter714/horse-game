// Procedural pixel-art cat (calico). Faces right, origin (0.5,1). Currently the only
// non-chicken animal enabled (see creatures.js buildAnimals). Uses the shared `gen`
// and `makeLeg` helpers from _frames.js, but builds its own frames so the tail can be
// animated independently of the legs and the walk stays smooth (cats don't bounce).

import { gen, makeLeg, blurEdgesSplit, scaledGraphics, ART_SCALE, ANIMAL_BLUR } from './_frames.js';

export const CAT_W = 22, CAT_H = 20;

// Calico palette: a white base with orange and black patches. The orange patch family
// (`fur`) and the eye colour are data-driven (#165); the customizer passes a `look` of
// { fur, eyes }. The white base and black saddle stay fixed (the calico structure).
const WHITE  = { mid: 0xf4efe6, hi: 0xffffff, lo: 0xddd2c4 };
const BLACK  = { mid: 0x35312a, hi: 0x4c473e, lo: 0x201d18 };
const EAR    = 0xf2a09a;   // ear inner pink
const NOSE   = 0xe69a86;
const PUPIL  = 0x14260a;

const DEFAULT_LOOK = {
  fur:  { mid: 0xe8943c, hi: 0xf6b45c, lo: 0xc06c20 }, // ginger patches
  eyes: { color: 0x74c24a },
};

// Short legs → low, crouched stance. Feet stay at y19; the body sits just above.
const catLeg = makeLeg({ topY: 16, w: 2, h: 3, hoofColor: 0x6a5848, hoofY: 19, hoofW: 4, hoofDX: -1, hoofH: 1 });

// tailTip nudges ONLY the tip of the tail (a small twitch). tailHigh raises the whole
// tail when truthy (alert pose); otherwise it rides lower and straighter (relaxed).
function drawCat(g, bob, [lhf, lhn, lff, lfn], tailTip = 0, tailHigh = false, look) {
  const ORANGE = look?.fur || DEFAULT_LOOK.fur;       // the calico's main patch colour
  const EYE = (look?.eyes || DEFAULT_LOOK.eyes).color;
  // Legs — far pair shadow tone, near pair base; white "socks". Cats step quietly:
  // legs barely lift and the body never bobs, so the gait reads as a smooth creep.
  catLeg(g, 5,  lhf, WHITE.lo,  bob); catLeg(g, 15, lff, WHITE.lo,  bob);
  catLeg(g, 7,  lhn, WHITE.mid, bob); catLeg(g, 17, lfn, WHITE.mid, bob);

  // ── Tail ── nearly straight, no dog-like curl. Two distinct poses: `tailHigh`
  // stands it upright (alert); otherwise it angles up-AND-BACK on a diagonal (a tilt,
  // not just lowered). Only the tip twitches, by tailTip.
  if (tailHigh) {
    g.fillStyle(ORANGE.mid, 1);
    g.fillRect(3, 11+bob, 3, 4);              // root, overlapping the haunch
    g.fillRect(3, 3+bob, 2, 9);              // upright shaft down to the root
    g.fillRect(3+tailTip, 1+bob, 2, 2);      // tip (twitches)
    g.fillStyle(ORANGE.hi, 1);  g.fillRect(3, 4+bob, 1, 7);                  // highlight
    g.fillStyle(BLACK.mid, 1);  g.fillRect(3, 6+bob, 2, 1); g.fillRect(3, 11+bob, 3, 1); // rings
  } else {
    g.fillStyle(ORANGE.mid, 1);
    g.fillRect(6, 12+bob, 3, 3);             // root, overlapping the haunch
    g.fillRect(5, 11+bob, 3, 2);            // …each segment steps back-and-up…
    g.fillRect(3,  9+bob, 3, 2);
    g.fillRect(2,  7+bob, 3, 2);
    g.fillRect(1,  5+bob, 3, 2);
    g.fillRect(0,  4-tailTip+bob, 2, 2);     // tip (twitches up/down)
    g.fillStyle(ORANGE.hi, 1);  g.fillRect(3, 9+bob, 1, 2); g.fillRect(1, 5+bob, 1, 2); // highlight
    g.fillStyle(BLACK.mid, 1);  g.fillRect(3, 9+bob, 2, 1); g.fillRect(6, 12+bob, 3, 1);  // rings
  }

  // ── Haunch ── rounded rear thigh, orange patch
  g.fillStyle(WHITE.mid, 1);  g.fillCircle(7, 13+bob, 4);
  g.fillStyle(ORANGE.mid, 1); g.fillCircle(7, 13+bob, 4);
  g.fillStyle(ORANGE.lo, 1);  g.fillCircle(7, 15+bob, 3);

  // ── Body ── white base, low and sleek with a gentle arched back
  g.fillStyle(WHITE.mid, 1); g.fillRect(5, 10+bob, 13, 6); g.fillRect(6, 8+bob, 9, 2);
  g.fillStyle(WHITE.hi, 1);  g.fillRect(6, 8+bob, 9, 1);   g.fillRect(5, 10+bob, 13, 1);
  g.fillStyle(WHITE.lo, 1);  g.fillRect(5, 15+bob, 13, 1);

  // Calico patches — blotchy, irregular edges (not clean blocks). Orange over the
  // rump, a black saddle over the shoulders, then white notches carved back in and a
  // couple of stray flecks so the borders look organic.
  g.fillStyle(ORANGE.mid, 1);
  g.fillRect(5,  9+bob, 5, 6);     // main rear patch
  g.fillRect(7,  7+bob, 2, 2);     // finger up into the back
  g.fillRect(10, 11+bob, 1, 3);    // reach toward the saddle
  g.fillStyle(ORANGE.hi, 1);  g.fillRect(6, 8+bob, 2, 1);
  g.fillStyle(BLACK.mid, 1);
  g.fillRect(11, 9+bob, 5, 5);     // main saddle
  g.fillRect(12, 8+bob, 3, 1);     // top bump
  g.fillRect(10, 10+bob, 1, 3);    // left finger toward the orange
  g.fillRect(15, 11+bob, 1, 3);    // right finger toward the shoulder
  g.fillStyle(BLACK.hi, 1);   g.fillRect(12, 8+bob, 3, 1);
  g.fillStyle(BLACK.lo, 1);   g.fillRect(12, 13+bob, 3, 1);
  // White notches bitten back into the patches
  g.fillStyle(WHITE.mid, 1);
  g.fillRect(5,  9+bob, 1, 1);     // orange top-left corner
  g.fillRect(9, 13+bob, 1, 2);     // widen the gap between patches
  g.fillRect(15, 9+bob, 1, 1);     // saddle top-right corner
  // Stray flecks
  g.fillStyle(BLACK.mid, 1);  g.fillRect(8, 12+bob, 1, 1);    // spot on the orange
  g.fillStyle(ORANGE.mid, 1); g.fillRect(16, 13+bob, 1, 1);   // ginger fleck on the shoulder

  // ── Neck/shoulder ── blends body into head (white chest)
  g.fillStyle(WHITE.mid, 1); g.fillRect(15, 9+bob, 4, 6);
  g.fillStyle(WHITE.hi, 1);  g.fillRect(15, 14+bob, 4, 1); // chest

  // ── Head ── small, round, FLAT-faced (no protruding snout — the dog cue), with
  // sharp triangular ears set wide. The front of the face is vertical at x21.
  g.fillStyle(WHITE.mid, 1); g.fillRect(15, 5+bob, 7, 5);  // round skull, flat front
  g.fillStyle(WHITE.hi, 1);  g.fillRect(16, 5+bob, 5, 1);  // brow highlight
  // Sharp triangular ears, tapering to a point (calico: one orange, one black)
  g.fillStyle(ORANGE.mid, 1);
  g.fillRect(14, 4+bob, 3, 1); g.fillRect(14, 3+bob, 2, 1); g.fillRect(14, 2+bob, 1, 1);
  g.fillStyle(BLACK.mid, 1);
  g.fillRect(19, 4+bob, 3, 1); g.fillRect(20, 3+bob, 2, 1); g.fillRect(21, 2+bob, 1, 1);
  g.fillStyle(EAR, 1); g.fillRect(15, 3+bob, 1, 1); g.fillRect(20, 3+bob, 1, 1);
  // Orange crown patch (calico face is asymmetric)
  g.fillStyle(ORANGE.mid, 1); g.fillRect(15, 5+bob, 3, 2);
  // Big eyes, set high and forward
  g.fillStyle(EYE, 1);   g.fillRect(16, 6+bob, 2, 2); g.fillRect(19, 6+bob, 2, 2);
  g.fillStyle(PUPIL, 1); g.fillRect(17, 6+bob, 1, 2); g.fillRect(20, 6+bob, 1, 2);
  g.fillStyle(0xffffff, 0.9); g.fillRect(16, 6+bob, 1, 1); g.fillRect(19, 6+bob, 1, 1);
  // Tiny nose + mouth right at the flat face (minimal muzzle)
  g.fillStyle(NOSE, 1);     g.fillRect(20, 9+bob, 1, 1);
  g.fillStyle(BLACK.lo, 1); g.fillRect(19, 9+bob, 1, 1);
  // Whiskers — pale strokes off the flat cheek
  g.fillStyle(0xffffff, 0.7);  g.fillRect(21, 8+bob, 1, 1);
  g.fillStyle(0xffffff, 0.4);  g.fillRect(21, 9+bob, 1, 1);
}

export function buildCatTextures(scene, key, look) {
  // Cats pad smoothly — no body bob, almost no leg lift, tail mostly still. Idle
  // holds an alert tail-up pose with a slow tip flick; walking drops to the relaxed
  // lower tail. The result is a quiet creep, not a dog's bouncy trot/wag.
  const frames = [
    { name: 'idle_0', bob: 0, legs: [0, 0, 0, 0], tail: 0, high: true },
    { name: 'idle_1', bob: 0, legs: [0, 0, 0, 0], tail: 1, high: true },  // tail-tip flick
    { name: 'walk_0', bob: 0, legs: [0, 0, 0, 0], tail: 0, high: false },
    { name: 'walk_1', bob: 0, legs: [1, 0, 0, 0], tail: 0, high: false },  // one foot at a time
    { name: 'walk_2', bob: 0, legs: [0, 0, 1, 0], tail: 1, high: false },
    { name: 'walk_3', bob: 0, legs: [0, 0, 0, 1], tail: 0, high: false },
  ];
  frames.forEach(f => {
    gen(scene, `${key}_${f.name}`, CAT_W * ART_SCALE, CAT_H * ART_SCALE,
      g0 => drawCat(scaledGraphics(g0), f.bob, f.legs, f.tail, f.high, look));
    blurEdgesSplit(scene, `${key}_${f.name}`, ANIMAL_BLUR);
  });
}
