// Procedural pixel-art cow (Holstein). Faces right, origin (0.5,1). Currently
// disabled in the paddock (see creatures.js buildAnimals) but kept ready to enable;
// shares the frame/leg helpers in _frames.js.

import { makeLeg, idleWalkLegs, buildFrames } from './_frames.js';

export const COW_W = 52, COW_H = 40;

const cowLeg = makeLeg({ topY: 27, w: 5, h: 11, hoofColor: 0x2a2020, hoofY: 38 });

function drawCow(g, bob, [lhf, lhn, lff, lfn]) {
  cowLeg(g, 6,  lhf, 0x2a2020, bob); cowLeg(g, 33, lff, 0x2a2020, bob);
  cowLeg(g, 11, lhn, 0x3a3030, bob); cowLeg(g, 37, lfn, 0x3a3030, bob);

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

  // Neck
  g.fillStyle(0xf0ece4, 1); g.fillRect(39, 10+bob, 6, 8);
  g.fillStyle(0x1a1818, 1); g.fillRect(40, 10+bob, 3, 4);

  // Head
  g.fillStyle(0xf0ece4, 1); g.fillRect(39, 3+bob, 13, 10);
  g.fillStyle(0xffffff, 1); g.fillRect(39, 3+bob, 13, 2);
  // Muzzle
  g.fillStyle(0xf0c0a0, 1); g.fillRect(46, 7+bob, 6, 6);
  g.fillStyle(0xd0a080, 1); g.fillRect(47, 10+bob, 2, 1); g.fillRect(50, 10+bob, 2, 1);
  // Horn
  g.fillStyle(0xe0d080, 1); g.fillRect(40, 1+bob, 2, 4);
  // Ear
  g.fillStyle(0xf0ece4, 1); g.fillRect(38, 5+bob, 2, 3);
  g.fillStyle(0xf4b0a0, 1); g.fillRect(38, 6+bob, 1, 2);
  // Eye
  g.fillStyle(0x1a0e00, 1); g.fillRect(43, 6+bob, 2, 2);
  g.fillStyle(0xffffff, 0.8); g.fillRect(43, 6+bob, 1, 1);
}

export function buildCowTextures(scene, key) {
  buildFrames(scene, key, COW_W, COW_H, drawCow, idleWalkLegs(3));
}
