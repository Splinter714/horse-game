// Procedural pixel-art llama / alpaca (#268). Faces right, origin (0.5,1). Drawn on
// the shared ART_SCALE super-sampled grid (like the horse/sheep) so the fleece can be
// rounded and shaded smoothly instead of reading as coarse blocks.
//
// ONE species, TWO appearance variants (like horse coats): the long-necked, leggy
// LLAMA and the smaller, rounder, extra-fluffy ALPACA. The variant is chosen by the
// roster individual's `look.variant` ('llama' | 'alpaca'); an arg-less call falls back
// to the llama so BootScene and the art-preview gallery render a sensible default.
//
// The signature shape is the tall upright NECK rising from the body to a small head
// with the two upright banana-ears — that silhouette is what reads instantly as a
// llama/alpaca rather than a sheep.
//
// Colors are data-driven (#165 style): a `look` may carry { fleece, skin } shading
// ramps; a `shorn` flag trims the fleece close (mirrors the sheep's shear look, #233).

import { gen, makeLeg, scaledGraphics, ART_SCALE, idleWalkLegs } from './_frames.js';

// A generous canvas — the upright neck is tall, so the sprite is taller than it is wide.
export const LLAMA_W = 40, LLAMA_H = 40;

// Default fleece = warm cream; skin (legs + face + muzzle) is a soft brown-grey family.
const DEFAULT_LOOK = {
  fleece: { hi: 0xf3e9d2, lit: 0xe8dabb, mid: 0xd6c39c, shad: 0xbca67e },
  skin:   { lit: 0x8a7a68, mid: 0x776656, dk: 0x635444, dkr: 0x4e4235 },
};

// Per-variant silhouette knobs. The llama is taller/leaner with a longer upright neck
// and a small proud head; the alpaca is shorter, rounder, extra fluffy, with a stubbier
// neck and a bigger fuzzy head — the two read distinct at a glance.
const VARIANTS = {
  llama:  { neckTopY: 8,  neckW: 5, headW: 7, headH: 6, bodyTopY: 20, extraFluff: false, earH: 6 },
  alpaca: { neckTopY: 11, neckW: 6, headW: 8, headH: 7, bodyTopY: 21, extraFluff: true,  earH: 5 },
};

