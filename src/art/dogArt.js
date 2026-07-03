// Procedural pixel-art dog (golden retriever). Faces right, origin (0.5,1).
// Currently disabled in the paddock but kept ready to enable; shares the frame/leg
// helpers in _frames.js.
//
// Colours are data-driven (#165): the customizer passes a `look` of { coat, collar }
// palettes. An arg-less call falls back to DEFAULT_LOOK (the original golden), so
// BootScene and the art-preview gallery render the dog unchanged.

import { makeLeg, idleWalkLegs, buildFrames, gen, scaledGraphics, ART_SCALE } from './_frames.js';

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

// A sitting pose (#186 companion charm): the dog settles onto its haunches beside
// an idle player. Rump lowered to the ground with folded hind legs, chest lifted so
// the front legs are straight and planted, head up and alert, tail sweeping the
// ground behind. Same colour data as the standing art; dissect-tagged like the rest.
function drawDogSit(g, look) {
  const c = look?.coat || DEFAULT_LOOK.coat;
  const col = look?.collar || DEFAULT_LOOK.collar;
  const { hi, mid, shad, legNear, tailHi, jaw, ear, earShad, snout, snoutShad } = c;

  g.layer('legs');
  // Straight front legs planted under the lifted chest.
  g.fillStyle(shad, 1);    g.fillRect(18, 16, 3, 7);
  g.fillStyle(legNear, 1); g.fillRect(21, 16, 3, 7);
  g.fillStyle(0x2a2018, 1); g.fillRect(17, 22, 5, 1); g.fillRect(20, 22, 5, 1); // paws
  // Folded hind leg tucked under the lowered rump.
  g.fillStyle(shad, 1);    g.fillRect(6, 15, 8, 4);

  g.layer('tail');
  // Tail sweeping along the ground behind the rump.
  g.fillStyle(legNear, 1); g.fillRect(2, 19, 6, 2);
  g.fillStyle(tailHi, 1);  g.fillRect(2, 19, 5, 1);

  g.layer('body');
  // Rump low at the back, chest rising toward the front — a wedge sitting shape.
  g.fillStyle(mid, 1);  g.fillRect(6, 12, 16, 9);
  g.fillStyle(hi, 1);   g.fillRect(14, 8, 8, 5);   // lifted chest
  g.fillStyle(hi, 1);   g.fillRect(6, 12, 16, 3);
  g.fillStyle(shad, 1); g.fillRect(6, 18, 16, 3);

  g.layer('neck');
  // Upright neck from the raised chest to the head.
  g.fillStyle(mid, 1); g.fillRect(19, 5, 5, 6);
  g.fillStyle(hi, 1);  g.fillRect(19, 5, 5, 2);

  g.layer('collar');
  g.fillStyle(col.mid, 1);  g.fillRect(19, 9, 5, 2);
  g.fillStyle(col.shad, 1); g.fillRect(21, 11, 2, 1); // tag

  g.layer('head');
  // Head held high and alert, snout forward.
  g.fillStyle(mid, 1);  g.fillRect(21, 1, 6, 7);   // skull
  g.fillStyle(hi, 1);   g.fillRect(21, 1, 6, 2);   // top highlight
  g.fillStyle(jaw, 1);  g.fillRect(21, 7, 4, 1);   // jaw shade
  g.fillStyle(snout, 1); g.fillRect(24, 5, 4, 3);  // snout
  g.fillStyle(snoutShad, 1); g.fillRect(24, 7, 4, 1); // chin shade
  g.fillStyle(0x2a1810, 1); g.fillRect(26, 5, 2, 1); // nose

  g.layer('ear');
  g.fillStyle(ear, 1);     g.fillRect(19, 2, 3, 7); // floppy ear
  g.fillStyle(earShad, 1); g.fillRect(19, 5, 2, 4);

  g.layer('eye');
  g.fillStyle(0x2a1808, 1); g.fillRect(23, 4, 1, 2);
  g.fillStyle(0xffffff, 0.7); g.fillRect(23, 4, 1, 1);
}

