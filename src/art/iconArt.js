// UI / hotbar icons and small floating bits (hearts). All 20×20 unless noted,
// generated into textures so the game ships with zero image files. Shares the
// snapshot helper (`gen`) from _frames.js.

import { gen } from './_frames.js';

export function buildIconTextures(scene) {
  // --- floating heart (world particle) ---
  gen(scene, 'heart', 14, 14, (g) => {
    g.fillStyle(0xe06a86, 1);
    g.fillCircle(5, 5, 3.2);
    g.fillCircle(9, 5, 3.2);
    g.fillTriangle(2, 6, 12, 6, 7, 12);
    g.fillStyle(0xf2a8bc, 1); g.fillCircle(4, 4, 1);
  });

  // --- action icons ---
  gen(scene, 'iconFeed', 20, 20, (g) => { // apple
    g.fillStyle(0xd64545, 1); g.fillCircle(10, 12, 6);
    g.fillStyle(0xe87a7a, 1); g.fillCircle(8, 10, 2);
    g.fillStyle(0x6a3d1a, 1); g.fillRect(9, 4, 2, 4);
    g.fillStyle(0x3b6d11, 1); g.fillEllipse(13, 5, 6, 3);
  });
  gen(scene, 'iconWater', 20, 20, (g) => { // droplet
    g.fillStyle(0x378add, 1);
    g.fillTriangle(10, 3, 4, 12, 16, 12);
    g.fillCircle(10, 13, 5);
    g.fillStyle(0x85b7eb, 1); g.fillCircle(8, 11, 1.5);
  });
  gen(scene, 'iconBrush', 20, 20, (g) => { // brush
    g.fillStyle(0x9a6a3a, 1); g.fillRoundedRect(3, 5, 14, 6, 2);
    g.fillStyle(0xd8c890, 1);
    for (let x = 4; x < 17; x += 2) g.fillRect(x, 11, 1, 5);
  });
  gen(scene, 'iconStable', 20, 20, (g) => { // little barn icon
    g.fillStyle(0x7a2a1c, 1); g.fillTriangle(2, 8, 10, 3, 18, 8);
    g.fillStyle(0xb6432e, 1); g.fillRect(4, 8, 12, 9);
    g.fillStyle(0x5a2418, 1); g.fillRect(8, 11, 4, 6);
  });
  gen(scene, 'iconApple', 20, 20, (g) => { // red apple
    g.fillStyle(0xd64545, 1); g.fillCircle(10, 12, 6);
    g.fillStyle(0xe87a7a, 1); g.fillCircle(8, 10, 2);
    g.fillStyle(0x6a3d1a, 1); g.fillRect(9, 4, 2, 4);
    g.fillStyle(0x3b6d11, 1); g.fillEllipse(13, 5, 6, 3);
  });
  gen(scene, 'iconHay', 20, 20, (g) => { // hay bundle
    g.fillStyle(0xd9b94a, 1); g.fillRoundedRect(3, 6, 14, 10, 3);
    g.fillStyle(0xc4a43a, 1);
    g.fillRect(3, 9, 14, 1); g.fillRect(3, 12, 14, 1);
    g.fillStyle(0x9a7c2a, 1); g.fillRect(8, 6, 1, 10); g.fillRect(11, 6, 1, 10);
    // stray stalks
    g.fillStyle(0xd9b94a, 1);
    g.fillRect(5, 3, 1, 4); g.fillRect(10, 2, 1, 5); g.fillRect(14, 4, 1, 3);
  });
  gen(scene, 'iconCarrot', 20, 20, (g) => { // carrot
    g.fillStyle(0xf07830, 1);
    g.fillTriangle(10, 17, 6, 7, 14, 7);
    g.fillStyle(0xff9a5a, 1); g.fillRect(8, 8, 2, 6);
    g.fillStyle(0x3b8a1c, 1);
    g.fillRect(9, 3, 1, 5); g.fillRect(7, 4, 1, 4); g.fillRect(11, 4, 1, 4);
  });
  gen(scene, 'iconStrawberry', 20, 20, (g) => { // strawberry (#242)
    g.fillStyle(0xe23b4a, 1); // red body, tapering to a point
    g.fillTriangle(10, 18, 4, 8, 16, 8);
    g.fillStyle(0xf06070, 1); g.fillTriangle(8, 12, 6, 8, 10, 8); // lit facet
    g.fillStyle(0xffe08a, 1); // seed flecks
    g.fillRect(8, 10, 1, 1); g.fillRect(11, 11, 1, 1); g.fillRect(9, 13, 1, 1); g.fillRect(12, 9, 1, 1); g.fillRect(7, 12, 1, 1);
    g.fillStyle(0x3b8a1c, 1); // green calyx / leaves on top
    g.fillTriangle(10, 8, 5, 5, 9, 6); g.fillTriangle(10, 8, 15, 5, 11, 6); g.fillRect(9, 3, 2, 3);
  });
  gen(scene, 'iconWheat', 20, 20, (g) => { // wheat sheaf (#242)
    g.fillStyle(0xcaa63a, 1); g.fillRect(9, 8, 2, 9); // stalk
    g.fillStyle(0xe8c94e, 1); // grain head — staggered kernels up the top
    for (let i = 0; i < 4; i++) {
      const y = 3 + i * 2.5;
      g.fillEllipse(7, y + 1, 3, 2.4); g.fillEllipse(13, y + 1, 3, 2.4); g.fillEllipse(10, y, 3, 2.4);
    }
    g.fillStyle(0xf5e07a, 1); g.fillEllipse(10, 3, 2, 2); // sunlit tip
    g.fillStyle(0xa9862b, 1); g.fillRect(6, 14, 8, 1); // bind
  });
  gen(scene, 'iconHoney', 20, 20, (g) => { // honey jar (#239) — sold at the stand
    // Glass jar of golden honey with a cloth lid and a little dipper.
    g.fillStyle(0xe8a828, 1); g.fillRoundedRect(5, 7, 10, 11, 2); // honey body
    g.fillStyle(0xf6c94e, 1); g.fillRect(6, 8, 3, 9);             // lit left face
    g.fillStyle(0xc9821a, 1); g.fillRect(12, 8, 2, 9);            // shaded right
    g.fillStyle(0xffe08a, 0.7); g.fillRect(7, 9, 2, 3);           // glass glint
    g.fillStyle(0xd8b84a, 1); g.fillRect(4, 5, 12, 3);            // cloth lid overhang
    g.fillStyle(0xbf9a34, 1); g.fillRect(4, 7, 12, 1);            // rim band
    g.fillStyle(0xf2e8c0, 1);                                     // tied string
    g.fillRect(5, 6, 10, 1);
    g.fillStyle(0x8a5f2c, 1); g.fillRect(15, 4, 1, 8); g.fillCircle(16, 12, 1.5); // dipper
  });
  gen(scene, 'iconTreat', 20, 20, (g) => { // sugar cube with sparkle
    g.fillStyle(0xf5ecd0, 1); g.fillRoundedRect(4, 7, 12, 10, 2);
    g.fillStyle(0xe8d8a8, 1);
    g.fillRect(4, 11, 12, 1); g.fillRect(9, 7, 1, 10);
    g.fillStyle(0xffe066, 1); // sparkle
    g.fillRect(14, 3, 2, 2); g.fillRect(15, 2, 1, 4); g.fillRect(13, 4, 4, 1);
    g.fillRect(3, 3, 1, 1);
  });
  gen(scene, 'iconSaddle', 20, 20, (g) => { // saddle
    g.fillStyle(0x8a5020, 1); g.fillRect(3, 7, 14, 5);
    g.fillStyle(0x6a3c18, 1); g.fillRect(2, 9, 4, 5); g.fillRect(14, 9, 4, 5);
    g.fillStyle(0xb07040, 1); g.fillRect(4, 8, 12, 2);
    g.fillStyle(0x6a3c18, 1);
    g.fillRect(5, 12, 1, 5); g.fillRect(14, 12, 1, 5);
    g.fillRect(3, 16, 4, 2); g.fillRect(12, 16, 4, 2);
  });
  gen(scene, 'iconLead', 20, 20, (g) => { // rope coil
    g.fillStyle(0xd4a84a, 1); g.fillCircle(9, 11, 7);
    g.fillStyle(0x1a1e30, 0); g.fillCircle(9, 11, 4); // clear center (ring shape)
    g.fillStyle(0xb88c3a, 1); g.fillCircle(9, 11, 5);
    g.fillStyle(0xd4a84a, 1); g.fillCircle(9, 11, 3);
    g.fillStyle(0xb88c3a, 1); g.fillCircle(9, 11, 1.5);
    g.fillStyle(0xd4a84a, 1); g.fillRect(14, 3, 2, 9); g.fillRect(14, 3, 5, 2);
  });

  gen(scene, 'iconSeed', 20, 20, (g) => { // scattered seeds
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
  gen(scene, 'iconHeart', 20, 20, (g) => { // heart for the Love button
    g.fillStyle(0xe06a86, 1);
    g.fillCircle(7, 8, 4.5);
    g.fillCircle(13, 8, 4.5);
    g.fillTriangle(3, 10, 17, 10, 10, 17);
    g.fillStyle(0xf2a8bc, 1); g.fillCircle(6, 6, 1.5);
  });
  gen(scene, 'iconEgg', 20, 20, (g) => { // egg for inventory badge
    g.fillStyle(0xfff8e0, 1); g.fillEllipse(10, 11, 12, 14);
    g.fillStyle(0xfffdf5, 1); g.fillEllipse(8, 8, 4, 5);
    g.fillStyle(0xe8d8a0, 1); g.fillEllipse(10, 14, 8, 4); // shadow base
  });
  gen(scene, 'iconEggBrown', 20, 20, (g) => { // brown egg (#276)
    g.fillStyle(0xc48a4c, 1); g.fillEllipse(10, 11, 12, 14);
    g.fillStyle(0xdca868, 1); g.fillEllipse(8, 8, 4, 5);
    g.fillStyle(0x9c6c34, 1); g.fillEllipse(10, 14, 8, 4); // shadow base
  });
  gen(scene, 'iconCoin', 20, 20, (g) => { // coin for money display
    g.fillStyle(0xe8b820, 1); g.fillCircle(10, 10, 8);
    g.fillStyle(0xf8d840, 1); g.fillCircle(9, 8, 4);
    g.fillStyle(0xc89010, 1); g.fillCircle(11, 12, 3);
    g.fillStyle(0xf0cc30, 1);
    g.fillRect(8, 6, 2, 1); g.fillRect(9, 5, 2, 2); // $ highlight
  });
  gen(scene, 'iconBasket', 20, 20, (g) => {
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

  gen(scene, 'iconBasketHay', 20, 20, (g) => {
    drawBasketBody(g);
    g.fillStyle(0xe8cc6a, 1); g.fillRoundedRect(4, 4, 12, 7, 2); // hay mounded above rim
    g.fillStyle(0xd9b94a, 1); g.fillRect(4, 7, 12, 1); g.fillRect(4, 9, 12, 1);
    g.fillStyle(0xe8cc6a, 1); g.fillRect(5, 2, 1, 3); g.fillRect(10, 1, 1, 4); g.fillRect(14, 2, 1, 3);
  });
  gen(scene, 'iconBasketApple', 20, 20, (g) => {
    drawBasketBody(g);
    g.fillStyle(0xd64545, 1); g.fillCircle(7, 7, 3); g.fillCircle(13, 7, 3); g.fillCircle(10, 5, 3);
    g.fillStyle(0xe87a7a, 1); g.fillCircle(6, 6, 1); g.fillCircle(9, 4, 1);
    g.fillStyle(0x3b6d11, 1); g.fillRect(10, 2, 1, 2);
  });
  gen(scene, 'iconBasketCarrot', 20, 20, (g) => {
    drawBasketBody(g);
    g.fillStyle(0xf07830, 1);
    g.fillTriangle(6, 9, 4, 3, 8, 3); g.fillTriangle(11, 9, 9, 3, 13, 3); g.fillTriangle(15, 8, 13, 4, 16, 4);
    g.fillStyle(0x3b8a1c, 1); g.fillRect(5, 1, 1, 3); g.fillRect(10, 1, 1, 3); g.fillRect(14, 2, 1, 3);
  });
  gen(scene, 'iconBasketStrawberry', 20, 20, (g) => {
    drawBasketBody(g);
    g.fillStyle(0xe23b4a, 1);
    g.fillTriangle(6, 10, 4, 4, 8, 4); g.fillTriangle(11, 10, 9, 4, 13, 4); g.fillTriangle(15, 9, 13, 5, 17, 5);
    g.fillStyle(0xffe08a, 1); g.fillRect(6, 6, 1, 1); g.fillRect(11, 6, 1, 1); g.fillRect(15, 7, 1, 1);
    g.fillStyle(0x3b8a1c, 1); g.fillRect(5, 3, 2, 1); g.fillRect(10, 3, 2, 1); g.fillRect(14, 4, 2, 1);
  });
  gen(scene, 'iconBasketWheat', 20, 20, (g) => {
    drawBasketBody(g);
    g.fillStyle(0xe8c94e, 1);
    g.fillEllipse(6, 6, 3, 5); g.fillEllipse(10, 5, 3, 6); g.fillEllipse(14, 6, 3, 5);
    g.fillStyle(0xf5e07a, 1); g.fillRect(6, 3, 1, 1); g.fillRect(10, 2, 1, 1); g.fillRect(14, 3, 1, 1);
    g.fillStyle(0xa9862b, 1); g.fillRect(5, 9, 10, 1); // bind at the rim
  });
  gen(scene, 'iconBasketHoney', 20, 20, (g) => { // basket of honey jars (#239)
    drawBasketBody(g);
    // A couple of little honey jars nestled in the basket.
    const jar = (x) => {
      g.fillStyle(0xe8a828, 1); g.fillRoundedRect(x, 4, 5, 6, 1);
      g.fillStyle(0xf6c94e, 1); g.fillRect(x + 1, 5, 2, 4);
      g.fillStyle(0xd8b84a, 1); g.fillRect(x - 1, 3, 7, 2); // lid
    };
    jar(4); jar(11);
    g.fillStyle(0xffe08a, 0.6); g.fillRect(5, 5, 1, 2); g.fillRect(12, 5, 1, 2); // glints
  });
  gen(scene, 'iconBasketSeed', 20, 20, (g) => {
    drawBasketBody(g);
    g.fillStyle(0xd4a93c, 1); g.fillRoundedRect(4, 5, 12, 6, 2); // mound of grain
    g.fillStyle(0xc8a030, 1);
    g.fillRect(5, 7, 2, 2); g.fillRect(9, 6, 2, 2); g.fillRect(13, 7, 2, 2); g.fillRect(7, 9, 2, 2); g.fillRect(11, 9, 2, 2);
    g.fillStyle(0xe8c050, 1); g.fillRect(6, 5, 1, 1); g.fillRect(10, 4, 1, 1); g.fillRect(14, 5, 1, 1);
  });
  gen(scene, 'iconBasketCatFood', 20, 20, (g) => {
    drawBasketBody(g);
    g.fillStyle(0xb9793a, 1); g.fillRoundedRect(4, 4, 12, 7, 2); // kibble mounded above rim
    g.fillStyle(0x8f5a26, 1); g.fillRect(4, 7, 12, 1); g.fillRect(4, 9, 12, 1);
    g.fillStyle(0xd6a25e, 1);
    g.fillCircle(6, 5, 1); g.fillCircle(10, 4, 1); g.fillCircle(14, 5, 1); g.fillCircle(8, 7, 1);
  });
  // Basket of bunny food (#224) — leafy green pellets + a carrot top, so it reads as
  // "rabbit food" distinct from the brown cat kibble / golden grain at a glance.
  gen(scene, 'iconBasketBunnyFood', 20, 20, (g) => {
    drawBasketBody(g);
    g.fillStyle(0x5c8a3a, 1); g.fillRoundedRect(4, 5, 12, 6, 2); // mound of green pellets
    g.fillStyle(0x74a84c, 1);
    g.fillCircle(6, 7, 1.2); g.fillCircle(10, 6, 1.2); g.fillCircle(14, 7, 1.2); g.fillCircle(8, 9, 1.2); g.fillCircle(12, 9, 1.2);
    g.fillStyle(0x466b2b, 1); g.fillCircle(9, 8, 1); g.fillCircle(13, 8, 1);
    // a little carrot poking out of the mix
    g.fillStyle(0xf07830, 1); g.fillTriangle(10, 5, 8, 1, 12, 1);
    g.fillStyle(0x3b8a1c, 1); g.fillRect(9, 0, 1, 2); g.fillRect(11, 0, 1, 2);
  });
  gen(scene, 'iconBasketEgg', 20, 20, (g) => {
    drawBasketBody(g);
    g.fillStyle(0xfff8e0, 1);
    g.fillEllipse(7, 7, 5, 6); g.fillEllipse(13, 7, 5, 6); g.fillEllipse(10, 5, 5, 6);
    g.fillStyle(0xfffdf5, 1); g.fillEllipse(6, 5, 2, 2); g.fillEllipse(12, 5, 2, 2);
  });
  // Basket of brown eggs (#276) — same layout, warm-brown shells.
  gen(scene, 'iconBasketEggBrown', 20, 20, (g) => {
    drawBasketBody(g);
    g.fillStyle(0xc48a4c, 1);
    g.fillEllipse(7, 7, 5, 6); g.fillEllipse(13, 7, 5, 6); g.fillEllipse(10, 5, 5, 6);
    g.fillStyle(0xdca868, 1); g.fillEllipse(6, 5, 2, 2); g.fillEllipse(12, 5, 2, 2);
  });
  // Basket of raw wool — soft cream fleece clumps mounded above the rim (#233).
  gen(scene, 'iconBasketWool', 20, 20, (g) => {
    drawBasketBody(g);
    g.fillStyle(0xf0ece8, 1);
    g.fillCircle(7, 7, 3.4); g.fillCircle(13, 7, 3.4); g.fillCircle(10, 5, 3.6);
    g.fillStyle(0xfbf9f6, 1); g.fillCircle(6, 5.5, 1.3); g.fillCircle(11, 4, 1.3); // fluffy highlights
    g.fillStyle(0xddd8d2, 1); g.fillCircle(9, 8, 1.1); g.fillCircle(13, 8, 1.1);   // soft shade
  });
  // Basket of yarn — two wound balls of yarn (the processed form), warmer toned so
  // it reads distinct from raw wool at a glance (#233).
  gen(scene, 'iconBasketYarn', 20, 20, (g) => {
    drawBasketBody(g);
    const ball = (cx, cy, r, c, hi) => {
      g.fillStyle(c, 1); g.fillCircle(cx, cy, r);
      g.fillStyle(hi, 1);                 // wound strands crossing the ball
      g.fillRect(cx - r, cy - 1, r * 2, 1); g.fillRect(cx - 1, cy - r, 1, r * 2);
      g.fillRect(cx - r + 1, cy - r + 1, r * 2 - 2, 0.8);
    };
    ball(7, 7, 3.6, 0xd88a6a, 0xe8a888);   // terracotta ball
    ball(13, 6, 3.4, 0x6f9bb8, 0x94bcd6);  // dusty-blue ball
  });
  // Basket of compost (#232) — dark crumbly earth mounded above the rim, flecked
  // with a couple of bits of straw so it reads "rich soil / manure" not just dirt.
  gen(scene, 'iconBasketCompost', 20, 20, (g) => {
    drawBasketBody(g);
    g.fillStyle(0x5a4128, 1); g.fillRoundedRect(4, 4, 12, 7, 2); // dark earth mound
    g.fillStyle(0x6e5233, 1); g.fillEllipse(9, 5, 9, 3);         // lighter crumb top
    g.fillStyle(0x3e2c19, 1);
    g.fillCircle(6, 7, 1); g.fillCircle(12, 6, 1); g.fillCircle(10, 9, 1); // clods
    g.fillStyle(0xc4a43a, 1); g.fillRect(6, 3, 3, 1); g.fillRect(11, 4, 3, 1); // straw flecks
  });

  // Scooper tool (#232) — a stable rake/scoop on a handle. Reads as the "clean up
  // droppings" tool at hotbar size: a wooden handle with a fan of tines at the head.
  gen(scene, 'iconScooper', 20, 20, (g) => {
    // handle (diagonal)
    g.fillStyle(0x9a6a3a, 1); g.fillRect(4, 3, 2, 9);
    g.fillStyle(0xb5854c, 1); g.fillRect(4, 3, 1, 9); // handle highlight
    // scoop head — a shallow metal basket/rake at the bottom
    g.fillStyle(0x8b929c, 1); g.fillRoundedRect(2, 11, 12, 4, 1); // head back
    g.fillStyle(0xaab0ba, 1); g.fillRect(3, 11, 10, 2);            // head highlight
    // tines fanning down from the head
    g.fillStyle(0x6f7580, 1);
    for (let x = 3; x <= 13; x += 2) g.fillRect(x, 14, 1, 4);
  });

  // Shears tool (#254) — a pair of open sheep-shears/scissors. Two crossed steel
  // blades opening to the upper-right with round finger-loop handles at the lower-left,
  // pinned by a rivet at the cross. Reads as the "cut/clip" tool at hotbar size,
  // distinct from the scooper's rake head.
  gen(scene, 'iconShears', 20, 20, (g) => {
    // handles — two dark finger loops at the lower-left, drawn as filled discs with a
    // punched-out lighter center so they read as rings (fill-only, no stroke).
    g.fillStyle(0x3a4048, 1); g.fillCircle(5, 15, 3); g.fillCircle(9, 16.5, 3);
    g.fillStyle(0x20242a, 1); g.fillCircle(5, 15, 1.4); g.fillCircle(9, 16.5, 1.4); // loop holes
    // blades — two tapering steel triangles crossing up toward the top-right
    g.fillStyle(0xb8c0cc, 1);
    g.fillTriangle(7, 13, 17, 4, 15, 6);   // upper blade
    g.fillTriangle(6, 14, 15, 6, 17, 7);   // lower blade
    g.fillStyle(0xdde3ec, 1);
    g.fillTriangle(8, 12, 16, 5, 15, 6);   // blade highlight
    // pivot rivet where the blades cross
    g.fillStyle(0x6f7580, 1); g.fillCircle(8, 13, 1.6);
    g.fillStyle(0x9aa3b0, 1); g.fillCircle(7.5, 12.5, 0.7);
  });

  // Empty bucket — a metal pail tilted slightly forward so you see down into it.
  // The open mouth is a dark interior oval, so "empty" reads at a glance vs. the
  // water-filled version below (#125).
  gen(scene, 'iconBucket', 20, 20, (g) => {
    // Handle arcing over the top
    g.fillStyle(0x6f7889, 1);
    g.fillRect(3, 4, 1, 3); g.fillRect(16, 4, 1, 3);
    g.fillRect(4, 2, 12, 1); g.fillRect(3, 3, 2, 1); g.fillRect(15, 3, 2, 1);
    // Tapered body (front face) with a rounded base so the bottom curves to match
    // the tilted top, instead of looking flat (#125 follow-up).
    g.fillStyle(0x9aa3b6, 1);
    g.fillTriangle(3, 8, 17, 8, 15, 17); g.fillTriangle(3, 8, 15, 17, 5, 17);
    g.fillEllipse(10, 17, 11, 4.4); // rounded bottom bulge
    // Raised rim oval (the lip we look over)
    g.fillStyle(0xb8c0d0, 1); g.fillEllipse(10, 8, 14, 5);
    // Dark inside oval — empty pail
    g.fillStyle(0x474d5b, 1); g.fillEllipse(10, 8, 10.5, 3.4);
    // Left highlight + curved underside shadow
    g.fillStyle(0xb8c0d0, 1); g.fillRect(5, 10, 1, 6);
    g.fillStyle(0x7a8396, 1); g.fillEllipse(10, 18.4, 8.6, 2.2);
  });
  // Filled bucket — same tilted pail, but the mouth oval is full of water with a
  // glint, so "filled" is obvious at a glance next to the empty one (#125).
  gen(scene, 'iconBucketWater', 20, 20, (g) => {
    g.fillStyle(0x6f7889, 1);
    g.fillRect(3, 4, 1, 3); g.fillRect(16, 4, 1, 3);
    g.fillRect(4, 2, 12, 1); g.fillRect(3, 3, 2, 1); g.fillRect(15, 3, 2, 1);
    g.fillStyle(0x9aa3b6, 1);
    g.fillTriangle(3, 8, 17, 8, 15, 17); g.fillTriangle(3, 8, 15, 17, 5, 17);
    g.fillEllipse(10, 17, 11, 4.4); // rounded bottom bulge (matches the tilted top)
    g.fillStyle(0xb8c0d0, 1); g.fillEllipse(10, 8, 14, 5); // rim
    // Water filling the mouth oval, with a brighter glint near-left
    g.fillStyle(0x5fa6d6, 1); g.fillEllipse(10, 8, 10.5, 3.4);
    g.fillStyle(0x9ae0f8, 1); g.fillEllipse(8.4, 7.4, 4.6, 1.6);
    g.fillStyle(0xb8c0d0, 1); g.fillRect(5, 10, 1, 6);
    g.fillStyle(0x7a8396, 1); g.fillEllipse(10, 18.4, 8.6, 2.2);
  });
  // (The cat's water bowl is now filled from a plain bucket of water, so there's no
  // separate cat-water bucket icon — #202 rework removed the `catWater` content.)
  // Bunny water bucket (#224) — same tilted pail of water as the others; it's still
  // literally a bucket of water, distinguished only by the bunny hutch it's drawn from.
  gen(scene, 'iconBucketBunnyWater', 20, 20, (g) => {
    g.fillStyle(0x6f7889, 1);
    g.fillRect(3, 4, 1, 3); g.fillRect(16, 4, 1, 3);
    g.fillRect(4, 2, 12, 1); g.fillRect(3, 3, 2, 1); g.fillRect(15, 3, 2, 1);
    g.fillStyle(0x9aa3b6, 1);
    g.fillTriangle(3, 8, 17, 8, 15, 17); g.fillTriangle(3, 8, 15, 17, 5, 17);
    g.fillEllipse(10, 17, 11, 4.4);
    g.fillStyle(0xb8c0d0, 1); g.fillEllipse(10, 8, 14, 5);
    g.fillStyle(0x5fa6d6, 1); g.fillEllipse(10, 8, 10.5, 3.4);
    g.fillStyle(0x9ae0f8, 1); g.fillEllipse(8.4, 7.4, 4.6, 1.6);
    g.fillStyle(0xb8c0d0, 1); g.fillRect(5, 10, 1, 6);
    g.fillStyle(0x7a8396, 1); g.fillEllipse(10, 18.4, 8.6, 2.2);
  });

  // Milk bucket — the tilted pail filled with creamy milk instead of water (#cow).
  gen(scene, 'iconBucketMilk', 20, 20, (g) => {
    g.fillStyle(0x6f7889, 1);
    g.fillRect(3, 4, 1, 3); g.fillRect(16, 4, 1, 3);
    g.fillRect(4, 2, 12, 1); g.fillRect(3, 3, 2, 1); g.fillRect(15, 3, 2, 1);
    g.fillStyle(0x9aa3b6, 1);
    g.fillTriangle(3, 8, 17, 8, 15, 17); g.fillTriangle(3, 8, 15, 17, 5, 17);
    g.fillEllipse(10, 17, 11, 4.4); // rounded bottom bulge
    g.fillStyle(0xb8c0d0, 1); g.fillEllipse(10, 8, 14, 5); // rim
    // Creamy milk filling the mouth oval, with a soft highlight near-left
    g.fillStyle(0xf4efe2, 1); g.fillEllipse(10, 8, 10.5, 3.4);
    g.fillStyle(0xfffdf6, 1); g.fillEllipse(8.4, 7.4, 4.6, 1.6);
    g.fillStyle(0xb8c0d0, 1); g.fillRect(5, 10, 1, 6);
    g.fillStyle(0x7a8396, 1); g.fillEllipse(10, 18.4, 8.6, 2.2);
  });

  // Nectar bucket (#226) — the tilted pail filled with rosy sugar-water (nectar) for
  // the hummingbird feeder. Same pail as the water/milk buckets, tinted a warm pink so
  // it reads as "sweet nectar" rather than plain water.
  gen(scene, 'iconBucketNectar', 20, 20, (g) => {
    g.fillStyle(0x6f7889, 1);
    g.fillRect(3, 4, 1, 3); g.fillRect(16, 4, 1, 3);
    g.fillRect(4, 2, 12, 1); g.fillRect(3, 3, 2, 1); g.fillRect(15, 3, 2, 1);
    g.fillStyle(0x9aa3b6, 1);
    g.fillTriangle(3, 8, 17, 8, 15, 17); g.fillTriangle(3, 8, 15, 17, 5, 17);
    g.fillEllipse(10, 17, 11, 4.4); // rounded bottom bulge
    g.fillStyle(0xb8c0d0, 1); g.fillEllipse(10, 8, 14, 5); // rim
    // Rosy nectar filling the mouth oval, with a soft highlight near-left
    g.fillStyle(0xe85a7a, 1); g.fillEllipse(10, 8, 10.5, 3.4);
    g.fillStyle(0xf7a6bd, 1); g.fillEllipse(8.4, 7.4, 4.6, 1.6);
    g.fillStyle(0xb8c0d0, 1); g.fillRect(5, 10, 1, 6);
    g.fillStyle(0x7a8396, 1); g.fillEllipse(10, 18.4, 8.6, 2.2);
  });

  // Milk jug/bottle — the saleable product shown on the farm-stand counter and as
  // the float icon when stocking milk (#cow).
  gen(scene, 'iconMilk', 20, 20, (g) => {
    // Bottle body
    g.fillStyle(0xf4efe2, 1); g.fillRect(6, 7, 8, 11);
    g.fillStyle(0xfffdf6, 1); g.fillRect(6, 7, 2, 11); // left highlight
    g.fillStyle(0xe6dfce, 1); g.fillRect(12, 7, 2, 11); // right shade
    // Shoulder + neck
    g.fillStyle(0xf4efe2, 1); g.fillRect(8, 4, 4, 3);
    // Blue cap + label band
    g.fillStyle(0x5fa6d6, 1); g.fillRect(8, 2, 4, 2);
    g.fillStyle(0x5fa6d6, 1); g.fillRect(6, 12, 8, 3);
    g.fillStyle(0x9ae0f8, 1); g.fillRect(6, 12, 8, 1);
  });

  // Wool bundle — the saleable raw fleece on the farm-stand counter and the float
  // icon when stocking wool (#233). A rounded cream clump tied with a band.
  gen(scene, 'iconWool', 20, 20, (g) => {
    g.fillStyle(0xf0ece8, 1);
    g.fillCircle(7, 9, 4); g.fillCircle(13, 9, 4); g.fillCircle(10, 7, 4.5); g.fillCircle(10, 11, 4);
    g.fillStyle(0xfbf9f6, 1); g.fillCircle(7, 6, 1.6); g.fillCircle(12, 5.5, 1.4); // top highlights
    g.fillStyle(0xddd8d2, 1); g.fillCircle(8, 12, 1.4); g.fillCircle(13, 12, 1.4); // underside shade
    g.fillStyle(0xc4bdb5, 1); g.fillRect(5, 13, 10, 1);                            // tie band
  });

  // Ball of yarn — the processed product on the counter / stock float (#233). One
  // wound ball with a trailing strand, warmer toned than raw wool.
  gen(scene, 'iconYarn', 20, 20, (g) => {
    g.fillStyle(0xd88a6a, 1); g.fillCircle(10, 10, 6);        // ball
    g.fillStyle(0xe8a888, 1);                                 // wound strands
    g.fillRect(4, 9, 12, 1.2); g.fillRect(9, 4, 1.2, 12);
    g.fillRect(5, 6, 10, 1); g.fillRect(5, 13, 10, 1);
    g.fillStyle(0xc06f52, 1); g.fillEllipse(10, 10, 12, 3);   // rounding shade
    g.fillStyle(0xd88a6a, 1); g.fillRect(15, 12, 3, 1); g.fillRect(17, 12, 1, 4); // trailing strand
  });

  // --- hand icon (20 × 20) ---
  gen(scene, 'iconHand', 20, 20, (g) => {
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
}
