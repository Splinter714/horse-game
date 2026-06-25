// Procedural pixel-art pig. Faces right, origin (0.5,1). Currently disabled in the
// paddock but kept ready to enable; shares the frame/leg helpers in _frames.js.

import { makeLeg, idleWalkLegs, buildFrames } from './_frames.js';

export const PIG_W = 32, PIG_H = 26;

const pigLeg = makeLeg({ topY: 18, w: 3, h: 6, hoofColor: 0xa05050, hoofY: 24, hoofW: 5, hoofDX: -1 });

function drawPig(g, bob, [lhf, lhn, lff, lfn]) {
  pigLeg(g, 5,  lhf, 0xd07878, bob); pigLeg(g, 19, lff, 0xd07878, bob);
  pigLeg(g, 8,  lhn, 0xe08888, bob); pigLeg(g, 22, lfn, 0xe08888, bob);

  // Curly tail (3-pixel curl)
  g.fillStyle(0xe07878, 1);
  g.fillRect(2, 11+bob, 2, 2);
  g.fillRect(1, 13+bob, 2, 2);
  g.fillRect(2, 15+bob, 2, 2);

  // Body (round pink)
  g.fillStyle(0xf4a0a0, 1); g.fillRect(4, 8+bob, 24, 14);
  g.fillStyle(0xf8c0c0, 1); g.fillRect(4, 8+bob, 24, 4);
  g.fillStyle(0xe08080, 1); g.fillRect(4, 18+bob, 24, 4);
  g.fillStyle(0xf4a0a0, 1); g.fillRect(3, 10+bob, 1, 8); // rump curve
  g.fillStyle(0xf8c0c0, 1); g.fillRect(3, 10+bob, 1, 2);

  // Head — rounded cheek that blends into the body and tapers to a snout disc
  g.fillStyle(0xf4a0a0, 1);
  g.fillRect(22, 8+bob, 8, 9);    // cheek/jowl mass (overlaps body so it blends)
  g.fillRect(23, 7+bob, 6, 1);    // rounded crown step
  g.fillRect(24, 6+bob, 4, 1);    // crown top
  g.fillRect(29, 10+bob, 2, 5);   // muzzle bridge toward the snout
  // Top highlight following the rounded crown
  g.fillStyle(0xf8c0c0, 1);
  g.fillRect(24, 6+bob, 4, 1);
  g.fillRect(23, 7+bob, 6, 1);
  g.fillRect(22, 8+bob, 8, 1);
  // Jowl / underside shadow (rounds off the lower cheek)
  g.fillStyle(0xe08080, 1); g.fillRect(23, 15+bob, 7, 2);
  // Snout disc (protruding, faces right) with nostrils
  g.fillStyle(0xea9a9a, 1); g.fillRect(30, 10+bob, 2, 6);
  g.fillStyle(0xd88888, 1); g.fillRect(30, 10+bob, 2, 1);
  g.fillStyle(0xc05858, 1); g.fillRect(31, 12+bob, 1, 1); g.fillRect(31, 14+bob, 1, 1);
  // Floppy ear draping forward over the forehead
  g.fillStyle(0xf09a9a, 1);
  g.fillRect(25, 4+bob, 4, 4);
  g.fillRect(26, 3+bob, 2, 1);
  g.fillStyle(0xc86868, 1); g.fillRect(26, 5+bob, 2, 3); // inner ear shade
  // Eye
  g.fillStyle(0x2a1010, 1); g.fillRect(27, 9+bob, 2, 2);
  g.fillStyle(0xffffff, 0.85); g.fillRect(27, 9+bob, 1, 1);
}

export function buildPigTextures(scene, key) {
  buildFrames(scene, key, PIG_W, PIG_H, drawPig, idleWalkLegs(2));
}
