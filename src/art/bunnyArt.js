// Procedural pixel-art bunny (#224). Faces right, origin (0.5,1). A small, round
// cottontail: crouched body, big upright ears, a puffy white tail, tucked forepaws
// and folded haunches. Four coat colours (grey / white / brown / black) are pure
// palette swaps selected by `look.coat` (an id string) — the silhouette is identical,
// so the whole family shares one draw fn.
//
// Movement differentiator (the HOP): the walk cycle isn't a plodding leg-step like the
// other quadrupeds — it's a bounce. `hop` lifts the whole body off the ground and
// stretches it slightly, ears trailing back, forepaws reaching forward; the idle
// frames sit low with a tiny nose-wiggle. So a moving bunny visibly hops rather than
// walks, with no bespoke movement-engine code (creatures.js tweens the sprite between
// hop-pose frames as usual).
//
// Super-sampled on the ART_SCALE grid (spawn.superSampled) for HiDPI crispness — the
// draw fns receive a scaledGraphics wrapper, so coords stay in the small design grid.

import { gen, scaledGraphics, ART_SCALE } from './_frames.js';

export const BUNNY_W = 20, BUNNY_H = 20;

// Coat palettes: fur base tones + the inner-ear pink and eye colour. The tail always
// matches the bunny's own coat tones (mid/hi/lo — see drawBunny), and the belly/cheek
// reads a touch lighter than the base. Black/brown/grey get darker eyes; white reads
// pink-eyed like a classic domestic albino for charm.
//
// Two coats (blackWhite / brownWhite) are splotchy patterns: a white base plus an
// optional `spots` patch colour, hand-placed at fixed spots (see drawBunnyPatches) —
// same two-tone technique as the Holstein cow (cowArt.js). The four solid coats have
// no `spots` field, so they render exactly as before.
const COATS = {
  grey:  { mid: 0x9a9aa2, hi: 0xc2c2cb, lo: 0x6f6f78, ear: 0xe8a7ad, eye: 0x2b2b30, belly: 0xcfcfd6 },
  white: { mid: 0xf1eee9, hi: 0xffffff, lo: 0xd8d2c8, ear: 0xf2b3ba, eye: 0xb04a52, belly: 0xffffff },
  brown: { mid: 0xa9773f, hi: 0xc99a5f, lo: 0x7f5628, ear: 0xe1a49a, eye: 0x2a1c10, belly: 0xd9c0a0 },
  black: { mid: 0x3b3740, hi: 0x565059, lo: 0x241f27, ear: 0xd7969c, eye: 0x120f14, belly: 0x6a636e },
  // Splotchy black & white — white base, near-black patches (matches the solid
  // black coat's own mid tone), dark eyes. `patches`/`facePatches` (rects in the
  // unlifted 0-20 design grid, see drawBunnyPatches/drawBunnyFacePatches) are its
  // OWN distribution — deliberately different positions/shapes from brownWhite's
  // below, so the two splotchy coats don't read as the same pattern recolored
  // (2026-07-28 playtest fix).
  blackWhite: {
    mid: 0xf1eee9, hi: 0xffffff, lo: 0xd8d2c8, ear: 0xe8a7ad, eye: 0x1c1a20, belly: 0xffffff, spots: 0x3b3740,
    patches: [
      [12, 7, 3, 3], [14, 8, 3, 2], [13, 10, 2, 2],   // upper back/shoulder cluster
      [5, 15, 3, 2], [7, 16, 2, 1],                    // small far-haunch patch
    ],
    facePatches: [[14, 6, 2, 2], [15, 8, 2, 1]],       // ear-base/cheek, left side of the head
  },
  // Splotchy brown & white — white base, warm-brown patches (matches the solid
  // brown coat's own mid tone), brown eyes. Heavier coverage than blackWhite (a
  // 2026-07-28 owner playtest fix — real brown-and-white rabbits skew more brown
  // than white) and its own distinct patch distribution/face placement.
  brownWhite: {
    mid: 0xf1eee9, hi: 0xffffff, lo: 0xd8d2c8, ear: 0xe8a7ad, eye: 0x2a1c10, belly: 0xffffff, spots: 0xa9773f,
    patches: [
      [5, 10, 4, 4], [8, 9, 3, 3], [6, 14, 3, 2], [9, 13, 2, 3],  // big haunch cluster
      [9, 8, 3, 2], [11, 9, 2, 3], [10, 15, 3, 2], [7, 9, 2, 2],  // midback + extra coverage
    ],
    facePatches: [[18, 9, 2, 1], [15, 9, 1, 2]],       // muzzle/cheek side, opposite of blackWhite's
  },
};

