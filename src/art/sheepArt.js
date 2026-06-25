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

  // --- Wool body: built row-by-row from a rounded silhouette so the sides and
  // bottom curve smoothly instead of stepping. Each row is [y, xLeft, xRight]. ---
  const rows = [
    [10,  8, 31], [11,  6, 33], [12,  4, 34], [13,  3, 35],
    [14,  3, 35], [15,  3, 35], [16,  3, 35], [17,  3, 35],
    [18,  3, 35], [19,  3, 35], [20,  3, 34], [21,  4, 34],
    [22,  5, 33], [23,  6, 33], [24,  8, 32], [25, 10, 30],
  ];
  const rowAt = (y) => rows.find((r) => r[0] === y);
  g.fillStyle(WOOL_LIT, 1);
  for (const [y, x0, x1] of rows) g.fillRect(x0, y + bob, x1 - x0, 1);

  // Fluffy top — small overlapping nubs of the SAME flat colour, varied height, with
  // their top corners shaved so the crown reads soft (not a hard block, not bubbly).
  const nub = (x, y, w, h) => {
    g.fillRect(x, y + 0.6 + bob, w, h - 0.6);     // body
    g.fillRect(x + 0.7, y + bob, w - 1.4, 0.6);   // shaved cap
  };
  const top = [
    [6, 9, 4, 3], [8, 7.5, 6, 4], [13, 6.5, 6, 4], [19, 6, 6, 4],
    [25, 6.5, 6, 4], [30, 8, 5, 3],
  ];
  for (const [x, y, w, h] of top) nub(x, y, w, h);
  const top2 = [[10, 8.5, 4, 2], [16, 8, 4, 2], [22, 8, 4, 2], [27, 8.5, 4, 2]];
  for (const [x, y, w, h] of top2) g.fillRect(x, y + bob, w, h);

  // Subtle shading that follows the silhouette (clamped to each row so it never
  // pokes past the rounded edge as a hard rectangle).
  const band = (color, y0, y1, inset) => {
    g.fillStyle(color, 1);
    for (let y = y0; y <= y1; y++) {
      const r = rowAt(y); if (!r) continue;
      g.fillRect(r[1] + inset, y + bob, (r[2] - r[1]) - inset * 2, 1);
    }
  };
  band(WOOL_HI, 11, 12, 2);    // lighter crown
  band(WOOL_MID, 22, 23, 1);   // belly
  band(WOOL_SHAD, 24, 25, 1);  // underside shadow

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
