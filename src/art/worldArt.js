// Procedural pixel-art for the environment's fixed structures: grass tiles, barn,
// fence, gate, trough, coop, nests/eggs, farm stand, and the NPC customer. All
// generated into textures so the game runs with zero external image files.
//
// `buildWorldTextures` is the single entry point BootScene calls; it builds the
// structures here and delegates the icons (iconArt.js) and props/effects/gather
// sources (propArt.js). Shares the snapshot helper (`gen`) from _frames.js.

import { gen } from './_frames.js';
import { buildIconTextures } from './iconArt.js';
import { buildPropTextures } from './propArt.js';

export function buildWorldTextures(scene) {
  // --- grass tiles (two variants for subtle variety) ---
  gen(scene, 'grass', 32, 32, (g) => {
    g.fillStyle(0x82c24e, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x76b446, 1);
    g.fillRect(5, 8, 2, 4); g.fillRect(20, 18, 2, 4); g.fillRect(26, 5, 2, 4);
    g.fillStyle(0x8fcf5a, 1);
    g.fillRect(12, 22, 2, 3); g.fillRect(28, 26, 2, 3); g.fillRect(2, 27, 2, 3);
  });
  gen(scene, 'grass2', 32, 32, (g) => {
    g.fillStyle(0x82c24e, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x76b446, 1);
    g.fillRect(14, 6, 2, 4); g.fillRect(3, 16, 2, 4); g.fillRect(24, 22, 2, 4);
    g.fillStyle(0x8fcf5a, 1);
    g.fillRect(8, 12, 2, 3); g.fillRect(20, 28, 2, 3);
  });

  // --- barn ---
  gen(scene, 'barn', 84, 66, (g) => {
    g.fillStyle(0x7a2a1c, 1);
    g.fillTriangle(2, 20, 42, 2, 82, 20);
    g.fillStyle(0xb6432e, 1); g.fillRect(8, 20, 68, 44);
    g.fillStyle(0xc8543c, 1); g.fillRect(8, 20, 68, 6);
    g.fillStyle(0x5a2418, 1); g.fillRect(34, 40, 18, 24);
    g.fillStyle(0x7a2a1c, 1); g.fillRect(42, 40, 2, 24);
    g.fillStyle(0xf0d890, 1); g.fillRect(16, 30, 12, 10); g.fillRect(56, 30, 12, 10);
    g.fillStyle(0x7a2a1c, 1);
    g.fillRect(21, 30, 2, 10); g.fillRect(16, 34, 12, 2);
    g.fillRect(61, 30, 2, 10); g.fillRect(56, 34, 12, 2);
  });

  // --- fence segment (tileable horizontally, 48 wide) ---
  gen(scene, 'fence', 48, 24, (g) => {
    g.fillStyle(0xc8924c, 1); g.fillRect(0, 6, 48, 3);
    g.fillStyle(0xbc8442, 1); g.fillRect(0, 14, 48, 3);
    g.fillStyle(0xa8743a, 1); g.fillRect(2, 2, 4, 20);
    g.fillStyle(0xc8924c, 1); g.fillRect(2, 2, 2, 20);
  });

  // --- gate closed (blocks passage) ---
  gen(scene, 'gateClosed', 56, 48, (g) => {
    // Posts on left and right
    g.fillStyle(0x8a5828, 1); g.fillRect(0, 0, 4, 48); g.fillRect(52, 0, 4, 48);
    // Horizontal cross-beams
    g.fillStyle(0xa8743a, 1); g.fillRect(0, 8, 56, 2);
    g.fillStyle(0xc8924c, 1); g.fillRect(0, 12, 56, 2);
    g.fillStyle(0xa8743a, 1); g.fillRect(0, 24, 56, 2);
    g.fillStyle(0xc8924c, 1); g.fillRect(0, 28, 56, 2);
    g.fillStyle(0xa8743a, 1); g.fillRect(0, 40, 56, 2);
    // Vertical slats
    g.fillStyle(0xa8743a, 1);
    for (let x = 8; x < 52; x += 6) g.fillRect(x, 2, 3, 44);
    g.fillStyle(0xc8924c, 1);
    for (let x = 10; x < 52; x += 6) g.fillRect(x, 4, 1, 40);
    // Gate latch pin
    g.fillStyle(0x6a5030, 1); g.fillCircle(28, 24, 2);
  });

  // --- gate open (swung to the right side) ---
  gen(scene, 'gateOpen', 56, 48, (g) => {
    // Left post only (right post would have the swung gate against it)
    g.fillStyle(0x8a5828, 1); g.fillRect(0, 0, 4, 48);
    // Right post open
    g.fillStyle(0x8a5828, 1); g.fillRect(52, 0, 4, 48);
    // Open passage marked with lighter ground
    g.fillStyle(0x9ad060, 0.5); g.fillRect(4, 20, 48, 8);
  });

  // --- water trough (empty = dry dark interior) ---
  gen(scene, 'trough', 100, 26, (g) => {
    g.fillStyle(0x8a5a2e, 1); g.fillRect(0, 6, 100, 20);
    g.fillStyle(0xa06c38, 1); g.fillRect(0, 2, 100, 5);
    g.fillStyle(0x3a2410, 1); g.fillRect(4, 8, 92, 10); // dry dark interior
    g.fillStyle(0x2a1a08, 1); g.fillRect(4, 15, 92, 3); // shadow at bottom
    // Post dividers so it reads as one long trough
    g.fillStyle(0x6a3c18, 1); g.fillRect(47, 4, 4, 22); g.fillRect(49, 2, 2, 4);
  });
  gen(scene, 'troughFull', 100, 26, (g) => {
    g.fillStyle(0x8a5a2e, 1); g.fillRect(0, 6, 100, 20);
    g.fillStyle(0xa06c38, 1); g.fillRect(0, 2, 100, 5);
    g.fillStyle(0x5fa6d6, 1); g.fillRect(4, 8, 92, 10);
    g.fillStyle(0x9ae0f8, 1); g.fillRect(4, 8, 92, 3);
    g.fillStyle(0x7cc8e8, 0.7);
    g.fillRect(8, 12, 10, 1); g.fillRect(30, 14, 12, 1); g.fillRect(60, 11, 8, 1); g.fillRect(78, 13, 10, 1);
    g.fillStyle(0x6a3c18, 1); g.fillRect(47, 4, 4, 22); g.fillRect(49, 2, 2, 4);
  });
  // Partial fills (#103): the interior runs y=8..18 (10px). Water sits in the
  // lower band — about two-thirds for half, a shallow sliver for low — with the
  // dry dark interior showing above it.
  gen(scene, 'troughHalf', 100, 26, (g) => {
    g.fillStyle(0x8a5a2e, 1); g.fillRect(0, 6, 100, 20);
    g.fillStyle(0xa06c38, 1); g.fillRect(0, 2, 100, 5);
    g.fillStyle(0x3a2410, 1); g.fillRect(4, 8, 92, 10);   // dry interior
    g.fillStyle(0x5fa6d6, 1); g.fillRect(4, 12, 92, 6);   // water (lower ~two-thirds)
    g.fillStyle(0x9ae0f8, 1); g.fillRect(4, 12, 92, 2);   // surface highlight
    g.fillStyle(0x7cc8e8, 0.7); g.fillRect(8, 15, 10, 1); g.fillRect(34, 16, 12, 1); g.fillRect(64, 14, 8, 1);
    g.fillStyle(0x6a3c18, 1); g.fillRect(47, 4, 4, 22); g.fillRect(49, 2, 2, 4);
  });
  gen(scene, 'troughLow', 100, 26, (g) => {
    g.fillStyle(0x8a5a2e, 1); g.fillRect(0, 6, 100, 20);
    g.fillStyle(0xa06c38, 1); g.fillRect(0, 2, 100, 5);
    g.fillStyle(0x3a2410, 1); g.fillRect(4, 8, 92, 10);   // dry interior
    g.fillStyle(0x2a1a08, 1); g.fillRect(4, 15, 92, 3);   // damp shadow
    g.fillStyle(0x4a86b0, 1); g.fillRect(4, 16, 92, 2);   // shallow water at the bottom
    g.fillStyle(0x7cc8e8, 0.55); g.fillRect(10, 16, 9, 1); g.fillRect(62, 16, 8, 1);
    g.fillStyle(0x6a3c18, 1); g.fillRect(47, 4, 4, 22); g.fillRect(49, 2, 2, 4);
  });

  // --- chicken coop (64 × 52) ---
  // A raised hen-house: short legs, a chicken-sized pop-door with a ramp, a
  // hinged nesting box on the side, a wire vent (no glass), and a rooster
  // weathervane — all to read as a coop, not a dwelling.
  gen(scene, 'coop', 64, 52, (g) => {
    const wall = 0xcf9a5c, wallDark = 0xa9743c, post = 0x8a5a2e;
    const roofDark = 0x5a3418, roofMid = 0x8a5024, roofHi = 0xb87040;
    const dark = 0x2a1808, legWood = 0x6e4a26, lid = 0x9a6030;
    const wire = 0x9a8a6a, comb = 0xd23a2a, beak = 0xe0a020;
    const straw = 0xe8c34a;

    // Legs (drawn behind the body so they peek out below)
    g.fillStyle(legWood, 1);
    g.fillRect(12, 44, 4, 8); g.fillRect(38, 44, 4, 8); g.fillRect(54, 42, 3, 10);

    // Main body box
    g.fillStyle(wall, 1);     g.fillRect(8, 20, 40, 26);
    g.fillStyle(wallDark, 1); g.fillRect(8, 20, 40, 3);  // eave shadow
    g.fillStyle(wallDark, 1); g.fillRect(8, 42, 40, 4);  // ground shadow
    g.fillStyle(wallDark, 1);                            // horizontal planks
    for (let y = 25; y < 42; y += 4) g.fillRect(8, y, 40, 1);
    g.fillStyle(post, 1); g.fillRect(8, 20, 3, 26); g.fillRect(45, 20, 3, 26);

    // Nesting box bump-out on the right with a hinged, slanted lid
    g.fillStyle(wall, 1);     g.fillRect(46, 30, 14, 12);
    g.fillStyle(wallDark, 1); g.fillRect(46, 38, 14, 4);
    g.fillStyle(lid, 1);      g.fillTriangle(44, 31, 61, 25, 61, 31);
    g.fillStyle(0x6e4326, 1); g.fillRect(44, 30, 17, 1);  // lid edge
    g.fillStyle(0x3a2410, 1); g.fillCircle(58, 28, 1);    // lid knob
    g.fillStyle(straw, 1);    g.fillRect(47, 41, 3, 1); g.fillRect(55, 41, 3, 1);

    // Gable roof over the body
    g.fillStyle(roofDark, 1); g.fillTriangle(3, 23, 28, 7, 53, 23);
    g.fillStyle(roofMid, 1);  g.fillTriangle(6, 23, 28, 10, 50, 23);
    g.fillStyle(roofHi, 1);   // left-slope highlight streaks
    g.fillRect(11, 18, 2, 4); g.fillRect(16, 15, 2, 5); g.fillRect(21, 12, 2, 6);
    g.fillStyle(0x6e4326, 1); g.fillRect(3, 22, 50, 2); // eave board

    // Rooster weathervane on the ridge
    g.fillStyle(0x3a2410, 1);
    g.fillRect(30, 1, 1, 7);          // pole
    g.fillEllipse(29, 2, 7, 3);       // body
    g.fillRect(25, 0, 2, 3);          // tail
    g.fillStyle(comb, 1); g.fillRect(32, 0, 1, 2); // comb
    g.fillStyle(beak, 1); g.fillRect(33, 1, 1, 1); // beak

    // Wire vent (barred, not glass) high-center on the wall
    g.fillStyle(dark, 1);     g.fillRect(27, 24, 10, 8);
    g.fillStyle(wire, 1);
    g.fillRect(27, 27, 10, 1); g.fillRect(27, 29, 10, 1);   // horizontal wires
    g.fillRect(30, 24, 1, 8);  g.fillRect(33, 24, 1, 8);    // vertical wires
    g.fillStyle(0x6e4326, 1);
    g.fillRect(26, 23, 12, 1); g.fillRect(26, 32, 12, 1);
    g.fillRect(26, 23, 1, 10); g.fillRect(37, 23, 1, 10);

    // Pop-door (chicken sized)
    g.fillStyle(0x6e4326, 1); g.fillRect(12, 33, 11, 12); // frame
    g.fillStyle(dark, 1);     g.fillRect(13, 34, 9, 11);  // opening

    // Ramp from the pop-door down to the ground, with rungs
    g.fillStyle(0xb5824a, 1);
    g.fillTriangle(13, 44, 22, 44, 6, 52);
    g.fillTriangle(22, 44, 6, 52, 15, 52);
    g.fillStyle(0x6e4326, 1);
    g.fillRect(13, 47, 4, 1); g.fillRect(10, 49, 4, 1); g.fillRect(8, 51, 4, 1);
  });

  // --- nest (18 × 12) — woven straw ring ---
  gen(scene, 'nest', 18, 12, (g) => {
    // Outer straw ring
    g.fillStyle(0xb87828, 1); g.fillEllipse(9, 8, 18, 10);
    g.fillStyle(0xd4a030, 1); g.fillEllipse(9, 7, 16, 8);
    g.fillStyle(0xc49028, 1); g.fillEllipse(9, 8, 12, 6);
    // Inner hollow
    g.fillStyle(0x6a3c10, 1); g.fillEllipse(9, 8, 8, 5);
    // Straw texture lines
    g.fillStyle(0xe8b840, 1);
    g.fillRect(3, 6, 3, 1); g.fillRect(12, 6, 3, 1);
    g.fillRect(5, 4, 2, 1); g.fillRect(11, 4, 2, 1);
  });

  // --- nest with egg ---
  gen(scene, 'nestEgg', 18, 12, (g) => {
    // Same nest base
    g.fillStyle(0xb87828, 1); g.fillEllipse(9, 8, 18, 10);
    g.fillStyle(0xd4a030, 1); g.fillEllipse(9, 7, 16, 8);
    g.fillStyle(0xc49028, 1); g.fillEllipse(9, 8, 12, 6);
    g.fillStyle(0x6a3c10, 1); g.fillEllipse(9, 8, 8, 5);
    g.fillStyle(0xe8b840, 1);
    g.fillRect(3, 6, 3, 1); g.fillRect(12, 6, 3, 1);
    g.fillRect(5, 4, 2, 1); g.fillRect(11, 4, 2, 1);
    // Egg sitting in nest
    g.fillStyle(0xfff8e0, 1); g.fillEllipse(9, 6, 6, 8);
    g.fillStyle(0xfffdf5, 1); g.fillEllipse(8, 5, 2, 3); // highlight
  });

  // --- egg (collectible on ground, 6 × 8) ---
  gen(scene, 'egg', 6, 8, (g) => {
    g.fillStyle(0xfff8e0, 1); g.fillEllipse(3, 4, 6, 8);
    g.fillStyle(0xfffdf5, 1); g.fillEllipse(2, 3, 2, 3);
  });

  // --- farm stand (market table, 72 × 44) ---
  gen(scene, 'farmStand', 72, 44, (g) => {
    // Canopy poles
    g.fillStyle(0x7a4820, 1);
    g.fillRect(4, 8, 4, 34); g.fillRect(64, 8, 4, 34);
    // Canopy (solid awning)
    g.fillStyle(0xd44030, 1); g.fillRect(0, 4, 72, 14);
    // Canopy scalloped edge
    g.fillStyle(0xd44030, 1);
    for (let x = 0; x < 72; x += 12) { g.fillEllipse(x + 6, 18, 10, 6); }
    // Table top
    g.fillStyle(0xa0682c, 1); g.fillRect(4, 22, 64, 12);
    g.fillStyle(0xc07c38, 1); g.fillRect(4, 22, 64, 4);
    g.fillStyle(0x8a5820, 1); g.fillRect(4, 30, 64, 4);
    // Table legs
    g.fillStyle(0x7a4820, 1);
    g.fillRect(8, 34, 4, 10); g.fillRect(60, 34, 4, 10);
  });

  // --- NPC customer sprite (16 × 24, same layout as player) ---
  const NPC_SKIN  = 0xf0c080;
  const NPC_HAIR  = 0x5a3a20;
  const NPC_SHIRT = 0x4466cc;
  const NPC_SHRTD = 0x2a4498;
  const NPC_PANTS = 0x445566;
  const NPC_SHOE  = 0x221408;

  const drawNpc = (g, step) => {
    // Hair
    g.fillStyle(NPC_HAIR, 1); g.fillRect(4, 0, 8, 3); g.fillRect(3, 2, 2, 6); g.fillRect(11, 2, 2, 6);
    // Face
    g.fillStyle(NPC_SKIN, 1); g.fillRect(5, 2, 6, 6);
    // Eyes
    g.fillStyle(0x1a0a04, 1); g.fillRect(6, 4, 1, 2); g.fillRect(9, 4, 1, 2);
    // Shirt
    g.fillStyle(NPC_SHIRT, 1); g.fillRect(4, 8, 8, 6); g.fillRect(2, 8, 3, 5); g.fillRect(11, 8, 3, 5);
    g.fillStyle(NPC_SHRTD, 1); g.fillRect(4, 12, 8, 2);
    // Hands
    g.fillStyle(NPC_SKIN, 1);
    g.fillRect(step === 1 ? 1 : 2, step === 1 ? 12 : 13, 2, 2);
    g.fillRect(step === 1 ? 13 : 12, 13, 2, 2);
    // Pants
    g.fillStyle(NPC_PANTS, 1); g.fillRect(4, 14, 8, 2);
    const lx0 = step === 0 ? 4 : 3, rx0 = step === 0 ? 9 : 10;
    g.fillRect(lx0, 16, 4, 5); g.fillRect(rx0, 16, 4, 5);
    // Shoes
    g.fillStyle(NPC_SHOE, 1);
    g.fillRect(step === 0 ? lx0 : lx0 - 1, 20, 5, 3);
    g.fillRect(step === 0 ? rx0 : rx0 + 1, 20, 5, 3);
  };
  gen(scene, 'npc_walk_0', 16, 24, (g) => drawNpc(g, 0));
  gen(scene, 'npc_walk_1', 16, 24, (g) => drawNpc(g, 1));

  // Icons (hotbar/UI) and props/effects/gather-sources live in their own files.
  buildIconTextures(scene);
  buildPropTextures(scene);
}
