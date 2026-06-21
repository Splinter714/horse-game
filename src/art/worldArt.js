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

  // --- water trough ---
  tex(scene, 'trough', 54, 26, (g) => {
    g.fillStyle(0x8a5a2e, 1); g.fillRect(0, 6, 54, 20);
    g.fillStyle(0xa06c38, 1); g.fillRect(0, 2, 54, 5);
    g.fillStyle(0x5fa6d6, 1); g.fillRect(4, 8, 46, 10);
    g.fillStyle(0x7cc0e8, 1); g.fillRect(4, 8, 46, 3);
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
  tex(scene, 'iconHeart', 20, 20, (g) => { // heart for the Love button
    g.fillStyle(0xe06a86, 1);
    g.fillCircle(7, 8, 4.5);
    g.fillCircle(13, 8, 4.5);
    g.fillTriangle(3, 10, 17, 10, 10, 17);
    g.fillStyle(0xf2a8bc, 1); g.fillCircle(6, 6, 1.5);
  });
}
