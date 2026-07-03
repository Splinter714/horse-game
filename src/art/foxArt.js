// Procedural pixel-art fox (#266). Faces right, origin (0.5,1). A slim, low-slung
// canid: russet body, black stockings, a white chest/muzzle, tall triangular ears with
// black tips, and — the signature — a big BUSHY TAIL with a bright white tip that sweeps
// behind it. One coat for now ('red'); the palette is factored out so a silver/arctic
// morph is a pure swatch swap later, like the bunny's coats.
//
// Movement: a light-footed trot. The walk cycle is a standard 4-frame leg-lift (the two
// visible legs alternate) with a small body bob and the bushy tail lofting on the
// airborne beats, so a moving fox reads as trotting, not plodding — no bespoke movement
// code (creatures.js tweens between the frames as usual).
//
// Super-sampled on the ART_SCALE grid (spawn.superSampled) for HiDPI crispness — the
// draw fns receive a scaledGraphics wrapper, so coords stay in the small design grid.

import { gen, scaledGraphics, ART_SCALE } from './_frames.js';

export const FOX_W = 26, FOX_H = 22;

// Coat palette: russet fur tones, the black leg/ear/nose detail, the white chest/tail-tip,
// and the eye. Factored out so a future morph is a swatch swap (the silhouette is shared).
const COATS = {
  red: {
    mid:  0xd06a2a, // russet body
    hi:   0xe8934a, // sunlit back
    lo:   0xa8501c, // shaded underside
    dark: 0x2a1c14, // legs / ear tips / nose (near-black)
    white: 0xf3ede2, // chest, muzzle, tail tip
    whiteLo: 0xd9d0c0, // shaded white
    ear:  0xe8934a, // inner ear (warm)
    eye:  0x3a2416, // dark amber eye
  },
};

function palette(look) {
  return COATS[look?.coat] ?? COATS.red;
}

