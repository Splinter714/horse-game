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
  // --- dust splotches overlay (sits on a horse's body when it needs brushing) ---
  // 64×54 to match the horse frame, origin (0.5,1); irregular muddy patches
  // clustered over the barrel/back. Runtime alpha (driven by the grooming stat)
  // fades the whole layer in and out together. (issue #26)
  tex(scene, 'dustSplotches', 64, 54, (g) => {
    const mud  = 0x6b4a2e;
    const dust = 0x856544;
    g.fillStyle(mud, 0.85);
    g.fillEllipse(20, 27, 12, 8);   // rump/barrel
    g.fillEllipse(31, 30, 10, 7);   // mid belly
    g.fillEllipse(40, 26, 9, 6);    // shoulder
    g.fillEllipse(15, 24, 6, 5);    // upper rump
    g.fillStyle(dust, 0.7);         // lighter speckle on top
    g.fillCircle(24, 25, 2);
    g.fillCircle(35, 28, 2);
    g.fillCircle(43, 29, 1.5);
    g.fillCircle(18, 29, 1.5);
    g.fillCircle(29, 23, 1.5);
  });

  // --- dust puff (kicked up when a horse rolls in the dirt) ---
  tex(scene, 'dustPuff', 16, 12, (g) => {
    g.fillStyle(0xcbb089, 0.8);
    g.fillCircle(5, 7, 4);
    g.fillCircle(10, 6, 4.5);
    g.fillCircle(13, 9, 3);
    g.fillStyle(0xe0cba6, 0.7);
    g.fillCircle(7, 5, 2.5);
  });

  // --- grumpy mark (transient, shown when a neglected horse is interacted with) ---
  tex(scene, 'iconGrumpy', 20, 20, (g) => {
    g.fillStyle(0xd63b3b, 1);
    // two short angry slashes (a "💢"-style anger mark)
    g.fillRect(4, 4, 7, 2); g.fillRect(4, 4, 2, 7);
    g.fillRect(13, 11, 2, 5); g.fillRect(11, 14, 6, 2);
    g.fillStyle(0xf07a7a, 1);
    g.fillRect(5, 6, 2, 2);
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
  tex(scene, 'applePile', 26, 14, (g) => { // a couple of apples on the ground
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
  tex(scene, 'carrotPile', 28, 14, (g) => { // a couple of carrots on the ground
    // Carrot 1 (lying diagonally)
    g.fillStyle(0xf07830, 1); g.fillTriangle(3, 11, 14, 6, 14, 10);
    g.fillStyle(0xff9a5a, 1); g.fillRect(6, 8, 4, 1);
    g.fillStyle(0x3b8a1c, 1); g.fillRect(14, 4, 1, 4); g.fillRect(16, 5, 1, 3); g.fillRect(12, 5, 1, 3);
    // Carrot 2
    g.fillStyle(0xe06a26, 1); g.fillTriangle(14, 12, 24, 9, 24, 12);
    g.fillStyle(0xff9a5a, 1); g.fillRect(17, 11, 4, 1);
    g.fillStyle(0x3b8a1c, 1); g.fillRect(24, 7, 1, 4); g.fillRect(26, 8, 1, 3);
  });
  tex(scene, 'iconHeart', 20, 20, (g) => { // heart for the Love button
    g.fillStyle(0xe06a86, 1);
    g.fillCircle(7, 8, 4.5);
    g.fillCircle(13, 8, 4.5);
    g.fillTriangle(3, 10, 17, 10, 10, 17);
    g.fillStyle(0xf2a8bc, 1); g.fillCircle(6, 6, 1.5);
  });

  // --- chicken coop (64 × 52) ---
  // A raised hen-house: short legs, a chicken-sized pop-door with a ramp, a
  // hinged nesting box on the side, a wire vent (no glass), and a rooster
  // weathervane — all to read as a coop, not a dwelling.
  tex(scene, 'coop', 64, 52, (g) => {
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

  // --- carrier icons (20 × 20) ---
  // A reusable empty-basket body, drawn so the content variants can sit on top.
  const drawBasketBody = (g) => {
    g.fillStyle(0xb07828, 1); // handle arch
    g.fillRect(6, 2, 2, 7); g.fillRect(12, 2, 2, 7); g.fillRect(6, 2, 8, 2);
    g.fillStyle(0xdcaa50, 1); g.fillRect(2, 9, 16, 2); // rim
    g.fillStyle(0xc8943c, 1); g.fillRect(2, 11, 16, 7); // body
    g.fillStyle(0xa87228, 1);
    g.fillRect(2, 13, 16, 1); g.fillRect(2, 15, 16, 1); g.fillRect(2, 17, 16, 1);
    g.fillRect(5, 11, 1, 7); g.fillRect(9, 11, 1, 7); g.fillRect(13, 11, 1, 7);
    g.fillStyle(0xc8943c, 1); g.fillRect(3, 18, 14, 1); g.fillRect(4, 19, 12, 1);
  };

  tex(scene, 'iconBasketHay', 20, 20, (g) => {
    drawBasketBody(g);
    g.fillStyle(0xe8cc6a, 1); g.fillRoundedRect(4, 4, 12, 7, 2); // hay mounded above rim
    g.fillStyle(0xd9b94a, 1); g.fillRect(4, 7, 12, 1); g.fillRect(4, 9, 12, 1);
    g.fillStyle(0xe8cc6a, 1); g.fillRect(5, 2, 1, 3); g.fillRect(10, 1, 1, 4); g.fillRect(14, 2, 1, 3);
  });
  tex(scene, 'iconBasketApple', 20, 20, (g) => {
    drawBasketBody(g);
    g.fillStyle(0xd64545, 1); g.fillCircle(7, 7, 3); g.fillCircle(13, 7, 3); g.fillCircle(10, 5, 3);
    g.fillStyle(0xe87a7a, 1); g.fillCircle(6, 6, 1); g.fillCircle(9, 4, 1);
    g.fillStyle(0x3b6d11, 1); g.fillRect(10, 2, 1, 2);
  });
  tex(scene, 'iconBasketCarrot', 20, 20, (g) => {
    drawBasketBody(g);
    g.fillStyle(0xf07830, 1);
    g.fillTriangle(6, 9, 4, 3, 8, 3); g.fillTriangle(11, 9, 9, 3, 13, 3); g.fillTriangle(15, 8, 13, 4, 16, 4);
    g.fillStyle(0x3b8a1c, 1); g.fillRect(5, 1, 1, 3); g.fillRect(10, 1, 1, 3); g.fillRect(14, 2, 1, 3);
  });
  tex(scene, 'iconBasketSeed', 20, 20, (g) => {
    drawBasketBody(g);
    g.fillStyle(0xd4a93c, 1); g.fillRoundedRect(4, 5, 12, 6, 2); // mound of grain
    g.fillStyle(0xc8a030, 1);
    g.fillRect(5, 7, 2, 2); g.fillRect(9, 6, 2, 2); g.fillRect(13, 7, 2, 2); g.fillRect(7, 9, 2, 2); g.fillRect(11, 9, 2, 2);
    g.fillStyle(0xe8c050, 1); g.fillRect(6, 5, 1, 1); g.fillRect(10, 4, 1, 1); g.fillRect(14, 5, 1, 1);
  });
  tex(scene, 'iconBasketEgg', 20, 20, (g) => {
    drawBasketBody(g);
    g.fillStyle(0xfff8e0, 1);
    g.fillEllipse(7, 7, 5, 6); g.fillEllipse(13, 7, 5, 6); g.fillEllipse(10, 5, 5, 6);
    g.fillStyle(0xfffdf5, 1); g.fillEllipse(6, 5, 2, 2); g.fillEllipse(12, 5, 2, 2);
  });

  // Empty bucket (a metal pail)
  tex(scene, 'iconBucket', 20, 20, (g) => {
    g.fillStyle(0x8a93a6, 1); g.fillRect(5, 2, 10, 1); // handle
    g.fillRect(4, 2, 1, 4); g.fillRect(15, 2, 1, 4);
    g.fillStyle(0xb8c0d0, 1); g.fillRect(3, 6, 14, 2); // rim
    g.fillStyle(0x9aa3b6, 1); // tapered body
    g.fillTriangle(4, 8, 16, 8, 14, 18); g.fillTriangle(4, 8, 14, 18, 6, 18);
    g.fillStyle(0xb8c0d0, 1); g.fillRect(5, 9, 1, 8); // highlight
    g.fillStyle(0x7a8396, 1); g.fillRect(6, 17, 8, 1);
  });
  // Filled bucket — water visible at the brim
  tex(scene, 'iconBucketWater', 20, 20, (g) => {
    g.fillStyle(0x8a93a6, 1); g.fillRect(5, 2, 10, 1);
    g.fillRect(4, 2, 1, 4); g.fillRect(15, 2, 1, 4);
    g.fillStyle(0x5fa6d6, 1); g.fillRect(4, 7, 12, 2); // water surface
    g.fillStyle(0x9ae0f8, 1); g.fillRect(5, 7, 6, 1);
    g.fillStyle(0xb8c0d0, 1); g.fillRect(3, 6, 14, 1);
    g.fillStyle(0x9aa3b6, 1);
    g.fillTriangle(4, 9, 16, 9, 14, 18); g.fillTriangle(4, 9, 14, 18, 6, 18);
    g.fillStyle(0xb8c0d0, 1); g.fillRect(5, 10, 1, 7);
    g.fillStyle(0x7a8396, 1); g.fillRect(6, 17, 8, 1);
  });

  // --- gathering source props (issue #63) ---
  // Haystack — a big mound to gather hay from
  tex(scene, 'haystack', 48, 40, (g) => {
    g.fillStyle(0xc4a43a, 1); g.fillEllipse(24, 36, 46, 10); // base shadow
    g.fillStyle(0xd9b94a, 1); g.fillEllipse(24, 26, 44, 26); // body
    g.fillStyle(0xe8cc6a, 1); g.fillEllipse(20, 18, 30, 16); // top highlight
    g.fillStyle(0xc4a43a, 1);
    for (let y = 18; y < 36; y += 5) g.fillRect(4, y, 40, 1); // layered straw lines
    g.fillStyle(0xb08c2a, 1);
    g.fillRect(10, 14, 1, 4); g.fillRect(26, 12, 1, 5); g.fillRect(38, 16, 1, 4); // stray stalks
  });
  // Apple tree — leafy crown over a trunk
  tex(scene, 'appleTree', 52, 68, (g) => {
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
  tex(scene, 'carrotGarden', 56, 32, (g) => {
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
  tex(scene, 'grainBin', 40, 44, (g) => {
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
  tex(scene, 'stream', 64, 40, (g) => {
    g.fillStyle(0x4a7a3a, 1); g.fillEllipse(32, 20, 64, 38); // muddy bank
    g.fillStyle(0x3f7fb5, 1); g.fillEllipse(32, 20, 56, 30); // water
    g.fillStyle(0x5fa6d6, 1); g.fillEllipse(30, 17, 44, 20);
    g.fillStyle(0x9ae0f8, 0.8); // ripples
    g.fillRect(14, 14, 12, 1); g.fillRect(34, 18, 14, 1); g.fillRect(20, 24, 10, 1); g.fillRect(40, 26, 8, 1);
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