const NOSE = 0xd76b76;

// Hand-placed patch shapes for the two splotchy coats' BODY/haunch, drawn on top
// of the body (mirrors the cow's Holstein patches: fixed positions, not random).
// No-op when the coat has no `spots` colour, so the four solid coats are
// unaffected. `lift` matches drawBunny's hop offset (0 for the eat pose, which
// never hops). Each patch is a cluster of small offset rects rather than one
// smooth ellipse — a jagged, hand-torn silhouette instead of a clean geometric
// shape (2026-07-28 playtest fix). The actual rect list lives per-coat in
// `COATS[id].patches`, so blackWhite/brownWhite each get their own distribution.
function drawBunnyPatches(g, lift, C) {
  if (!C.spots || !C.patches) return;
  g.layer('spots');
  g.fillStyle(C.spots, 1);
  for (const [x, y, w, h] of C.patches) g.fillRect(x, y - lift, w, h);
}

// Small patch(es) of the coat's spot colour on the FACE/head (not just the body)
// — `COATS[id].facePatches`, drawn after the head circle so they read as
// markings on the head, but before the eye/nose so those stay legible on top.
function drawBunnyFacePatches(g, lift, C) {
  if (!C.spots || !C.facePatches) return;
  g.layer('facePatch');
  g.fillStyle(C.spots, 1);
  for (const [x, y, w, h] of C.facePatches) g.fillRect(x, y - lift, w, h);
}

// Resolve a coat from a `look` — look.coat is a colour id ('grey'…). Falls back to
// grey (the first coat) for an unset/stale look so the art never blanks.
function palette(look) {
  return COATS[look?.coat] ?? COATS.grey;
}

