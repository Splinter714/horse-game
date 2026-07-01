// Procedural pixel-art cat (calico). Faces right, origin (0.5,1). Currently the only
// non-chicken animal enabled (see creatures.js buildAnimals). Uses the shared `gen`
// and `makeLeg` helpers from _frames.js, but builds its own frames so the tail can be
// animated independently of the legs and the walk stays smooth (cats don't bounce).

import { gen, makeLeg, scaledGraphics, ART_SCALE } from './_frames.js';

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
  g.layer('legs');
  catLeg(g, 5,  lhf, WHITE.lo,  bob); catLeg(g, 15, lff, WHITE.lo,  bob);
  catLeg(g, 7,  lhn, WHITE.mid, bob); catLeg(g, 17, lfn, WHITE.mid, bob);

  // ── Tail ──
  g.layer('tail');
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

  g.layer('haunch');
  // ── Haunch ── rounded rear thigh, orange patch
  g.fillStyle(WHITE.mid, 1);  g.fillCircle(7, 13+bob, 4);
  g.fillStyle(ORANGE.mid, 1); g.fillCircle(7, 13+bob, 4);
  g.fillStyle(ORANGE.lo, 1);  g.fillCircle(7, 15+bob, 3);

  g.layer('body');
  // ── Body ── white base, low and sleek with a gentle arched back
  g.fillStyle(WHITE.mid, 1); g.fillRect(5, 10+bob, 13, 6); g.fillRect(6, 8+bob, 9, 2);
  g.fillStyle(WHITE.hi, 1);  g.fillRect(6, 8+bob, 9, 1);   g.fillRect(5, 10+bob, 13, 1);
  g.fillStyle(WHITE.lo, 1);  g.fillRect(5, 15+bob, 13, 1);

  g.layer('patches');
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

  g.layer('neck');
  // ── Neck/shoulder ── blends body into head (white chest)
  g.fillStyle(WHITE.mid, 1); g.fillRect(15, 9+bob, 4, 6);
  g.fillStyle(WHITE.hi, 1);  g.fillRect(15, 14+bob, 4, 1); // chest

  g.layer('head');
  // ── Head ── small, round, FLAT-faced (no protruding snout — the dog cue), with
  // sharp triangular ears set wide. The front of the face is vertical at x21.
  g.fillStyle(WHITE.mid, 1); g.fillRect(15, 5+bob, 7, 5);  // round skull, flat front
  g.fillStyle(WHITE.hi, 1);  g.fillRect(16, 5+bob, 5, 1);  // brow highlight
  g.layer('ears');
  // Sharp triangular ears, tapering to a point (calico: one orange, one black)
  g.fillStyle(ORANGE.mid, 1);
  g.fillRect(14, 4+bob, 3, 1); g.fillRect(14, 3+bob, 2, 1); g.fillRect(14, 2+bob, 1, 1);
  g.fillStyle(BLACK.mid, 1);
  g.fillRect(19, 4+bob, 3, 1); g.fillRect(20, 3+bob, 2, 1); g.fillRect(21, 2+bob, 1, 1);
  g.fillStyle(EAR, 1); g.fillRect(15, 3+bob, 1, 1); g.fillRect(20, 3+bob, 1, 1);
  // Orange crown patch (calico face is asymmetric)
  g.fillStyle(ORANGE.mid, 1); g.fillRect(15, 5+bob, 3, 2);
  g.layer('eyes');
  // Big eyes, set high and forward
  g.fillStyle(EYE, 1);   g.fillRect(16, 6+bob, 2, 2); g.fillRect(19, 6+bob, 2, 2);
  g.fillStyle(PUPIL, 1); g.fillRect(17, 6+bob, 1, 2); g.fillRect(20, 6+bob, 1, 2);
  g.fillStyle(0xffffff, 0.9); g.fillRect(16, 6+bob, 1, 1); g.fillRect(19, 6+bob, 1, 1);
  g.layer('nose');
  // Tiny nose + mouth right at the flat face (minimal muzzle)
  g.fillStyle(NOSE, 1);     g.fillRect(20, 9+bob, 1, 1);
  g.fillStyle(BLACK.lo, 1); g.fillRect(19, 9+bob, 1, 1);
  // Whiskers — pale strokes off the flat cheek
  g.fillStyle(0xffffff, 0.7);  g.fillRect(21, 8+bob, 1, 1);
  g.fillStyle(0xffffff, 0.4);  g.fillRect(21, 9+bob, 1, 1);
}

