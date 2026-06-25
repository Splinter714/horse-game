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

  // Neck — slopes up from the shoulder to the head
  g.fillStyle(0xd4943c, 1); g.fillRect(20, 8+bob, 5, 6);
  g.fillStyle(0xe8b054, 1); g.fillRect(20, 8+bob, 5, 2);

  // Red collar at the base of the neck
  g.fillStyle(0xe03030, 1); g.fillRect(21, 12+bob, 5, 2);
  g.fillStyle(0xc02020, 1); g.fillRect(23, 14+bob, 2, 1); // tag

  // Head — domed skull rising above the back, snout poking forward-and-down
  g.fillStyle(0xd4943c, 1); g.fillRect(22, 4+bob, 6, 7);  // skull
  g.fillStyle(0xe8b054, 1); g.fillRect(22, 4+bob, 6, 2);  // top highlight
  g.fillStyle(0xc88a30, 1); g.fillRect(22, 10+bob, 4, 1); // jaw shade
  // Snout (cream), lower and forward
  g.fillStyle(0xf0d898, 1); g.fillRect(25, 8+bob, 3, 4);
  g.fillStyle(0xe2c47e, 1); g.fillRect(25, 11+bob, 3, 1); // chin shade
  g.fillStyle(0x2a1810, 1); g.fillRect(26, 8+bob, 2, 1);  // nose at the tip
  // Floppy ear draping the back of the head
  g.fillStyle(0xa86e22, 1); g.fillRect(20, 5+bob, 3, 7);
  g.fillStyle(0x946018, 1); g.fillRect(20, 8+bob, 2, 4);
  // Eye — small friendly dot
  g.fillStyle(0x2a1808, 1); g.fillRect(24, 7+bob, 1, 2);
  g.fillStyle(0xffffff, 0.7); g.fillRect(24, 7+bob, 1, 1);
}

export function buildDogTextures(scene, key) {
  buildFrames(scene, key, DOG_W, DOG_H, drawDog, idleWalkLegs(2));
}
