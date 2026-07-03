// Procedural pixel-art baby CHICK (#274) — the offspring of a hen+rooster
// incubation. Faces right, origin (0.5,1). idle_0/1, walk_0..3 frames. A sibling
// of the hen (chickenArt.js) and rooster (roosterArt.js) — same drawing approach
// via the shared `gen` helper (_frames.js) — but visibly a BABY: a small round
// fluffball body, a stubby half-size tail, oversized head/eye (the classic "baby"
// proportions, mirroring how the horse foal keeps a big head on a small body,
// horseArt.js), and no comb/wattle yet (those come in when it grows up into a
// full hen/rooster, mirroring growUpFoal's art swap).

import { gen, scaledGraphics, ART_SCALE } from './_frames.js';

// Noticeably smaller canvas than the hen (16x22) — a chick is a small fluffball.
export const CHICK_W = 11, CHICK_H = 12;

// Chick down colours — softer/fluffier pastel takes on the hen coat family so a
// chick plausibly reads as "baby of that hen" without a genetics system. Indexed
// the SAME as CHICKEN_COATS (chickenArt.js) so a chick can seed from its hen
// parent's coat index directly (seedChickLook in data/species/chicken/incubation.js).
export const CHICK_COATS = [
  { body: 0xfff2d0, bodyHi: 0xffffff, bodyLo: 0xf0dca0, wing: 0xf5e6b8 }, // fluffy cream (white hen's chick)
  { body: 0xe8b088, bodyHi: 0xf5c8a8, bodyLo: 0xd09068, wing: 0xdca078 }, // warm buff-red (rhode island red's chick)
  { body: 0xc0b8a0, bodyHi: 0xd8d0b8, bodyLo: 0xa89c80, wing: 0xb0a690 }, // soft grey-brown (black hen's chick)
  { body: 0xf5dc88, bodyHi: 0xfff0a8, bodyLo: 0xe0c468, wing: 0xecd478 }, // golden yellow (buff hen's chick)
  { body: 0xd8d4c8, bodyHi: 0xeeeae0, bodyLo: 0xc0bcae, wing: 0xcac6b8 }, // pale grey (grey hen's chick)
];

function drawChick(g, bob, phase, coat = CHICK_COATS[0]) {
  const { body, bodyHi, bodyLo, wing } = coat;
  const lL = phase === 1 ? 1 : 0;
  const lR = phase === 3 ? 1 : 0;

  g.layer('legs');
  g.fillStyle(0xe8b840, 1);
  g.fillRect(3, 9 + bob, 1, 2 - lL); g.fillRect(6, 9 + bob, 1, 2 - lR);

  g.layer('tail');
  // Stubby fluff-tuft tail — a chick barely has one yet.
  g.fillStyle(bodyLo, 1); g.fillRect(0, 5 + bob, 2, 2);

  g.layer('body');
  // Small round body — fluffball proportions.
  g.fillStyle(body, 1);   g.fillCircle(4.5, 6 + bob, 4);
  g.fillStyle(bodyHi, 1); g.fillRect(2, 3 + bob, 5, 2);
  g.fillStyle(bodyLo, 1); g.fillRect(2, 8 + bob, 5, 2);
  g.layer('wing');
  g.fillStyle(wing, 1); g.fillRect(2, 5 + bob, 3, 3);

  g.layer('head');
  // Oversized head relative to body — the "baby" read.
  g.fillStyle(body, 1);   g.fillCircle(8, 3 + bob, 3);
  g.fillStyle(bodyHi, 1); g.fillRect(6, 0 + bob, 4, 1.5);
  g.layer('beak');
  g.fillStyle(0xf0a828, 1); g.fillRect(10, 3 + bob, 1.5, 1.5);
  g.layer('eye');
  g.fillStyle(0x1a0800, 1); g.fillRect(8, 2 + bob, 1.5, 1.5);
  g.fillStyle(0xffffff, 0.8); g.fillRect(8, 2 + bob, 0.75, 0.75);
}

// Pecking pose — peckDepth 0 = beak lifted, 1 = beak near ground (chicks peck
// gently, a smaller motion than the hen).
function drawChickEat(g, peckDepth, coat = CHICK_COATS[0]) {
  const { body, bodyHi, bodyLo, wing } = coat;

  g.layer('legs');
  g.fillStyle(0xe8b840, 1); g.fillRect(3, 9, 1, 2); g.fillRect(6, 9, 1, 2);

  g.layer('tail');
  g.fillStyle(bodyLo, 1); g.fillRect(0, 4, 2, 2);

  g.layer('body');
  g.fillStyle(body, 1);   g.fillCircle(4.5, 6, 4);
  g.fillStyle(bodyHi, 1); g.fillRect(2, 3, 5, 2);
  g.layer('wing');
  g.fillStyle(wing, 1); g.fillRect(2, 5, 3, 3);

  g.layer('head');
  const hy = 3 + peckDepth * 2;
  g.fillStyle(body, 1); g.fillCircle(8, hy, 2.75);
  g.layer('beak');
  g.fillStyle(0xf0a828, 1); g.fillRect(10, hy, 1.5, 1.5);
  g.layer('eye');
  g.fillStyle(0x1a0800, 1); g.fillRect(8, hy - 1, 1.5, 1.5);
}

export function buildChickTextures(scene, key, coatIndex = 0) {
  const coat = CHICK_COATS[coatIndex] ?? CHICK_COATS[0];
  const phases = [0, 0, 0, 1, 2, 3];
  const bobs   = [0, 1, 0, 1, 0, 1];
  const names  = ['idle_0', 'idle_1', 'walk_0', 'walk_1', 'walk_2', 'walk_3'];
  const W = CHICK_W * ART_SCALE, H = CHICK_H * ART_SCALE;
  names.forEach((name, i) => {
    gen(scene, `${key}_${name}`, W, H, (g0) => drawChick(scaledGraphics(g0), bobs[i], phases[i], coat));
  });
  gen(scene, `${key}_eat_0`, W, H, (g0) => drawChickEat(scaledGraphics(g0), 1, coat));
  gen(scene, `${key}_eat_1`, W, H, (g0) => drawChickEat(scaledGraphics(g0), 0, coat));
}
