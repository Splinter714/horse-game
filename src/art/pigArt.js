// Procedural pixel-art pig. Faces right, origin (0.5,1). Currently disabled in the
// paddock but kept ready to enable; shares the frame/leg helpers in _frames.js.
//
// Colours are data-driven (#165): the customizer passes a `look` with a `body` palette
// (the pig's hide). The snout, inner ear and nostrils stay a fixed pink — pigs keep a
// pink snout whatever their coat colour. An arg-less call uses DEFAULT_LOOK (original).

import { gen, scaledGraphics, ART_SCALE, makeLeg, idleWalkLegs, buildFrames } from './_frames.js';

export const PIG_W = 32, PIG_H = 26;

const DEFAULT_LOOK = {
  body: { hi: 0xf8c0c0, mid: 0xf4a0a0, shad: 0xe08080, legFar: 0xd07878, legNear: 0xe08888, tail: 0xe07878, ear: 0xf09a9a },
};

const pigLeg = makeLeg({ topY: 18, w: 3, h: 6, hoofColor: 0xa05050, hoofY: 24, hoofW: 5, hoofDX: -1 });

function drawPig(g, bob, [lhf, lhn, lff, lfn], look) {
  const b = look?.body || DEFAULT_LOOK.body;
  const { hi, mid, shad, legFar, legNear, tail, ear } = b;

  g.layer('legs');
  pigLeg(g, 5,  lhf, legFar,  bob); pigLeg(g, 19, lff, legFar,  bob);
  pigLeg(g, 8,  lhn, legNear, bob); pigLeg(g, 22, lfn, legNear, bob);

  g.layer('tail');
  // Curly tail (3-pixel curl)
  g.fillStyle(tail, 1);
  g.fillRect(2, 11+bob, 2, 2);
  g.fillRect(1, 13+bob, 2, 2);
  g.fillRect(2, 15+bob, 2, 2);

  g.layer('body');
  // Body (round)
  g.fillStyle(mid, 1); g.fillRect(4, 8+bob, 24, 14);
  g.fillStyle(hi, 1); g.fillRect(4, 8+bob, 24, 4);
  g.fillStyle(shad, 1); g.fillRect(4, 18+bob, 24, 4);
  g.fillStyle(mid, 1); g.fillRect(3, 10+bob, 1, 8); // rump curve
  g.fillStyle(hi, 1); g.fillRect(3, 10+bob, 1, 2);

  g.layer('head');
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
  g.layer('snout');
  // Snout disc (protruding, faces right) with nostrils — fixed pink
  g.fillStyle(0xea9a9a, 1); g.fillRect(30, 10+bob, 2, 6);
  g.fillStyle(0xd88888, 1); g.fillRect(30, 10+bob, 2, 1);
  g.fillStyle(0xc05858, 1); g.fillRect(31, 12+bob, 1, 1); g.fillRect(31, 14+bob, 1, 1);
  g.layer('ear');
  // Floppy ear draping forward over the forehead
  g.fillStyle(ear, 1);
  g.fillRect(25, 4+bob, 4, 4);
  g.fillRect(26, 3+bob, 2, 1);
  g.fillStyle(0xc86868, 1); g.fillRect(26, 5+bob, 2, 3); // inner ear shade (fixed pink)
  g.layer('eye');
  g.fillStyle(0x2a1010, 1); g.fillRect(27, 9+bob, 2, 2);
  g.fillStyle(0xffffff, 0.85); g.fillRect(27, 9+bob, 1, 1);
}

// Pig eating/rooting: head drops to ground level, body stays planted — mirrors the
// horse/cow/foal eat pose treatment (#200/#199).
function drawPigEat(g, bob, look) {
  const b = look?.body || DEFAULT_LOOK.body;
  const { hi, mid, shad, legFar, legNear, tail } = b;

  g.layer('legs');
  pigLeg(g, 5,  0, legFar,  bob); pigLeg(g, 19, 0, legFar,  bob);
  pigLeg(g, 8,  0, legNear, bob); pigLeg(g, 22, 0, legNear, bob);

  g.layer('tail');
  g.fillStyle(tail, 1);
  g.fillRect(2, 11+bob, 2, 2);
  g.fillRect(1, 13+bob, 2, 2);
  g.fillRect(2, 15+bob, 2, 2);

  g.layer('body');
  g.fillStyle(mid, 1); g.fillRect(4, 8+bob, 24, 14);
  g.fillStyle(hi, 1); g.fillRect(4, 8+bob, 24, 4);
  g.fillStyle(shad, 1); g.fillRect(4, 18+bob, 24, 4);
  g.fillStyle(mid, 1); g.fillRect(3, 10+bob, 1, 8); // rump curve
  g.fillStyle(hi, 1); g.fillRect(3, 10+bob, 1, 2);

  g.layer('head');
  // Head lowered — nose rooting at ground level, staggered steps down like the
  // horse/cow eat pose.
  const headY = 14 + bob;
  g.fillStyle(mid, 1);
  g.fillRect(22, headY, 7, 6);     // cheek/jowl, lower than the standing pose
  g.fillRect(23, headY - 1, 5, 1); // rounded crown step
  g.fillRect(28, headY + 2, 2, 4); // muzzle bridge sloping down toward the snout
  g.fillStyle(hi, 1);
  g.fillRect(23, headY - 1, 5, 1);
  g.fillRect(22, headY, 7, 1);
  g.fillStyle(shad, 1); g.fillRect(23, headY + 5, 6, 1);

  g.layer('snout');
  // Snout disc down near the ground, nostrils pointed toward the dirt.
  g.fillStyle(0xea9a9a, 1); g.fillRect(29, headY + 3, 2, 5);
  g.fillStyle(0xd88888, 1); g.fillRect(29, headY + 3, 2, 1);
  g.fillStyle(0xc05858, 1); g.fillRect(30, headY + 5, 1, 1); g.fillRect(30, headY + 7, 1, 1);

  g.layer('ear');
  // Ear flops forward/down over the lowered head.
  g.fillStyle(b.ear, 1);
  g.fillRect(24, headY - 3, 4, 3);
  g.fillRect(25, headY - 4, 2, 1);
  g.fillStyle(0xc86868, 1); g.fillRect(25, headY - 2, 2, 2);

  g.layer('eye');
  g.fillStyle(0x2a1010, 1); g.fillRect(26, headY + 1, 2, 2);
  g.fillStyle(0xffffff, 0.85); g.fillRect(26, headY + 1, 1, 1);
}