// One trot/idle pose. `bob` is a tiny vertical body bob; `legs` is the 4-tuple
// [hindFar, hindNear, foreFar, foreNear] lift amounts from the standard walk cycle;
// `tailLoft` sweeps the bushy tail up a touch on the airborne beats.
function drawFox(g, bob, legs, tailLoft, look) {
  const C = palette(look);
  const [hindFar, hindNear, foreFar, foreNear] = legs;
  const y = -bob; // whole body bobs up on odd frames

  // ── Legs ── slim black stockings; far pair first (drawn under the body), then the
  // near pair over it. Each leg lifts by its cycle amount.
  g.layer('legs');
  g.fillStyle(C.dark, 1);
  g.fillRect(7,  15 + y - hindFar, 2, 5 - hindFar);   // hind far
  g.fillRect(19, 15 + y - foreFar, 2, 5 - foreFar);   // fore far

  // ── Bushy tail ── the fox's signature: a fat russet plume sweeping back-and-down from
  // the rump, tipped bright white. Drawn before the body so the body overlaps its root.
  g.layer('tail');
  const ty = 10 + y - tailLoft;
  g.fillStyle(C.lo, 1);   g.fillEllipse(3,  ty + 2, 12, 8);   // underside shade
  g.fillStyle(C.mid, 1);  g.fillEllipse(3,  ty,     12, 8);   // main plume
  g.fillStyle(C.hi, 1);   g.fillEllipse(2,  ty - 2, 8,  4);   // sunlit top of plume
  g.fillStyle(C.white, 1);   g.fillCircle(-1, ty - 1, 3.2);   // white tip
  g.fillStyle(C.whiteLo, 1); g.fillCircle(-1, ty + 1, 1.8);   // tip shade

  // ── Body ── a low, lean loaf, longer than the bunny's.
  g.layer('body');
  g.fillStyle(C.mid, 1);   g.fillEllipse(13, 12 + y, 18, 9);
  g.fillStyle(C.hi, 1);    g.fillEllipse(13, 9  + y, 14, 4);  // sunlit back
  g.fillStyle(C.white, 1); g.fillEllipse(14, 15 + y, 11, 3);  // white chest/belly

  // ── Near legs ── over the body.
  g.layer('legs');
  g.fillStyle(C.dark, 1);
  g.fillRect(9,  15 + y - hindNear, 2, 5 - hindNear);  // hind near
  g.fillRect(21, 15 + y - foreNear, 2, 5 - foreNear);  // fore near

  // ── Neck / chest ── blends the body up into the head.
  g.layer('neck');
  g.fillStyle(C.mid, 1);   g.fillRect(19, 7 + y, 5, 6);
  g.fillStyle(C.white, 1); g.fillRect(19, 12 + y, 5, 2);      // white ruff down the chest

  // ── Head ── a small wedge set high and forward.
  g.layer('head');
  g.fillStyle(C.mid, 1); g.fillCircle(23, 7 + y, 3.6);
  g.fillStyle(C.hi, 1);  g.fillCircle(22, 5 + y, 1.6);        // brow highlight

  // ── Ears ── two tall triangular ears with black tips (the alert fox look).
  g.layer('ears');
  g.fillStyle(C.mid, 1);
  g.fillTriangle(20, 5 + y, 21, 0 + y, 23, 5 + y);           // far ear
  g.fillTriangle(23, 5 + y, 24.5, -0.5 + y, 26, 5 + y);      // near ear
  g.fillStyle(C.ear, 1);
  g.fillTriangle(21.5, 4 + y, 22, 1.5 + y, 23, 4 + y);       // inner (near) ear
  g.fillStyle(C.dark, 1);
  g.fillTriangle(20.5, 1.5 + y, 21, 0 + y, 21.5, 1.5 + y);   // far-ear black tip
  g.fillTriangle(24, 1 + y, 24.5, -0.5 + y, 25, 1 + y);      // near-ear black tip

  // ── Eye ── one forward almond eye with a catchlight.
  g.layer('eye');
  g.fillStyle(C.eye, 1);      g.fillRect(23, 6 + y, 2, 2);
  g.fillStyle(0xffffff, 0.9); g.fillRect(23, 6 + y, 1, 1);

  // ── Snout / muzzle ── a slim pointed muzzle, white underside, black nose tip.
  g.layer('snout');
  g.fillStyle(C.mid, 1);   g.fillTriangle(25, 6 + y, 25, 9 + y, 30, 8 + y); // russet top
  g.fillStyle(C.white, 1); g.fillTriangle(25, 8 + y, 25, 10 + y, 29, 9 + y); // white lower
  g.fillStyle(C.dark, 1);  g.fillRect(29, 7.5 + y, 1.5, 1.5);               // nose tip
}

