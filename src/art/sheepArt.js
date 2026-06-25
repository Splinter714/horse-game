// Procedural pixel-art sheep. Faces right, origin (0.5,1). Currently disabled in the
// paddock but kept ready to enable; shares the frame/leg helpers in _frames.js.
//
// Drawn on the shared ART_SCALE super-sampled grid (like the horse/foal) so the wool
// can be rounded with ellipses and shaded smoothly instead of reading as coarse blocks.

import { gen, makeLeg, scaledGraphics, ART_SCALE, idleWalkLegs } from './_frames.js';

export const SHEEP_W = 40, SHEEP_H = 30;

// Wool palette (light → shadow) for soft top-lit 3D shading.
const WOOL_HI   = 0xfbf9f6;
const WOOL_LIT  = 0xf0ece8;
const WOOL_MID  = 0xddd8d2;
const WOOL_SHAD = 0xc4bdb5;
// Skin (legs + face). Snout shares this family.
const SKIN      = 0x6b6b6b;
const SKIN_LIT  = 0x7d7d7d;
const SKIN_DK   = 0x5a5a5a;
const SKIN_DKR  = 0x4c4c4c;

const sheepLeg = makeLeg({ topY: 22, w: 3, h: 6, hoofColor: SKIN_DKR, hoofY: 28, hoofW: 5, hoofDX: -1 });

function drawSheep(g, bob, [lhf, lhn, lff, lfn]) {
  sheepLeg(g, 6,  lhf, SKIN, bob);    sheepLeg(g, 26, lff, SKIN, bob);
  sheepLeg(g, 10, lhn, SKIN_DK, bob); sheepLeg(g, 30, lfn, SKIN_DK, bob);

  // Tail stub
  g.fillStyle(WOOL_LIT, 1); g.fillRect(3, 16 + bob, 3, 4);

  // --- Wool body: one solid squared mass, edges softly scalloped ---
  g.fillStyle(WOOL_LIT, 1);
  g.fillRect(6, 12 + bob, 28, 13);
  g.fillRect(4, 14 + bob, 2, 9);     // left edge
  g.fillRect(34, 13 + bob, 2, 9);    // right edge
  // Continuous bumpy top — small overlapping nubs of the SAME flat colour, varied
  // height, so the fleece reads soft without any separate-bubble look.
  const top = [
    [6, 10.5, 5, 2], [10, 9.5, 5, 3], [15, 9, 5, 3], [20, 9, 5, 3],
    [25, 9.5, 5, 3], [29, 10.5, 5, 2],
  ];
  for (const [x, y, w, h] of top) g.fillRect(x, y + bob, w, h);
  // Shave the hard top corners a touch.
  g.fillStyle(WOOL_MID, 1); g.fillRect(6, 12 + bob, 1, 1); g.fillRect(33, 12 + bob, 1, 1);

  // Subtle shading — flat bands, not a gradient: a lighter crown, a darker belly.
  g.fillStyle(WOOL_HI, 1);  g.fillRect(8, 11 + bob, 20, 2);
  g.fillStyle(WOOL_MID, 1); g.fillRect(6, 21 + bob, 28, 2);
  g.fillStyle(WOOL_SHAD, 1); g.fillRect(6, 23 + bob, 28, 2);

  // --- Grey face: a square block with the corners notched for a soft look ---
  g.fillStyle(SKIN, 1);
  g.fillRect(31, 11 + bob, 8, 10);   // core
  g.fillRect(30, 13 + bob, 1, 6);    // left cheek
  g.fillRect(39, 13 + bob, 1, 6);    // right cheek
  g.fillStyle(SKIN_LIT, 1); g.fillRect(31, 11 + bob, 8, 2); // forehead band

  // Snout — small square muzzle, same grey family, corner shaved.
  g.fillStyle(SKIN_DK, 1);
  g.fillRect(37, 16 + bob, 3, 3);
  g.fillRect(37, 19 + bob, 2, 1);
  g.fillStyle(SKIN_DKR, 1); g.fillRect(38, 18 + bob, 1, 1);

  // Floppy ear behind the cheek.
  g.fillStyle(SKIN_DK, 1); g.fillRect(29, 12 + bob, 2, 5);
  g.fillStyle(SKIN, 1);    g.fillRect(29, 13 + bob, 1, 3);

  // Amber slit-pupil eye.
  g.fillStyle(0xf0c080, 1); g.fillRect(33, 14 + bob, 2, 2);
  g.fillStyle(0x1a0800, 1); g.fillRect(33, 14 + bob, 1, 2);
}

export function buildSheepTextures(scene, key) {
  const names = ['idle_0', 'idle_1', 'walk_0', 'walk_1', 'walk_2', 'walk_3'];
  const bobs  = [0, 1, 0, 1, 0, 1];
  idleWalkLegs(2).forEach((legs, i) => {
    gen(scene, `${key}_${names[i]}`, SHEEP_W * ART_SCALE, SHEEP_H * ART_SCALE, g0 => {
      drawSheep(scaledGraphics(g0), bobs[i], legs);
    });
  });
}