// Idle / hop pose. `bob` is a tiny idle nose/ear wiggle; `hop` (0 = grounded, >0 =
// airborne) lifts the whole body and reshapes the pose into a mid-bounce stretch.
// `noseWiggle` nudges just the nose for the idle twitch.
function drawBunny(g, bob, hop, noseWiggle, look) {
  const C = palette(look);
  const lift = hop;               // how far off the ground the whole body sits
  const stretch = hop > 0 ? 1 : 0; // body/ears lengthen a touch mid-hop

  // ── Hind legs / feet ── long bunny feet planted flat when grounded, tucked up and
  // back mid-hop. Drawn first so the body overlaps them.
  g.layer('legs');
  if (hop > 0) {
    // Airborne: hind feet kick up behind, forepaws reach forward.
    g.fillStyle(C.lo, 1);
    g.fillRect(3, 15 - lift, 4, 2);          // hind foot tucked back
    g.fillStyle(C.mid, 1);
    g.fillRect(14, 16 - lift, 3, 2);         // fore paw reaching down/forward
  } else {
    g.fillStyle(C.lo, 1);
    g.fillRect(3, 17, 6, 2);                 // long hind foot flat on the ground
    g.fillStyle(C.mid, 1);
    g.fillRect(13, 17, 3, 2);                // fore paw
  }

  // ── Cotton tail ── a round puff at the rear, in the bunny's own coat tones.
  g.layer('tail');
  g.fillStyle(C.mid, 1); g.fillCircle(3, 12 - lift, 2.6);
  g.fillStyle(C.hi, 1);  g.fillCircle(2.2, 11 - lift, 1.2);
  g.fillStyle(C.lo, 1);  g.fillCircle(3.5, 13 - lift, 1);

  // ── Haunch ── big rounded rear thigh (the bunny's crouched-power silhouette).
  g.layer('haunch');
  g.fillStyle(C.mid, 1); g.fillCircle(7, 12 - lift, 4.5);
  g.fillStyle(C.lo, 1);  g.fillCircle(7, 14 - lift, 3.5);
  g.fillStyle(C.hi, 1);  g.fillCircle(6, 10 - lift, 2);

  // ── Body ── low, rounded loaf; stretches forward a touch mid-hop.
  g.layer('body');
  g.fillStyle(C.mid, 1); g.fillEllipse(11, 12 - lift, 12 + stretch, 8);
  g.fillStyle(C.hi, 1);  g.fillEllipse(11, 10 - lift, 9, 3);      // sunlit back
  g.fillStyle(C.belly, 1); g.fillEllipse(11, 15 - lift, 8, 2);   // pale belly

  // ── Splotches (blackWhite/brownWhite only) ── hand-placed patches over the
  // haunch/back, drawn on top of body so they read as markings on the coat.
  drawBunnyPatches(g, lift, C);

  // ── Neck/chest ── blends the body up into the head.
  g.layer('neck');
  g.fillStyle(C.mid, 1); g.fillRect(14, 8 - lift, 4, 6);
  g.fillStyle(C.belly, 1); g.fillRect(14, 13 - lift, 4, 1);      // chest

  // ── Head ── small round head set high and forward.
  g.layer('head');
  g.fillStyle(C.mid, 1); g.fillCircle(17, 8 - lift, 3.4);
  g.fillStyle(C.hi, 1);  g.fillCircle(16, 6 - lift, 1.6);        // brow highlight
  drawBunnyFacePatches(g, lift, C);  // splotchy coats only — markings on the face too

  // ── Ears ── two tall upright ears; trail back a little mid-hop.
  g.layer('ears');
  const earBack = stretch; // ears lay back when airborne
  g.fillStyle(C.mid, 1);
  g.fillRect(16 - earBack, 1 - lift, 2, 5);                       // far ear
  g.fillRect(18 - earBack, 0 - lift, 2, 6 + stretch);            // near ear
  g.fillStyle(C.ear, 1);
  g.fillRect(18 - earBack, 1 - lift, 1, 4 + stretch);           // inner-ear pink
  g.fillStyle(C.hi, 1);
  g.fillRect(16 - earBack, 1 - lift, 1, 2);                      // far-ear rim light

  // ── Eye ── one big forward eye with a catchlight.
  g.layer('eye');
  g.fillStyle(C.eye, 1);      g.fillRect(17, 7 - lift, 2, 2);
  g.fillStyle(0xffffff, 0.9); g.fillRect(17, 7 - lift, 1, 1);

  // ── Nose / muzzle ── tiny pink nose that twitches on the idle wiggle.
  g.layer('nose');
  g.fillStyle(NOSE, 1);      g.fillRect(20, 8 - lift + noseWiggle, 1, 1);
  g.fillStyle(C.belly, 1);   g.fillRect(19, 9 - lift, 1, 1);      // pale chin
  // Whisker hint
  g.fillStyle(0xffffff, 0.4); g.fillRect(21, 8 - lift + noseWiggle, 1, 1);
}