function drawLlama(g, bob, [lhf, lhn, lff, lfn], look) {
  const fleece = look?.fleece || DEFAULT_LOOK.fleece;
  const skin   = look?.skin   || DEFAULT_LOOK.skin;
  const shorn  = !!look?.shorn;                       // freshly sheared → trimmed fleece
  const variant = VARIANTS[look?.variant] || VARIANTS.llama;
  const F_HI = fleece.hi, F_LIT = fleece.lit, F_MID = fleece.mid, F_SHAD = fleece.shad;
  const SKIN = skin.mid, SKIN_LIT = skin.lit, SKIN_DK = skin.dk, SKIN_DKR = skin.dkr;

  // Long slim legs (llamas/alpacas are leggy) — hoof same width as the shin.
  const llamaLeg = makeLeg({ topY: 24, w: 3, h: 12, hoofColor: SKIN_DKR, hoofY: 34, hoofW: 3, hoofDX: 0 });

  g.layer('legs');
  llamaLeg(g, 12, lhf, SKIN,    bob);   llamaLeg(g, 26, lff, SKIN,    bob);
  llamaLeg(g, 15, lhn, SKIN_DK, bob);   llamaLeg(g, 29, lfn, SKIN_DK, bob);

  g.layer('tail');
  // Small tuft of fleece at the rump.
  g.fillStyle(F_LIT, 1); g.fillRect(9, 18 + bob, 3, 4);

  g.layer('body');
  // --- Fleecy oval body, row-by-row from a rounded silhouette (like the sheep) so the
  // sides/underside curve smoothly. Each row is [y, xLeft, xRight]. The alpaca is a
  // touch rounder/plumper; shorn pulls the whole silhouette in and shaves the crown. ---
  const top = variant.bodyTopY;
  const bodyRows = shorn ? [
    [top - 4, 15, 27], [top - 3, 13, 29], [top - 2, 12, 30], [top - 1, 12, 30],
    [top,     12, 30], [top + 1, 13, 29], [top + 2, 14, 28], [top + 3, 16, 27],
  ] : [
    [top - 6, 15, 27], [top - 5, 13, 29], [top - 4, 11, 31], [top - 3, 10, 32],
    [top - 2, 10, 32], [top - 1, 10, 32], [top,     10, 32], [top + 1, 11, 31],
    [top + 2, 12, 30], [top + 3, 14, 28],
  ];
  const rowAt = (y) => bodyRows.find((r) => r[0] === y);
  g.fillStyle(shorn ? F_SHAD : F_LIT, 1);
  for (const [y, x0, x1] of bodyRows) g.fillRect(x0, y + bob, x1 - x0, 1);

  // Underside form-shadow bands (blend without a hard seam, like the sheep).
  const band = (color, y, inset, alpha = 1) => {
    const r = rowAt(y); if (!r) return;
    g.fillStyle(color, alpha);
    g.fillRect(r[1] + inset, y + bob, (r[2] - r[1]) - inset * 2, 1);
  };
  band(F_MID,  top + 1, 1.5, 0.6);
  band(F_SHAD, top + 2, 1.5, 0.8);
  band(F_SHAD, top + 3, 1.0);
  // Top highlight ridge along the back.
  band(F_HI, top - (shorn ? 4 : 6), 2, 0.5);

  g.layer('neck');
  // --- The signature UPRIGHT NECK: a slightly forward-leaning fleecy column rising from
  // the front of the body up to the head. Built as stacked rows so it tapers toward the
  // top; the near edge is lit, the far edge shaded, giving it round volume. ---
  const nTop = variant.neckTopY, nW = variant.neckW;
  const neckBottomY = top - 1;
  // x drifts right as it rises (leaning forward toward the head over the shoulders).
  for (let y = neckBottomY; y >= nTop; y--) {
    const t = (neckBottomY - y) / (neckBottomY - nTop);   // 0 at base → 1 at top
    const x = 24 + t * 5;                                  // lean forward as it climbs
    const w = nW - (shorn ? 1 : 0);
    g.fillStyle(shorn ? F_SHAD : F_LIT, 1);
    g.fillRect(x, y + bob, w, 1);
    g.fillStyle(F_HI, 0.5); g.fillRect(x + w - 1, y + bob, 1, 1);  // lit near edge
    g.fillStyle(F_MID, 0.5); g.fillRect(x, y + bob, 1, 1);         // shaded far edge
  }

  g.layer('head');
  // Small head atop the neck. The alpaca's is bigger + fuzzier; the llama's is neater.
  const hW = variant.headW, hH = variant.headH, hx = 28, hy = nTop - hH + 2;
  g.fillStyle(SKIN, 1);
  g.fillRect(hx, hy + bob, hW, hH);
  g.fillStyle(SKIN_LIT, 1); g.fillRect(hx, hy + bob, hW, 2);        // lit brow
  if (variant.extraFluff) {
    // Alpaca: a fuzzy forelock cap of fleece over the brow.
    g.fillStyle(F_LIT, 1);
    g.fillRect(hx, hy - 2 + bob, hW, 3);
    g.fillStyle(F_HI, 0.6); g.fillRect(hx + 1, hy - 2 + bob, hW - 2, 1);
  }

  g.layer('ears');
  // Two upright banana ears — the tell. Near ear lit, far ear shaded.
  const eH = variant.earH;
  g.fillStyle(SKIN_DK, 1); g.fillRect(hx + 1, hy - eH + bob, 2, eH);           // far ear
  g.fillStyle(SKIN, 1);    g.fillRect(hx + hW - 3, hy - eH + bob, 2, eH);      // near ear
  g.fillStyle(SKIN_LIT, 1); g.fillRect(hx + hW - 3, hy - eH + bob, 1, 2);      // ear tip lit

  g.layer('eye');
  // Big gentle dark eye with a highlight — llamas have famously soft eyes.
  g.fillStyle(0x1a120c, 1); g.fillRect(hx + hW - 3, hy + 2 + bob, 2, 2);
  g.fillStyle(0xf4ead6, 1); g.fillRect(hx + hW - 3, hy + 2 + bob, 1, 1);

  g.layer('muzzle');
  // Short muzzle poking forward off the head, darker skin family.
  g.fillStyle(SKIN_DK, 1);
  g.fillRect(hx + hW, hy + 2 + bob, 2, hH - 3);
  g.fillStyle(SKIN_DKR, 1); g.fillRect(hx + hW, hy + hH - 2 + bob, 2, 1);      // nostril/lip shade
}

export function buildLlamaTextures(scene, key, look) {
  const names = ['idle_0', 'idle_1', 'walk_0', 'walk_1', 'walk_2', 'walk_3'];
  const bobs  = [0, 1, 0, 1, 0, 1];
  // Modest leg-lift (2px) for an unhurried plod, like the sheep.
  idleWalkLegs(2).forEach((legs, i) => {
    gen(scene, `${key}_${names[i]}`, LLAMA_W * ART_SCALE, LLAMA_H * ART_SCALE, g0 => {
      drawLlama(scaledGraphics(g0), bobs[i], legs, look);
    });
  });
}