// Pig wallow: flopped on its side in the mud, legs kicking — a dedicated pose (not
// a reuse of the idle/sleep frames) so the mud-roll charm behavior (#197) reads as
// its own thing. `kick` alternates the raised-leg pair between frames for a lazy
// paddling read.
function drawPigWallow(g, bob, kick, look) {
  const b = look?.body || DEFAULT_LOOK.body;
  const { hi, mid, shad, legFar, legNear, tail } = b;
  const dy = 4; // drop the whole pose toward the ground, like the horse roll/sleep

  g.layer('legs');
  // Splayed, kicking legs — near pair kicks up on frame 0, far pair on frame 1.
  const nearLift = kick ? 0 : 3;
  const farLift  = kick ? 3 : 0;
  pigLeg(g, 5,  farLift,  legFar,  bob + dy); pigLeg(g, 19, farLift,  legFar,  bob + dy);
  pigLeg(g, 8,  nearLift, legNear, bob + dy); pigLeg(g, 22, nearLift, legNear, bob + dy);

  g.layer('tail');
  g.fillStyle(tail, 1);
  g.fillRect(2, 15+bob+dy, 2, 2);
  g.fillRect(1, 17+bob+dy, 2, 2);

  g.layer('body');
  // Body rolled onto its side — flatter, wider silhouette than standing.
  g.fillStyle(mid, 1); g.fillRect(4, 10+bob+dy, 25, 11);
  g.fillStyle(hi, 1);  g.fillRect(4, 10+bob+dy, 25, 3);
  g.fillStyle(shad, 1); g.fillRect(4, 18+bob+dy, 25, 3);
  g.fillStyle(mid, 1); g.fillRect(3, 12+bob+dy, 1, 6);

  g.layer('mud');
  // Mud smeared along the flank/belly, kicked up by the roll.
  g.fillStyle(0x6b4a2e, 0.55);
  g.fillRect(5, 17+bob+dy, 22, 4);
  g.fillStyle(0x5a3d26, 0.4);
  g.fillRect(8, 19+bob+dy, 14, 2);

  g.layer('head');
  // Head resting/relaxed on the ground, tipped back a touch.
  g.fillStyle(mid, 1);
  g.fillRect(23, 8+bob+dy, 8, 8);
  g.fillRect(24, 7+bob+dy, 5, 1);
  g.fillStyle(hi, 1); g.fillRect(24, 7+bob+dy, 5, 1);
  g.fillStyle(shad, 1); g.fillRect(23, 14+bob+dy, 7, 2);

  g.layer('snout');
  g.fillStyle(0xea9a9a, 1); g.fillRect(30, 10+bob+dy, 2, 5);
  g.fillStyle(0xd88888, 1); g.fillRect(30, 10+bob+dy, 2, 1);
  g.fillStyle(0xc05858, 1); g.fillRect(31, 12+bob+dy, 1, 1);

  g.layer('ear');
  g.fillStyle(b.ear, 1);
  g.fillRect(25, 5+bob+dy, 4, 3);
  g.fillStyle(0xc86868, 1); g.fillRect(25, 6+bob+dy, 2, 2);

  g.layer('eye');
  // Contented squint (a slimmer eye) while wallowing.
  g.fillStyle(0x2a1010, 1); g.fillRect(26, 9+bob+dy, 2, 1);
}

export function buildPigTextures(scene, key, look) {
  buildFrames(scene, key, PIG_W, PIG_H, (g, bob, legs) => drawPig(g, bob, legs, look), idleWalkLegs(2));

  ['eat_0', 'eat_1'].forEach((name, i) => {
    gen(scene, `${key}_${name}`, PIG_W * ART_SCALE, PIG_H * ART_SCALE, g0 =>
      drawPigEat(scaledGraphics(g0), i, look));
  });

  ['wallow_0', 'wallow_1'].forEach((name, i) => {
    gen(scene, `${key}_${name}`, PIG_W * ART_SCALE, PIG_H * ART_SCALE, g0 =>
      drawPigWallow(scaledGraphics(g0), i, i === 1, look));
  });
}
