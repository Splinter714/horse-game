// Procedural pixel-art cow (Holstein). Faces right, origin (0.5,1). Currently
// disabled in the paddock (see creatures.js buildAnimals) but kept ready to enable;
// shares the frame/leg helpers in _frames.js.

import { makeLeg, idleWalkLegs, buildFrames } from './_frames.js';

export const COW_W = 56, COW_H = 40;

const cowLeg = makeLeg({ topY: 27, w: 5, h: 11, hoofColor: 0x2a2020, hoofY: 38 });

// A leg that matches the coat: white shin (shaded far/near), dark hoof, and a small
// black coat-spot near the top. The spot sits in the non-lifted upper region so it
// stays put as a stepping leg shortens. Spotting two legs reads as patchy Holstein.
function cowLegSpotted(g, x, lift, tone, bob, spot) {
  cowLeg(g, x, lift, tone, bob);
  if (spot) { g.fillStyle(0x1a1818, 1); g.fillRect(x, 28 + bob, 4, 4); }
}

function drawCow(g, bob, [lhf, lhn, lff, lfn]) {
  cowLegSpotted(g, 6,  lhf, 0xdedacf, bob, true);  cowLegSpotted(g, 33, lff, 0xdedacf, bob, false);
  cowLegSpotted(g, 11, lhn, 0xf0ece4, bob, false); cowLegSpotted(g, 37, lfn, 0xf0ece4, bob, true);

  // Tail with tuft
  g.fillStyle(0xb09080, 1); g.fillRect(3, 18+bob, 2, 8);
  g.fillStyle(0x3a3030, 1); g.fillRect(2, 25+bob, 3, 5);

  // Udder — a touch narrower and shifted back toward the rump
  g.fillStyle(0xf4b4b4, 1); g.fillRect(11, 28+bob, 13, 5);
  g.fillStyle(0xe89898, 1); g.fillRect(11, 31+bob, 13, 2);
  g.fillStyle(0xe08080, 1);
  // Teats centred on the visible belly span (the butt-side of the udder tucks behind
  // the rear leg), so they read as centred rather than skewed toward the rump.
  g.fillRect(16, 33+bob, 2, 2); g.fillRect(19, 33+bob, 2, 2); g.fillRect(22, 33+bob, 2, 2);

  // Body — taller/deeper barrel
  g.fillStyle(0xf0ece4, 1); g.fillRect(5, 12+bob, 38, 18);
  g.fillStyle(0xffffff, 1); g.fillRect(5, 12+bob, 38, 3);
  g.fillStyle(0xe0dcd4, 1); g.fillRect(5, 27+bob, 38, 3);
  g.fillStyle(0xf0ece4, 1); g.fillRect(4, 14+bob, 1, 12); // rump curve

  // Black patches
  g.fillStyle(0x1a1818, 1);
  g.fillRect(6,  13+bob, 12, 12);
  g.fillRect(31, 14+bob, 9,  11);
  g.fillRect(20, 19+bob, 6,  8);

  // Neck — a tapering wedge that rises from the shoulder up to the head, clearly
  // thinner than the barrel so it reads as a neck rather than more body.
  g.fillStyle(0xf0ece4, 1);
  g.fillRect(39, 13+bob, 5, 14);   // shoulder end (deep)
  g.fillRect(43, 12+bob, 4, 13);   // mid
  g.fillRect(46, 11+bob, 4, 12);   // head end (shallower)
  g.fillStyle(0xffffff, 1);        // crest highlight stepping up to the poll
  g.fillRect(39, 13+bob, 5, 2); g.fillRect(43, 12+bob, 4, 2); g.fillRect(46, 11+bob, 4, 2);
  g.fillStyle(0xe0dcd4, 1);        // throat/dewlap shade tucking up to the jaw
  g.fillRect(39, 25+bob, 5, 2); g.fillRect(43, 23+bob, 4, 2); g.fillRect(46, 21+bob, 4, 2);

  // Head — long, lowered, forward-facing face set out at the end of the neck
  g.fillStyle(0xf0ece4, 1); g.fillRect(47, 9+bob, 9, 14);
  g.fillStyle(0xffffff, 1); g.fillRect(47, 9+bob, 9, 2);    // poll highlight

  // Black Holstein face patch across the poll/brow
  g.fillStyle(0x1a1818, 1); g.fillRect(47, 9+bob, 8, 4);

  // Muzzle — soft tan/pink snout
  g.fillStyle(0xf4c4a8, 1); g.fillRect(50, 16+bob, 6, 7);
  g.fillStyle(0xe0a888, 1); g.fillRect(50, 16+bob, 6, 1);   // muzzle top edge
  g.fillStyle(0xc88870, 1); g.fillRect(52, 19+bob, 1, 2); g.fillRect(54, 19+bob, 1, 2); // nostrils

  // Horns — small pair rising from the dark poll
  g.fillStyle(0xe8d8a0, 1); g.fillRect(48, 6+bob, 2, 3); g.fillRect(52, 6+bob, 2, 3);
  g.fillStyle(0xd8c488, 1); g.fillRect(48, 6+bob, 2, 1); g.fillRect(52, 6+bob, 2, 1);

  // Ear — set back at the side of the head
  g.fillStyle(0xf0ece4, 1); g.fillRect(45, 10+bob, 3, 3);
  g.fillStyle(0xf4b0a0, 1); g.fillRect(45, 11+bob, 2, 2);

  // Eye — on the white cheek just below the patch
  g.fillStyle(0x1a0e00, 1); g.fillRect(50, 14+bob, 2, 2);
  g.fillStyle(0xffffff, 0.85); g.fillRect(50, 14+bob, 1, 1);
}

export function buildCowTextures(scene, key) {
  buildFrames(scene, key, COW_W, COW_H, drawCow, idleWalkLegs(3));
}
