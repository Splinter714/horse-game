// Procedural pixel-art duck (#275). Faces right, origin (0.5,1). A small, round
// waterfowl: a plump oval body, a curved neck, a rounded head with a flat bill, and
// stubby webbed feet. One coat for now ('mallard' — the classic green-headed drake
// look with a chestnut chest band), factored out so a future hen/pied morph is a pure
// swatch swap later, like the fox's coat table.
//
// Movement: a WADDLE on land — a short side-to-side body rock (no big leg-lift like
// the fox/bunny; ducks waddle low and stubby-legged) — and a doggy-paddle-style SWIM
// pose in the water (reusing the generic stream-swim primitive, ../data/species/
// swim.js / paddock/charm.js animalGoSwim), mirroring the dog's `${key}_swim_0/1`
// frames but drawn duck-shaped: body riding low and flat, head+bill up, a little wake
// trailing behind instead of paddling legs (a duck floats, it doesn't dog-paddle with
// visible legs).
//
// Two coats (#409): 'mallard', the classic green-headed drake, and 'hen', a plainer
// mottled-brown female — palette swaps only, same silhouette/frames, mirroring the
// rooster/hen coat split.
//
// Super-sampled on the ART_SCALE grid (spawn.superSampled) for HiDPI crispness — the
// draw fns receive a scaledGraphics wrapper, so coords stay in the small design grid.

import { gen, scaledGraphics, ART_SCALE } from './_frames.js';

export const DUCK_W = 24, DUCK_H = 20;

// Coat palette. `mallard` is the drake (male) colouring — the iridescent green head,
// white neck ring, chestnut chest, grey-brown body, and the bright orange bill/feet.
// `hen` (#409, the second duck) is the plainer mottled-brown female mallard look: no
// green head or white ring — just warm mottled brown all over with a darker eye-stripe
// and a duller olive bill — same silhouette/frames, palette-only swap, exactly like the
// rooster/hen coat split.
const COATS = {
  mallard: {
    head:    0x2f6b46, // iridescent green head
    headHi:  0x4a9464, // sunlit green
    ring:    0xf3ede2, // white neck ring
    chest:   0x7a4a2e, // chestnut chest band
    body:    0x8a8478, // grey-brown body
    bodyHi:  0xa8a294, // sunlit back
    bodyLo:  0x625d53, // shaded underside
    tail:    0x3a362f, // dark tail feathers
    bill:    0xd8a020, // orange-yellow bill
    billLo:  0xb2820f, // bill shade
    feet:    0xd8a020, // webbed feet
    eye:     0x1a1410, // dark eye
  },
  hen: {
    head:    0x8a6a3c, // mottled brown head — no iridescent green
    headHi:  0xa8875a, // sunlit brown
    ring:    0x8a6a3c, // no white collar — same as head, reads as unbroken brown
    chest:   0x9c8156, // warm buff chest, softer than the drake's chestnut band
    body:    0x7a6a4c, // mottled brown-tan body
    bodyHi:  0x9c8c68, // sunlit back
    bodyLo:  0x564a34, // shaded underside
    tail:    0x3e3524, // dark tail feathers
    bill:    0xb2822e, // duller olive-orange bill (no bright drake yellow)
    billLo:  0x8c6420, // bill shade
    feet:    0xb2822e, // webbed feet
    eye:     0x1a1410, // dark eye
  },
};

function palette(look) {
  return COATS[look?.coat] ?? COATS.mallard;
}