// Eating: head drops level with the ground to nose at a dropped fish pile. Legs
// stay planted (cats don't crouch their whole body to eat, just dip the head/neck),
// tail lowers and stills — the alert tail-up idle would read as "still on watch",
// not settled in for a meal. Two frames give a tiny head bob (chew) rather than a
// static pose, matching the two-frame idle/walk cadence used elsewhere.
function drawCatEat(g, bob, [lhf, lhn, lff, lfn], dip, look) {
  const ORANGE = look?.fur || DEFAULT_LOOK.fur;
  const EYE = (look?.eyes || DEFAULT_LOOK.eyes).color;

  g.layer('legs');
  catLeg(g, 5,  lhf, WHITE.lo,  bob); catLeg(g, 15, lff, WHITE.lo,  bob);
  catLeg(g, 7,  lhn, WHITE.mid, bob); catLeg(g, 17, lfn, WHITE.mid, bob);

  g.layer('tail');
  // Low, relaxed tail — settled in for a meal, not alert.
  g.fillStyle(ORANGE.mid, 1);
  g.fillRect(6, 12+bob, 3, 3);
  g.fillRect(5, 11+bob, 3, 2);
  g.fillRect(3,  9+bob, 3, 2);
  g.fillRect(2,  8+bob, 3, 2);
  g.fillStyle(ORANGE.hi, 1); g.fillRect(3, 9+bob, 1, 2);
  g.fillStyle(BLACK.mid, 1); g.fillRect(3, 9+bob, 2, 1); g.fillRect(6, 12+bob, 3, 1);

  g.layer('haunch');
  g.fillStyle(WHITE.mid, 1);  g.fillCircle(7, 13+bob, 4);
  g.fillStyle(ORANGE.mid, 1); g.fillCircle(7, 13+bob, 4);
  g.fillStyle(ORANGE.lo, 1);  g.fillCircle(7, 15+bob, 3);

  g.layer('body');
  g.fillStyle(WHITE.mid, 1); g.fillRect(5, 10+bob, 13, 6); g.fillRect(6, 8+bob, 9, 2);
  g.fillStyle(WHITE.hi, 1);  g.fillRect(6, 8+bob, 9, 1);   g.fillRect(5, 10+bob, 13, 1);
  g.fillStyle(WHITE.lo, 1);  g.fillRect(5, 15+bob, 13, 1);

  g.layer('patches');
  g.fillStyle(ORANGE.mid, 1);
  g.fillRect(5,  9+bob, 5, 6);
  g.fillRect(7,  7+bob, 2, 2);
  g.fillRect(10, 11+bob, 1, 3);
  g.fillStyle(ORANGE.hi, 1);  g.fillRect(6, 8+bob, 2, 1);
  g.fillStyle(BLACK.mid, 1);
  g.fillRect(11, 9+bob, 5, 5);
  g.fillRect(12, 8+bob, 3, 1);
  g.fillRect(10, 10+bob, 1, 3);
  g.fillRect(15, 11+bob, 1, 3);
  g.fillStyle(BLACK.hi, 1);   g.fillRect(12, 8+bob, 3, 1);
  g.fillStyle(BLACK.lo, 1);   g.fillRect(12, 13+bob, 3, 1);
  g.fillStyle(WHITE.mid, 1);
  g.fillRect(5,  9+bob, 1, 1);
  g.fillRect(9, 13+bob, 1, 2);
  g.fillRect(15, 9+bob, 1, 1);
  g.fillStyle(BLACK.mid, 1);  g.fillRect(8, 12+bob, 1, 1);
  g.fillStyle(ORANGE.mid, 1); g.fillRect(16, 13+bob, 1, 1);

  g.layer('neck');
  // Neck stretches forward and DOWN toward the food (dip lowers it further than idle).
  g.fillStyle(WHITE.mid, 1); g.fillRect(15, 9+dip+bob, 4, 6-dip);
  g.fillStyle(WHITE.hi, 1);  g.fillRect(15, 14+bob, 4, 1);

  g.layer('head');
  // Head drops to the pile, tipped down and forward.
  const hy = 5 + dip;
  g.fillStyle(WHITE.mid, 1); g.fillRect(15, hy+bob, 7, 5);
  g.fillStyle(WHITE.hi, 1);  g.fillRect(16, hy+bob, 5, 1);
  g.layer('ears');
  g.fillStyle(ORANGE.mid, 1);
  g.fillRect(14, hy-1+bob, 3, 1); g.fillRect(14, hy-2+bob, 2, 1); g.fillRect(14, hy-3+bob, 1, 1);
  g.fillStyle(BLACK.mid, 1);
  g.fillRect(19, hy-1+bob, 3, 1); g.fillRect(20, hy-2+bob, 2, 1); g.fillRect(21, hy-3+bob, 1, 1);
  g.fillStyle(EAR, 1); g.fillRect(15, hy-2+bob, 1, 1); g.fillRect(20, hy-2+bob, 1, 1);
  g.fillStyle(ORANGE.mid, 1); g.fillRect(15, hy+bob, 3, 2);
  g.layer('eyes');
  // Eyes narrow/half-lidded (focused on the food, not alert) — a thinner strip than idle.
  g.fillStyle(EYE, 1);   g.fillRect(16, hy+1+bob, 2, 1); g.fillRect(19, hy+1+bob, 2, 1);
  g.fillStyle(PUPIL, 1); g.fillRect(17, hy+1+bob, 1, 1); g.fillRect(20, hy+1+bob, 1, 1);
  g.layer('nose');
  // Nose/mouth right down at pile level — the "eating" tell.
  g.fillStyle(NOSE, 1);     g.fillRect(20, hy+4+bob, 1, 1);
  g.fillStyle(BLACK.lo, 1); g.fillRect(19, hy+4+bob, 1, 1);
  g.fillStyle(0xffffff, 0.7);  g.fillRect(21, hy+3+bob, 1, 1);
  g.fillStyle(0xffffff, 0.4);  g.fillRect(21, hy+4+bob, 1, 1);
}