// Eating: the bunny drops its head and nibbles at a dropped pile — body low and
// settled, ears forward, nose right down at ground level. Two frames give a small
// nibble bob. `dip` lowers the head/neck toward the food.
function drawBunnyEat(g, bob, dip, look) {
  const C = palette(look);

  g.layer('legs');
  g.fillStyle(C.lo, 1);  g.fillRect(3, 17, 6, 2);
  g.fillStyle(C.mid, 1); g.fillRect(13, 17, 3, 2);

  g.layer('tail');
  g.fillStyle(C.mid, 1); g.fillCircle(3, 12, 2.6);
  g.fillStyle(C.hi, 1);  g.fillCircle(2.2, 11, 1.2);

  g.layer('haunch');
  g.fillStyle(C.mid, 1); g.fillCircle(7, 12, 4.5);
  g.fillStyle(C.lo, 1);  g.fillCircle(7, 14, 3.5);

  g.layer('body');
  g.fillStyle(C.mid, 1); g.fillEllipse(11, 12, 12, 8);
  g.fillStyle(C.hi, 1);  g.fillEllipse(11, 10, 9, 3);
  g.fillStyle(C.belly, 1); g.fillEllipse(11, 15, 8, 2);

  // ── Splotches (blackWhite/brownWhite only) ── same fixed patches as the idle pose.
  drawBunnyPatches(g, 0, C);

  g.layer('neck');
  // Neck stretches forward and DOWN toward the food.
  g.fillStyle(C.mid, 1); g.fillRect(14, 9 + dip, 4, 5 - dip);

  g.layer('head');
  // Head tipped down to the pile.
  const hy = 9 + dip + bob;
  g.fillStyle(C.mid, 1); g.fillCircle(17, hy, 3.4);
  g.fillStyle(C.hi, 1);  g.fillCircle(16, hy - 2, 1.4);
  drawBunnyFacePatches(g, 8 - hy, C); // face patches are drawn relative to head y=8 in the idle pose

  g.layer('ears');
  // Ears tip forward over the head while nibbling.
  g.fillStyle(C.mid, 1);
  g.fillRect(15, hy - 5, 2, 5); g.fillRect(17, hy - 5, 2, 5);
  g.fillStyle(C.ear, 1); g.fillRect(17, hy - 4, 1, 3);

  g.layer('eye');
  // Eye half-lidded, focused on the food.
  g.fillStyle(C.eye, 1); g.fillRect(17, hy - 1, 2, 1);

  g.layer('nose');
  g.fillStyle(NOSE, 1);    g.fillRect(20, hy + 2, 1, 1);
  g.fillStyle(C.belly, 1); g.fillRect(19, hy + 2, 1, 1);
}

// Build every frame set for one bunny key from its coat `look` ({ coat: 'grey' }).
// idle_0/1 sit grounded with a tiny nose/ear wiggle; walk_0..3 are the hop cycle
// (grounded → airborne → grounded → airborne) so the tween between them reads as a
// bounce; eat_0/1 give a head-down nibble bob.
export function buildBunnyTextures(scene, key, look) {
  const frames = [
    { name: 'idle_0', bob: 0, hop: 0, wiggle: 0 },
    { name: 'idle_1', bob: 0, hop: 0, wiggle: 1 }, // nose twitch
    { name: 'walk_0', bob: 0, hop: 0, wiggle: 0 }, // touch down
    { name: 'walk_1', bob: 0, hop: 3, wiggle: 0 }, // mid-hop (airborne)
    { name: 'walk_2', bob: 0, hop: 0, wiggle: 0 }, // touch down
    { name: 'walk_3', bob: 0, hop: 4, wiggle: 0 }, // peak hop
  ];
  frames.forEach(f => {
    gen(scene, `${key}_${f.name}`, BUNNY_W * ART_SCALE, BUNNY_H * ART_SCALE,
      g0 => drawBunny(scaledGraphics(g0), f.bob, f.hop, f.wiggle, look));
  });

  // Eating: head-down nibble at a dropped bunny-food/water pile (the shared grazing
  // primitive plays eat_<key>). Two frames give a small nibble bob.
  const eatFrames = [
    { name: 'eat_0', bob: 0, dip: 2 },
    { name: 'eat_1', bob: 1, dip: 3 },
  ];
  eatFrames.forEach(f => {
    gen(scene, `${key}_${f.name}`, BUNNY_W * ART_SCALE, BUNNY_H * ART_SCALE,
      g0 => drawBunnyEat(scaledGraphics(g0), f.bob, f.dip, look));
  });
}
