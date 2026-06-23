// Procedural pixel-art sheep. Faces right, origin (0.5,1). Currently disabled in the
// paddock but kept ready to enable; shares the frame/leg helpers in _frames.js.

import { makeLeg, idleWalkLegs, buildFrames } from './_frames.js';

export const SHEEP_W = 40, SHEEP_H = 30;

const sheepLeg = makeLeg({ topY: 22, w: 3, h: 6, hoofColor: 0x2a1e14, hoofY: 28, hoofW: 5, hoofDX: -1 });

function drawSheep(g, bob, [lhf, lhn, lff, lfn]) {
  sheepLeg(g, 6,  lhf, 0x2a1e14, bob); sheepLeg(g, 26, lff, 0x2a1e14, bob);
  sheepLeg(g, 10, lhn, 0x3a2e24, bob); sheepLeg(g, 30, lfn, 0x3a2e24, bob);

  // Tail stub
  g.fillStyle(0xf0ece8, 1); g.fillRect(3, 16+bob, 3, 4);

  // Fluffy wool body — bumpy outline
  g.fillStyle(0xf0ece8, 1);
  g.fillRect(6,  12+bob, 28, 14);
  g.fillRect(4,  14+bob, 2,  10);   // left bump
  g.fillRect(34, 13+bob, 2,  10);   // right bump
  g.fillRect(8,  10+bob, 6,  4);    // top-left bump
  g.fillRect(17,  9+bob, 7,  4);    // top-mid bump
  g.fillRect(26, 10+bob, 6,  4);    // top-right bump
  // Wool shading
  g.fillStyle(0xd8d4d0, 1); g.fillRect(6,  22+bob, 28, 4);
  g.fillStyle(0xe8e4e0, 1);
  g.fillRect(9, 13+bob, 3, 3); g.fillRect(18, 11+bob, 3, 3); g.fillRect(27, 12+bob, 3, 3);

  // Dark face
  g.fillStyle(0x2a1e14, 1); g.fillRect(30, 11+bob, 10, 10);
  g.fillStyle(0x3a2e24, 1); g.fillRect(30, 11+bob, 10, 2);
  // Nose
  g.fillStyle(0xe0a090, 1); g.fillRect(37, 16+bob, 3, 4);
  g.fillStyle(0xc08070, 1); g.fillRect(38, 18+bob, 1, 1);
  // Floppy ear
  g.fillStyle(0x3a2e24, 1); g.fillRect(29, 12+bob, 2, 5);
  g.fillStyle(0xe0a090, 1); g.fillRect(29, 13+bob, 1, 3);
  // Amber slit-pupil eye
  g.fillStyle(0xf0c080, 1); g.fillRect(33, 14+bob, 2, 2);
  g.fillStyle(0x1a0800, 1); g.fillRect(33, 14+bob, 1, 2);
}

export function buildSheepTextures(scene, key) {
  buildFrames(scene, key, SHEEP_W, SHEEP_H, drawSheep, idleWalkLegs(2));
}
