// In-world props and overlays: scatter/piles of food, flowers, the saddle overlay,
// grooming/roll effects (dust, stink), shadow, and the gather-source props (haystack,
// apple tree, carrot garden, grain bin, stream). Shares `gen` from _frames.js.

import { gen } from './_frames.js';

// Raw Phaser Graphics has no `.layer()` — only the dissect capture recorder does.
// Shim a no-op so prop draw fns can carry dissect tags (per CLAUDE.md) without
// throwing in the real texture build.
const withLayer = (g) => (g.layer ??= () => {}, g);

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

  // Saddle overlays (#134 follow-up to #21): three cosmetically distinct types,
  // all drawn at the same horse-back position (x=19-38, y=16-22) so riding.js can
  // swap textures without repositioning. `withLayer` keeps dissect tags harmless.
  // Western — sturdy, boxy, with a visible horn and skirt (the original silhouette).
  gen(scene, 'saddleOverlayWestern', 64, 54, (g) => { withLayer(g);
    g.layer('seat');
    g.fillStyle(0x8a5020, 1); g.fillRect(19, 16, 20, 6);
    g.fillStyle(0x6a3c18, 1); g.fillRect(18, 18, 4, 5); g.fillRect(35, 18, 4, 5);
    g.fillStyle(0xb07040, 1); g.fillRect(20, 17, 17, 2);
    g.layer('horn');
    g.fillStyle(0x9a6428, 1); g.fillRect(27, 13, 3, 4); g.fillCircle(28, 13, 2); // saddle horn
    g.layer('straps');
    g.fillStyle(0x6a3c18, 1);
    g.fillRect(22, 22, 1, 9); g.fillRect(33, 22, 1, 9);
    g.fillRect(20, 30, 4, 2); g.fillRect(31, 30, 4, 2); // wide fenders/skirt
  });
  // English — lighter, sleeker, no horn, a slimmer flap.
  gen(scene, 'saddleOverlayEnglish', 64, 54, (g) => { withLayer(g);
    g.layer('seat');
    g.fillStyle(0x2e2420, 1); g.fillRect(20, 16, 18, 5);
    g.fillStyle(0x1c1512, 1); g.fillRect(19, 18, 3, 4); g.fillRect(35, 18, 3, 4);
    g.fillStyle(0x4a3c34, 1); g.fillRect(21, 16, 15, 2);
    g.layer('straps');
    g.fillStyle(0x1c1512, 1);
    g.fillRect(23, 21, 1, 7); g.fillRect(33, 21, 1, 7); // slim, close-contact flaps
    g.fillRect(22, 27, 3, 2); g.fillRect(32, 27, 3, 2);
  });
  // Bareback pad: no rigid saddle silhouette on the horse (SADDLE_TYPES.overlay is
  // null for it in items.js), just a soft folded pad — kept here for completeness/
  // preview tooling even though riding.js won't attach it in-world.
  gen(scene, 'saddleOverlayBareback', 64, 54, (g) => { withLayer(g);
    g.layer('pad');
    g.fillStyle(0x8a3a2e, 1); g.fillRect(20, 17, 18, 4);
    g.fillStyle(0xa8503e, 1); g.fillRect(21, 17, 16, 1);
    g.fillStyle(0x6a2a20, 1); g.fillRect(19, 19, 20, 1); // fold shadow
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
  gen(scene, 'orangePile', 26, 14, (g) => { // a couple of oranges on the ground (#228)
    g.fillStyle(0xf0902a, 1); g.fillCircle(8, 9, 5);
    g.fillStyle(0xffb85a, 1); g.fillCircle(6, 7, 1.5);
    g.fillStyle(0x3b8a1c, 1); g.fillEllipse(11, 4, 4, 2);
    g.fillStyle(0xe07f20, 1); g.fillCircle(18, 10, 4.5);
    g.fillStyle(0xffb85a, 1); g.fillCircle(16, 8, 1.2);
  });
  gen(scene, 'berryPile', 24, 12, (g) => { // a small handful of spilled berries (#228)
    g.fillStyle(0x4a2f8a, 1);
    g.fillCircle(6, 8, 2.4); g.fillCircle(11, 6, 2.4); g.fillCircle(16, 8, 2.4); g.fillCircle(9, 10, 2.2);
    g.fillStyle(0x8a5fd6, 1);
    g.fillCircle(5, 7, 0.8); g.fillCircle(10, 5, 0.8); g.fillCircle(15, 7, 0.8);
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
  // Kibble sack (#202 rework) — the cat-food source. A small burlap sack of kibble
  // by the house the player scoops cat food from into a basket, then pours into the
  // food bowl. Mirrors the grain bin's role for seed, but sized small like the bowls.
  gen(scene, 'kibbleSack', 26, 30, (g) => {
    const sack = 0xc9a86a, sackHi = 0xe0c589, sackLo = 0x9c7f45, tie = 0x7a6236;
    g.fillStyle(0x000000, 0.12); g.fillEllipse(13, 29, 22, 5); // ground shadow
    // sack body (a rounded bag, wider at the base)
    g.fillStyle(sackLo, 1); g.fillEllipse(13, 22, 24, 14);
    g.fillStyle(sack, 1);   g.fillEllipse(13, 20, 22, 13);
    g.fillStyle(sackHi, 1); g.fillEllipse(10, 18, 9, 6); // sunlit belly
    // cinched neck + folded top
    g.fillStyle(sackLo, 1); g.fillRect(9, 6, 8, 6);
    g.fillStyle(tie, 1);    g.fillRect(9, 9, 8, 2); // the tie
    g.fillStyle(sack, 1);   g.fillTriangle(8, 7, 18, 7, 13, 2); // folded-over top
    // kibble spilling from the mouth
    const kibble = 0xb9793a, kibbleHi = 0xd6a25e;
    g.fillStyle(kibble, 1); g.fillEllipse(13, 6, 8, 3);
    g.fillStyle(kibbleHi, 1); g.fillCircle(11, 5, 1.2); g.fillCircle(15, 5, 1.2); g.fillCircle(13, 4, 1.2);
  });

  // Fox den (#266) — the gather SOURCE for fox food: a low earthen mound with a dark
  // burrow mouth tucked into it, a scatter of dry grass, and a little bowl of food scraps
  // set out front. The player fills a basket here, then drops fox-food piles to befriend
  // the fox. Origin bottom-centre (set by the placer). Drawn in the same cozy pixel style
  // as the other sources.
  gen(scene, 'foxDen', 44, 34, (g) => {
    const earth = 0x8a6a44, earthHi = 0xa8855a, earthLo = 0x63492d, hole = 0x241a10;
    g.layer('shadow');
    g.fillStyle(0x000000, 0.14); g.fillEllipse(22, 32, 40, 6);
    // earthen mound
    g.layer('mound');
    g.fillStyle(earthLo, 1); g.fillEllipse(22, 26, 42, 18);
    g.fillStyle(earth, 1);   g.fillEllipse(22, 24, 38, 16);
    g.fillStyle(earthHi, 1); g.fillEllipse(16, 20, 16, 6); // sunlit crown
    // burrow mouth
    g.layer('burrow');
    g.fillStyle(hole, 1);        g.fillEllipse(22, 25, 16, 12);
    g.fillStyle(0x000000, 0.35); g.fillEllipse(22, 26, 12, 9); // depth
    g.fillStyle(earthLo, 1);     g.fillEllipse(22, 20, 15, 4); // lip above the hole
    // dry grass tufts around the base
    g.layer('grass');
    const grass = 0x9aa15a, grassHi = 0xbcc178;
    g.fillStyle(grass, 1);
    g.fillRect(4, 26, 1, 5); g.fillRect(7, 25, 1, 6); g.fillRect(38, 26, 1, 5); g.fillRect(41, 25, 1, 6);
    g.fillStyle(grassHi, 1);
    g.fillRect(5, 27, 1, 3); g.fillRect(39, 27, 1, 3);
    // a little dish of food scraps out front
    g.layer('dish');
    g.fillStyle(0x6f6f78, 1); g.fillEllipse(22, 32, 12, 4);
    g.fillStyle(0xb9793a, 1); g.fillEllipse(22, 31, 9, 2.5);
    g.fillStyle(0xd6a25e, 1); g.fillCircle(20, 31, 1); g.fillCircle(24, 31, 1);
  });

  // Fox food pile (#266) — a dropped serving of scraps the fox trots over to gnaw. Little
  // russet meaty morsels + a couple of berries on the ground, distinct at a glance from
  // the golden hay / green bunny pellets. Origin default (placed centred by placeFood).
  gen(scene, 'foxFoodPile', 22, 10, (g) => {
    g.fillStyle(0x000000, 0.1); g.fillEllipse(11, 9, 20, 3); // ground shadow
    const meat = 0xb05a3a, meatHi = 0xcf7a54, meatLo = 0x8a4028;
    // scattered meaty morsels
    g.fillStyle(meatLo, 1);
    g.fillEllipse(6, 6, 6, 4); g.fillEllipse(13, 6, 6, 4); g.fillEllipse(17, 5, 5, 3);
    g.fillStyle(meat, 1);
    g.fillEllipse(6, 5, 5, 3); g.fillEllipse(13, 5, 5, 3); g.fillEllipse(17, 4, 4, 2.5);
    g.fillStyle(meatHi, 1);
    g.fillCircle(5, 4, 1); g.fillCircle(12, 4, 1); g.fillCircle(16, 3.5, 0.8);
    // a couple of dark berries tucked in
    g.fillStyle(0x5a2a55, 1); g.fillCircle(9, 6, 1.4); g.fillCircle(15, 7, 1.4);
    g.fillStyle(0x7a3a72, 1); g.fillCircle(8.5, 5.5, 0.6); g.fillCircle(14.5, 6.5, 0.6);
  });

  // Pig feed pile (#40) — a dropped serving of ground pig chow the pig trots over to
  // eat. A coarse brownish mash mound, distinct at a glance from the golden hay /
  // orange carrot pile / green bunny pellets. Origin default (placed by placeFood).
  gen(scene, 'pigFeedPile', 22, 10, (g) => {
    g.fillStyle(0x000000, 0.1); g.fillEllipse(11, 9, 20, 3); // ground shadow
    g.fillStyle(0x6e5230, 1); g.fillEllipse(11, 6, 18, 6);   // mash mound
    g.fillStyle(0x8a6a3c, 1); g.fillEllipse(9, 5, 12, 4);    // lit crown
    g.fillStyle(0xa8845a, 1); g.fillCircle(6, 5, 1); g.fillCircle(14, 4, 1); g.fillCircle(17, 6, 1);
    g.fillStyle(0xf07830, 1); g.fillCircle(9, 4, 0.9); g.fillCircle(15, 5, 0.9); // carrot flecks
  });

  // Pig slop pile (#225) — a dropped serving from the slop-maker: leftover food ground
  // into pig chow. Duller and wetter-looking than pigFeedPile's warm mash, with a
  // couple of colored flecks hinting at the mixed leftovers that went in.
  gen(scene, 'pigSlopPile', 22, 10, (g) => {
    g.fillStyle(0x000000, 0.1); g.fillEllipse(11, 9, 20, 3); // ground shadow
    g.fillStyle(0x54503e, 1); g.fillEllipse(11, 6, 18, 6);   // dull slop mound
    g.fillStyle(0x6a6250, 1); g.fillEllipse(9, 5, 12, 4);    // lit crown
    g.fillStyle(0x38362a, 1); g.fillCircle(6, 6, 1); g.fillCircle(15, 5, 1); // wet dark bits
    g.fillStyle(0x8a3ca0, 1); g.fillCircle(9, 4, 0.8); // fleck of leftover pie
    g.fillStyle(0xe8a848, 1); g.fillCircle(14, 4, 0.8); // fleck of leftover bread
  });

  // Duck feeder (#275) — the gather SOURCE for duck food: a rustic wooden feed tray
  // set on a post by the stream bank, scattered with grain. The player fills a basket
  // here, then drops duck-food piles to befriend the wild duck. Origin bottom-centre
  // (set by the placer). Drawn in the same cozy pixel style as the fox den / kibble sack.
  gen(scene, 'duckFeeder', 36, 34, (g) => {
    const post = 0x8a6a44, postHi = 0xa8855a, postLo = 0x63492d;
    const wood = 0xb08858, woodHi = 0xcaa878, woodLo = 0x8a6640;
    g.layer('shadow');
    g.fillStyle(0x000000, 0.14); g.fillEllipse(18, 32, 26, 5);
    // post
    g.layer('post');
    g.fillStyle(postLo, 1); g.fillRect(16, 14, 5, 18);
    g.fillStyle(post, 1);   g.fillRect(17, 14, 3, 18);
    g.fillStyle(postHi, 1); g.fillRect(17, 14, 1, 18);
    // tray
    g.layer('tray');
    g.fillStyle(woodLo, 1); g.fillEllipse(18, 13, 30, 9);
    g.fillStyle(wood, 1);   g.fillEllipse(18, 11, 28, 8);
    g.fillStyle(woodHi, 1); g.fillEllipse(12, 9, 12, 3); // sunlit rim
    // grain scattered in the tray
    g.layer('grain');
    const grain = 0xd8a94a, grainHi = 0xefc978;
    g.fillStyle(grain, 1);
    g.fillCircle(9, 10, 1.2); g.fillCircle(14, 9, 1.2); g.fillCircle(19, 10, 1.2);
    g.fillCircle(24, 9, 1.2); g.fillCircle(27, 11, 1.2); g.fillCircle(16, 12, 1.2);
    g.fillStyle(grainHi, 1);
    g.fillCircle(9, 9, 0.6); g.fillCircle(19, 9, 0.6); g.fillCircle(24, 8, 0.6);
  });

  // Duck food pile (#275) — a dropped serving of grain the wild duck waddles over to
  // eat. Golden scattered grains + a couple of green pond-weed bits, distinct at a
  // glance from the fox's meaty morsels / the bunny's leafy pellets. Origin default
  // (placed centred by placeFood).
  gen(scene, 'duckFoodPile', 22, 10, (g) => {
    g.fillStyle(0x000000, 0.1); g.fillEllipse(11, 9, 20, 3); // ground shadow
    const grain = 0xd8a94a, grainHi = 0xefc978, grainLo = 0xab8038;
    g.fillStyle(grainLo, 1);
    g.fillEllipse(6, 6, 6, 4); g.fillEllipse(13, 6, 6, 4); g.fillEllipse(17, 5, 5, 3);
    g.fillStyle(grain, 1);
    g.fillEllipse(6, 5, 5, 3); g.fillEllipse(13, 5, 5, 3); g.fillEllipse(17, 4, 4, 2.5);
    g.fillStyle(grainHi, 1);
    g.fillCircle(5, 4, 1); g.fillCircle(12, 4, 1); g.fillCircle(16, 3.5, 0.8);
    // a couple of pond-weed sprigs tucked in
    g.fillStyle(0x4a7a2e, 1); g.fillCircle(9, 6, 1.4); g.fillCircle(15, 7, 1.4);
    g.fillStyle(0x69a34a, 1); g.fillCircle(8.5, 5.5, 0.6); g.fillCircle(14.5, 6.5, 0.6);
  });

  // Animal dropping (#232) — a small, tasteful cluster of rounded pellets on the
  // ground with a soft shadow. Cozy pixel-art, kept deliberately little and neat so
  // it reads as "a bit to tidy up," not gross. Scooped up with the scooper tool.
  gen(scene, 'dropping', 16, 10, (g) => {
    g.layer('shadow');
    g.fillStyle(0x000000, 0.12); g.fillEllipse(8, 8, 14, 3);
    g.layer('pellets');
    const base = 0x5a4128, hi = 0x6e5233, lo = 0x3e2c19;
    // three rounded pellets clustered together
    g.fillStyle(base, 1);
    g.fillEllipse(5, 6, 5, 4); g.fillEllipse(10, 6, 5, 4); g.fillEllipse(8, 4, 5, 4);
    g.fillStyle(hi, 1); // soft top highlight on each
    g.fillEllipse(4, 5, 2, 1.4); g.fillEllipse(9, 5, 2, 1.4); g.fillEllipse(7, 3, 2, 1.4);
    g.fillStyle(lo, 1); // grounding shade under the cluster
    g.fillRect(2, 7, 12, 1);
  });

  // Compost bin (#232) — a slatted wooden bin you dump scooped droppings into. A
  // simple open-topped crate with a dark composting-earth pile just visible over the
  // rim, so it reads as "put the muck here." Placed once in the pasture.
  gen(scene, 'compostBin', 40, 34, (g) => {
    g.layer('shadow');
    g.fillStyle(0x000000, 0.14); g.fillEllipse(20, 31, 36, 6);
    g.layer('earth');
    // dark compost heaped inside, showing above the front slats
    g.fillStyle(0x4a3620, 1); g.fillEllipse(20, 14, 30, 10);
    g.fillStyle(0x5e4529, 1); g.fillEllipse(18, 12, 22, 6);
    g.fillStyle(0x3a2a18, 1); g.fillCircle(13, 13, 1.4); g.fillCircle(26, 12, 1.4); g.fillCircle(20, 15, 1.4);
    g.fillStyle(0xc4a43a, 1); g.fillRect(11, 11, 3, 1); g.fillRect(24, 12, 3, 1); // straw flecks
    g.layer('bin');
    // wooden crate walls (front + sides), slatted
    const wood = 0x8a6a3c, woodHi = 0xa07f4a, woodLo = 0x6b502c;
    g.fillStyle(wood, 1); g.fillRect(6, 12, 28, 18);       // front wall
    g.fillStyle(woodLo, 1); g.fillRect(6, 27, 28, 3);       // shaded base
    // vertical slats / posts
    g.fillStyle(woodLo, 1);
    for (let x = 10; x < 34; x += 6) g.fillRect(x, 12, 1, 18);
    // corner posts
    g.fillStyle(woodHi, 1); g.fillRect(6, 10, 3, 20); g.fillRect(31, 10, 3, 20);
    g.fillStyle(wood, 1); g.fillRect(6, 10, 28, 3);         // top rim front
    g.fillStyle(woodHi, 1); g.fillRect(6, 10, 28, 1);       // rim highlight
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
  // Orange tree (#228) — a second gatherable tree, same silhouette as the apple
  // tree (leafy crown over a trunk) but its own colour palette + round orange fruit.
  gen(scene, 'orangeTree', 52, 68, (g) => {
    g.fillStyle(0x6a4424, 1); g.fillRect(23, 40, 6, 26); // trunk
    g.fillStyle(0x83562e, 1); g.fillRect(23, 40, 2, 26);
    g.fillStyle(0x2f7a2a, 1); g.fillCircle(26, 26, 24); // crown (a touch yellower green than apple)
    g.fillStyle(0x3f9a34, 1); g.fillCircle(18, 20, 14); g.fillCircle(36, 22, 13);
    g.fillStyle(0x58b840, 1); g.fillCircle(20, 16, 8);
    g.fillStyle(0xf0902a, 1); // oranges
    g.fillCircle(14, 28, 3); g.fillCircle(30, 16, 3); g.fillCircle(38, 30, 3); g.fillCircle(24, 34, 3);
    g.fillStyle(0xffb85a, 1);
    g.fillCircle(13, 27, 1); g.fillCircle(29, 15, 1); g.fillCircle(37, 29, 1); g.fillCircle(23, 33, 1);
  });
  // Berry bush (#228) — the same gather interaction as the apple/orange trees, but a
  // low, trunkless canopy sitting near the ground (no trunk texture at all): a wide,
  // squat cluster of foliage with berries dotted through it.
  gen(scene, 'berryBush', 46, 34, (g) => {
    // ground shadow
    g.fillStyle(0x000000, 0.12); g.fillEllipse(23, 32, 36, 6);
    g.fillStyle(0x2f6e1f, 1); g.fillCircle(23, 22, 16); // low, wide canopy — no trunk
    g.fillStyle(0x3b8a26, 1); g.fillCircle(13, 20, 10); g.fillCircle(33, 20, 10);
    g.fillStyle(0x4fa838, 1); g.fillCircle(23, 14, 8);
    g.fillStyle(0x4a2f8a, 1); // berries (deep purple-red)
    g.fillCircle(11, 22, 2.6); g.fillCircle(23, 12, 2.6); g.fillCircle(33, 24, 2.6); g.fillCircle(20, 27, 2.6);
    g.fillStyle(0x8a5fd6, 1);
    g.fillCircle(10, 21, 0.9); g.fillCircle(22, 11, 0.9); g.fillCircle(32, 23, 0.9); g.fillCircle(19, 26, 0.9);
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
    g.fillStyle(0xb98a4a, 1); g.fillRect(6, 14, 28, 25); // burlap sack body
    g.fillStyle(0xb98a4a, 1); g.fillEllipse(20, 39, 28, 9); // rounded bottom (matches the top rim's curve)
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
  // Stone well — a water source: stone drum, posts, peaked shingle roof,
  // a crank, and a bucket hanging on a rope over the dark opening.
  gen(scene, 'well', 40, 52, (g) => {
    const stone = 0x9a9087, stoneLo = 0x7d756c, stoneHi = 0xb6ada3, mortar = 0x655e56;
    const wood = 0x7a5230, woodHi = 0x946540, woodLo = 0x5e3f24;
    const roof = 0x8a4a2a, roofHi = 0xa75c34, roofLo = 0x6d3a20;
    // ground shadow
    g.fillStyle(0x000000, 0.12); g.fillEllipse(20, 50, 36, 6);
    // stone drum body
    g.fillStyle(stone, 1); g.fillRect(6, 32, 28, 17);
    g.fillStyle(stoneLo, 1); g.fillEllipse(20, 49, 28, 6); // rounded foot
    g.fillStyle(stone, 1); g.fillEllipse(20, 48, 26, 5);
    // mortar lines + block highlights
    g.fillStyle(mortar, 1);
    g.fillRect(6, 40, 28, 1); g.fillRect(15, 33, 1, 7); g.fillRect(24, 40, 1, 9);
    g.fillRect(11, 40, 1, 9); g.fillRect(20, 41, 1, 8);
    g.fillStyle(stoneHi, 1); g.fillRect(8, 36, 3, 1); g.fillRect(26, 43, 3, 1); g.fillRect(17, 45, 3, 1);
    // top rim + dark opening with a hint of water
    g.fillStyle(stoneHi, 1); g.fillEllipse(20, 32, 30, 8);
    g.fillStyle(stoneLo, 1); g.fillEllipse(20, 32, 26, 6);
    g.fillStyle(0x2a2f38, 1); g.fillEllipse(20, 32, 21, 5);
    g.fillStyle(0x35506b, 1); g.fillEllipse(20, 33, 13, 3);
    g.fillStyle(0x4a7fa8, 0.8); g.fillEllipse(18, 32, 6, 1);
    // posts
    g.fillStyle(wood, 1); g.fillRect(7, 9, 3, 25); g.fillRect(30, 9, 3, 25);
    g.fillStyle(woodHi, 1); g.fillRect(7, 9, 1, 25); g.fillRect(30, 9, 1, 25);
    // crank axle + handle
    g.fillStyle(woodLo, 1); g.fillRect(9, 17, 22, 3);
    g.fillStyle(woodHi, 1); g.fillRect(9, 17, 22, 1);
    g.fillStyle(wood, 1); g.fillRect(31, 16, 4, 1); g.fillRect(34, 16, 1, 6); g.fillRect(31, 21, 4, 1);
    // rope + hanging bucket dipping into the opening
    g.fillStyle(0xcaa56a, 1); g.fillRect(20, 20, 1, 7);
    g.fillStyle(woodLo, 1); g.fillRect(16, 26, 8, 7);
    g.fillStyle(wood, 1); g.fillRect(16, 26, 8, 1);
    g.fillStyle(0x4a586a, 1); g.fillRect(17, 27, 6, 3);
    g.fillStyle(0x3a2a18, 1); g.fillRect(16, 28, 1, 5); g.fillRect(23, 28, 1, 5);
    // peaked shingle roof
    g.fillStyle(roofLo, 1); g.fillTriangle(2, 12, 38, 12, 20, 0);
    g.fillStyle(roof, 1); g.fillTriangle(4, 11, 36, 11, 20, 1);
    g.fillStyle(roofHi, 1); g.fillTriangle(6, 10, 21, 10, 20, 3);
    g.fillStyle(roofLo, 1); g.fillRect(8, 9, 25, 1); g.fillRect(11, 6, 18, 1);
    g.fillStyle(roofLo, 1); g.fillRect(19, 1, 2, 11); // ridge
  });
  // Combined pet food + water bowl (#202 cat rework, #311 merged the separate food
  // and water dishes into ONE prop). A single two-sided dish — food on the left,
  // water on the right, touching in the middle like a real two-bowl pet feeder — so
  // the player interacts with one object instead of two side-by-side props. Each
  // side fills/empties independently, so there are four texture states
  // (`<tex>_00`/`_10`/`_01`/`_11`, food-bit then water-bit); the sprite swaps as
  // either side's level crosses zero (worldObjects.js `_setPetBowlLevel`).
  // `foodColor`/`foodHi` let a species tint its side's contents (kibble for the cat,
  // green pellets for the bunny) while sharing the same dish shape + water side.
  const drawPetBowl = (g, { foodFilled, waterFilled, foodColor = 0xb9793a, foodHi = 0xd6a25e }) => {
    const dish = 0xc85a3c, dishHi = 0xe07854, dishLo = 0x9c4228;
    const water = 0x8a97a0, waterDishHi = 0xaab5bc, waterDishLo = 0x6a747c;
    // shared ground shadow beneath both dishes
    g.fillStyle(0x000000, 0.12); g.fillEllipse(26, 15, 46, 5);
    // food dish (left, warm terracotta)
    g.fillStyle(dishLo, 1); g.fillEllipse(13, 11, 24, 9);
    g.fillStyle(dish, 1); g.fillEllipse(13, 9, 22, 8);
    if (!foodFilled) { g.fillStyle(dishLo, 0.6); g.fillEllipse(13, 8, 15, 4); } // hollow shadow
    g.fillStyle(dishHi, 1); g.fillEllipse(13, 7, 18, 5); // rim highlight
    if (foodFilled) {
      g.fillStyle(foodColor, 1); g.fillEllipse(13, 6, 14, 5);
      g.fillStyle(foodHi, 1);
      g.fillCircle(9, 5, 1.4); g.fillCircle(13, 4, 1.4); g.fillCircle(17, 5, 1.4);
      g.fillStyle(foodColor, 1);
      g.fillCircle(11, 6, 1.2); g.fillCircle(15, 6, 1.2);
    }
    // water dish (right, blue-grey)
    g.fillStyle(waterDishLo, 1); g.fillEllipse(39, 11, 24, 9);
    g.fillStyle(water, 1); g.fillEllipse(39, 9, 22, 8);
    if (!waterFilled) { g.fillStyle(waterDishLo, 0.6); g.fillEllipse(39, 8, 15, 4); } // hollow shadow
    g.fillStyle(waterDishHi, 1); g.fillEllipse(39, 7, 18, 5); // rim highlight
    if (waterFilled) {
      const w = 0x3f7fb5, wHi = 0x9ae0f8;
      g.fillStyle(w, 1); g.fillEllipse(39, 6, 14, 5);
      g.fillStyle(wHi, 0.85); g.fillEllipse(36, 5, 5, 1.6); // sunlit ripple
      g.fillStyle(wHi, 0.6); g.fillEllipse(42, 6, 3, 1);
    }
  };
  // One combined bowl texture set per pet — cat (kibble, orange-brown), bunny
  // (pellets, leafy green) and dog (#347: bigger meaty chunks, a deeper brown) —
  // each with all four food/water fill-state combinations. Same dish shape and water
  // side throughout, so the three read as one family of object; only the food tint
  // differs.
  const BOWL_STATES = [[false, false], [true, false], [false, true], [true, true]];
  for (const [foodFilled, waterFilled] of BOWL_STATES) {
    const suffix = `${foodFilled ? 1 : 0}${waterFilled ? 1 : 0}`;
    gen(scene, `catBowl_${suffix}`, 52, 16, (g) => drawPetBowl(g, { foodFilled, waterFilled }));
    gen(scene, `bunnyBowl_${suffix}`, 52, 16, (g) => drawPetBowl(g, {
      foodFilled, waterFilled, foodColor: 0x6a9c3c, foodHi: 0x8fc95e,
    }));
    gen(scene, `dogBowl_${suffix}`, 52, 16, (g) => drawPetBowl(g, {
      foodFilled, waterFilled, foodColor: 0x8a5730, foodHi: 0xb07a4a,
    }));
  }

  // Bunny hutch (#224) — the gathering source for bunny food + water. A little raised
  // wooden hutch with a wire-mesh front, a shingled roof, and a bowl of green food
  // pellets tucked in front. The player fills a carrier here, then drops a bunny-food
  // pile to attract/feed bunnies. Origin bottom-centre (set by the placer).
  gen(scene, 'bunnyHutch', 48, 44, (g) => {
    const wood = 0xa9773f, woodHi = 0xc99a5f, woodLo = 0x7f5628;
    const roof = 0x8a5a34, roofHi = 0xa9754a, mesh = 0x4a4038;
    g.layer('shadow');
    g.fillStyle(0x000000, 0.14); g.fillEllipse(24, 42, 40, 6);
    // legs
    g.layer('legs');
    g.fillStyle(woodLo, 1); g.fillRect(8, 32, 4, 9); g.fillRect(36, 32, 4, 9);
    // main box body
    g.layer('body');
    g.fillStyle(wood, 1); g.fillRect(6, 16, 36, 18);
    g.fillStyle(woodHi, 1); g.fillRect(6, 16, 36, 2);
    g.fillStyle(woodLo, 1); g.fillRect(6, 32, 36, 2);
    // wire-mesh door on the left, solid nesting box on the right
    g.layer('door');
    g.fillStyle(mesh, 1); g.fillRect(9, 19, 15, 12);
    g.fillStyle(0x6a5f52, 1);
    for (let x = 11; x < 24; x += 3) g.fillRect(x, 19, 1, 12);
    for (let y = 21; y < 31; y += 3) g.fillRect(9, y, 15, 1);
    g.fillStyle(woodHi, 1); g.fillRect(26, 19, 13, 12); // solid box side
    g.fillStyle(woodLo, 1); g.fillRect(31, 19, 1, 12);
    // shingled roof, overhanging
    g.layer('roof');
    g.fillStyle(roof, 1); g.fillRect(3, 10, 42, 7);
    g.fillStyle(roofHi, 1); g.fillRect(3, 10, 42, 2);
    g.fillStyle(0x6f4526, 1); g.fillRect(3, 13, 42, 1); g.fillRect(3, 15, 42, 1);
    // a food dish of green pellets sitting out front
    g.layer('dish');
    g.fillStyle(0x8a97a0, 1); g.fillEllipse(24, 37, 16, 5);
    g.fillStyle(0x5c8a3a, 1); g.fillEllipse(24, 35, 12, 4);
    g.fillStyle(0x74a84c, 1); g.fillCircle(21, 34, 1.1); g.fillCircle(25, 34, 1.1); g.fillCircle(27, 35, 1);
  });

  // --- Trash can (#191) ---------------------------------------------------
  // A dented galvanized-metal bin the raccoon rummages in: a tapered drum with
  // vertical ribs, two side handles, and a domed lid. Origin bottom-centre (set by
  // the placer). Two states — `trashCan` (lid on, tidy) and `trashCanOpen` (lid
  // tipped off beside it with rubbish poking out) — swapped as the raccoon works.
  const trashDrum = (g, y0) => {
    const metal = 0x9aa0a6, metalHi = 0xc3c8cc, metalLo = 0x6b7076, rib = 0x7f858b, dent = 0x5c6167;
    // ground shadow
    g.layer('shadow');
    g.fillStyle(0x000000, 0.14); g.fillEllipse(16, 43, 30, 6);
    // drum body — slightly tapered (wider at the rim), rounded foot
    g.layer('body');
    g.fillStyle(metalLo, 1); g.fillEllipse(16, 41, 26, 7);   // foot
    g.fillStyle(metal, 1);   g.fillRect(4, y0, 24, 41 - y0);  // sides
    g.fillStyle(metal, 1);   g.fillEllipse(16, 41, 24, 6);    // rounded base
    // vertical ribs / corrugations
    g.layer('ribs');
    g.fillStyle(metalHi, 1); g.fillRect(6, y0 + 2, 1, 36); g.fillRect(11, y0 + 2, 1, 36);
    g.fillStyle(rib, 1);     g.fillRect(9, y0 + 2, 1, 36); g.fillRect(20, y0 + 2, 1, 36);
    g.fillStyle(metalHi, 1); g.fillRect(23, y0 + 2, 1, 36);
    g.fillStyle(metalLo, 1); g.fillRect(4, y0, 1, 41 - y0); g.fillRect(27, y0, 1, 41 - y0); // shaded edges
    // a couple of dents for character
    g.layer('dents');
    g.fillStyle(dent, 0.8); g.fillEllipse(13, y0 + 18, 4, 3); g.fillEllipse(22, y0 + 28, 3, 2);
    // two riveted side handles
    g.layer('handles');
    g.fillStyle(metalLo, 1); g.fillRect(2, y0 + 8, 3, 2); g.fillRect(27, y0 + 8, 3, 2);
    g.fillStyle(metalHi, 1); g.fillRect(2, y0 + 8, 1, 1); g.fillRect(29, y0 + 8, 1, 1);
  };

  gen(scene, 'trashCan', 32, 46, (g0) => {
    const g = withLayer(g0);
    const metal = 0x9aa0a6, metalHi = 0xc3c8cc, metalLo = 0x6b7076;
    trashDrum(g, 8);
    // domed lid seated on top, with a knob handle
    g.layer('lid');
    g.fillStyle(metalLo, 1); g.fillEllipse(16, 8, 30, 8);   // lid underside/rim
    g.fillStyle(metal, 1);   g.fillEllipse(16, 6, 28, 7);   // lid dome
    g.fillStyle(metalHi, 1); g.fillEllipse(14, 5, 16, 3);   // sunlit top
    g.fillStyle(metalLo, 1); g.fillRect(15, 1, 2, 3);       // knob stem
    g.fillStyle(metal, 1);   g.fillEllipse(16, 1, 6, 3);    // knob
    g.fillStyle(metalHi, 1); g.fillEllipse(15, 0, 3, 1.5);
  });

  gen(scene, 'trashCanOpen', 32, 46, (g0) => {
    const g = withLayer(g0);
    const metal = 0x9aa0a6, metalHi = 0xc3c8cc, metalLo = 0x6b7076;
    const dark = 0x2a2d30, banana = 0xe6c33a, paper = 0xe8e4d6, apple = 0xb84040;
    trashDrum(g, 8);
    // open mouth — dark interior at the rim
    g.layer('mouth');
    g.fillStyle(metalLo, 1); g.fillEllipse(16, 8, 28, 8);
    g.fillStyle(dark, 1);    g.fillEllipse(16, 8, 22, 6);
    // rubbish poking out of the open top
    g.layer('rubbish');
    g.fillStyle(banana, 1); g.fillTriangle(10, 8, 6, 2, 13, 6);   // banana peel
    g.fillStyle(paper, 1);  g.fillRect(15, 2, 5, 5);              // crumpled paper
    g.fillStyle(0xd2cebd, 1); g.fillRect(16, 3, 3, 3);
    g.fillStyle(apple, 1);  g.fillCircle(22, 6, 2.5);             // apple core
    g.fillStyle(0x6a3d1a, 1); g.fillRect(22, 2, 1, 2);
    // the tipped-off lid leaning against the base on the left
    g.layer('lid');
    g.fillStyle(metalLo, 1); g.fillEllipse(3, 40, 12, 20);
    g.fillStyle(metal, 1);   g.fillEllipse(3, 40, 9, 17);
    g.fillStyle(metalHi, 1); g.fillEllipse(2, 38, 3, 8);
    g.fillStyle(metalLo, 1); g.fillRect(0, 39, 2, 3);            // knob (on its side)
  });

  // A small scatter of spilled rubbish the raccoon strews on the ground while it
  // rummages (cleared when it tidies off). Origin centre.
  gen(scene, 'trashSpill', 24, 12, (g0) => {
    const g = withLayer(g0);
    g.layer('spill');
    g.fillStyle(0x000000, 0.08); g.fillEllipse(12, 10, 22, 3);
    g.fillStyle(0xe8e4d6, 1); g.fillRect(3, 5, 5, 4);            // paper wad
    g.fillStyle(0xd2cebd, 1); g.fillRect(4, 6, 2, 2);
    g.fillStyle(0xe6c33a, 1); g.fillTriangle(11, 9, 9, 3, 15, 7); // banana peel
    g.fillStyle(0xb84040, 1); g.fillCircle(18, 7, 2.5);          // apple core
    g.fillStyle(0x6a3d1a, 1); g.fillRect(18, 3, 1, 3);
    g.fillStyle(0x5a7a3a, 1); g.fillRect(20, 8, 3, 2);           // a bit of green scrap
  });

  // A little morsel the raccoon clutches while it scurries off with its "loot"
  // (cosmetic theft #191 — it takes nothing real). A rosy apple with a leaf; small
  // enough to read as held-in-paws. Origin centre.
  gen(scene, 'raccoonLoot', 10, 10, (g0) => {
    const g = withLayer(g0);
    g.layer('loot');
    g.fillStyle(0xd64545, 1); g.fillCircle(5, 6, 4);
    g.fillStyle(0xe87a7a, 1); g.fillCircle(3, 4, 1.4);          // highlight
    g.fillStyle(0x6a3d1a, 1); g.fillRect(5, 1, 1, 3);           // stem
    g.fillStyle(0x3b8a1c, 1); g.fillTriangle(6, 2, 9, 1, 8, 4); // leaf
  });

  // ── Garden plot + crops (#242) ───────────────────────────────────────────────
  buildGardenTextures(scene);
}

// Garden plot art: the tilled soil bed, and per-crop growth-stage sprites. Kept in its
// own function so the crop set stays co-located and easy to extend (a new crop = a new
// entry in CROP_ART below + its icons). Origins bottom-centre so a crop "stands" in its
// slot the way animals/props do (setDepth(y) sorts correctly).
function buildGardenTextures(scene) {
  const withLayer = (g0) => (g0.layer ??= () => {}, g0);

  // The tilled garden bed the slots sit on — a rectangle of dark furrowed earth with a
  // wooden frame, drawn once behind the crops. Sized to hold a 3×2 row of slots.
  gen(scene, 'gardenPlot', 132, 84, (g0) => {
    const g = withLayer(g0);
    g.layer('frame');
    const wood = 0x7a5a30, woodHi = 0x93703c, woodLo = 0x5e4525;
    g.fillStyle(wood, 1); g.fillRect(0, 0, 132, 84);
    g.fillStyle(woodHi, 1); g.fillRect(0, 0, 132, 3);
    g.fillStyle(woodLo, 1); g.fillRect(0, 81, 132, 3);
    g.layer('soil');
    const soil = 0x5a3f24, soilHi = 0x6e4e2c, soilLo = 0x452f1a;
    g.fillStyle(soil, 1); g.fillRect(5, 5, 122, 74);
    g.fillStyle(soilHi, 1); g.fillRect(5, 5, 122, 2);
    // furrow ridges running across the bed
    g.fillStyle(soilLo, 1);
    for (let y = 14; y < 78; y += 12) g.fillRect(6, y, 120, 2);
    g.fillStyle(soilHi, 1);
    for (let y = 10; y < 78; y += 12) g.fillRect(6, y, 120, 1);
    // scattered flecks of grit
    g.fillStyle(soilLo, 1);
    for (let i = 0; i < 24; i++) g.fillRect(8 + (i * 37) % 116, 8 + (i * 23) % 68, 1, 1);
  });

  // Shared soil mound each crop stage sprout grows out of (a small dark hillock).
  const mound = (g) => {
    g.fillStyle(0x000000, 0.12); g.fillEllipse(11, 21, 18, 4); // shadow
    g.fillStyle(0x4a3420, 1); g.fillEllipse(11, 19, 15, 5);
    g.fillStyle(0x5c4228, 1); g.fillEllipse(11, 18, 11, 3);
  };
  const sprout = (g, tall) => { // a young green shoot, `tall` px high
    g.fillStyle(0x3f8a24, 1); g.fillRect(10, 19 - tall, 2, tall);
    g.fillStyle(0x54a634, 1);
    g.fillTriangle(11, 19 - tall, 6, 19 - tall + 3, 11, 19 - tall + 5);
    g.fillTriangle(11, 19 - tall, 16, 19 - tall + 3, 11, 19 - tall + 5);
  };
  const leafy = (g, h) => { // a fuller bushy plant of height `h`
    g.fillStyle(0x357a1e, 1); g.fillEllipse(11, 19 - h * 0.5, h, h * 0.9);
    g.fillStyle(0x4a9a2e, 1); g.fillEllipse(9, 19 - h * 0.6, h * 0.6, h * 0.6);
    g.fillStyle(0x5fb43a, 1); g.fillEllipse(13, 19 - h * 0.4, h * 0.4, h * 0.4);
  };

  // Per-crop foliage + ripe fruit. Each draws stages 0..3 (0 seedling → 3 ripe). The
  // ripe stage adds the crop's harvestable fruit so the plot reads "ready to pick."
  const CROP_ART = {
    strawberry: {
      grow: (g) => leafy(g, 12),
      fruit: (g) => { // red berries dotted among the leaves
        for (const [x, y] of [[6, 15], [15, 14], [11, 18], [16, 18]]) {
          g.fillStyle(0xe23b4a, 1); g.fillTriangle(x, y + 4, x - 2, y, x + 2, y);
          g.fillStyle(0xffe08a, 1); g.fillRect(x, y + 1, 1, 1);
        }
      },
    },
    wheat: {
      grow: (g) => { // tall golden-green stalks
        g.fillStyle(0x6a9a3a, 1);
        for (const x of [7, 11, 15]) g.fillRect(x, 6, 1, 13);
      },
      fruit: (g) => { // ripe golden grain heads
        for (const x of [7, 11, 15]) {
          g.fillStyle(0xcaa63a, 1); g.fillRect(x, 8, 1, 11);
          g.fillStyle(0xe8c94e, 1); g.fillEllipse(x + 0.5, 6, 3, 5);
          g.fillStyle(0xf5e07a, 1); g.fillRect(x, 4, 1, 1);
        }
      },
    },
    carrot: {
      grow: (g) => { // feathery green tops
        g.fillStyle(0x3b8a1c, 1);
        for (const x of [6, 9, 12, 15]) { g.fillRect(x, 8, 1, 11); g.fillRect(x - 1, 8, 1, 5); g.fillRect(x + 1, 9, 1, 4); }
      },
      fruit: (g) => { // orange crown just peeking above the soil
        g.fillStyle(0x3b8a1c, 1);
        for (const x of [6, 9, 12, 15]) { g.fillRect(x, 6, 1, 11); g.fillRect(x - 1, 6, 1, 5); }
        g.fillStyle(0xf07830, 1); g.fillEllipse(11, 17, 8, 4);
        g.fillStyle(0xff9a5a, 1); g.fillEllipse(10, 16, 4, 2);
      },
    },
    // Blueberry (#216) — a small bush; ripe stage shows dark-blue berry clusters
    // dotted among the foliage (regrows after harvest, so this stage repeats).
    blueberry: {
      grow: (g) => leafy(g, 13),
      fruit: (g) => {
        for (const [x, y] of [[6, 14], [15, 13], [10, 17], [13, 17], [8, 12]]) {
          g.fillStyle(0x3c4f9e, 1); g.fillCircle(x, y, 1.6);
          g.fillStyle(0x5f74c9, 1); g.fillRect(x - 1, y - 1, 1, 1);
        }
      },
    },
    // Potato (#216) — leafy tops like the carrot, but the ripe stage shows tubers
    // peeking through cracked soil instead of a crown (one-and-done, dug up whole).
    potato: {
      grow: (g) => { // bushy dark-green leaves
        g.fillStyle(0x2f6a1e, 1);
        for (const x of [6, 10, 14]) { g.fillRect(x, 8, 2, 10); g.fillRect(x - 1, 9, 1, 5); g.fillRect(x + 2, 9, 1, 5); }
      },
      fruit: (g) => { // tubers breaking the soil surface
        g.fillStyle(0x2f6a1e, 1);
        for (const x of [6, 10, 14]) { g.fillRect(x, 6, 2, 10); g.fillRect(x - 1, 7, 1, 5); g.fillRect(x + 2, 7, 1, 5); }
        g.fillStyle(0xa9793f, 1); g.fillEllipse(8, 18, 5, 3); g.fillEllipse(14, 17, 4, 3);
        g.fillStyle(0xc4935a, 1); g.fillEllipse(7, 17, 2, 1);
      },
    },
  };

  for (const [id, art] of Object.entries(CROP_ART)) {
    // Stage 0 — a bare seedling shoot (same for every crop: just a sprout).
    gen(scene, `crop_${id}_0`, 22, 24, (g0) => {
      const g = withLayer(g0); g.layer('soil'); mound(g); g.layer('plant'); sprout(g, 4);
    });
    // Stage 1 — a taller sprout.
    gen(scene, `crop_${id}_1`, 22, 24, (g0) => {
      const g = withLayer(g0); g.layer('soil'); mound(g); g.layer('plant'); sprout(g, 8);
    });
    // Stage 2 — the crop's full foliage, not yet fruiting.
    gen(scene, `crop_${id}_2`, 22, 24, (g0) => {
      const g = withLayer(g0); g.layer('soil'); mound(g); g.layer('plant'); art.grow(g);
    });
    // Stage 3 — ripe: full foliage + the harvestable fruit.
    gen(scene, `crop_${id}_3`, 22, 24, (g0) => {
      const g = withLayer(g0); g.layer('soil'); mound(g); g.layer('plant'); art.grow(g); g.layer('fruit'); art.fruit(g);
    });
  }

  // ── Riding trail scenery (#36) ──────────────────────────────────────────
  // Simple procedural woodland props scattered along the trail extension:
  // a pine-ish tree, a mossy boulder, and a shiny trailside collectible
  // (a "lost" trinket — first-pass, flagged for playtest).
  gen(scene, 'trailTree', 44, 72, (g0) => {
    const g = withLayer(g0);
    g.layer('shadow'); g.fillStyle(0x000000, 0.15); g.fillEllipse(22, 69, 30, 8);
    g.layer('trunk');
    g.fillStyle(0x5a4028, 1); g.fillRect(19, 46, 6, 24);
    g.fillStyle(0x6d4e33, 1); g.fillRect(19, 46, 2, 24);
    g.layer('canopy');
    // three stacked conifer tiers, wide at the bottom, narrow at the top
    g.fillStyle(0x2c5c28, 1); g.fillTriangle(22, 4, 4, 40, 40, 40);
    g.fillStyle(0x35702f, 1); g.fillTriangle(22, 16, 7, 48, 37, 48);
    g.fillStyle(0x3f8137, 1); g.fillTriangle(22, 28, 2, 58, 42, 58);
    g.fillStyle(0x4f9a43, 1); g.fillTriangle(22, 8, 14, 22, 30, 22); // sunlit highlight wedge
  });
  gen(scene, 'trailRock', 34, 22, (g0) => {
    const g = withLayer(g0);
    g.layer('shadow'); g.fillStyle(0x000000, 0.15); g.fillEllipse(17, 20, 26, 6);
    g.layer('rock');
    g.fillStyle(0x7c7d7f, 1); g.fillEllipse(17, 12, 30, 16);
    g.fillStyle(0x919395, 1); g.fillEllipse(12, 8, 14, 9);
    g.fillStyle(0x5f6062, 1); g.fillEllipse(22, 16, 12, 7);
    g.layer('moss');
    g.fillStyle(0x5a8a3e, 0.85); g.fillEllipse(9, 13, 8, 4); g.fillEllipse(24, 9, 6, 3);
  });
  // A small glinting trinket lost along the trail — a first-pass collectible
  // (flagged for playtest, see #36).
  gen(scene, 'trailTrinket', 16, 14, (g0) => {
    const g = withLayer(g0);
    g.layer('shadow'); g.fillStyle(0x000000, 0.18); g.fillEllipse(8, 12, 10, 3);
    g.layer('trinket');
    g.fillStyle(0xd9a72b, 1); g.fillCircle(8, 7, 5);
    g.fillStyle(0xf0cf5a, 1); g.fillCircle(6, 5, 2);
    g.fillStyle(0xfff3c0, 1); g.fillRect(6, 4, 1, 1);
    g.lineStyle(1, 0xa87c1c, 1); g.strokeCircle(8, 7, 5);
  });
}
