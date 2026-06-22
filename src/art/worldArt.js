// Procedural pixel-art for the environment: grass tiles, barn, fence, trough,
// flowers, hay, plus small UI bits (heart, shadow, icons). All generated into
// textures so the game runs with zero external image files.

function tex(scene, key, w, h, draw) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

export function buildWorldTextures(scene) {
  // --- grass tiles (two variants for subtle variety) ---
  tex(scene, 'grass', 32, 32, (g) => {
    g.fillStyle(0x82c24e, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x76b446, 1);
    g.fillRect(5, 8, 2, 4); g.fillRect(20, 18, 2, 4); g.fillRect(26, 5, 2, 4);
    g.fillStyle(0x8fcf5a, 1);
    g.fillRect(12, 22, 2, 3); g.fillRect(28, 26, 2, 3); g.fillRect(2, 27, 2, 3);
  });
  tex(scene, 'grass2', 32, 32, (g) => {
    g.fillStyle(0x82c24e, 1); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x76b446, 1);
    g.fillRect(14, 6, 2, 4); g.fillRect(3, 16, 2, 4); g.fillRect(24, 22, 2, 4);
    g.fillStyle(0x8fcf5a, 1);
    g.fillRect(8, 12, 2, 3); g.fillRect(20, 28, 2, 3);
  });

  // --- barn ---
  tex(scene, 'barn', 84, 66, (g) => {
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
  tex(scene, 'fence', 48, 24, (g) => {
    g.fillStyle(0xc8924c, 1); g.fillRect(0, 6, 48, 3);
    g.fillStyle(0xbc8442, 1); g.fillRect(0, 14, 48, 3);
    g.fillStyle(0xa8743a, 1); g.fillRect(2, 2, 4, 20);
    g.fillStyle(0xc8924c, 1); g.fillRect(2, 2, 2, 20);
  });

  // --- gate closed (blocks passage) ---
  tex(scene, 'gateClosed', 56, 48, (g) => {
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
  tex(scene, 'gateOpen', 56, 48, (g) => {
    // Left post only (right post would have the swung gate against it)
    g.fillStyle(0x8a5828, 1); g.fillRect(0, 0, 4, 48);
    // Right post open
    g.fillStyle(0x8a5828, 1); g.fillRect(52, 0, 4, 48);
    // Open passage marked with lighter ground
    g.fillStyle(0x9ad060, 0.5); g.fillRect(4, 20, 48, 8);
  });

  // --- water trough (empty = dry dark interior) ---
  tex(scene, 'trough', 100, 26, (g) => {
    g.fillStyle(0x8a5a2e, 1); g.fillRect(0, 6, 100, 20);
    g.fillStyle(0xa06c38, 1); g.fillRect(0, 2, 100, 5);
    g.fillStyle(0x3a2410, 1); g.fillRect(4, 8, 92, 10); // dry dark interior
    g.fillStyle(0x2a1a08, 1); g.fillRect(4, 15, 92, 3); // shadow at bottom
    // Post dividers so it reads as one long trough
    g.fillStyle(0x6a3c18, 1); g.fillRect(47, 4, 4, 22); g.fillRect(49, 2, 2, 4);
  });

  // --- hay bale ---
  tex(scene, 'hay', 28, 18, (g) => {
    g.fillStyle(0xd9b94a, 1); g.fillRect(0, 0, 28, 18);
    g.fillStyle(0xc4a43a, 1);
    g.fillRect(0, 5, 28, 1); g.fillRect(0, 11, 28, 1);
    g.fillStyle(0x9a7c2a, 1); g.fillRect(6, 0, 1, 18); g.fillRect(20, 0, 1, 18);
  });

  // --- flowers ---
  const flower = (key, petal) => tex(scene, key, 8, 8, (g) => {
    g.fillStyle(0x3b6d11, 1); g.fillRect(3, 4, 1, 4);
    g.fillStyle(petal, 1);
    g.fillRect(2, 1, 3, 1); g.fillRect(1, 2, 5, 2); g.fillRect(2, 4, 3, 1);
    g.fillStyle(0xfff2b0, 1); g.fillRect(3, 2, 1, 1);
  });
  flower('flowerRed', 0xe2554a);
  flower('flowerYellow', 0xf0c040);
  flower('flowerWhite', 0xeeeeee);

  // --- soft shadow blob ---
  tex(scene, 'shadow', 44, 14, (g) => {
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(22, 7, 44, 14);
  });

  // --- floating heart ---
  tex(scene, 'heart', 14, 14, (g) => {
    g.fillStyle(0xe06a86, 1);
    g.fillCircle(5, 5, 3.2);
    g.fillCircle(9, 5, 3.2);
    g.fillTriangle(2, 6, 12, 6, 7, 12);
    g.fillStyle(0xf2a8bc, 1); g.fillCircle(4, 4, 1);
  });

  // --- action icons ---
  tex(scene, 'iconFeed', 20, 20, (g) => { // apple
    g.fillStyle(0xd64545, 1); g.fillCircle(10, 12, 6);
    g.fillStyle(0xe87a7a, 1); g.fillCircle(8, 10, 2);
    g.fillStyle(0x6a3d1a, 1); g.fillRect(9, 4, 2, 4);
    g.fillStyle(0x3b6d11, 1); g.fillEllipse(13, 5, 6, 3);
  });
  tex(scene, 'iconWater', 20, 20, (g) => { // droplet
    g.fillStyle(0x378add, 1);
    g.fillTriangle(10, 3, 4, 12, 16, 12);
    g.fillCircle(10, 13, 5);
    g.fillStyle(0x85b7eb, 1); g.fillCircle(8, 11, 1.5);
  });
  tex(scene, 'iconBrush', 20, 20, (g) => { // brush
    g.fillStyle(0x9a6a3a, 1); g.fillRoundedRect(3, 5, 14, 6, 2);
    g.fillStyle(0xd8c890, 1);
    for (let x = 4; x < 17; x += 2) g.fillRect(x, 11, 1, 5);
  });
  tex(scene, 'iconStable', 20, 20, (g) => { // little barn icon
    g.fillStyle(0x7a2a1c, 1); g.fillTriangle(2, 8, 10, 3, 18, 8);
    g.fillStyle(0xb6432e, 1); g.fillRect(4, 8, 12, 9);
    g.fillStyle(0x5a2418, 1); g.fillRect(8, 11, 4, 6);
  });
  tex(scene, 'iconApple', 20, 20, (g) => { // red apple
    g.fillStyle(0xd64545, 1); g.fillCircle(10, 12, 6);
    g.fillStyle(0xe87a7a, 1); g.fillCircle(8, 10, 2);
    g.fillStyle(0x6a3d1a, 1); g.fillRect(9, 4, 2, 4);
    g.fillStyle(0x3b6d11, 1); g.fillEllipse(13, 5, 6, 3);
  });
  tex(scene, 'iconHay', 20, 20, (g) => { // hay bundle
    g.fillStyle(0xd9b94a, 1); g.fillRoundedRect(3, 6, 14, 10, 3);
    g.fillStyle(0xc4a43a, 1);
    g.fillRect(3, 9, 14, 1); g.fillRect(3, 12, 14, 1);
    g.fillStyle(0x9a7c2a, 1); g.fillRect(8, 6, 1, 10); g.fillRect(11, 6, 1, 10);
    // stray stalks
    g.fillStyle(0xd9b94a, 1);
    g.fillRect(5, 3, 1, 4); g.fillRect(10, 2, 1, 5); g.fillRect(14, 4, 1, 3);
  });
  tex(scene, 'iconCarrot', 20, 20, (g) => { // carrot
    g.fillStyle(0xf07830, 1);
    g.fillTriangle(10, 17, 6, 7, 14, 7);
    g.fillStyle(0xff9a5a, 1); g.fillRect(8, 8, 2, 6);
    g.fillStyle(0x3b8a1c, 1);
    g.fillRect(9, 3, 1, 5); g.fillRect(7, 4, 1, 4); g.fillRect(11, 4, 1, 4);
  });
  tex(scene, 'iconTreat', 20, 20, (g) => { // sugar cube with sparkle
    g.fillStyle(0xf5ecd0, 1); g.fillRoundedRect(4, 7, 12, 10, 2);
    g.fillStyle(0xe8d8a8, 1);
    g.fillRect(4, 11, 12, 1); g.fillRect(9, 7, 1, 10);
    g.fillStyle(0xffe066, 1); // sparkle
    g.fillRect(14, 3, 2, 2); g.fillRect(15, 2, 1, 4); g.fillRect(13, 4, 4, 1);
    g.fillRect(3, 3, 1, 1);
  });
  tex(scene, 'iconSaddle', 20, 20, (g) => { // saddle
    g.fillStyle(0x8a5020, 1); g.fillRect(3, 7, 14, 5);
    g.fillStyle(0x6a3c18, 1); g.fillRect(2, 9, 4, 5); g.fillRect(14, 9, 4, 5);
    g.fillStyle(0xb07040, 1); g.fillRect(4, 8, 12, 2);
    g.fillStyle(0x6a3c18, 1);
    g.fillRect(5, 12, 1, 5); g.fillRect(14, 12, 1, 5);
    g.fillRect(3, 16, 4, 2); g.fillRect(12, 16, 4, 2);
  });
  tex(scene, 'iconLead', 20, 20, (g) => { // rope coil
    g.fillStyle(0xd4a84a, 1); g.fillCircle(9, 11, 7);
    g.fillStyle(0x1a1e30, 0); g.fillCircle(9, 11, 4); // clear center (ring shape)
    g.fillStyle(0xb88c3a, 1); g.fillCircle(9, 11, 5);
    g.fillStyle(0xd4a84a, 1); g.fillCircle(9, 11, 3);
    g.fillStyle(0xb88c3a, 1); g.fillCircle(9, 11, 1.5);
    g.fillStyle(0xd4a84a, 1); g.fillRect(14, 3, 2, 9); g.fillRect(14, 3, 5, 2);
  });
  tex(scene, 'troughFull', 100, 26, (g) => {
    g.fillStyle(0x8a5a2e, 1); g.fillRect(0, 6, 100, 20);
    g.fillStyle(0xa06c38, 1); g.fillRect(0, 2, 100, 5);
    g.fillStyle(0x5fa6d6, 1); g.fillRect(4, 8, 92, 10);
    g.fillStyle(0x9ae0f8, 1); g.fillRect(4, 8, 92, 3);
    g.fillStyle(0x7cc8e8, 0.7);
    g.fillRect(8, 12, 10, 1); g.fillRect(30, 14, 12, 1); g.fillRect(60, 11, 8, 1); g.fillRect(78, 13, 10, 1);
    g.fillStyle(0x6a3c18, 1); g.fillRect(47, 4, 4, 22); g.fillRect(49, 2, 2, 4);
  });
  tex(scene, 'hayPile', 36, 12, (g) => { // hay spread on ground
    g.fillStyle(0xd9b94a, 1); g.fillRect(2, 5, 32, 7);
    g.fillStyle(0xc4a43a, 1); g.fillRect(2, 8, 32, 3);
    g.fillStyle(0xd9b94a, 1);
    g.fillRect(4, 2, 1, 4); g.fillRect(8, 1, 1, 5); g.fillRect(13, 2, 1, 4);
    g.fillRect(18, 1, 1, 5); g.fillRect(22, 2, 1, 4); g.fillRect(27, 1, 1, 5);
    g.fillStyle(0xe8cc6a, 1);
    g.fillRect(6, 3, 1, 3); g.fillRect(15, 2, 1, 4); g.fillRect(24, 3, 1, 3);
  });
  tex(scene, 'saddleOverlay', 64, 54, (g) => { // drawn at horse-back position (x=19-38, y=16-22)
    g.fillStyle(0x8a5020, 1); g.fillRect(19, 16, 20, 6);
    g.fillStyle(0x6a3c18, 1); g.fillRect(18, 18, 4, 5); g.fillRect(35, 18, 4, 5);
    g.fillStyle(0xb07040, 1); g.fillRect(20, 17, 17, 2);
    g.fillStyle(0x6a3c18, 1);
    g.fillRect(22, 22, 1, 9); g.fillRect(33, 22, 1, 9);
    g.fillRect(20, 30, 4, 2); g.fillRect(31, 30, 4, 2);
  });
  tex(scene, 'iconSeed', 20, 20, (g) => { // scattered seeds
    g.fillStyle(0xc8a030, 1);
    g.fillRect(5, 13, 3, 3); g.fillRect(11, 11, 3, 3); g.fillRect(8, 15, 2, 2);
    g.fillRect(3, 9, 2, 2);  g.fillRect(14, 14, 2, 2); g.fillRect(12, 7, 2, 2);
    g.fillStyle(0xe8c050, 1);
    g.fillRect(6, 14, 1, 1); g.fillRect(12, 12, 1, 1); g.fillRect(4, 10, 1, 1);
    // small pouch at top
    g.fillStyle(0xd4943c, 1); g.fillRect(7, 3, 6, 7);
    g.fillStyle(0xe8b054, 1); g.fillRect(7, 3, 6, 2);
    g.fillStyle(0xb07828, 1); g.fillRect(8, 2, 4, 2);
    g.fillStyle(0xc8a030, 1); g.fillRect(9, 9, 2, 2); g.fillRect(7, 8, 2, 2);
  });
  tex(scene, 'seedPile', 22, 8, (g) => { // seeds scattered on ground
    g.fillStyle(0xc8a030, 1);
    g.fillRect(2, 3, 2, 2); g.fillRect(6, 2, 2, 2); g.fillRect(10, 4, 2, 2);
    g.fillRect(14, 2, 2, 2); g.fillRect(18, 3, 2, 2); g.fillRect(4, 5, 2, 2);
    g.fillRect(8, 5, 2, 2);  g.fillRect(12, 3, 2, 2); g.fillRect(16, 5, 2, 2);
    g.fillStyle(0xe8c050, 1);
    g.fillRect(3, 3, 1, 1); g.fillRect(7, 2, 1, 1); g.fillRect(11, 4, 1, 1);
    g.fillRect(15, 2, 1, 1); g.fillRect(5, 5, 1, 1);
  });
  tex(scene, 'iconHeart', 20, 20, (g) => { // heart for the Love button
    g.fillStyle(0xe06a86, 1);
    g.fillCircle(7, 8, 4.5);
    g.fillCircle(13, 8, 4.5);
    g.fillTriangle(3, 10, 17, 10, 10, 17);
    g.fillStyle(0xf2a8bc, 1); g.fillCircle(6, 6, 1.5);
  });

  // --- chicken coop (64 × 52) ---
  tex(scene, 'coop', 64, 52, (g) => {
    // Roof — dark ridge, two slopes
    g.fillStyle(0x6b3c1a, 1); g.fillTriangle(0, 18, 32, 2, 64, 18);
    g.fillStyle(0x9a5a2c, 1); g.fillTriangle(2, 18, 32, 4, 62, 18);
    g.fillStyle(0xb87040, 1);
    // Left slope highlight
    g.fillRect(6, 10, 2, 8); g.fillRect(12, 8, 2, 10); g.fillRect(18, 6, 2, 12);
    // Ridge cap
    g.fillStyle(0x7a4420, 1); g.fillRect(28, 2, 8, 3);

    // Walls
    g.fillStyle(0xd4a060, 1); g.fillRect(0, 18, 64, 34);
    g.fillStyle(0xc0904e, 1); g.fillRect(0, 18, 64, 4); // top shadow under eave
    g.fillStyle(0xa87840, 1); g.fillRect(0, 44, 64, 8); // ground shadow

    // Left window
    g.fillStyle(0x5a3010, 1); g.fillRect(6, 24, 14, 10);
    g.fillStyle(0xffe89a, 1); g.fillRect(7, 25, 12, 8);
    g.fillStyle(0x5a3010, 1); g.fillRect(12, 25, 2, 8); g.fillRect(7, 28, 12, 2);

    // Right window
    g.fillStyle(0x5a3010, 1); g.fillRect(44, 24, 14, 10);
    g.fillStyle(0xffe89a, 1); g.fillRect(45, 25, 12, 8);
    g.fillStyle(0x5a3010, 1); g.fillRect(50, 25, 2, 8); g.fillRect(45, 28, 12, 2);

    // Door opening (arched) — center bottom
    g.fillStyle(0x3a1e08, 1); g.fillRect(26, 34, 12, 18);
    g.fillCircle(32, 34, 6);

    // Vertical wood planks
    g.fillStyle(0xc0904e, 0.4);
    for (let x = 8; x < 64; x += 8) g.fillRect(x, 18, 1, 34);

    // Eave board
    g.fillStyle(0x8a5428, 1); g.fillRect(0, 17, 64, 2);
  });

  // --- nest (18 × 12) — woven straw ring ---
  tex(scene, 'nest', 18, 12, (g) => {
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
  tex(scene, 'nestEgg', 18, 12, (g) => {
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
  tex(scene, 'egg', 6, 8, (g) => {
    g.fillStyle(0xfff8e0, 1); g.fillEllipse(3, 4, 6, 8);
    g.fillStyle(0xfffdf5, 1); g.fillEllipse(2, 3, 2, 3);
  });

  // --- egg icon (for inventory badge, 20 × 20) ---
  tex(scene, 'iconEgg', 20, 20, (g) => {
    g.fillStyle(0xfff8e0, 1); g.fillEllipse(10, 11, 12, 14);
    g.fillStyle(0xfffdf5, 1); g.fillEllipse(8, 8, 4, 5);
    g.fillStyle(0xe8d8a0, 1); g.fillEllipse(10, 14, 8, 4); // shadow base
  });

  // --- farm stand (market table, 72 × 44) ---
  tex(scene, 'farmStand', 72, 44, (g) => {
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

  // --- coin icon (for money display, 20 × 20) ---
  tex(scene, 'iconCoin', 20, 20, (g) => {
    g.fillStyle(0xe8b820, 1); g.fillCircle(10, 10, 8);
    g.fillStyle(0xf8d840, 1); g.fillCircle(9, 8, 4);
    g.fillStyle(0xc89010, 1); g.fillCircle(11, 12, 3);
    g.fillStyle(0xf0cc30, 1);
    g.fillRect(8, 6, 2, 1); g.fillRect(9, 5, 2, 2); // $ highlight
  });

  // --- basket icon (20 × 20) ---
  tex(scene, 'iconBasket', 20, 20, (g) => {
    // Handle arch
    g.fillStyle(0xb07828, 1);
    g.fillRect(6, 2, 2, 8); g.fillRect(12, 2, 2, 8);
    g.fillRect(6, 2, 8, 2);
    // Rim
    g.fillStyle(0xdcaa50, 1); g.fillRect(2, 8, 16, 2);
    // Body
    g.fillStyle(0xc8943c, 1); g.fillRect(2, 10, 16, 8);
    g.fillStyle(0xdab04c, 1); g.fillRect(3, 11, 14, 2);
    // Weave lines horizontal
    g.fillStyle(0xa87228, 1);
    g.fillRect(2, 12, 16, 1); g.fillRect(2, 14, 16, 1); g.fillRect(2, 16, 16, 1);
    // Weave lines vertical
    g.fillRect(5, 10, 1, 8); g.fillRect(9, 10, 1, 8); g.fillRect(13, 10, 1, 8);
    // Bottom curve
    g.fillStyle(0xc8943c, 1); g.fillRect(3, 18, 14, 1); g.fillRect(4, 19, 12, 1);
  });

  // --- hand icon (20 × 20) ---
  tex(scene, 'iconHand', 20, 20, (g) => {
    g.fillStyle(0xf0c080, 1); // skin tone
    // Palm base
    g.fillRect(6, 10, 8, 8);
    // Thumb
    g.fillRect(4, 10, 2, 5);
    // Fingers (4 extended)
    g.fillRect(6, 4, 2, 6); g.fillRect(9, 3, 2, 7);
    g.fillRect(12, 4, 2, 6); g.fillRect(15, 7, 2, 4);
    // Hand lines/definition
    g.fillStyle(0xd4a080, 0.6);
    g.fillRect(6, 14, 8, 1); // palm line
    g.fillRect(6, 16, 8, 1); // palm line 2
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
  tex(scene, 'npc_walk_0', 16, 24, (g) => drawNpc(g, 0));
  tex(scene, 'npc_walk_1', 16, 24, (g) => drawNpc(g, 1));
}
