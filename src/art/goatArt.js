// Procedural pixel-art goat (#267). Faces right, origin (0.5,1). A milkable barnyard
// grazer like the cow, but leaner and lighter — a nimble little dairy goat with the
// goat signatures: swept-back horns, a chin beard, an upright flick of a tail, and a
// wedge muzzle. Drawn on the shared ART_SCALE super-sampled grid (like the cow/sheep)
// for HiDPI crispness; displayed at S/ART_SCALE (spawn.superSampled) so on-screen size
// is unchanged.
//
// Colours are data-driven (#165): the customizer passes a `look` of { coat, saddle }
// palettes. An arg-less call falls back to DEFAULT_LOOK (a soft tan goat with a darker
// dorsal "saddle" band), so BootScene and the art-preview gallery render her unchanged.

import { gen, scaledGraphics, ART_SCALE, makeLeg, idleWalkLegs, buildFrames } from './_frames.js';

export const GOAT_W = 48, GOAT_H = 36;

// Coat = the body/legs/neck/head base (hi/mid/shad + the two leg shin tones). saddle =
// the darker dorsal band down the back (a common dairy-goat marking). udder is a fixed
// soft pink (not customized), like the cow's teats.
const DEFAULT_LOOK = {
  coat:   { hi: 0xe8d8c0, mid: 0xd8c4a4, shad: 0xc4ac88, legFar: 0xbfa682, legNear: 0xd0bc9c },
  saddle: { mid: 0x8a6f4c },
};

const goatLeg = makeLeg({ topY: 24, w: 4, h: 10, hoofColor: 0x2a2018, hoofY: 34 });

function drawGoat(g, bob, [lhf, lhn, lff, lfn], look) {
  const coat = look?.coat || DEFAULT_LOOK.coat;
  const SADDLE = (look?.saddle || DEFAULT_LOOK.saddle).mid;
  const { hi, mid, shad, legFar, legNear } = coat;

  g.layer('legs');
  goatLeg(g, 8,  lhf, legFar,  bob); goatLeg(g, 30, lff, legFar,  bob);
  goatLeg(g, 12, lhn, legNear, bob); goatLeg(g, 34, lfn, legNear, bob);

  g.layer('tail');
  // Short upright goat tail — a stubby flick that cocks up over the rump (unlike the
  // cow's long hanging tail).
  g.fillStyle(mid, 1);  g.fillRect(5, 13+bob, 3, 5);
  g.fillStyle(shad, 1); g.fillRect(5, 13+bob, 3, 2);

  g.layer('udder');
  // Small udder — she's a dairy goat, so she milks — tucked under the belly.
  g.fillStyle(0xf4b4b4, 1); g.fillRect(13, 26+bob, 9, 4);
  g.fillStyle(0xe08080, 1); g.fillRect(15, 30+bob, 2, 2); g.fillRect(18, 30+bob, 2, 2);

  g.layer('body');
  // Body — a leaner, shallower barrel than the cow's.
  g.fillStyle(mid, 1);  g.fillRect(7, 13+bob, 30, 14);
  g.fillStyle(hi, 1);   g.fillRect(7, 13+bob, 30, 3);
  g.fillStyle(shad, 1); g.fillRect(7, 24+bob, 30, 3);
  g.fillStyle(mid, 1);  g.fillRect(6, 15+bob, 1, 9);  // rump curve

  g.layer('saddle');
  // Darker dorsal "saddle" band down the spine — a common dairy-goat marking.
  g.fillStyle(SADDLE, 1);
  g.fillRect(9, 13+bob, 26, 3);

  g.layer('neck');
  // Neck — a slim tapering wedge rising from the shoulder to the head.
  g.fillStyle(mid, 1);
  g.fillRect(34, 13+bob, 4, 11);   // shoulder end
  g.fillRect(37, 12+bob, 4, 10);   // mid
  g.fillRect(40, 11+bob, 4, 9);    // head end
  g.fillStyle(hi, 1);              // crest highlight up to the poll
  g.fillRect(34, 13+bob, 4, 2); g.fillRect(37, 12+bob, 4, 2); g.fillRect(40, 11+bob, 4, 2);
  g.fillStyle(shad, 1);           // throat shade
  g.fillRect(34, 22+bob, 4, 2); g.fillRect(37, 20+bob, 4, 2);

  g.layer('head');
  // Head — a short forward face at the end of the neck.
  g.fillStyle(mid, 1); g.fillRect(41, 9+bob, 7, 11);
  g.fillStyle(hi, 1);  g.fillRect(41, 9+bob, 7, 2);   // poll highlight

  g.layer('horns');
  // Horns — a swept-BACK pair curving up and over the poll (the goat signature).
  g.fillStyle(0xcbb88f, 1);
  g.fillRect(42, 4+bob, 2, 5); g.fillRect(45, 4+bob, 2, 5);   // rising bases
  g.fillRect(40, 3+bob, 2, 2); g.fillRect(43, 3+bob, 2, 2);   // curving back over the poll
  g.fillStyle(0xb8a074, 1);
  g.fillRect(42, 4+bob, 2, 1); g.fillRect(45, 4+bob, 2, 1);   // horn ridge shade

  g.layer('muzzle');
  // Muzzle — a slim wedge snout with a dark nose tip.
  g.fillStyle(0xe8d8c0, 1); g.fillRect(46, 13+bob, 4, 6);
  g.fillStyle(0xd0bc9c, 1); g.fillRect(46, 13+bob, 4, 1);      // muzzle top edge
  g.fillStyle(0x3a2c20, 1); g.fillRect(48, 15+bob, 2, 2);      // nose

  g.layer('beard');
  // Chin beard — a little tuft hanging under the jaw (the classic goat beard).
  g.fillStyle(shad, 1); g.fillRect(45, 19+bob, 3, 4);
  g.fillStyle(SADDLE, 1); g.fillRect(45, 21+bob, 3, 2);

  g.layer('ear');
  // Ear — set back at the side of the head, angled down a touch.
  g.fillStyle(mid, 1); g.fillRect(39, 10+bob, 3, 3);
  g.fillStyle(0xf4c0a8, 1); g.fillRect(39, 11+bob, 2, 2);

  g.layer('eye');
  // Eye — on the cheek.
  g.fillStyle(0x1a0e00, 1); g.fillRect(44, 12+bob, 2, 2);
  g.fillStyle(0xffffff, 0.85); g.fillRect(44, 12+bob, 1, 1);
}

