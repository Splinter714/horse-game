// Procedural pixel-art pig. Faces right, origin (0.5,1). Currently disabled in the
// paddock but kept ready to enable; shares the frame/leg helpers in _frames.js.
//
// Colours are data-driven (#165): the customizer passes a `look` with a `body` palette
// (the pig's hide). The snout, inner ear and nostrils stay a fixed pink — pigs keep a
// pink snout whatever their coat colour. An arg-less call uses DEFAULT_LOOK (original).

import { makeLeg, idleWalkLegs, buildFrames, blurEdgesSplit } from './_frames.js';
const BLUR = { radius: 0.7, strength: 0.5, feather: 1, internalBlur: 0.7, internalStrength: 0.5, colorThresh: 80 };

export const PIG_W = 32, PIG_H = 26;

const DEFAULT_LOOK = {
  body: { hi: 0xf8c0c0, mid: 0xf4a0a0, shad: 0xe08080, legFar: 0xd07878, legNear: 0xe08888, tail: 0xe07878, ear: 0xf09a9a },
};

const pigLeg = makeLeg({ topY: 18, w: 3, h: 6, hoofColor: 0xa05050, hoofY: 24, hoofW: 5, hoofDX: -1 });

function drawPig(g, bob, [lhf, lhn, lff, lfn], look) {
  const b = look?.body || DEFAULT_LOOK.body;
  const { hi, mid, shad, legFar, legNear, tail, ear } = b;

  pigLeg(g, 5,  lhf, legFar,  bob); pigLeg(g, 19, lff, legFar,  bob);
  pigLeg(g, 8,  lhn, legNear, bob); pigLeg(g, 22, lfn, legNear, bob);

  // Curly tail (3-pixel curl)
  g.fillStyle(tail, 1);
  g.fillRect(2, 11+bob, 2, 2);
  g.fillRect(1, 13+bob, 2, 2);
  g.fillRect(2, 15+bob, 2, 2);

  // Body (round)
  g.fillStyle(mid, 1); g.fillRect(4, 8+bob, 24, 14);
  g.fillStyle(hi, 1); g.fillRect(4, 8+bob, 24, 4);
  g.fillStyle(shad, 1); g.fillRect(4, 18+bob, 24, 4);
  g.fillStyle(mid, 1); g.fillRect(3, 10+bob, 1, 8); // rump curve
  g.fillStyle(hi, 1); g.fillRect(3, 10+bob, 1, 2);

  // Head — rounded cheek that blends into the body and tapers to a snout disc
  g.fillStyle(mid, 1);
  g.fillRect(22, 8+bob, 8, 9);    // cheek/jowl mass (overlaps body so it blends)
  g.fillRect(23, 7+bob, 6, 1);    // rounded crown step
  g.fillRect(24, 6+bob, 4, 1);    // crown top
  g.fillRect(29, 10+bob, 2, 5);   // muzzle bridge toward the snout
  // Top highlight following the rounded crown
  g.fillStyle(hi, 1);
  g.fillRect(24, 6+bob, 4, 1);
  g.fillRect(23, 7+bob, 6, 1);
  g.fillRect(22, 8+bob, 8, 1);
  // Jowl / underside shadow (rounds off the lower cheek)
  g.fillStyle(shad, 1); g.fillRect(23, 15+bob, 7, 2);
  // Snout disc (protruding, faces right) with nostrils — fixed pink
  g.fillStyle(0xea9a9a, 1); g.fillRect(30, 10+bob, 2, 6);
  g.fillStyle(0xd88888, 1); g.fillRect(30, 10+bob, 2, 1);
  g.fillStyle(0xc05858, 1); g.fillRect(31, 12+bob, 1, 1); g.fillRect(31, 14+bob, 1, 1);
  // Floppy ear draping forward over the forehead
  g.fillStyle(ear, 1);
  g.fillRect(25, 4+bob, 4, 4);
  g.fillRect(26, 3+bob, 2, 1);
  g.fillStyle(0xc86868, 1); g.fillRect(26, 5+bob, 2, 3); // inner ear shade (fixed pink)
  // Eye
  g.fillStyle(0x2a1010, 1); g.fillRect(27, 9+bob, 2, 2);
  g.fillStyle(0xffffff, 0.85); g.fillRect(27, 9+bob, 1, 1);
}

export function buildPigTextures(scene, key, look) {
  buildFrames(scene, key, PIG_W, PIG_H, (g, bob, legs) => drawPig(g, bob, legs, look), idleWalkLegs(2), BLUR);
}
