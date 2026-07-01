// Procedural pixel-art cow (Holstein). Faces right, origin (0.5,1). Currently
// disabled in the paddock (see creatures.js buildAnimals) but kept ready to enable;
// shares the frame/leg helpers in _frames.js.
//
// Colours are data-driven (#165): the customizer passes a `look` of { coat, spots }
// palettes. An arg-less call falls back to DEFAULT_LOOK (the original Holstein), so
// BootScene and the art-preview gallery render the cow unchanged.

import { gen, scaledGraphics, ART_SCALE, makeLeg, idleWalkLegs, buildFrames } from './_frames.js';

export const COW_W = 56, COW_H = 40;

// Coat = the body/legs/neck/head base (hi/mid/shad + the two leg shin tones); spots =
// the Holstein patch colour (also the small coat-spot on two legs).
const DEFAULT_LOOK = {
  coat:  { hi: 0xffffff, mid: 0xf0ece4, shad: 0xe0dcd4, legFar: 0xdedacf, legNear: 0xf0ece4 },
  spots: { mid: 0x1a1818 },
};

const cowLeg = makeLeg({ topY: 27, w: 5, h: 11, hoofColor: 0x2a2020, hoofY: 38 });

// A leg that matches the coat: white shin (shaded far/near), dark hoof, and a small
// coat-spot near the top. The spot sits in the non-lifted upper region so it stays put
// as a stepping leg shortens. Spotting two legs reads as patchy Holstein.
function cowLegSpotted(g, x, lift, tone, bob, spot, spotColor) {
  cowLeg(g, x, lift, tone, bob);
  if (spot) { g.fillStyle(spotColor, 1); g.fillRect(x, 28 + bob, 4, 4); }
}

