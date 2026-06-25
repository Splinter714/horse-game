// Procedural pixel-art cow (Holstein). Faces right, origin (0.5,1). Currently
// disabled in the paddock (see creatures.js buildAnimals) but kept ready to enable;
// shares the frame/leg helpers in _frames.js.

import { makeLeg, idleWalkLegs, buildFrames } from './_frames.js';

export const COW_W = 52, COW_H = 40;

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

  // Udder
  g.fillStyle(0xf4b4b4, 1); g.fillRect(14, 28+bob, 16, 5);
  g.fillStyle(0xe89898, 1); g.fillRect(14, 31+bob, 16, 2);
  g.fillStyle(0xe08080, 1);
  g.fillRect(16, 33+bob, 2, 2); g.fillRect(21, 33+bob, 2, 2); g.fillRect(26, 33+bob, 2, 2);

  // Body
  g.fillStyle(0xf0ece4, 1); g.fillRect(5, 14+bob, 38, 16);
  g.fillStyle(0xffffff, 1); g.fillRect(5, 14+bob, 38, 3);
  g.fillStyle(0xe0dcd4, 1); g.fillRect(5, 27+bob, 38, 3);
  g.fillStyle(0xf0ece4, 1); g.fillRect(4, 16+bob, 1, 10); // rump curve

  // Black patches
  g.fillStyle(0x1a1818, 1);
  g.fillRect(6,  14+bob, 12, 10);
  g.fillRect(31, 15+bob, 9,  9);
  g.fillRect(20, 20+bob, 6,  7);

  // Neck — beefy, blends the shoulder smoothly up into the head with a soft dewlap
  g.fillStyle(0xf0ece4, 1); g.fillRect(38, 13+bob, 9, 16);
  g.fillStyle(0xffffff, 1); g.fillRect(38, 13+bob, 9, 2);   // crest highlight
  g.fillStyle(0xe0dcd4, 1); g.fillRect(38, 27+bob, 9, 2);   // throat/dewlap shade

  // Head — long, lowered, forward-facing face (no longer perched above the body)
  g.fillStyle(0xf0ece4, 1); g.fillRect(43, 11+bob, 9, 14);
  g.fillStyle(0xffffff, 1); g.fillRect(43, 11+bob, 9, 2);   // poll highlight

  // Black Holstein face patch across the poll/brow
  g.fillStyle(0x1a1818, 1); g.fillRect(43, 11+bob, 8, 4);

  // Muzzle — soft tan/pink snout
  g.fillStyle(0xf4c4a8, 1); g.fillRect(46, 18+bob, 6, 7);
  g.fillStyle(0xe0a888, 1); g.fillRect(46, 18+bob, 6, 1);   // muzzle top edge
  g.fillStyle(0xc88870, 1); g.fillRect(48, 21+bob, 1, 2); g.fillRect(50, 21+bob, 1, 2); // nostrils

  // Horns — small pair rising from the dark poll
  g.fillStyle(0xe8d8a0, 1); g.fillRect(44, 8+bob, 2, 3); g.fillRect(48, 8+bob, 2, 3);
  g.fillStyle(0xd8c488, 1); g.fillRect(44, 8+bob, 2, 1); g.fillRect(48, 8+bob, 2, 1);

  // Ear — set back at the side of the head
  g.fillStyle(0xf0ece4, 1); g.fillRect(41, 12+bob, 3, 3);
  g.fillStyle(0xf4b0a0, 1); g.fillRect(41, 13+bob, 2, 2);

  // Eye — on the white cheek just below the patch
  g.fillStyle(0x1a0e00, 1); g.fillRect(46, 16+bob, 2, 2);
  g.fillStyle(0xffffff, 0.85); g.fillRect(46, 16+bob, 1, 1);
}

export function buildCowTextures(scene, key) {
  buildFrames(scene, key, COW_W, COW_H, drawCow, idleWalkLegs(3));
}