// Eating: the fox drops its head and gnaws at a dropped fox-food pile — body settled low,
// front legs planted, nose right down at ground level. Two frames give a small gnaw bob.
// `dip` lowers the head/muzzle toward the food.
function drawFoxEat(g, bob, dip, look) {
  const C = palette(look);

  g.layer('legs');
  g.fillStyle(C.dark, 1);
  g.fillRect(7, 15, 2, 5); g.fillRect(9, 15, 2, 5);   // hind pair planted
  g.fillRect(19, 15, 2, 5); g.fillRect(21, 15, 2, 5); // fore pair planted

  g.layer('tail');
  g.fillStyle(C.lo, 1);   g.fillEllipse(3, 12, 12, 8);
  g.fillStyle(C.mid, 1);  g.fillEllipse(3, 10, 12, 8);
  g.fillStyle(C.hi, 1);   g.fillEllipse(2, 8,  8,  4);
  g.fillStyle(C.white, 1); g.fillCircle(-1, 9, 3.2);

  g.layer('body');
  g.fillStyle(C.mid, 1);   g.fillEllipse(13, 12, 18, 9);
  g.fillStyle(C.hi, 1);    g.fillEllipse(13, 9,  14, 4);
  g.fillStyle(C.white, 1); g.fillEllipse(14, 15, 11, 3);

  g.layer('neck');
  // Neck stretches forward and DOWN toward the food.
  g.fillStyle(C.mid, 1); g.fillRect(19, 9 + dip, 5, 5 - dip);

  g.layer('head');
  const hy = 9 + dip + bob;
  g.fillStyle(C.mid, 1); g.fillCircle(23, hy, 3.6);
  g.fillStyle(C.hi, 1);  g.fillCircle(22, hy - 2, 1.4);

  g.layer('ears');
  // Ears tip forward over the head while gnawing.
  g.fillStyle(C.mid, 1);
  g.fillTriangle(20, hy - 1, 21, hy - 5, 23, hy - 1);
  g.fillTriangle(23, hy - 1, 24.5, hy - 5.5, 26, hy - 1);
  g.fillStyle(C.dark, 1);
  g.fillTriangle(20.5, hy - 4, 21, hy - 5, 21.5, hy - 4);
  g.fillTriangle(24, hy - 4.5, 24.5, hy - 5.5, 25, hy - 4.5);

  g.layer('eye');
  // Eye half-lidded, focused on the food.
  g.fillStyle(C.eye, 1); g.fillRect(23, hy, 2, 1);

  g.layer('snout');
  g.fillStyle(C.mid, 1);   g.fillTriangle(25, hy, 25, hy + 3, 30, hy + 2);
  g.fillStyle(C.white, 1); g.fillTriangle(25, hy + 2, 25, hy + 4, 29, hy + 3);
  g.fillStyle(C.dark, 1);  g.fillRect(29, hy + 1.5, 1.5, 1.5);
}

// Build every frame set for one fox key from its coat `look` ({ coat: 'red' }). idle_0/1
// stand with a small bob; walk_0..3 are the trot cycle (planted / lifted / planted /
// lifted) so the tween reads as a light trot; eat_0/1 give a head-down gnaw bob.
export function buildFoxTextures(scene, key, look = { coat: 'red' }) {
  // [hindFar, hindNear, foreFar, foreNear] lift amounts + the tail loft per frame.
  const LIFT = 2;
  const frames = [
    { name: 'idle_0', bob: 0, legs: [0, 0, 0, 0],       tail: 0 },
    { name: 'idle_1', bob: 1, legs: [0, 0, 0, 0],       tail: 1 }, // gentle breathing bob
    { name: 'walk_0', bob: 0, legs: [0, 0, 0, 0],       tail: 0 }, // planted
    { name: 'walk_1', bob: 1, legs: [LIFT, 0, 0, LIFT], tail: 2 }, // diagonal step (airborne)
    { name: 'walk_2', bob: 0, legs: [0, 0, 0, 0],       tail: 0 }, // planted
    { name: 'walk_3', bob: 1, legs: [0, LIFT, LIFT, 0], tail: 2 }, // opposite diagonal step
  ];
  frames.forEach(f => {
    gen(scene, `${key}_${f.name}`, FOX_W * ART_SCALE, FOX_H * ART_SCALE,
      g0 => drawFox(scaledGraphics(g0), f.bob, f.legs, f.tail, look));
  });

  // Eating: head-down gnaw at a dropped fox-food pile (the shared grazing primitive
  // plays eat_<key>). Two frames give a small gnaw bob.
  const eatFrames = [
    { name: 'eat_0', bob: 0, dip: 2 },
    { name: 'eat_1', bob: 1, dip: 3 },
  ];
  eatFrames.forEach(f => {
    gen(scene, `${key}_${f.name}`, FOX_W * ART_SCALE, FOX_H * ART_SCALE,
      g0 => drawFoxEat(scaledGraphics(g0), f.bob, f.dip, look));
  });
}