// Doggy-paddle swim pose (#231): the classic reference — head and back riding above
// the waterline, legs paddling below the surface (mostly hidden), body sitting lower
// and flatter than standing. `kick` alternates a little paddle-splash left/right for
// a lazy two-frame stroke, mirroring the pig wallow's kick alternation. The waterline
// itself isn't drawn here — the animal is placed to visually sit in the stream water
// graphic (world.js buildStream, depth -96) and the shallow submersion reads from the
// lowered body + hidden legs + the splash flecks either side.
function drawDogSwim(g, kick, look) {
  const c = look?.coat || DEFAULT_LOOK.coat;
  const { hi, mid, shad, legNear, tailHi, jaw, ear, earShad, snout, snoutShad } = c;
  const dy = 6; // drop the whole pose toward the waterline, well below the standing pose

  g.layer('legs');
  // Paddling legs — only the very tops break the surface; mostly submerged/hidden, a
  // couple of pixels alternate up on each frame for a lazy "kicking" read.
  const nearUp = kick ? 1 : 0;
  const farUp  = kick ? 0 : 1;
  g.fillStyle(shad, 0.55);    g.fillRect(6,  16 + dy - farUp,  2, 3);
  g.fillStyle(shad, 0.55);    g.fillRect(18, 16 + dy - farUp,  2, 3);
  g.fillStyle(legNear, 0.7);  g.fillRect(9,  15 + dy - nearUp, 2, 3);
  g.fillStyle(legNear, 0.7);  g.fillRect(21, 15 + dy - nearUp, 2, 3);

  g.layer('splash');
  // Little paddle-splash flecks either side, alternating with the kick.
  g.fillStyle(0xeaf7ff, 0.85);
  if (kick) { g.fillRect(4, 17 + dy, 2, 1); g.fillRect(23, 15 + dy, 2, 1); }
  else      { g.fillRect(5, 15 + dy, 2, 1); g.fillRect(22, 17 + dy, 2, 1); }

  g.layer('tail');
  // Tail trails flat on the surface behind, just a damp streak.
  g.fillStyle(legNear, 0.8); g.fillRect(2, 14 + dy, 3, 2);

  g.layer('body');
  // Body riding low and flat in the water — shallower silhouette than standing, no
  // belly/legs visible, top half catching the light.
  g.fillStyle(mid, 1); g.fillRect(4, 11 + dy, 20, 6);
  g.fillStyle(hi, 1);  g.fillRect(4, 11 + dy, 20, 2);
  g.fillStyle(shad, 1); g.fillRect(4, 15 + dy, 20, 2);

  g.layer('neck');
  g.fillStyle(mid, 1); g.fillRect(20, 8 + dy, 5, 5);
  g.fillStyle(hi, 1);  g.fillRect(20, 8 + dy, 5, 2);

  g.layer('head');
  // Head and snout held up clear of the water — the whole point of the pose.
  g.fillStyle(mid, 1); g.fillRect(22, 3 + dy, 6, 7);   // skull
  g.fillStyle(hi, 1);  g.fillRect(22, 3 + dy, 6, 2);   // top highlight
  g.fillStyle(jaw, 1); g.fillRect(22, 9 + dy, 4, 1);   // jaw shade
  g.fillStyle(snout, 1); g.fillRect(25, 7 + dy, 3, 4);
  g.fillStyle(snoutShad, 1); g.fillRect(25, 10 + dy, 3, 1);
  g.fillStyle(0x2a1810, 1); g.fillRect(26, 7 + dy, 2, 1); // nose

  g.layer('ear');
  // Ears pinned back/down against the head, wet-look (a touch darker + tighter).
  g.fillStyle(earShad, 1); g.fillRect(20, 4 + dy, 3, 5);
  g.fillStyle(ear, 1);     g.fillRect(20, 4 + dy, 2, 3);

  g.layer('eye');
  g.fillStyle(0x2a1808, 1); g.fillRect(24, 6 + dy, 1, 2);
  g.fillStyle(0xffffff, 0.7); g.fillRect(24, 6 + dy, 1, 1);
}

export function buildDogTextures(scene, key, look) {
  buildFrames(scene, key, DOG_W, DOG_H, (g, bob, legs) => drawDog(g, bob, legs, look), idleWalkLegs(2));
  // Extra single-frame sit pose (#186), same super-sampled grid as the walk frames.
  gen(scene, `${key}_sit_0`, DOG_W * ART_SCALE, DOG_H * ART_SCALE,
    (g0) => drawDogSit(scaledGraphics(g0), look));

  // Doggy-paddle swim frames (#231), same super-sampled grid, gated on by the
  // `swims` capability (creatures.js only registers swim_0/1 anims when these exist).
  ['swim_0', 'swim_1'].forEach((name, i) => {
    gen(scene, `${key}_${name}`, DOG_W * ART_SCALE, DOG_H * ART_SCALE,
      (g0) => drawDogSwim(scaledGraphics(g0), i === 1, look));
  });
}
