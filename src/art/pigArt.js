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

  // Head
  g.fillStyle(0xf4a0a0, 1); g.fillRect(23, 6+bob, 9, 12);
  g.fillStyle(0xf8c0c0, 1); g.fillRect(23, 6+bob, 9, 2);
  // Round snout
  g.fillStyle(0xe07878, 1); g.fillRect(28, 10+bob, 4, 5);
  g.fillStyle(0xc05858, 1); g.fillRect(29, 12+bob, 1, 1); g.fillRect(31, 12+bob, 1, 1);
  // Ear (triangular, flopped forward)
  g.fillStyle(0xf4a0a0, 1); g.fillRect(23, 3+bob, 4, 5);
  g.fillStyle(0xe07878, 1); g.fillRect(24, 4+bob, 2, 4);
  // Eye
  g.fillStyle(0x2a1010, 1); g.fillRect(25, 9+bob, 2, 2);
  g.fillStyle(0xffffff, 0.8); g.fillRect(25, 9+bob, 1, 1);
}

export function buildPigTextures(scene, key) {
  buildFrames(scene, key, PIG_W, PIG_H, drawPig, idleWalkLegs(2));
}