function drawCow(g, bob, [lhf, lhn, lff, lfn], look) {
  const coat = look?.coat || DEFAULT_LOOK.coat;
  const SPOT = (look?.spots || DEFAULT_LOOK.spots).mid;
  const { hi, mid, shad, legFar, legNear } = coat;

  g.layer('legs');
  cowLegSpotted(g, 6,  lhf, legFar,  bob, true,  SPOT); cowLegSpotted(g, 33, lff, legFar,  bob, false, SPOT);
  cowLegSpotted(g, 11, lhn, legNear, bob, false, SPOT); cowLegSpotted(g, 37, lfn, legNear, bob, true,  SPOT);

  g.layer('tail');
  // Tail with tuft
  g.fillStyle(0xb09080, 1); g.fillRect(3, 18+bob, 2, 8);
  g.fillStyle(0x3a3030, 1); g.fillRect(2, 25+bob, 3, 5);

  g.layer('udder');
  // Udder — a touch narrower and shifted back toward the rump
  g.fillStyle(0xf4b4b4, 1); g.fillRect(11, 28+bob, 13, 5);
  g.fillStyle(0xe89898, 1); g.fillRect(11, 31+bob, 13, 2);
  g.fillStyle(0xe08080, 1);
  // Teats centred on the visible belly span (the butt-side of the udder tucks behind
  // the rear leg), so they read as centred rather than skewed toward the rump.
  g.fillRect(16, 33+bob, 2, 2); g.fillRect(19, 33+bob, 2, 2); g.fillRect(22, 33+bob, 2, 2);

  g.layer('body');
  // Body — taller/deeper barrel
  g.fillStyle(mid, 1); g.fillRect(5, 12+bob, 38, 18);
  g.fillStyle(hi, 1); g.fillRect(5, 12+bob, 38, 3);
  g.fillStyle(shad, 1); g.fillRect(5, 27+bob, 38, 3);
  g.fillStyle(mid, 1); g.fillRect(4, 14+bob, 1, 12); // rump curve

  g.layer('spots');
  // Holstein patches
  g.fillStyle(SPOT, 1);
  g.fillRect(6,  13+bob, 12, 12);
  g.fillRect(31, 14+bob, 9,  11);
  g.fillRect(20, 19+bob, 6,  8);

  g.layer('neck');
  // Neck — a tapering wedge that rises from the shoulder up to the head, clearly
  // thinner than the barrel so it reads as a neck rather than more body.
  g.fillStyle(mid, 1);
  g.fillRect(39, 13+bob, 5, 14);   // shoulder end (deep)
  g.fillRect(43, 12+bob, 4, 13);   // mid
  g.fillRect(46, 11+bob, 4, 12);   // head end (shallower)
  g.fillStyle(hi, 1);              // crest highlight stepping up to the poll
  g.fillRect(39, 13+bob, 5, 2); g.fillRect(43, 12+bob, 4, 2); g.fillRect(46, 11+bob, 4, 2);
  g.fillStyle(shad, 1);            // throat/dewlap shade tucking up to the jaw
  g.fillRect(39, 25+bob, 5, 2); g.fillRect(43, 23+bob, 4, 2); g.fillRect(46, 21+bob, 4, 2);

  g.layer('head');
  // Head — long, lowered, forward-facing face set out at the end of the neck
  g.fillStyle(mid, 1); g.fillRect(47, 9+bob, 9, 14);
  g.fillStyle(hi, 1); g.fillRect(47, 9+bob, 9, 2);    // poll highlight

  // Holstein face patch across the poll/brow
  g.fillStyle(SPOT, 1); g.fillRect(47, 9+bob, 8, 4);

  g.layer('muzzle');
  // Muzzle — soft tan/pink snout
  g.fillStyle(0xf4c4a8, 1); g.fillRect(50, 16+bob, 6, 7);
  g.fillStyle(0xe0a888, 1); g.fillRect(50, 16+bob, 6, 1);   // muzzle top edge
  g.fillStyle(0xc88870, 1); g.fillRect(52, 19+bob, 1, 2); g.fillRect(54, 19+bob, 1, 2); // nostrils

  g.layer('horns');
  // Horns — small pair rising from the dark poll
  g.fillStyle(0xe8d8a0, 1); g.fillRect(48, 6+bob, 2, 3); g.fillRect(52, 6+bob, 2, 3);
  g.fillStyle(0xd8c488, 1); g.fillRect(48, 6+bob, 2, 1); g.fillRect(52, 6+bob, 2, 1);

  g.layer('ear');
  // Ear — set back at the side of the head
  g.fillStyle(mid, 1); g.fillRect(45, 10+bob, 3, 3);
  g.fillStyle(0xf4b0a0, 1); g.fillRect(45, 11+bob, 2, 2);

  g.layer('eye');
  // Eye — on the cheek just below the patch
  g.fillStyle(0x1a0e00, 1); g.fillRect(50, 14+bob, 2, 2);
  g.fillStyle(0xffffff, 0.85); g.fillRect(50, 14+bob, 1, 1);
}