// Goat eating/drinking: head/neck drop toward the ground so the muzzle reaches the
// grass, body/legs stay planted — mirrors the horse/cow eat pose treatment.
function drawGoatEat(g, bob, look) {
  const coat = look?.coat || DEFAULT_LOOK.coat;
  const SADDLE = (look?.saddle || DEFAULT_LOOK.saddle).mid;
  const { hi, mid, shad, legFar, legNear } = coat;

  g.layer('legs');
  goatLeg(g, 8,  0, legFar,  bob); goatLeg(g, 30, 0, legFar,  bob);
  goatLeg(g, 12, 0, legNear, bob); goatLeg(g, 34, 0, legNear, bob);

  g.layer('tail');
  g.fillStyle(mid, 1);  g.fillRect(5, 13+bob, 3, 5);
  g.fillStyle(shad, 1); g.fillRect(5, 13+bob, 3, 2);

  g.layer('udder');
  g.fillStyle(0xf4b4b4, 1); g.fillRect(13, 26+bob, 9, 4);
  g.fillStyle(0xe08080, 1); g.fillRect(15, 30+bob, 2, 2); g.fillRect(18, 30+bob, 2, 2);

  g.layer('body');
  g.fillStyle(mid, 1);  g.fillRect(7, 13+bob, 30, 14);
  g.fillStyle(hi, 1);   g.fillRect(7, 13+bob, 30, 3);
  g.fillStyle(shad, 1); g.fillRect(7, 24+bob, 30, 3);
  g.fillStyle(mid, 1);  g.fillRect(6, 15+bob, 1, 9);

  g.layer('saddle');
  g.fillStyle(SADDLE, 1); g.fillRect(9, 13+bob, 26, 3);

  g.layer('neck');
  // Neck angled down from the shoulder toward the ground (head lowered to graze).
  g.fillStyle(mid, 1);
  g.fillRect(34, 15+bob, 4, 10);   // shoulder end
  g.fillRect(37, 19+bob, 4, 9);    // mid
  g.fillRect(40, 23+bob, 4, 7);    // head end
  g.fillStyle(hi, 1);
  g.fillRect(34, 15+bob, 4, 2); g.fillRect(37, 19+bob, 4, 2); g.fillRect(40, 23+bob, 4, 2);
  g.fillStyle(shad, 1);
  g.fillRect(34, 23+bob, 4, 2); g.fillRect(37, 26+bob, 4, 2);

  g.layer('head');
  const headY = 23 + bob;
  g.fillStyle(mid, 1); g.fillRect(41, headY, 7, 7);
  g.fillStyle(hi, 1);  g.fillRect(41, headY, 7, 2);

  g.layer('horns');
  g.fillStyle(0xcbb88f, 1);
  g.fillRect(42, headY - 4, 2, 4); g.fillRect(45, headY - 4, 2, 4);
  g.fillRect(40, headY - 5, 2, 2); g.fillRect(43, headY - 5, 2, 2);
  g.fillStyle(0xb8a074, 1);
  g.fillRect(42, headY - 4, 2, 1); g.fillRect(45, headY - 4, 2, 1);

  g.layer('muzzle');
  g.fillStyle(0xe8d8c0, 1); g.fillRect(46, headY + 4, 4, 5);
  g.fillStyle(0x3a2c20, 1); g.fillRect(48, headY + 6, 2, 2);

  g.layer('beard');
  g.fillStyle(shad, 1); g.fillRect(45, headY + 8, 3, 4);
  g.fillStyle(SADDLE, 1); g.fillRect(45, headY + 10, 3, 2);

  g.layer('ear');
  g.fillStyle(mid, 1); g.fillRect(39, headY + 1, 3, 3);
  g.fillStyle(0xf4c0a8, 1); g.fillRect(39, headY + 2, 2, 2);

  g.layer('eye');
  g.fillStyle(0x1a0e00, 1); g.fillRect(44, headY + 2, 2, 2);
  g.fillStyle(0xffffff, 0.85); g.fillRect(44, headY + 2, 1, 1);
}

export function buildGoatTextures(scene, key, look) {
  buildFrames(scene, key, GOAT_W, GOAT_H, (g, bob, legs) => drawGoat(g, bob, legs, look), idleWalkLegs(3));

  ['eat_0', 'eat_1'].forEach((name, i) => {
    gen(scene, `${key}_${name}`, GOAT_W * ART_SCALE, GOAT_H * ART_SCALE, g0 =>
      drawGoatEat(scaledGraphics(g0), i, look));
  });
}
