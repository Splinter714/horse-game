// Procedural pixel-art chicken. Faces right, origin (0.5,1). idle_0/1, walk_0..3,
// and eat_0/1 (pecking) frames, in five feather coats. Drawn via the shared `gen`
// helper (_frames.js).

import { gen } from './_frames.js';

export const CHICKEN_W = 16, CHICKEN_H = 22;

// Five feather coat variants
export const CHICKEN_COATS = [
  { body: 0xf0e8d8, bodyHi: 0xffffff, bodyLo: 0xd8d0c0, wing: 0xe0d8c8, wingLo: 0xc8c0b0, tail: 0xd4a050, tailDark: 0xb87830 }, // white
  { body: 0xa83820, bodyHi: 0xc04830, bodyLo: 0x882810, wing: 0x8c2c18, wingLo: 0x6c1c0c, tail: 0x7a2010, tailDark: 0x5a1408 }, // rhode island red
  { body: 0x282820, bodyHi: 0x404038, bodyLo: 0x181810, wing: 0x1c1c18, wingLo: 0x141410, tail: 0x303028, tailDark: 0x202018 }, // black
  { body: 0xe8c060, bodyHi: 0xf4d880, bodyLo: 0xc8a040, wing: 0xd4a848, wingLo: 0xb89038, tail: 0xc09030, tailDark: 0xa07020 }, // buff/golden
  { body: 0x909088, bodyHi: 0xb0b0a8, bodyLo: 0x707068, wing: 0x808078, wingLo: 0x606058, tail: 0x787870, tailDark: 0x585850 }, // grey
];

function drawChicken(g, bob, phase, coat = CHICKEN_COATS[0]) {
  const { body, bodyHi, bodyLo, wing, wingLo, tail, tailDark } = coat;
  const lL = phase === 1 ? 2 : 0;
  const lR = phase === 3 ? 2 : 0;

  g.fillStyle(0xe0c030, 1);
  g.fillRect(4, 16+bob, 2, 5-lL); g.fillRect(9, 16+bob, 2, 5-lR);
  g.fillStyle(0xb89820, 1);
  g.fillRect(2, 21+bob-lL, 5, 1); g.fillRect(7, 21+bob-lR, 5, 1);

  g.fillStyle(tail, 1);     g.fillRect(1, 9+bob, 3, 5);
  g.fillStyle(tailDark, 1); g.fillRect(1, 12+bob, 2, 4);

  g.fillStyle(body, 1);    g.fillRect(2, 10+bob, 12, 8);
  g.fillStyle(bodyHi, 1);  g.fillRect(2, 10+bob, 12, 2);
  g.fillStyle(bodyLo, 1);  g.fillRect(2, 15+bob, 12, 3);
  g.fillStyle(wing, 1);    g.fillRect(3, 11+bob, 9, 5);
  g.fillStyle(wingLo, 1);  g.fillRect(3, 14+bob, 9, 2);

  g.fillStyle(body, 1); g.fillRect(11, 7+bob, 4, 6);
  g.fillStyle(body, 1); g.fillRect(10, 2+bob, 6, 7);
  g.fillStyle(bodyHi, 1); g.fillRect(10, 2+bob, 6, 2);
  g.fillStyle(0xe03030, 1);
  g.fillRect(11, 0+bob, 2, 3); g.fillRect(13, 1+bob, 2, 2); g.fillRect(10, 1+bob, 2, 2);
  g.fillStyle(0xe03030, 1); g.fillRect(14, 6+bob, 2, 3);
  g.fillStyle(0xe0c030, 1); g.fillRect(15, 4+bob, 1, 2);
  g.fillStyle(0x1a0800, 1); g.fillRect(12, 4+bob, 2, 2); // eye
  g.fillStyle(0xffffff, 0.8); g.fillRect(12, 4+bob, 1, 1); // catchlight
}

// Pecking pose — peckDepth 0 = beak lifted, 2 = beak at ground
function drawChickenEat(g, peckDepth, coat = CHICKEN_COATS[0]) {
  const { body, bodyHi, bodyLo, wing, wingLo, tail, tailDark } = coat;

  // Legs — both grounded
  g.fillStyle(0xe0c030, 1); g.fillRect(4, 16, 2, 5); g.fillRect(9, 16, 2, 5);
  g.fillStyle(0xb89820, 1); g.fillRect(2, 21, 5, 1); g.fillRect(7, 21, 5, 1);

  // Tail raised as front dips
  g.fillStyle(tail, 1);     g.fillRect(1, 6, 3, 6);
  g.fillStyle(tailDark, 1); g.fillRect(1, 9, 2, 4);

  // Body
  g.fillStyle(body, 1);   g.fillRect(2, 10, 12, 8);
  g.fillStyle(bodyHi, 1); g.fillRect(2, 10, 12, 2);
  g.fillStyle(bodyLo, 1); g.fillRect(2, 15, 12, 3);
  g.fillStyle(wing, 1);   g.fillRect(3, 11, 9, 5);
  g.fillStyle(wingLo, 1); g.fillRect(3, 14, 9, 2);

  // Neck angled down-forward
  g.fillStyle(body, 1); g.fillRect(12, 12, 3, 6);

  // Head tilted down — peckDepth controls how far it dips
  const hy = 14 + peckDepth;
  g.fillStyle(body, 1);    g.fillRect(11, hy, 5, 5);
  g.fillStyle(bodyHi, 1);  g.fillRect(11, hy, 5, 1);
  g.fillStyle(0xe03030, 1); g.fillRect(12, hy - 1, 2, 2); // comb (small)
  g.fillStyle(0xe03030, 1); g.fillRect(14, hy + 3, 2, 2); // wattle
  g.fillStyle(0xe0c030, 1); g.fillRect(15, hy + 4, 1, 2); // beak pointing down
  g.fillStyle(0x1a0800, 1); g.fillRect(12, hy + 1, 2, 2); // eye
  g.fillStyle(0xffffff, 0.8); g.fillRect(12, hy + 1, 1, 1); // catchlight
}

export function buildChickenTextures(scene, key, coat) {
  const phases = [0, 0, 0, 1, 2, 3];
  const bobs   = [0, 1, 0, 1, 0, 1];
  const names  = ['idle_0','idle_1','walk_0','walk_1','walk_2','walk_3'];
  names.forEach((name, i) => {
    gen(scene, `${key}_${name}`, CHICKEN_W, CHICKEN_H, g => drawChicken(g, bobs[i], phases[i], coat));
  });
  // Eat (peck) frames: beak at ground / beak lifted
  gen(scene, `${key}_eat_0`, CHICKEN_W, CHICKEN_H, g => drawChickenEat(g, 2, coat));
  gen(scene, `${key}_eat_1`, CHICKEN_W, CHICKEN_H, g => drawChickenEat(g, 0, coat));
}
