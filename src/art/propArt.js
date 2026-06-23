// In-world props and overlays: scatter/piles of food, flowers, the saddle overlay,
// grooming/roll effects (dust, stink), shadow, and the gather-source props (haystack,
// apple tree, carrot garden, grain bin, stream). Shares `gen` from _frames.js.

import { gen } from './_frames.js';

export function buildPropTextures(scene) {
  // --- hay bale ---
  gen(scene, 'hay', 28, 18, (g) => {
    g.fillStyle(0xd9b94a, 1); g.fillRect(0, 0, 28, 18);
    g.fillStyle(0xc4a43a, 1);
    g.fillRect(0, 5, 28, 1); g.fillRect(0, 11, 28, 1);
    g.fillStyle(0x9a7c2a, 1); g.fillRect(6, 0, 1, 18); g.fillRect(20, 0, 1, 18);
  });

  // --- flowers ---
  const flower = (key, petal) => gen(scene, key, 8, 8, (g) => {
    g.fillStyle(0x3b6d11, 1); g.fillRect(3, 4, 1, 4);
    g.fillStyle(petal, 1);
    g.fillRect(2, 1, 3, 1); g.fillRect(1, 2, 5, 2); g.fillRect(2, 4, 3, 1);
    g.fillStyle(0xfff2b0, 1); g.fillRect(3, 2, 1, 1);
  });
  flower('flowerRed', 0xe2554a);
  flower('flowerYellow', 0xf0c040);
  flower('flowerWhite', 0xeeeeee);

  // --- soft shadow blob ---
  gen(scene, 'shadow', 44, 14, (g) => {
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(22, 7, 44, 14);
  });

  // --- dust splotches overlay (sits on a horse's body when it needs brushing) ---
  // 64×54 to match the horse frame, origin (0.5,1); irregular muddy patches
  // clustered over the barrel/back. Runtime alpha (driven by the grooming stat)
  // fades the whole layer in and out together. (issue #26)
  gen(scene, 'dustSplotches', 64, 54, (g) => {
    const mud  = 0x4d3115;   // darker, muckier brown
    const dust = 0x6b4a2e;
    // Dense caked-on mud covering most of the barrel/back/rump.
    g.fillStyle(mud, 0.95);
    g.fillEllipse(20, 26, 18, 12);  // rump/barrel
    g.fillEllipse(32, 29, 16, 11);  // mid belly
    g.fillEllipse(42, 25, 13, 9);   // shoulder
    g.fillEllipse(14, 23, 9, 8);    // upper rump
    g.fillEllipse(27, 21, 12, 6);   // along the back
    g.fillStyle(dust, 0.9);         // lighter clods on top for texture
    g.fillCircle(22, 24, 3);
    g.fillCircle(34, 27, 3);
    g.fillCircle(43, 28, 2.5);
    g.fillCircle(17, 28, 2.5);
    g.fillCircle(29, 22, 2.5);
    g.fillCircle(38, 31, 2);
    g.fillStyle(0x382309, 0.9);     // darkest grime flecks
    g.fillCircle(25, 28, 1.5);
    g.fillCircle(36, 24, 1.5);
    g.fillCircle(19, 25, 1.5);
  });

  // --- "stink" lines (wavy vertical squiggles for a very dirty horse) ---
  gen(scene, 'stinkLines', 26, 22, (g) => {
    const squig = (x0, col) => {
      g.lineStyle(2, col, 0.9);
      g.beginPath();
      g.moveTo(x0, 21);
      g.lineTo(x0 - 3, 16);
      g.lineTo(x0 + 3, 11);
      g.lineTo(x0 - 3, 6);
      g.lineTo(x0 + 1, 1);
      g.strokePath();
    };
    squig(6,  0x8a9a55);   // sickly green
    squig(14, 0x9aa766);
    squig(21, 0x8a9a55);
    // a tiny fly buzzing around
    g.fillStyle(0x2a2a2a, 1);
    g.fillCircle(20, 4, 1.4);
  });

  // --- dust puff (kicked up when a horse rolls in the dirt) ---
  gen(scene, 'dustPuff', 16, 12, (g) => {
    g.fillStyle(0xcbb089, 0.8);
    g.fillCircle(5, 7, 4);
    g.fillCircle(10, 6, 4.5);
    g.fillCircle(13, 9, 3);
    g.fillStyle(0xe0cba6, 0.7);
    g.fillCircle(7, 5, 2.5);
  });

  gen(scene, 'hayPile', 36, 12, (g) => { // hay spread on ground
    g.fillStyle(0xd9b94a, 1); g.fillRect(2, 5, 32, 7);
    g.fillStyle(0xc4a43a, 1); g.fillRect(2, 8, 32, 3);
    g.fillStyle(0xd9b94a, 1);
    g.fillRect(4, 2, 1, 4); g.fillRect(8, 1, 1, 5); g.fillRect(13, 2, 1, 4);
    g.fillRect(18, 1, 1, 5); g.fillRect(22, 2, 1, 4); g.fillRect(27, 1, 1, 5);
    g.fillStyle(0xe8cc6a, 1);
    g.fillRect(6, 3, 1, 3); g.fillRect(15, 2, 1, 4); g.fillRect(24, 3, 1, 3);
  });

  gen(scene, 'saddleOverlay', 64, 54, (g) => { // drawn at horse-back position (x=19-38, y=16-22)
    g.fillStyle(0x8a5020, 1); g.fillRect(19, 16, 20, 6);
    g.fillStyle(0x6a3c18, 1); g.fillRect(18, 18, 4, 5); g.fillRect(35, 18, 4, 5);
    g.fillStyle(0xb07040, 1); g.fillRect(20, 17, 17, 2);
    g.fillStyle(0x6a3c18, 1);
    g.fillRect(22, 22, 1, 9); g.fillRect(33, 22, 1, 9);
    g.fillRect(20, 30, 4, 2); g.fillRect(31, 30, 4, 2);
  });

  gen(scene, 'seedPile', 22, 8, (g) => { // seeds scattered on ground
    g.fillStyle(0xc8a030, 1);
    g.fillRect(2, 3, 2, 2); g.fillRect(6, 2, 2, 2); g.fillRect(10, 4, 2, 2);
    g.fillRect(14, 2, 2, 2); g.fillRect(18, 3, 2, 2); g.fillRect(4, 5, 2, 2);
    g.fillRect(8, 5, 2, 2);  g.fillRect(12, 3, 2, 2); g.fillRect(16, 5, 2, 2);
    g.fillStyle(0xe8c050, 1);
    g.fillRect(3, 3, 1, 1); g.fillRect(7, 2, 1, 1); g.fillRect(11, 4, 1, 1);
    g.fillRect(15, 2, 1, 1); g.fillRect(5, 5, 1, 1);
  });
  gen(scene, 'applePile', 26, 14, (g) => { // a couple of apples on the ground
    // Apple 1
    g.fillStyle(0xd64545, 1); g.fillCircle(8, 9, 5);
    g.fillStyle(0xe87a7a, 1); g.fillCircle(6, 7, 1.5);
    g.fillStyle(0x6a3d1a, 1); g.fillRect(8, 3, 1, 3);
    g.fillStyle(0x3b6d11, 1); g.fillEllipse(11, 4, 4, 2);
    // Apple 2
    g.fillStyle(0xc23b3b, 1); g.fillCircle(18, 10, 4.5);
    g.fillStyle(0xe87a7a, 1); g.fillCircle(16, 8, 1.2);
    g.fillStyle(0x6a3d1a, 1); g.fillRect(18, 5, 1, 3);
  });
  gen(scene, 'carrotPile', 28, 14, (g) => { // a couple of carrots on the ground
    // Carrot 1 (lying diagonally)
    g.fillStyle(0xf07830, 1); g.fillTriangle(3, 11, 14, 6, 14, 10);
    g.fillStyle(0xff9a5a, 1); g.fillRect(6, 8, 4, 1);
    g.fillStyle(0x3b8a1c, 1); g.fillRect(14, 4, 1, 4); g.fillRect(16, 5, 1, 3); g.fillRect(12, 5, 1, 3);
    // Carrot 2
    g.fillStyle(0xe06a26, 1); g.fillTriangle(14, 12, 24, 9, 24, 12);
    g.fillStyle(0xff9a5a, 1); g.fillRect(17, 11, 4, 1);
    g.fillStyle(0x3b8a1c, 1); g.fillRect(24, 7, 1, 4); g.fillRect(26, 8, 1, 3);
  });

  // --- gathering source props (issue #63) ---
  // Haystack — a big mound to gather hay from
  gen(scene, 'haystack', 48, 40, (g) => {
    g.fillStyle(0xc4a43a, 1); g.fillEllipse(24, 36, 46, 10); // base shadow
    g.fillStyle(0xd9b94a, 1); g.fillEllipse(24, 26, 44, 26); // body
    g.fillStyle(0xe8cc6a, 1); g.fillEllipse(20, 18, 30, 16); // top highlight
    g.fillStyle(0xc4a43a, 1);
    for (let y = 18; y < 36; y += 5) g.fillRect(4, y, 40, 1); // layered straw lines
    g.fillStyle(0xb08c2a, 1);
    g.fillRect(10, 14, 1, 4); g.fillRect(26, 12, 1, 5); g.fillRect(38, 16, 1, 4); // stray stalks
  });
  // Apple tree — leafy crown over a trunk
  gen(scene, 'appleTree', 52, 68, (g) => {
    g.fillStyle(0x6a4424, 1); g.fillRect(23, 40, 6, 26); // trunk
    g.fillStyle(0x83562e, 1); g.fillRect(23, 40, 2, 26);
    g.fillStyle(0x2f6e1f, 1); g.fillCircle(26, 26, 24); // crown
    g.fillStyle(0x3b8a26, 1); g.fillCircle(18, 20, 14); g.fillCircle(36, 22, 13);
    g.fillStyle(0x4fa838, 1); g.fillCircle(20, 16, 8);
    g.fillStyle(0xd64545, 1); // apples
    g.fillCircle(14, 28, 3); g.fillCircle(30, 16, 3); g.fillCircle(38, 30, 3); g.fillCircle(24, 34, 3);
    g.fillStyle(0xe87a7a, 1);
    g.fillCircle(13, 27, 1); g.fillCircle(29, 15, 1); g.fillCircle(37, 29, 1); g.fillCircle(23, 33, 1);
  });
  // Carrot garden — a tilled plot with carrot tops poking out
  gen(scene, 'carrotGarden', 56, 32, (g) => {
    g.fillStyle(0x6a4a2a, 1); g.fillRoundedRect(0, 8, 56, 22, 4); // soil bed
    g.fillStyle(0x5a3e22, 1);
    for (let x = 4; x < 56; x += 8) g.fillRect(x, 10, 1, 18); // furrows
    g.fillStyle(0x7a5632, 1); g.fillRect(0, 8, 56, 2);
    // carrot tops in rows
    const tops = [[8, 12], [20, 14], [32, 12], [44, 13], [14, 22], [27, 23], [39, 22], [50, 22]];
    for (const [tx, ty] of tops) {
      g.fillStyle(0xf07830, 1); g.fillTriangle(tx, ty + 5, tx - 2, ty, tx + 2, ty);
      g.fillStyle(0x3b8a1c, 1);
      g.fillRect(tx - 1, ty - 4, 1, 4); g.fillRect(tx, ty - 5, 1, 5); g.fillRect(tx + 1, ty - 4, 1, 4);
    }
  });
  // Grain bin — an open sack of seed to fill baskets from (for the chickens)
  gen(scene, 'grainBin', 40, 44, (g) => {
    g.fillStyle(0xb98a4a, 1); g.fillRect(6, 14, 28, 28); // burlap sack body
    g.fillStyle(0xa87a3c, 1); g.fillRect(6, 14, 28, 3);
    g.fillStyle(0xcb9c58, 1); g.fillRect(8, 18, 3, 22); // fold highlight
    g.fillStyle(0xa87a3c, 1); g.fillRect(20, 18, 1, 22); g.fillRect(28, 18, 1, 22); // seams
    // rolled-down rim at the top
    g.fillStyle(0xcb9c58, 1); g.fillEllipse(20, 14, 30, 8);
    g.fillStyle(0x8a6430, 1); g.fillEllipse(20, 13, 22, 6); // opening
    // grain heaped at the mouth
    g.fillStyle(0xd4a93c, 1); g.fillEllipse(20, 11, 20, 7);
    g.fillStyle(0xc8a030, 1);
    g.fillRect(12, 9, 2, 2); g.fillRect(18, 8, 2, 2); g.fillRect(24, 9, 2, 2); g.fillRect(15, 11, 2, 2); g.fillRect(22, 11, 2, 2);
    g.fillStyle(0xe8c050, 1); g.fillRect(16, 8, 1, 1); g.fillRect(21, 7, 1, 1);
    // a little spilled grain at the foot
    g.fillStyle(0xc8a030, 1); g.fillRect(3, 41, 2, 1); g.fillRect(35, 41, 2, 1); g.fillRect(30, 42, 2, 1);
  });
  // Water stream — a still pool/stream segment to fill buckets
  gen(scene, 'stream', 64, 40, (g) => {
    g.fillStyle(0x4a7a3a, 1); g.fillEllipse(32, 20, 64, 38); // muddy bank
    g.fillStyle(0x3f7fb5, 1); g.fillEllipse(32, 20, 56, 30); // water
    g.fillStyle(0x5fa6d6, 1); g.fillEllipse(30, 17, 44, 20);
    g.fillStyle(0x9ae0f8, 0.8); // ripples
    g.fillRect(14, 14, 12, 1); g.fillRect(34, 18, 14, 1); g.fillRect(20, 24, 10, 1); g.fillRect(40, 26, 8, 1);
  });
}