// One waddle/idle pose. `bob` is a tiny idle body bob; `rock` sways the whole body a
// touch left/right for the waddle (a duck's signature side-to-side gait — no leg-lift
// like a quadruped's walk cycle, just a body rock over stubby feet).
function drawDuck(g, bob, rock, look) {
  const C = palette(look);
  const y = -bob;    // whole body bobs up on odd frames
  const rx = rock;   // horizontal rock offset (waddle sway)

  // ── Feet ── short webbed feet, planted, peeking out beneath the body.
  g.layer('legs');
  g.fillStyle(C.feet, 1);
  g.fillRect(8 + rx,  16 + y, 3, 2);   // hind foot
  g.fillRect(15 - rx, 16 + y, 3, 2);   // fore foot

  // ── Tail ── short dark feathers at the rear, tipped up a touch.
  g.layer('tail');
  g.fillStyle(C.tail, 1); g.fillTriangle(2 + rx, 11 + y, 2 + rx, 15 + y, 7 + rx, 13 + y);

  // ── Body ── a plump oval, rocking side to side on the waddle.
  g.layer('body');
  g.fillStyle(C.bodyLo, 1); g.fillEllipse(12 + rx, 13 + y, 17, 9);
  g.fillStyle(C.body, 1);   g.fillEllipse(12 + rx, 11 + y, 17, 8);
  g.fillStyle(C.bodyHi, 1); g.fillEllipse(11 + rx, 8  + y, 12, 4); // sunlit back

  // ── Chest band ── the chestnut patch at the front of the body.
  g.layer('chest');
  g.fillStyle(C.chest, 1); g.fillEllipse(17 + rx, 12 + y, 6, 6);

  // ── Neck ── curved, blending body into head.
  g.layer('neck');
  g.fillStyle(C.head, 1); g.fillRect(18 + rx, 6 + y, 4, 7);

  // ── White neck ring ── the mallard's signature collar.
  g.layer('ring');
  g.fillStyle(C.ring, 1); g.fillRect(18 + rx, 10 + y, 4, 1.5);

  // ── Head ── a rounded head, iridescent green.
  g.layer('head');
  g.fillStyle(C.head, 1);   g.fillCircle(21 + rx, 5 + y, 3.6);
  g.fillStyle(C.headHi, 1); g.fillCircle(20 + rx, 3 + y, 1.6); // sunlit crown

  // ── Eye ── one small dark eye.
  g.layer('eye');
  g.fillStyle(C.eye, 1);      g.fillRect(22 + rx, 4 + y, 1.5, 1.5);
  g.fillStyle(0xffffff, 0.8); g.fillRect(22 + rx, 4 + y, 1, 1);

  // ── Bill ── the flat, wide duck bill.
  g.layer('bill');
  g.fillStyle(C.bill, 1);   g.fillTriangle(23.5 + rx, 4 + y, 23.5 + rx, 7 + y, 28 + rx, 5.5 + y);
  g.fillStyle(C.billLo, 1); g.fillRect(23.5 + rx, 6 + y, 4.5, 1);
}

// Eating: the duck dips its head down and forward to peck at a dropped duck-food pile
// — neck stretched low, bill at ground level. Two frames give a small peck bob.
// `dip` lowers the head/bill toward the food.
function drawDuckEat(g, bob, dip, look) {
  const C = palette(look);

  g.layer('legs');
  g.fillStyle(C.feet, 1);
  g.fillRect(8, 16, 3, 2); g.fillRect(15, 16, 3, 2);

  g.layer('tail');
  g.fillStyle(C.tail, 1); g.fillTriangle(2, 12, 2, 16, 7, 14);

  g.layer('body');
  g.fillStyle(C.bodyLo, 1); g.fillEllipse(12, 13, 17, 9);
  g.fillStyle(C.body, 1);   g.fillEllipse(12, 11, 17, 8);
  g.fillStyle(C.bodyHi, 1); g.fillEllipse(11, 8, 12, 4);

  g.layer('chest');
  g.fillStyle(C.chest, 1); g.fillEllipse(17, 12, 6, 6);

  g.layer('neck');
  // Neck stretches forward and DOWN toward the food.
  g.fillStyle(C.head, 1); g.fillRect(17, 8 + dip, 5, 6 - dip);

  g.layer('head');
  const hy = 8 + dip + bob;
  g.fillStyle(C.head, 1);   g.fillCircle(21, hy, 3.6);
  g.fillStyle(C.headHi, 1); g.fillCircle(20, hy - 2, 1.4);

  g.layer('eye');
  g.fillStyle(C.eye, 1); g.fillRect(22, hy, 1.5, 1);

  g.layer('bill');
  g.fillStyle(C.bill, 1);   g.fillTriangle(23.5, hy, 23.5, hy + 3, 28, hy + 1.5);
  g.fillStyle(C.billLo, 1); g.fillRect(23.5, hy + 2, 4.5, 1);
}