// Cow eating/drinking: head/neck drop down to ground level so the muzzle reaches
// the grass, body/legs stay planted — mirrors the horse/foal eat pose treatment.
function drawCowEat(g, bob, look) {
  const coat = look?.coat || DEFAULT_LOOK.coat;
  const SPOT = (look?.spots || DEFAULT_LOOK.spots).mid;
  const { hi, mid, shad, legFar, legNear } = coat;

  g.layer('legs');
  cowLegSpotted(g, 6,  0, legFar,  bob, true,  SPOT); cowLegSpotted(g, 33, 0, legFar,  bob, false, SPOT);
  cowLegSpotted(g, 11, 0, legNear, bob, false, SPOT); cowLegSpotted(g, 37, 0, legNear, bob, true,  SPOT);

  g.layer('tail');
  g.fillStyle(0xb09080, 1); g.fillRect(3, 18+bob, 2, 8);
  g.fillStyle(0x3a3030, 1); g.fillRect(2, 25+bob, 3, 5);

  g.layer('udder');
  g.fillStyle(0xf4b4b4, 1); g.fillRect(11, 28+bob, 13, 5);
  g.fillStyle(0xe89898, 1); g.fillRect(11, 31+bob, 13, 2);
  g.fillStyle(0xe08080, 1);
  g.fillRect(16, 33+bob, 2, 2); g.fillRect(19, 33+bob, 2, 2); g.fillRect(22, 33+bob, 2, 2);

  g.layer('body');
  g.fillStyle(mid, 1); g.fillRect(5, 12+bob, 38, 18);
  g.fillStyle(hi, 1); g.fillRect(5, 12+bob, 38, 3);
  g.fillStyle(shad, 1); g.fillRect(5, 27+bob, 38, 3);
  g.fillStyle(mid, 1); g.fillRect(4, 14+bob, 1, 12); // rump curve

  g.layer('spots');
  g.fillStyle(SPOT, 1);
  g.fillRect(6,  13+bob, 12, 12);
  g.fillRect(31, 14+bob, 9,  11);
  g.fillRect(20, 19+bob, 6,  8);

  g.layer('neck');
  // Neck angled down from the shoulder toward the ground (head lowered to graze).
  g.fillStyle(mid, 1);
  g.fillRect(39, 16+bob, 5, 12);   // shoulder end
  g.fillRect(43, 20+bob, 4, 11);   // mid
  g.fillRect(46, 25+bob, 4, 8);    // head end
  g.fillStyle(hi, 1);
  g.fillRect(39, 16+bob, 5, 2); g.fillRect(43, 20+bob, 4, 2); g.fillRect(46, 25+bob, 4, 2);
  g.fillStyle(shad, 1);
  g.fillRect(39, 26+bob, 5, 2); g.fillRect(43, 29+bob, 4, 2);

  g.layer('head');
  // Head lowered — staggered steps down toward the ground, muzzle lowest.
  const headY = 25 + bob;
  g.fillStyle(mid, 1); g.fillRect(47, headY, 9, 8);
  g.fillStyle(hi, 1);  g.fillRect(47, headY, 9, 2);
  g.fillStyle(SPOT, 1); g.fillRect(47, headY, 8, 3); // Holstein face patch on the lowered poll

  g.layer('muzzle');
  g.fillStyle(0xf4c4a8, 1); g.fillRect(49, headY + 6, 6, 6);
  g.fillStyle(0xe0a888, 1); g.fillRect(49, headY + 6, 6, 1);
  g.fillStyle(0xc88870, 1); g.fillRect(51, headY + 9, 1, 2); g.fillRect(53, headY + 9, 1, 2);

  g.layer('horns');
  g.fillStyle(0xe8d8a0, 1); g.fillRect(48, headY - 3, 2, 3); g.fillRect(52, headY - 3, 2, 3);
  g.fillStyle(0xd8c488, 1); g.fillRect(48, headY - 3, 2, 1); g.fillRect(52, headY - 3, 2, 1);

  g.layer('ear');
  g.fillStyle(mid, 1); g.fillRect(45, headY + 1, 3, 3);
  g.fillStyle(0xf4b0a0, 1); g.fillRect(45, headY + 2, 2, 2);

  g.layer('eye');
  g.fillStyle(0x1a0e00, 1); g.fillRect(50, headY + 4, 2, 2);
  g.fillStyle(0xffffff, 0.85); g.fillRect(50, headY + 4, 1, 1);
}

export function buildCowTextures(scene, key, look) {
  buildFrames(scene, key, COW_W, COW_H, (g, bob, legs) => drawCow(g, bob, legs, look), idleWalkLegs(3));

  ['eat_0', 'eat_1'].forEach((name, i) => {
    gen(scene, `${key}_${name}`, COW_W * ART_SCALE, COW_H * ART_SCALE, g0 =>
      drawCowEat(scaledGraphics(g0), i, look));
  });
}