// Napping: a curled-up "loaf" pose — tucked paws, tail wrapped round, eyes shut.
// Used for the barn go-home fade (#90 catGoHome/catLeaveHome, dayNight.js) so the
// cat visibly settles in rather than just fading out mid-idle-pose. `breathe` gives
// a one-pixel torso rise/fall between the two frames (a slow sleeping breath).
function drawCatNap(g, breathe, look) {
  const ORANGE = look?.fur || DEFAULT_LOOK.fur;
  const dy = 6; // drop the whole pose toward the ground, like the horse sleep pose

  g.layer('tail');
  // Tail curls forward around the tucked paws.
  g.fillStyle(ORANGE.mid, 1);
  g.fillRect(3, 14+dy, 3, 3); g.fillRect(6, 15+dy, 4, 2); g.fillRect(10, 13+dy, 2, 3);
  g.fillStyle(BLACK.mid, 1); g.fillRect(6, 15+dy, 2, 1); g.fillRect(10, 14+dy, 2, 1);

  g.layer('body');
  // Low, rounded loaf — no legs visible (tucked under), back arches gently.
  g.fillStyle(WHITE.mid, 1);
  g.fillRect(5, 9+breathe+dy, 15, 7); g.fillEllipse(12, 9+breathe+dy, 15, 4);
  g.fillStyle(WHITE.hi, 1); g.fillEllipse(12, 8+breathe+dy, 13, 2);
  g.fillStyle(WHITE.lo, 1); g.fillRect(5, 15+dy, 15, 1);

  g.layer('patches');
  g.fillStyle(ORANGE.mid, 1);
  g.fillRect(5, 10+breathe+dy, 6, 5); g.fillRect(7, 8+breathe+dy, 3, 2);
  g.fillStyle(BLACK.mid, 1);
  g.fillRect(13, 9+breathe+dy, 6, 6); g.fillRect(14, 8+breathe+dy, 3, 1);
  g.fillStyle(WHITE.mid, 1); g.fillRect(11, 11+breathe+dy, 2, 3);

  g.layer('haunch');
  g.fillStyle(ORANGE.lo, 1); g.fillRect(4, 13+breathe+dy, 3, 2);

  g.layer('head');
  // Head tucked down onto the paws, eyes shut, ears relaxed to the side.
  g.fillStyle(WHITE.mid, 1); g.fillRect(17, 10+breathe+dy, 6, 5);
  g.fillStyle(WHITE.hi, 1);  g.fillRect(18, 10+breathe+dy, 4, 1);
  g.layer('ears');
  g.fillStyle(ORANGE.mid, 1); g.fillRect(17, 9+breathe+dy, 2, 1);
  g.fillStyle(BLACK.mid, 1);  g.fillRect(21, 9+breathe+dy, 2, 1);
  g.layer('eyes');
  // Closed eyes: a thin contented line, not the round open dots.
  g.fillStyle(BLACK.lo, 1); g.fillRect(19, 12+breathe+dy, 2, 1); g.fillRect(21, 12+breathe+dy, 1, 1);
  g.layer('nose');
  g.fillStyle(NOSE, 1); g.fillRect(22, 13+breathe+dy, 1, 1);
}

