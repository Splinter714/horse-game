// Procedural pixel-art dog (golden retriever). Faces right, origin (0.5,1).
// Currently disabled in the paddock but kept ready to enable; shares the frame/leg
// helpers in _frames.js.

import { makeLeg, idleWalkLegs, buildFrames } from './_frames.js';

export const DOG_W = 28, DOG_H = 24;

const dogLeg = makeLeg({ topY: 17, w: 3, h: 6, hoofColor: 0x2a2018, hoofY: 23, hoofW: 5, hoofDX: -1, hoofH: 1 });

function drawDog(g, bob, [lhf, lhn, lff, lfn]) {
  dogLeg(g, 5,  lhf, 0xb07828, bob); dogLeg(g, 17, lff, 0xb07828, bob);
  dogLeg(g, 8,  lhn, 0xc48830, bob); dogLeg(g, 20, lfn, 0xc48830, bob);

  // Tail wagging up
  g.fillStyle(0xc48830, 1); g.fillRect(2, 7+bob, 2, 7);
  g.fillStyle(0xd4983c, 1); g.fillRect(1, 7+bob, 1, 5);

  // Body
  g.fillStyle(0xd4943c, 1); g.fillRect(4, 10+bob, 20, 10);
  g.fillStyle(0xe8b054, 1); g.fillRect(4, 10+bob, 20, 3);
  g.fillStyle(0xb07828, 1); g.fillRect(4, 17+bob, 20, 3);
  g.fillStyle(0xd4943c, 1); g.fillRect(3, 12+bob, 1, 6);

  // Red collar
  g.fillStyle(0xe03030, 1); g.fillRect(20, 12+bob, 5, 2);
  g.fillStyle(0xc02020, 1); g.fillRect(22, 14+bob, 2, 1); // tag

  // Neck
  g.fillStyle(0xd4943c, 1); g.fillRect(21, 8+bob, 5, 6);

  // Head
  g.fillStyle(0xd4943c, 1); g.fillRect(21, 2+bob, 7, 10);
  g.fillStyle(0xe8b054, 1); g.fillRect(21, 2+bob, 7, 2);
  // Muzzle (cream)
  g.fillStyle(0xf0d898, 1); g.fillRect(25, 7+bob, 3, 5);
  g.fillStyle(0x3a2010, 1); g.fillRect(26, 8+bob, 2, 1); // nose
  // Floppy ear
  g.fillStyle(0xb07828, 1); g.fillRect(21, 3+bob, 2, 7);
  // Eye
  g.fillStyle(0x2a1808, 1); g.fillRect(23, 5+bob, 2, 2);
  g.fillStyle(0xffffff, 0.8); g.fillRect(23, 5+bob, 1, 1);
}

export function buildDogTextures(scene, key) {
  buildFrames(scene, key, DOG_W, DOG_H, drawDog, idleWalkLegs(2));
}