// Swimming: the duck floats low on the water — body riding flat and shallow (belly/
// feet hidden below the surface), neck upright, head+bill held up above the waterline.
// A little wake trails behind rather than visible paddling legs (a duck floats; its
// feet paddle unseen underwater). `kick` gives a tiny bob + wake ripple alternation for
// a lazy two-frame float, mirroring the dog's swim-frame shape but duck-appropriate.
function drawDuckSwim(g, kick, look) {
  const C = palette(look);
  const dy = 5; // drop the whole pose toward the waterline, below the standing pose
  const bob = kick ? 1 : 0;

  g.layer('wake');
  // Little wake ripple trailing behind, alternating with the kick.
  g.fillStyle(0xeaf7ff, 0.85);
  if (kick) { g.fillRect(1, 15 + dy, 4, 1); g.fillRect(3, 13 + dy, 3, 1); }
  else      { g.fillRect(2, 14 + dy, 4, 1); g.fillRect(4, 16 + dy, 3, 1); }

  g.layer('tail');
  // Tail trails flat on the surface behind, just clear of the water.
  g.fillStyle(C.tail, 1); g.fillTriangle(5, 10 + dy - bob, 5, 13 + dy - bob, 9, 12 + dy - bob);

  g.layer('body');
  // Body riding low and flat — shallower silhouette than standing, no legs/feet
  // visible, top half catching the light.
  g.fillStyle(C.bodyLo, 1); g.fillEllipse(13, 13 + dy - bob, 16, 6);
  g.fillStyle(C.body, 1);   g.fillEllipse(13, 11 + dy - bob, 16, 5);
  g.fillStyle(C.bodyHi, 1); g.fillEllipse(12, 9  + dy - bob, 11, 2);

  g.layer('chest');
  g.fillStyle(C.chest, 1); g.fillEllipse(18, 12 + dy - bob, 5, 4);

  g.layer('neck');
  // Neck held upright, clear of the water.
  g.fillStyle(C.head, 1); g.fillRect(19, 5 + dy - bob, 4, 7);

  g.layer('ring');
  g.fillStyle(C.ring, 1); g.fillRect(19, 10 + dy - bob, 4, 1.5);

  g.layer('head');
  g.fillStyle(C.head, 1);   g.fillCircle(22, 4 + dy - bob, 3.4);
  g.fillStyle(C.headHi, 1); g.fillCircle(21, 2 + dy - bob, 1.5);

  g.layer('eye');
  g.fillStyle(C.eye, 1);      g.fillRect(23, 3 + dy - bob, 1.4, 1.4);
  g.fillStyle(0xffffff, 0.8); g.fillRect(23, 3 + dy - bob, 1, 1);

  g.layer('bill');
  g.fillStyle(C.bill, 1);   g.fillTriangle(24.4, 3.5 + dy - bob, 24.4, 6 + dy - bob, 28.5, 4.5 + dy - bob);
  g.fillStyle(C.billLo, 1); g.fillRect(24.4, 5.2 + dy - bob, 4.1, 0.8);
}

// Build every frame set for one duck key from its coat `look` ({ coat: 'mallard' }).
// idle_0/1 stand with a small bob; walk_0..3 are the waddle cycle (a body rock left/
// right, no leg-lift) so the tween reads as a waddle, not a trot; eat_0/1 give a
// head-down peck bob; swim_0/1 are the floating stream-swim pose (#231/#275).
export function buildDuckTextures(scene, key, look = { coat: 'mallard' }) {
  const ROCK = 1.5; // waddle sway amount
  const frames = [
    { name: 'idle_0', bob: 0, rock: 0 },
    { name: 'idle_1', bob: 1, rock: 0 }, // gentle breathing bob
    { name: 'walk_0', bob: 0, rock: -ROCK }, // rock left
    { name: 'walk_1', bob: 1, rock: 0 },     // upright, mid-step
    { name: 'walk_2', bob: 0, rock: ROCK },  // rock right
    { name: 'walk_3', bob: 1, rock: 0 },     // upright, mid-step
  ];
  frames.forEach(f => {
    gen(scene, `${key}_${f.name}`, DUCK_W * ART_SCALE, DUCK_H * ART_SCALE,
      g0 => drawDuck(scaledGraphics(g0), f.bob, f.rock, look));
  });

  // Eating: head-down peck at a dropped duck-food pile (the shared grazing primitive
  // plays eat_<key>). Two frames give a small peck bob.
  const eatFrames = [
    { name: 'eat_0', bob: 0, dip: 2 },
    { name: 'eat_1', bob: 1, dip: 3 },
  ];
  eatFrames.forEach(f => {
    gen(scene, `${key}_${f.name}`, DUCK_W * ART_SCALE, DUCK_H * ART_SCALE,
      g0 => drawDuckEat(scaledGraphics(g0), f.bob, f.dip, look));
  });

  // Stream swim (#231/#275): only the duck (+ dog) have dedicated swim_0/1 frames —
  // gated on by texture existence in creatures.js, same pattern as the dog's.
  ['swim_0', 'swim_1'].forEach((name, i) => {
    gen(scene, `${key}_${name}`, DUCK_W * ART_SCALE, DUCK_H * ART_SCALE,
      g0 => drawDuckSwim(scaledGraphics(g0), i === 1, look));
  });
}
