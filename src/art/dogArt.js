// Procedural pixel-art dog (golden retriever). Faces right, origin (0.5,1).
// Currently disabled in the paddock but kept ready to enable; shares the frame/leg
// helpers in _frames.js.
//
// Colours are data-driven (#165): the customizer passes a `look` of { coat, collar }
// palettes. An arg-less call falls back to DEFAULT_LOOK (the original golden), so
// BootScene and the art-preview gallery render the dog unchanged.

import { makeLeg, idleWalkLegs, buildFrames } from './_frames.js';

export const DOG_W = 28, DOG_H = 24;

// Coat covers the whole pelt (body/legs/tail/head/ears/snout shading); collar is the
// band + tag at the base of the neck.
const DEFAULT_LOOK = {
  coat: {
    hi: 0xe8b054, mid: 0xd4943c, shad: 0xb07828, legNear: 0xc48830, tailHi: 0xd4983c,
    jaw: 0xc88a30, ear: 0xa86e22, earShad: 0x946018, snout: 0xf0d898, snoutShad: 0xe2c47e,
  },
  collar: { mid: 0xe03030, shad: 0xc02020 },
};

const dogLeg = makeLeg({ topY: 17, w: 3, h: 6, hoofColor: 0x2a2018, hoofY: 23, hoofW: 5, hoofDX: -1, hoofH: 1 });

function drawDog(g, bob, [lhf, lhn, lff, lfn], look) {
  const c = look?.coat || DEFAULT_LOOK.coat;
  const col = look?.collar || DEFAULT_LOOK.collar;
  const { hi, mid, shad, legNear, tailHi, jaw, ear, earShad, snout, snoutShad } = c;

  g.layer('legs');
  dogLeg(g, 5,  lhf, shad,    bob); dogLeg(g, 17, lff, shad,    bob);
  dogLeg(g, 8,  lhn, legNear, bob); dogLeg(g, 20, lfn, legNear, bob);

  g.layer('tail');
  // Tail wagging up
  g.fillStyle(legNear, 1); g.fillRect(2, 7+bob, 2, 7);
  g.fillStyle(tailHi, 1); g.fillRect(1, 7+bob, 1, 5);

  g.layer('body');
  // Body
  g.fillStyle(mid, 1); g.fillRect(4, 10+bob, 20, 10);
  g.fillStyle(hi, 1); g.fillRect(4, 10+bob, 20, 3);
  g.fillStyle(shad, 1); g.fillRect(4, 17+bob, 20, 3);
  g.fillStyle(mid, 1); g.fillRect(3, 12+bob, 1, 6);

  g.layer('neck');
  // Neck — slopes up from the shoulder to the head
  g.fillStyle(mid, 1); g.fillRect(20, 8+bob, 5, 6);
  g.fillStyle(hi, 1); g.fillRect(20, 8+bob, 5, 2);

  g.layer('collar');
  // Collar at the base of the neck
  g.fillStyle(col.mid, 1); g.fillRect(21, 12+bob, 5, 2);
  g.fillStyle(col.shad, 1); g.fillRect(23, 14+bob, 2, 1); // tag

  g.layer('head');
  // Head — domed skull rising above the back, snout poking forward-and-down
  g.fillStyle(mid, 1); g.fillRect(22, 4+bob, 6, 7);  // skull
  g.fillStyle(hi, 1); g.fillRect(22, 4+bob, 6, 2);  // top highlight
  g.fillStyle(jaw, 1); g.fillRect(22, 10+bob, 4, 1); // jaw shade
  // Snout (cream), lower and forward
  g.fillStyle(snout, 1); g.fillRect(25, 8+bob, 3, 4);
  g.fillStyle(snoutShad, 1); g.fillRect(25, 11+bob, 3, 1); // chin shade
  g.fillStyle(0x2a1810, 1); g.fillRect(26, 8+bob, 2, 1);  // nose at the tip
  g.layer('ear');
  // Floppy ear draping the back of the head
  g.fillStyle(ear, 1); g.fillRect(20, 5+bob, 3, 7);
  g.fillStyle(earShad, 1); g.fillRect(20, 8+bob, 2, 4);
  g.layer('eye');
  // Eye — small friendly dot
  g.fillStyle(0x2a1808, 1); g.fillRect(24, 7+bob, 1, 2);
  g.fillStyle(0xffffff, 0.7); g.fillRect(24, 7+bob, 1, 1);
}

export function buildDogTextures(scene, key, look) {
  buildFrames(scene, key, DOG_W, DOG_H, (g, bob, legs) => drawDog(g, bob, legs, look), idleWalkLegs(2));
}