// Pounce: the fishing catch-attempt lunge (#198, catAI.js `_catFishAttempt`) — body
// stretched low and long toward the water, front legs reaching out, tail flagged up
// for balance, ears pinned back in concentration. A single one-shot frame (the scene
// tweens the sprite forward/back over it, so the *pose* just needs to read as
// "lunging", not animate internally).
function drawCatPounce(g, look) {
  const ORANGE = look?.fur || DEFAULT_LOOK.fur;
  const EYE = (look?.eyes || DEFAULT_LOOK.eyes).color;

  g.layer('legs');
  // Hind legs planted/coiled (push-off), fore legs stretched forward reaching.
  g.fillStyle(WHITE.lo, 1);  g.fillRect(3, 16, 2, 4); g.fillRect(20, 15, 2, 2);
  g.fillStyle(WHITE.mid, 1); g.fillRect(5, 16, 2, 4); g.fillRect(22, 15, 2, 2);
  g.fillStyle(0x6a5848, 1);  g.fillRect(2, 19, 4, 1); g.fillRect(21, 16, 4, 1); // paw pads

  g.layer('tail');
  // Flagged up high for balance mid-lunge.
  g.fillStyle(ORANGE.mid, 1);
  g.fillRect(2, 9, 3, 4); g.fillRect(2, 3, 2, 7); g.fillRect(1, 1, 2, 3);
  g.fillStyle(ORANGE.hi, 1); g.fillRect(2, 4, 1, 5);
  g.fillStyle(BLACK.mid, 1); g.fillRect(2, 6, 2, 1); g.fillRect(2, 9, 3, 1);

  g.layer('haunch');
  g.fillStyle(WHITE.mid, 1);  g.fillCircle(6, 12, 4);
  g.fillStyle(ORANGE.mid, 1); g.fillCircle(6, 12, 4);
  g.fillStyle(ORANGE.lo, 1);  g.fillCircle(6, 14, 3);

  g.layer('body');
  // Long, low, stretched-out silhouette — the whole spine flattens toward the water.
  g.fillStyle(WHITE.mid, 1); g.fillRect(4, 10, 17, 5); g.fillRect(6, 9, 14, 2);
  g.fillStyle(WHITE.hi, 1);  g.fillRect(6, 9, 14, 1);  g.fillRect(4, 10, 17, 1);
  g.fillStyle(WHITE.lo, 1);  g.fillRect(4, 14, 17, 1);

  g.layer('patches');
  g.fillStyle(ORANGE.mid, 1);
  g.fillRect(4, 9, 5, 5); g.fillRect(6, 7, 2, 2);
  g.fillStyle(BLACK.mid, 1);
  g.fillRect(11, 9, 6, 4); g.fillRect(12, 8, 3, 1);
  g.fillStyle(WHITE.mid, 1); g.fillRect(9, 12, 2, 2);

  g.layer('neck');
  // Neck stretched forward and low, reaching toward the water.
  g.fillStyle(WHITE.mid, 1); g.fillRect(18, 9, 5, 5);
  g.fillStyle(WHITE.hi, 1);  g.fillRect(18, 13, 5, 1);

  g.layer('head');
  // Head thrust forward and low, level with the stretched neck.
  g.fillStyle(WHITE.mid, 1); g.fillRect(19, 6, 7, 5);
  g.fillStyle(WHITE.hi, 1);  g.fillRect(20, 6, 5, 1);
  g.layer('ears');
  // Pinned flat back against the skull (concentration), not the alert upright triangles.
  g.fillStyle(ORANGE.mid, 1); g.fillRect(18, 5, 2, 1);
  g.fillStyle(BLACK.mid, 1);  g.fillRect(24, 5, 2, 1);
  g.fillStyle(ORANGE.mid, 1); g.fillRect(19, 6, 3, 2);
  g.layer('eyes');
  // Wide, fixed on the target.
  g.fillStyle(EYE, 1);   g.fillRect(20, 7, 2, 2); g.fillRect(23, 7, 2, 2);
  g.fillStyle(PUPIL, 1); g.fillRect(21, 7, 1, 2); g.fillRect(24, 7, 1, 2);
  g.layer('nose');
  g.fillStyle(NOSE, 1);     g.fillRect(25, 9, 1, 1);
  g.fillStyle(BLACK.lo, 1); g.fillRect(24, 9, 1, 1);
  g.fillStyle(0xffffff, 0.7); g.fillRect(26, 8, 1, 1);
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
  });

  // Eating (#198): head-down at a dropped fish pile, legs planted. Two frames give
  // a small head-bob "chew" between mouthfuls.
  const eatFrames = [
    { name: 'eat_0', legs: [0, 0, 0, 0], dip: 2 },
    { name: 'eat_1', legs: [0, 0, 0, 0], dip: 3 },  // dips a touch lower — the bob
  ];
  eatFrames.forEach(f => {
    gen(scene, `${key}_${f.name}`, CAT_W * ART_SCALE, CAT_H * ART_SCALE,
      g0 => drawCatEat(scaledGraphics(g0), 0, f.legs, f.dip, look));
  });

  // Napping (#198/#90): curled-up loaf pose for the barn go-home fade. Two frames
  // give a slow one-pixel breathing rise/fall.
  const napFrames = [
    { name: 'nap_0', breathe: 0 },
    { name: 'nap_1', breathe: 1 },
  ];
  napFrames.forEach(f => {
    gen(scene, `${key}_${f.name}`, CAT_W * ART_SCALE, CAT_H * ART_SCALE,
      g0 => drawCatNap(scaledGraphics(g0), f.breathe, look));
  });

  // Pounce (#198): a single one-shot lunge frame for the fishing catch attempt
  // (catAI.js `_catFishAttempt`) — low, stretched-forward body, ears back, tail
  // flagged up for balance. Reuses the walk leg-lift shape for a mid-lunge stride.
  gen(scene, `${key}_pounce_0`, CAT_W * ART_SCALE, CAT_H * ART_SCALE,
    g0 => drawCatPounce(scaledGraphics(g0), look));
}
