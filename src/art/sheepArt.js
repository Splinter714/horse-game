// Procedural pixel-art sheep. Faces right, origin (0.5,1). Currently disabled in the
// paddock but kept ready to enable; shares the frame/leg helpers in _frames.js.
//
// Drawn on the shared ART_SCALE super-sampled grid (like the horse/foal) so the wool
// can be rounded with ellipses and shaded smoothly instead of reading as coarse blocks.
//
// Colors are data-driven (#165): the customizer passes a `look` of part palettes
// ({ wool, skin } shading ramps). An arg-less call falls back to DEFAULT_LOOK so
// BootScene and the art-preview gallery render the original sheep unchanged.

import { gen, makeLeg, scaledGraphics, ART_SCALE, idleWalkLegs, blurEdgesSplit } from './_frames.js';
const BLUR = { radius: 0.7, strength: 0.5, feather: 1, internalBlur: 0.7, internalStrength: 0.5, colorThresh: 80 };

export const SHEEP_W = 40, SHEEP_H = 30;

// Default palette. Wool = top-lit 4-tone (light → shadow); skin (legs + face + snout)
// is a 4-tone grey family (lit → mid → dk → dkr).
const DEFAULT_LOOK = {
  wool: { hi: 0xfbf9f6, lit: 0xf0ece8, mid: 0xddd8d2, shad: 0xc4bdb5 },
  skin: { lit: 0x7d7d7d, mid: 0x6b6b6b, dk: 0x5a5a5a, dkr: 0x4c4c4c },
};

function drawSheep(g, bob, [lhf, lhn, lff, lfn], look) {
  const wool = look?.wool || DEFAULT_LOOK.wool;
  const skin = look?.skin || DEFAULT_LOOK.skin;
  const WOOL_LIT = wool.lit, WOOL_MID = wool.mid, WOOL_SHAD = wool.shad;
  const SKIN = skin.mid, SKIN_LIT = skin.lit, SKIN_DK = skin.dk, SKIN_DKR = skin.dkr;

  // Longer, slightly thicker legs; hoof is the same width as the shin (not wider).
  // Built per-draw so the hoof tone follows the chosen skin palette.
  const sheepLeg = makeLeg({ topY: 20, w: 4, h: 8, hoofColor: SKIN_DKR, hoofY: 28, hoofW: 4, hoofDX: 0 });

  sheepLeg(g, 6,  lhf, SKIN, bob);    sheepLeg(g, 26, lff, SKIN, bob);
  sheepLeg(g, 10, lhn, SKIN_DK, bob); sheepLeg(g, 30, lfn, SKIN_DK, bob);

  // Tail stub
  g.fillStyle(WOOL_LIT, 1); g.fillRect(3, 16 + bob, 3, 4);

  // --- Wool body: built row-by-row from a rounded silhouette so the sides and
  // bottom curve smoothly instead of stepping. Each row is [y, xLeft, xRight]. ---
  const rows = [
    [ 9,  8, 31], [10,  5, 33], [11,  4, 34], [12,  3, 35],
    [13,  3, 35], [14,  3, 35], [15,  3, 35], [16,  3, 35],
    [17,  3, 34], [18,  4, 34], [19,  5, 33], [20,  7, 33],
    [21,  9, 32], [22, 11, 30],
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
    [6, 8, 4, 3], [8, 6.5, 6, 4], [13, 5.5, 6, 4], [19, 5, 6, 4],
    [25, 5.5, 6, 4], [30, 7, 5, 3],
  ];
  for (const [x, y, w, h] of top) nub(x, y, w, h);
  const top2 = [[10, 7.5, 4, 2], [16, 7, 4, 2], [22, 7, 4, 2], [27, 7.5, 4, 2]];
  for (const [x, y, w, h] of top2) g.fillRect(x, y + bob, w, h);

  // Soft form shading: just an underside shadow that deepens toward the belly (no
  // top highlight — it read as a stray horizontal line). Bands follow the silhouette
  // and use alpha transition rows so each step blends without a hard seam.
  const band = (color, y, inset, alpha = 1) => {
    const r = rowAt(y); if (!r) return;
    g.fillStyle(color, alpha);
    g.fillRect(r[1] + inset, y + bob, (r[2] - r[1]) - inset * 2, 1);
  };
  band(WOOL_MID, 19, 1.5, 0.55);       // transition into the belly
  band(WOOL_MID, 20, 1.5);             // belly
  band(WOOL_SHAD, 21, 1.5, 0.7);       // transition
  band(WOOL_SHAD, 22, 1.5);            // underside shadow

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

export function buildSheepTextures(scene, key, look) {
  const names = ['idle_0', 'idle_1', 'walk_0', 'walk_1', 'walk_2', 'walk_3'];
  const bobs  = [0, 1, 0, 1, 0, 1];
  idleWalkLegs(2).forEach((legs, i) => {
    gen(scene, `${key}_${names[i]}`, SHEEP_W * ART_SCALE, SHEEP_H * ART_SCALE, g0 => {
      drawSheep(scaledGraphics(g0), bobs[i], legs, look);
    });
    blurEdgesSplit(scene, `${key}_${names[i]}`, BLUR);
  });
}
