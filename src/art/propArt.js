// In-world props and overlays: scatter/piles of food, flowers, the saddle overlay,
// grooming/roll effects (dust, stink), shadow, and the gather-source props (haystack,
// apple tree, carrot garden, grain bin, stream). Shares `gen` from _frames.js.

import { gen } from './_frames.js';

export function buildPropTextures(scene) {
  // --- hay bale ---
  // A baled block of straw: chamfered corners, packed straw striations, a sunlit
  // top, two binding twines, and a few loose stalks poking out.
  gen(scene, 'hay', 28, 18, (g) => {
    const base = 0xd9b94a, hi = 0xefd877, hi2 = 0xf7e58c, mid = 0xc4a43a;
    const lo = 0xa9892b, twine = 0x6f5520, twineHi = 0x9a7a2e;
    // soft ground shadow
    g.fillStyle(0x000000, 0.12); g.fillEllipse(14, 17, 26, 4);
    // body with faux-rounded sides (chamfered corners)
    g.fillStyle(base, 1);
    g.fillRect(2, 2, 24, 14);
    g.fillRect(1, 4, 26, 10);
    // sunlit top
    g.fillStyle(hi, 1); g.fillRect(2, 2, 24, 2); g.fillRect(1, 4, 26, 1);
    g.fillStyle(hi2, 1); g.fillRect(3, 2, 19, 1);
    // shaded underside
    g.fillStyle(lo, 1); g.fillRect(1, 13, 26, 1); g.fillRect(2, 14, 24, 2);
    // packed straw layers
    g.fillStyle(mid, 1);
    for (let y = 6; y < 14; y += 3) g.fillRect(2, y, 24, 1);
    // straw flecks for texture (light + dark)
    g.fillStyle(hi, 1);
    g.fillRect(4, 7, 3, 1); g.fillRect(12, 8, 4, 1); g.fillRect(22, 7, 3, 1);
    g.fillRect(6, 10, 3, 1); g.fillRect(15, 11, 4, 1); g.fillRect(23, 10, 2, 1);
    g.fillStyle(lo, 1);
    g.fillRect(9, 9, 2, 1); g.fillRect(17, 7, 2, 1); g.fillRect(11, 12, 3, 1); g.fillRect(24, 12, 2, 1);
    // two binding twines with a highlit edge
    g.fillStyle(twine, 1); g.fillRect(8, 2, 2, 14); g.fillRect(19, 2, 2, 14);
    g.fillStyle(twineHi, 1); g.fillRect(8, 2, 1, 14); g.fillRect(19, 2, 1, 14);
    // loose straw poking out the top
    g.fillStyle(hi2, 1); g.fillRect(5, 0, 1, 2); g.fillRect(13, 0, 1, 2); g.fillRect(25, 1, 1, 1);
    g.fillStyle(hi, 1); g.fillRect(6, 1, 1, 1); g.fillRect(14, 1, 1, 1); g.fillRect(3, 1, 1, 1);
    // a couple stray stalks at the sides
    g.fillStyle(base, 1); g.fillRect(0, 12, 1, 1); g.fillRect(27, 11, 1, 1);
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

  gen(scene, 'hayPile', 36, 12, (g) => { // loose hay spread on ground
    const base = 0xd9b94a, hi = 0xefd877, mid = 0xc4a43a, lo = 0xa9892b;
    g.fillStyle(0x000000, 0.1); g.fillEllipse(18, 11, 34, 3);
    // rounded mound
    g.fillStyle(mid, 1); g.fillEllipse(18, 8, 34, 7);
    g.fillStyle(base, 1); g.fillEllipse(17, 7, 30, 6);
    g.fillStyle(hi, 1); g.fillEllipse(15, 6, 20, 3);
    g.fillStyle(lo, 1); g.fillRect(3, 9, 30, 1);
    // straw stalks of varied height sticking up
    g.fillStyle(base, 1);
    g.fillRect(4, 2, 1, 4); g.fillRect(8, 1, 1, 5); g.fillRect(13, 3, 1, 3);
    g.fillRect(18, 1, 1, 5); g.fillRect(22, 2, 1, 4); g.fillRect(27, 1, 1, 5); g.fillRect(31, 3, 1, 3);
    g.fillStyle(hi, 1);
    g.fillRect(6, 3, 1, 3); g.fillRect(10, 2, 1, 3); g.fillRect(15, 2, 1, 4);
    g.fillRect(20, 3, 1, 3); g.fillRect(24, 2, 1, 3); g.fillRect(29, 3, 1, 3);
    // scattered straw flecks across the mound
    g.fillStyle(lo, 1);
    g.fillRect(7, 7, 2, 1); g.fillRect(16, 8, 3, 1); g.fillRect(25, 7, 2, 1);
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
  // Haystack — a low stack of rectangular straw bales to gather hay from,
  // with loose fuzzy straw poking out around the edges.
  gen(scene, 'haystack', 48, 40, (g) => {
    const base = 0xd9b94a, hi = 0xefd877, hi2 = 0xf7e58c, mid = 0xc4a43a;
    const lo = 0xa9892b, twine = 0x6f5520, twineHi = 0x9a7a2e;
    // a tuft of loose straw stalks fanning up from (x, y)
    const tuft = (x, y) => {
      g.fillStyle(base, 1);
      g.fillRect(x - 2, y - 3, 1, 4); g.fillRect(x, y - 4, 1, 5); g.fillRect(x + 2, y - 3, 1, 4);
      g.fillStyle(hi, 1);
      g.fillRect(x - 1, y - 4, 1, 4); g.fillRect(x + 1, y - 3, 1, 3);
    };
    // draw one rectangular bale at (x,y) of size w×h, with twine + texture
    const bale = (x, y, w, h) => {
      g.fillStyle(base, 1); g.fillRect(x, y, w, h);          // body
      g.fillStyle(hi, 1); g.fillRect(x, y, w, 2);            // sunlit top
      g.fillStyle(hi2, 1); g.fillRect(x + 1, y, w - 4, 1);
      g.fillStyle(mid, 1);                                    // packed straw layers
      for (let yy = y + 4; yy < y + h - 1; yy += 3) g.fillRect(x, yy, w, 1);
      g.fillStyle(lo, 1); g.fillRect(x, y + h - 2, w, 2);    // shaded underside
      // straw flecks
      g.fillStyle(hi, 1); g.fillRect(x + 3, y + 5, 2, 1); g.fillRect(x + w - 7, y + 6, 2, 1);
      g.fillStyle(lo, 1); g.fillRect(x + 5, y + 8, 2, 1);
      // ragged loose straw whiskers along the top
      g.fillStyle(base, 1);
      g.fillRect(x + 2, y - 1, 1, 1); g.fillRect(x + w - 5, y - 1, 1, 1);
      g.fillStyle(hi, 1); g.fillRect(x + w - 4, y - 1, 1, 1);
      // fuzzy cut-straw whiskers poking out the left & right ends — long,
      // irregular & janky: each is [yOffset, length], lengths all over the place
      const leftW  = [[2, 3], [4, 5], [6, 2], [8, 4], [10, 1], [11, 5], [13, 3], [15, 4]];
      const rightW = [[3, 4], [5, 2], [7, 5], [9, 3], [10, 5], [12, 1], [14, 4], [16, 2]];
      g.fillStyle(base, 1);
      for (const [dy, len] of leftW)  g.fillRect(x - len, y + dy, len, 1);
      for (const [dy, len] of rightW) g.fillRect(x + w, y + dy, len, 1);
      g.fillStyle(hi, 1); // bright frayed tips
      for (const [dy, len] of leftW)  g.fillRect(x - len, y + dy, 1, 1);
      for (const [dy, len] of rightW) g.fillRect(x + w + len - 1, y + dy, 1, 1);
      g.fillStyle(lo, 1); // a few darker strands
      g.fillRect(x - 3, y + 9, 2, 1); g.fillRect(x + w, y + 6, 2, 1);
      // two binding twines
      const t1 = x + Math.round(w * 0.28), t2 = x + Math.round(w * 0.68);
      g.fillStyle(twine, 1); g.fillRect(t1, y, 2, h); g.fillRect(t2, y, 2, h);
      g.fillStyle(twineHi, 1); g.fillRect(t1, y, 1, h); g.fillRect(t2, y, 1, h);
    };
    // ground shadow
    g.fillStyle(0x000000, 0.12); g.fillEllipse(24, 38, 48, 6);
    // bottom row: three bales side by side; top row: two bales offset
    // (inset ~6px each side so the long end whiskers have room to poke out)
    bale(6, 21, 12, 18);
    bale(18, 21, 12, 18);
    bale(30, 21, 12, 18);
    bale(12, 5, 12, 16);
    bale(24, 5, 12, 16);
    // fuzzy loose straw tufts poking out around the stack
    tuft(18, 6); tuft(30, 6);     // along the seam of the top bales
    tuft(8, 24); tuft(40, 24);    // tucked between the rows at the sides
    tuft(24, 5);                  // a wisp off the very top
    // scattered loose straw at the base
    g.fillStyle(base, 1);
    g.fillRect(2, 38, 3, 1); g.fillRect(20, 39, 4, 1); g.fillRect(40, 38, 4, 1);
    g.fillStyle(hi, 1); g.fillRect(10, 39, 2, 1); g.fillRect(34, 39, 2, 1);
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
  // Water stream — a wide meandering channel flowing across the plot, with
  // grassy banks, current ripples, stepping stones, and reed tufts.
  gen(scene, 'stream', 120, 44, (g) => {
    const W = 120;
    const cy = (x) => 23 + 5 * Math.sin(x / 11) + 2 * Math.sin(x / 4); // wavy centerline
    // grassy bank (the channel cut, slightly wider than the water)
    g.fillStyle(0x4a7a3a, 1);
    for (let x = 0; x < W; x++) { const y = cy(x); g.fillRect(x, y - 13, 1, 26); }
    // darker damp mud rim along both edges
    g.fillStyle(0x3e6630, 1);
    for (let x = 0; x < W; x++) { const y = cy(x); g.fillRect(x, y - 13, 1, 2); g.fillRect(x, y + 11, 1, 2); }
    // water body
    g.fillStyle(0x3f7fb5, 1);
    for (let x = 0; x < W; x++) { const y = cy(x); g.fillRect(x, y - 9, 1, 18); }
    // deeper shade along the far (top) edge
    g.fillStyle(0x356f9e, 1);
    for (let x = 0; x < W; x++) { const y = cy(x); g.fillRect(x, y - 9, 1, 2); }
    // sunlit surface on the upper half
    g.fillStyle(0x5fa6d6, 1);
    for (let x = 0; x < W; x++) { const y = cy(x); g.fillRect(x, y - 7, 1, 6); }
    // bright current ripples streaking along the flow
    g.fillStyle(0x9ae0f8, 0.85);
    for (const rx of [8, 26, 44, 70, 92, 108]) {
      const y = cy(rx);
      g.fillRect(rx, y - 4, 5, 1); g.fillRect(rx + 2, y - 1, 4, 1); g.fillRect(rx - 1, y + 3, 4, 1);
    }
    g.fillStyle(0xc8f0ff, 0.7);
    for (const rx of [16, 54, 84, 102]) { const y = cy(rx); g.fillRect(rx, y - 2, 3, 1); }
    // stepping stones / rocks in and beside the water
    const rock = (x, y, r, c) => {
      g.fillStyle(0x000000, 0.12); g.fillEllipse(x, y + r - 1, r * 2.2, r); // tiny shadow
      g.fillStyle(c, 1); g.fillEllipse(x, y, r * 2, r * 1.6);
      g.fillStyle(0x9aa0a4, 1); g.fillEllipse(x - r * 0.4, y - r * 0.4, r, r * 0.7); // highlight
    };
    rock(34, cy(34) + 1, 4, 0x747b80);
    rock(64, cy(64) - 1, 3, 0x6c7378);
    rock(96, cy(96) + 2, 4, 0x747b80);
    // reed / grass tufts along the banks (a blade spans [y-len, y] up, or [y, y+len] down)
    const reeds = (x, top) => {
      const y = top ? cy(x) - 12 : cy(x) + 12;
      const blade = (bx, len) => g.fillRect(bx, top ? y - len : y, 1, len);
      g.fillStyle(0x3b8a26, 1); blade(x - 1, 3); blade(x + 1, 4); blade(x + 3, 2);
      g.fillStyle(0x4fa838, 1); blade(x, 3); blade(x + 2, 3);
    };
    reeds(12, true); reeds(50, true); reeds(88, true);
    reeds(28, false); reeds(74, false); reeds(106, false);
  });
}
