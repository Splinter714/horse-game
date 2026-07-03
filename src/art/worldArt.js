// Procedural pixel-art for the environment's fixed structures: grass tiles, house,
// barn, fence, gate, trough, coop, nests/eggs, farm stand, and the NPC customer. All
// generated into textures so the game runs with zero external image files.
//
// `buildWorldTextures` is the single entry point BootScene calls; it builds the
// structures here and delegates the icons (iconArt.js) and props/effects/gather
// sources (propArt.js). Shares the snapshot helper (`gen`) from _frames.js.

import { gen } from './_frames.js';
import { buildIconTextures } from './iconArt.js';
import { buildPropTextures } from './propArt.js';
import { TROUGH_CAP } from '../scenes/paddock/constants.js';

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

  // --- house (the player's home base, #56 builds its interior) ---
  // FIRST-PASS ART, owner-art-directed (#241): a cozy cottage — plaster walls,
  // a warm shingled gable roof, a chimney, a front door, and two shuttered
  // windows. Deliberately reads as a *dwelling* (not a barn) so the barn below
  // can be the clearly-agricultural building. Same 84×66 footprint the old barn
  // used, so world placement/collision are unchanged. Dissect tags (g.layer)
  // per part for the dev dissect tool.
  gen(scene, 'house', 84, 66, (g) => {
    g.layer('roof');
    g.fillStyle(0x6a4a2a, 1); g.fillTriangle(0, 24, 42, 0, 84, 24);   // roof underside/shadow
    g.fillStyle(0x8a5a34, 1); g.fillTriangle(4, 23, 42, 3, 80, 23);   // roof face
    g.fillStyle(0xa9743c, 1);                                          // shingle highlight rows
    g.fillRect(10, 18, 64, 1); g.fillRect(16, 13, 52, 1); g.fillRect(24, 8, 36, 1);
    g.layer('chimney');
    g.fillStyle(0x8a4030, 1); g.fillRect(58, 4, 9, 16);
    g.fillStyle(0x6a2e22, 1); g.fillRect(57, 3, 11, 3);               // chimney cap
    g.layer('wall');
    g.fillStyle(0xe4d2a8, 1); g.fillRect(10, 24, 64, 40);            // plaster wall
    g.fillStyle(0xd0bc90, 1); g.fillRect(10, 24, 64, 3);            // eave shadow
    g.fillStyle(0xc8b284, 1); g.fillRect(10, 60, 64, 4);            // ground shadow
    g.fillStyle(0x9a7a4a, 1); g.fillRect(10, 24, 3, 40); g.fillRect(71, 24, 3, 40); // corner posts
    g.layer('door');
    g.fillStyle(0x6a4324, 1); g.fillRect(36, 42, 14, 22);           // door
    g.fillStyle(0x8a5a30, 1); g.fillRect(38, 44, 10, 20);          // door panel
    g.fillStyle(0x3a2410, 1); g.fillRect(40, 44, 1, 20); g.fillRect(45, 44, 1, 20); // planks
    g.fillStyle(0xf0d060, 1); g.fillCircle(46, 54, 1);             // knob
    g.layer('window');
    for (const wx of [17, 55]) {
      g.fillStyle(0x6a4324, 1); g.fillRect(wx - 1, 33, 14, 12);    // window frame
      g.fillStyle(0xbfe4f0, 1); g.fillRect(wx, 34, 12, 10);        // glass
      g.fillStyle(0x6a4324, 1); g.fillRect(wx + 5, 34, 2, 10); g.fillRect(wx, 38, 12, 2); // muntins
      g.fillStyle(0xa04030, 1); g.fillRect(wx - 3, 33, 2, 12); g.fillRect(wx + 13, 33, 2, 12); // shutters
    }
  });

  // --- house interior (#56) ---
  // FIRST-PASS DRAFT ART, owner-art-directed. A single cozy one-room cottage interior
  // rendered as ONE floor-plan texture the HouseInteriorScene lays down as the room. It
  // carries the three v1 stations — a BED (sleep, #210), a DRESSER + wall MIRROR
  // (opens the character customizer, #211), and a KITCHEN counter/stove (cooking #41 is
  // future — the surface is placed but inert) — plus a rug, a doormat by the south
  // doorway (the way back out), and a warm plank floor. Design grid 160×120 (origin
  // 0,0, top-left); the scene positions furniture hit-zones from the same coordinates
  // (see HOUSE_INTERIOR in scenes/paddock/constants.js). Dissect tags per part.
  const HI_W = 160, HI_H = 120;
  gen(scene, 'houseInterior', HI_W, HI_H, (g) => {
    g.layer('floor');
    g.fillStyle(0xcaa877, 1); g.fillRect(0, 0, HI_W, HI_H);            // warm plank floor
    g.fillStyle(0xbb9967, 1);                                          // plank seams
    for (let y = 8; y < HI_H; y += 10) g.fillRect(0, y, HI_W, 1);
    g.fillStyle(0xd6b985, 1);                                          // lit plank edges
    for (let y = 9; y < HI_H; y += 10) g.fillRect(0, y, HI_W, 1);
    g.layer('walls');
    g.fillStyle(0xe6d7b8, 1); g.fillRect(0, 0, HI_W, 16);             // back (north) wall
    g.fillStyle(0xd6c39a, 1); g.fillRect(0, 14, HI_W, 2);            // wall base moulding
    g.fillStyle(0xd0bc90, 1); g.fillRect(0, 0, 4, HI_H); g.fillRect(HI_W - 4, 0, 4, HI_H); // side walls
    g.layer('rug');
    g.fillStyle(0x9a5a52, 1); g.fillRect(52, 60, 56, 34);            // hearth rug
    g.fillStyle(0xb87a6a, 1); g.fillRect(56, 64, 48, 26);
    g.fillStyle(0x9a5a52, 1); g.fillRect(62, 70, 36, 14);
    g.layer('bed');
    // Bed in the NE corner: frame, mattress, blanket, pillow.
    g.fillStyle(0x6a4a2a, 1); g.fillRect(112, 22, 40, 40);           // bed frame
    g.fillStyle(0xe8e0d0, 1); g.fillRect(114, 24, 36, 36);          // mattress
    g.fillStyle(0x5a86b0, 1); g.fillRect(114, 34, 36, 26);         // blanket
    g.fillStyle(0x6f9ac4, 1); g.fillRect(114, 34, 36, 3);         // blanket fold highlight
    g.fillStyle(0xffffff, 1); g.fillRect(118, 26, 28, 8);         // pillow
    g.fillStyle(0x4a2f18, 1); g.fillRect(112, 22, 40, 2); g.fillRect(112, 60, 40, 2); // frame rails
    g.layer('dresser');
    // Dresser + wall mirror in the NW corner (the customizer station, #211).
    g.fillStyle(0x7a5230, 1); g.fillRect(10, 30, 30, 30);           // dresser body
    g.fillStyle(0x8a6038, 1); g.fillRect(12, 32, 26, 12);         // top drawer
    g.fillStyle(0x8a6038, 1); g.fillRect(12, 46, 26, 12);         // bottom drawer
    g.fillStyle(0x3a2410, 1); g.fillRect(12, 32, 26, 1); g.fillRect(12, 46, 26, 1);
    g.fillStyle(0xf0d060, 1); g.fillCircle(20, 38, 1); g.fillCircle(30, 38, 1); // knobs
    g.fillStyle(0xf0d060, 1); g.fillCircle(20, 52, 1); g.fillCircle(30, 52, 1);
    g.layer('mirror');
    g.fillStyle(0x6a4a2a, 1); g.fillRect(16, 17, 18, 12);          // mirror frame
    g.fillStyle(0xbfe4f0, 1); g.fillRect(18, 18, 14, 10);        // mirror glass
    g.fillStyle(0xe8f6fb, 1); g.fillRect(19, 19, 4, 8);         // glass sheen
    g.layer('kitchen');
    // Kitchen counter + stove along the back wall, centre (cooking #41 lives here).
    g.fillStyle(0x8a5a34, 1); g.fillRect(56, 18, 48, 20);         // counter body
    g.fillStyle(0xc9b48a, 1); g.fillRect(56, 18, 48, 5);        // countertop
    g.fillStyle(0x5a3f24, 1); g.fillRect(56, 27, 48, 1);       // cabinet line
    g.fillStyle(0x3a2a1a, 1); g.fillRect(78, 28, 12, 10);      // oven door
    g.fillStyle(0x6a5030, 1); g.fillRect(80, 30, 8, 2);       // oven handle
    g.fillStyle(0x4a4a52, 1); g.fillCircle(64, 22, 2); g.fillCircle(72, 22, 2); // stove burners
    g.fillStyle(0x9a8a5a, 1); g.fillRect(92, 12, 8, 6);       // hanging pot/pan
    g.layer('doormat');
    g.fillStyle(0x8a6a44, 1); g.fillRect(66, HI_H - 10, 28, 8);  // doormat (south exit)
    g.fillStyle(0x9a7a52, 1); g.fillRect(68, HI_H - 9, 24, 2);
    g.fillStyle(0x6a4a2a, 1); g.fillRect(64, HI_H - 3, 32, 3);   // threshold board
  });

  // --- barn interior + cutaway (#35) ---
  // FIRST-PASS DRAFT ART, owner-art-directed. The barn is now a walk-in building
  // rendered as two stacked textures so it can do an in-world CUTAWAY: when the
  // player steps inside, the front-wall/roof façade (`barnFront`) fades out to
  // reveal the interior (`barnInterior`) drawn beneath it. See scenes/paddock/barn.js.
  //
  // Footprint is 160×132 design px (origin 0.5,1 at the SOUTH doorway). At scale
  // S=2 that's 320×264 world px — real walkable interior depth, per #35's note that
  // the old #241 placeholder was too small to walk into. Dissect tags per part.
  const BARN_W = 160, BARN_H = 132;

  // INTERIOR — floor, back/side inner walls, a row of 4 stalls along the back, and a
  // tack room in the left bay. Drawn UNDER animals/player (low depth) so anything
  // standing inside occludes it correctly. The south edge (y≈H) is the open doorway.
  gen(scene, 'barnInterior', BARN_W, BARN_H, (g) => {
    g.layer('floor');
    g.fillStyle(0x6a5236, 1); g.fillRect(8, 18, 144, 110);           // packed-dirt floor
    g.fillStyle(0x5e492f, 1);                                        // plank/board seams
    for (let y = 30; y < 128; y += 12) g.fillRect(10, y, 140, 1);
    g.fillStyle(0x775c3c, 1);                                        // straw scatter (light)
    for (const [sx, sy] of [[40, 100], [96, 112], [130, 96], [60, 120]]) g.fillRect(sx, sy, 6, 1);
    g.layer('backwall');
    g.fillStyle(0x8a3020, 1); g.fillRect(8, 18, 144, 16);            // inner back wall (shaded red)
    g.fillStyle(0x7a2a1c, 1); g.fillRect(8, 18, 144, 3);            // wall-top shadow line
    g.layer('stalls');
    // Four stalls across the back: low dividers + a hay-mound + a nameboard each.
    for (let i = 0; i < 4; i++) {
      const x = 40 + i * 30;
      g.fillStyle(0x6a4420, 1); g.fillRect(x, 30, 3, 30);           // stall divider post
      g.fillStyle(0x8a5a2e, 1); g.fillRect(x, 44, 3, 3);           // divider rail cap
    }
    // Stall goodies drawn in a second pass so their colours don't fight the divider loop.
    for (let i = 0; i < 4; i++) {
      const cx = 40 + i * 30 + 15;
      g.fillStyle(0xd8b060, 1); g.fillRect(cx - 8, 52, 16, 6);      // hay mound
      g.fillStyle(0xe8c878, 1); g.fillRect(cx - 8, 52, 16, 2);
      g.fillStyle(0xead9b0, 1); g.fillRect(cx - 7, 36, 14, 6);      // nameboard
      g.fillStyle(0x6a4420, 1); g.fillRect(cx - 7, 36, 14, 1);
    }
    g.layer('tack');
    // Tack room / corner: a wall-mounted rack with a saddle, bridle and brush.
    g.fillStyle(0x5a3f24, 1); g.fillRect(10, 66, 26, 3);            // shelf
    g.fillStyle(0x7a5a34, 1); g.fillRect(13, 58, 10, 8);           // saddle body
    g.fillStyle(0x5a3f24, 1); g.fillRect(13, 64, 10, 2);          // saddle skirt
    g.fillStyle(0x2a1c10, 1); g.fillRect(27, 58, 2, 10);          // bridle strap
    g.fillStyle(0x2a1c10, 1); g.fillCircle(28, 66, 3);           // bridle loop
    g.fillStyle(0x8a5a2e, 1); g.fillRect(31, 60, 4, 6);          // brush block
    g.fillStyle(0x3a2410, 1); g.fillRect(31, 65, 4, 2);         // brush bristles
  });

  // FRONT FAÇADE — the front wall, big doorway, gambrel roof, cupola & hayloft. This
  // is drawn OVER the interior + occupants (high depth) and is what fades out for the
  // cutaway. Kept visually consistent with the old #241 barn so it still reads as a barn.
  gen(scene, 'barnFront', BARN_W, BARN_H, (g) => {
    g.layer('roof');
    // Gambrel (barn) roof spanning the wide front.
    g.fillStyle(0x7a2a1c, 1); g.fillTriangle(4, 34, 80, 4, 156, 34);   // underside/shadow
    g.fillStyle(0x9a3826, 1);
    g.fillPoints([{ x: 8, y: 34 }, { x: 34, y: 18 }, { x: 126, y: 18 }, { x: 152, y: 34 }]); // lower slopes
    g.fillStyle(0xb6432e, 1);
    g.fillPoints([{ x: 34, y: 18 }, { x: 80, y: 4 }, { x: 126, y: 18 }]); // upper cap
    g.fillStyle(0xc8543c, 1); g.fillRect(8, 33, 144, 2);                // eave highlight
    g.layer('cupola');
    g.fillStyle(0x9a3826, 1); g.fillRect(74, 0, 12, 8);
    g.fillStyle(0x5a2418, 1); g.fillTriangle(71, 2, 80, -4, 89, 2);
    g.fillStyle(0xf0d890, 1); g.fillRect(77, 3, 6, 4);
    g.layer('wall');
    g.fillStyle(0xb6432e, 1); g.fillRect(8, 34, 144, 34);              // front wall band
    g.fillStyle(0xc8543c, 1); g.fillRect(8, 34, 144, 5);             // top-lit band
    g.fillStyle(0x7a2a1c, 1); g.fillRect(8, 34, 3, 34); g.fillRect(149, 34, 3, 34); // corner posts
    g.layer('loft');
    g.fillStyle(0x5a2418, 1); g.fillRect(72, 22, 16, 12);            // hayloft door
    g.fillStyle(0xd8b060, 1); g.fillRect(75, 24, 10, 8);           // straw glow
    g.fillStyle(0x3a1810, 1); g.fillRect(79, 15, 2, 8); g.fillCircle(80, 15, 2); // pulley
    g.layer('doorway');
    // A big open central doorway (the dark interior shows through). Framed jambs +
    // a header, with the two doors swung open flat against the wall to either side.
    g.fillStyle(0x2a1c10, 1); g.fillRect(60, 40, 40, 92);           // dark doorway opening
    g.fillStyle(0x6a4420, 1); g.fillRect(56, 38, 4, 94); g.fillRect(100, 38, 4, 94); // jambs
    g.fillStyle(0x6a4420, 1); g.fillRect(56, 38, 48, 4);           // header
    g.fillStyle(0x8a5a2e, 1);                                       // open doors flat on the wall
    g.fillRect(40, 40, 16, 28); g.fillRect(104, 40, 16, 28);
    g.fillStyle(0xe8dcc0, 1);                                       // white braces on the doors
    g.fillTriangle(41, 41, 55, 67, 56, 67); g.fillTriangle(105, 41, 119, 67, 120, 67);
    g.layer('window');
    for (const wx of [22, 124]) {
      g.fillStyle(0xf0d890, 1); g.fillRect(wx, 44, 12, 12);
      g.fillStyle(0x7a2a1c, 1); g.fillRect(wx + 5, 44, 2, 12); g.fillRect(wx, 49, 12, 2);
    }
  });

  // --- fence segment (tileable horizontally, 48 wide) ---
  gen(scene, 'fence', 48, 24, (g) => {
    g.fillStyle(0xc8924c, 1); g.fillRect(0, 6, 48, 3);
    g.fillStyle(0xbc8442, 1); g.fillRect(0, 14, 48, 3);
    g.fillStyle(0xa8743a, 1); g.fillRect(2, 2, 4, 20);
    g.fillStyle(0xc8924c, 1); g.fillRect(2, 2, 2, 20);
  });

  // --- gate closed (blocks passage) ---
  // Slimmed to match the fence's vertical thickness (#117): a thin two-rail gate
  // rather than a chunky 48px slab you appear to stand *on* when nudged south.
  gen(scene, 'gateClosed', 56, 24, (g) => {
    // Posts on left and right
    g.fillStyle(0x8a5828, 1); g.fillRect(0, 0, 4, 24); g.fillRect(52, 0, 4, 24);
    // Horizontal cross-beams (two rails, echoing the fence)
    g.fillStyle(0xa8743a, 1); g.fillRect(0, 5, 56, 2);
    g.fillStyle(0xc8924c, 1); g.fillRect(0, 8, 56, 2);
    g.fillStyle(0xa8743a, 1); g.fillRect(0, 15, 56, 2);
    g.fillStyle(0xc8924c, 1); g.fillRect(0, 18, 56, 2);
    // Vertical slats
    g.fillStyle(0xa8743a, 1);
    for (let x = 8; x < 52; x += 6) g.fillRect(x, 3, 3, 18);
    g.fillStyle(0xc8924c, 1);
    for (let x = 10; x < 52; x += 6) g.fillRect(x, 5, 1, 14);
    // Gate latch pin
    g.fillStyle(0x6a5030, 1); g.fillCircle(28, 12, 2);
  });

  // --- gate open (swung to the right side) ---
  gen(scene, 'gateOpen', 56, 24, (g) => {
    // Left post only (right post would have the swung gate against it)
    g.fillStyle(0x8a5828, 1); g.fillRect(0, 0, 4, 24);
    // Right post open
    g.fillStyle(0x8a5828, 1); g.fillRect(52, 0, 4, 24);
    // Open passage marked with lighter ground
    g.fillStyle(0x9ad060, 0.5); g.fillRect(4, 9, 48, 6);
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
  // Filled levels (#109): one texture per discrete water level (trough1..troughN)
  // so the rendered height maps 1:1 to the actual level — no more collapsing many
  // distinct levels into a few "looks full" buckets (#103 had only low/half/full,
  // which let, say, 7/9 and 9/9 look identical). The interior runs y=8..18 (10
  // rows); water rises from the bottom, and only the top level fills it completely.
  for (let lvl = 1; lvl <= TROUGH_CAP; lvl++) {
    gen(scene, `trough${lvl}`, 100, 26, (g) => {
      g.fillStyle(0x8a5a2e, 1); g.fillRect(0, 6, 100, 20);   // wood body
      g.fillStyle(0xa06c38, 1); g.fillRect(0, 2, 100, 5);    // top rim
      g.fillStyle(0x3a2410, 1); g.fillRect(4, 8, 92, 10);    // dry dark interior
      const rows = Math.round((lvl * 10) / TROUGH_CAP);      // 1..10 — distinct per level
      const top  = 18 - rows;
      g.fillStyle(0x5fa6d6, 1); g.fillRect(4, top, 92, rows);              // water body
      g.fillStyle(0x9ae0f8, 1); g.fillRect(4, top, 92, Math.min(2, rows)); // surface highlight
      if (rows >= 3) {                                        // sparkle dashes once it has depth
        g.fillStyle(0x7cc8e8, 0.7);
        g.fillRect(10, top + 1, 9, 1); g.fillRect(40, top + 1, 11, 1); g.fillRect(66, top + 1, 8, 1);
      }
      g.fillStyle(0x6a3c18, 1); g.fillRect(47, 4, 4, 22); g.fillRect(49, 2, 2, 4); // post dividers
    });
  }

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

  // --- doghouse (48 × 42) — decorative yard prop (#237) ---
  // A classic peaked-roof kennel: a wooden gable house with a round arched
  // doorway, a little name-board over the door, a food bowl beside it, and a
  // gnawed bone on the grass — all to read as "a dog lives here." Decorative
  // only; the dog actually using it is deferred to #186. Dissect tags (g.layer)
  // per logical part for the dev dissect tool.
  gen(scene, 'doghouse', 48, 42, (g) => {
    const wall = 0xc08a4e, wallDark = 0x9a6a34, plank = 0x84592a;
    const roofDark = 0x6a3a1c, roofMid = 0x9a5024, roofHi = 0xc07a40;
    const dark = 0x241408, board = 0x6e4326, bowl = 0xc94a3a, bowlDark = 0x9a3428;
    const bone = 0xeadfc4, food = 0x8a5a2e;

    // Body box (the kennel walls)
    g.layer('body');
    g.fillStyle(wall, 1);     g.fillRect(8, 18, 30, 22);
    g.fillStyle(wallDark, 1); g.fillRect(8, 18, 30, 3);   // eave shadow
    g.fillStyle(wallDark, 1); g.fillRect(8, 36, 30, 4);   // ground shadow
    g.fillStyle(plank, 1);                                // vertical plank seams
    for (let x = 13; x < 38; x += 5) g.fillRect(x, 21, 1, 15);
    g.fillStyle(plank, 1); g.fillRect(8, 18, 2, 22); g.fillRect(36, 18, 2, 22);

    // Arched doorway (rounded top)
    g.layer('door');
    g.fillStyle(board, 1); g.fillRect(16, 24, 14, 16);    // frame
    g.fillStyle(dark, 1);
    g.fillRect(18, 27, 10, 13);                           // opening body
    g.fillTriangle(18, 27, 23, 22, 28, 27);               // arched top
    g.fillStyle(dark, 1); g.fillCircle(23, 27, 5);        // round out the arch

    // Name-board over the door
    g.layer('sign');
    g.fillStyle(board, 1);   g.fillRect(17, 19, 12, 4);
    g.fillStyle(0xe8c34a, 1); g.fillRect(19, 20, 8, 1);   // little brass plate

    // Gable roof
    g.layer('roof');
    g.fillStyle(roofDark, 1); g.fillTriangle(3, 20, 23, 4, 43, 20);
    g.fillStyle(roofMid, 1);  g.fillTriangle(6, 20, 23, 7, 40, 20);
    g.fillStyle(roofHi, 1);                               // left-slope highlight streaks
    g.fillRect(11, 15, 2, 3); g.fillRect(15, 12, 2, 3); g.fillRect(19, 9, 2, 3);
    g.fillStyle(board, 1); g.fillRect(3, 19, 40, 2);      // eave board
    g.fillStyle(roofDark, 1); g.fillRect(22, 4, 2, 4);    // ridge cap

    // Food bowl beside the door
    g.layer('bowl');
    g.fillStyle(bowlDark, 1); g.fillEllipse(41, 38, 12, 6);
    g.fillStyle(bowl, 1);     g.fillEllipse(41, 37, 11, 5);
    g.fillStyle(food, 1);     g.fillEllipse(41, 36, 7, 3);

    // Gnawed bone on the grass
    g.layer('bone');
    g.fillStyle(bone, 1);
    g.fillRect(3, 37, 8, 2);
    g.fillCircle(3, 37, 1); g.fillCircle(3, 39, 1);
    g.fillCircle(11, 37, 1); g.fillCircle(11, 39, 1);
  });

  // --- bird bath (34 × 40) — decorative garden bird bath (#219) ---
  // A classic pedestal bird bath: a fluted stone column on a wide foot, topped by
  // a shallow round basin of water. Purely decorative + ambient — birds fly in to
  // splash/drink (paddock/wildlife.js), no refilling/upkeep. Origin (0.5,1) at the
  // foot so it depth-sorts on its base like the other pedestal props. Dissect tags
  // (g.layer) per logical part for the dev dissect tool.
  gen(scene, 'birdBath', 34, 40, (g) => {
    const stone = 0xb8b2a6, stoneHi = 0xd6d0c4, stoneLo = 0x8f897d, moss = 0x7a8a52;
    const rim = 0xa8a294, water = 0x5aa6d6, waterHi = 0x9ad2f0, waterLo = 0x3f83b8;

    // Wide base foot
    g.layer('base');
    g.fillStyle(stoneLo, 1); g.fillEllipse(17, 38, 22, 7);   // ground shadow ring
    g.fillStyle(stone, 1);   g.fillEllipse(17, 36, 20, 6);
    g.fillStyle(stoneHi, 1); g.fillEllipse(17, 35, 16, 3);
    g.fillStyle(moss, 0.7);  g.fillRect(7, 36, 2, 1); g.fillRect(25, 35, 2, 1); // moss flecks

    // Fluted pedestal column
    g.layer('column');
    g.fillStyle(stone, 1);   g.fillRect(12, 16, 10, 20);
    g.fillStyle(stoneHi, 1); g.fillRect(12, 16, 2, 20);      // lit left edge
    g.fillStyle(stoneLo, 1); g.fillRect(20, 16, 2, 20);      // shaded right edge
    g.fillStyle(stoneLo, 1);                                  // flute seams
    g.fillRect(15, 18, 1, 16); g.fillRect(18, 18, 1, 16);
    g.fillStyle(moss, 0.6);  g.fillRect(13, 30, 2, 2);       // a little moss on the shaft

    // Basin bowl (wide shallow dish on top)
    g.layer('basin');
    g.fillStyle(stoneLo, 1); g.fillEllipse(17, 16, 32, 12);  // underside rim shadow
    g.fillStyle(stone, 1);   g.fillEllipse(17, 14, 32, 12);  // outer bowl
    g.fillStyle(rim, 1);     g.fillEllipse(17, 13, 30, 11);  // rim lip
    g.fillStyle(stoneHi, 1); g.fillEllipse(17, 12, 30, 9);   // lit inner rim

    // Water surface in the basin
    g.layer('water');
    g.fillStyle(waterLo, 1); g.fillEllipse(17, 13, 24, 8);
    g.fillStyle(water, 1);   g.fillEllipse(17, 12, 24, 7);
    g.fillStyle(waterHi, 0.85);
    g.fillEllipse(12, 11, 6, 2);                             // sun glint
    g.fillRect(20, 13, 5, 1); g.fillRect(15, 14, 4, 1);      // little ripple lines
    g.layer('rim');
    g.fillStyle(stoneHi, 1); g.fillEllipse(17, 10, 30, 3);   // front rim highlight
  });

  // --- seed bird feeder (28 × 56) — refillable songbird feeder on a post (#240) ---
  // A wooden hopper feeder atop a slim post: a peaked-roof seed box with a glass-front
  // hopper and a little landing tray. Two variants — stocked (`seedFeeder`, seed
  // showing in the tray + hopper) and empty (`seedFeederEmpty`, bare tray) — swapped by
  // birdEcosystem.js as the seed level crosses zero (like the trough/pet bowls). Origin
  // (0.5,1) at the foot of the post so it depth-sorts on its base. Dissect-tagged.
  const drawSeedFeeder = (g, stocked) => {
    const post = 0x8a5a2e, postHi = 0xa9743c, postLo = 0x6a4420;
    const wood = 0xc08a4e, woodHi = 0xd8a662, woodLo = 0x9a6a34;
    const roofD = 0x6a3a1c, roofM = 0x9a5024, roofH = 0xc07a40;
    const glass = 0xbfe0ea, tray = 0x8a5a2e, trayHi = 0xa9743c;
    const seed = 0xe0b840, seedLo = 0xbe9628, seedHi = 0xf2d868;

    // Post
    g.layer('post');
    g.fillStyle(post, 1);   g.fillRect(12, 30, 4, 26);
    g.fillStyle(postHi, 1); g.fillRect(12, 30, 1, 26);
    g.fillStyle(postLo, 1); g.fillRect(15, 30, 1, 26);
    g.fillStyle(postLo, 1); g.fillEllipse(14, 55, 8, 3); // ground shadow

    // Landing tray (with a low lip)
    g.layer('tray');
    g.fillStyle(woodLo, 1); g.fillRect(5, 30, 18, 4);
    g.fillStyle(tray, 1);   g.fillRect(6, 28, 16, 3);
    g.fillStyle(trayHi, 1); g.fillRect(6, 28, 16, 1);
    g.fillStyle(woodLo, 1); g.fillRect(5, 29, 1, 4); g.fillRect(22, 29, 1, 4); // lip ends

    // Seed heaped in the tray (stocked only)
    if (stocked) {
      g.layer('seed');
      g.fillStyle(seedLo, 1); g.fillEllipse(14, 28, 14, 3);
      g.fillStyle(seed, 1);   g.fillEllipse(14, 27, 12, 3);
      g.fillStyle(seedHi, 1); g.fillRect(9, 26, 2, 1); g.fillRect(16, 26, 2, 1); g.fillRect(13, 25, 2, 1);
    }

    // Hopper box (glass-fronted)
    g.layer('hopper');
    g.fillStyle(wood, 1);   g.fillRect(8, 14, 12, 14);
    g.fillStyle(woodHi, 1); g.fillRect(8, 14, 12, 2);
    g.fillStyle(woodLo, 1); g.fillRect(8, 26, 12, 2);
    g.fillStyle(wood, 1);   g.fillRect(8, 14, 2, 14); g.fillRect(18, 14, 2, 14); // side posts
    g.fillStyle(glass, 0.85); g.fillRect(10, 16, 8, 10);   // glass front
    if (stocked) { // seed visible through the glass, settling to the bottom
      g.fillStyle(seed, 1);   g.fillRect(10, 21, 8, 5);
      g.fillStyle(seedHi, 1); g.fillRect(10, 21, 8, 1);
      g.fillStyle(seedLo, 1); g.fillRect(11, 24, 2, 1); g.fillRect(15, 24, 2, 1);
    }
    g.fillStyle(0xffffff, 0.4); g.fillRect(11, 17, 1, 7); // glass glint

    // Peaked roof
    g.layer('roof');
    g.fillStyle(roofD, 1); g.fillTriangle(4, 15, 14, 5, 24, 15);
    g.fillStyle(roofM, 1); g.fillTriangle(6, 15, 14, 7, 22, 15);
    g.fillStyle(roofH, 1); g.fillRect(9, 11, 2, 2); g.fillRect(12, 9, 2, 2); // highlight streaks
    g.fillStyle(woodLo, 1); g.fillRect(4, 14, 20, 2);      // eave board
    g.fillStyle(roofD, 1);  g.fillRect(13, 5, 2, 3);       // ridge cap
    // Little hang-loop finial
    g.fillStyle(postLo, 1); g.fillRect(13, 2, 2, 4);
  };
  gen(scene, 'seedFeeder',      28, 56, (g) => drawSeedFeeder(g, true));
  gen(scene, 'seedFeederEmpty', 28, 56, (g) => drawSeedFeeder(g, false));

  // --- hummingbird nectar feeder (24 × 52) — refillable sugar-water feeder (#226) ---
  // A hanging nectar feeder: an inverted glass reservoir of rosy sugar water with a
  // little red flower-shaped feeding base and yellow bee-guard ports. Two variants —
  // stocked (`nectarFeeder`, nectar showing) and empty (`nectarFeederEmpty`, clear
  // reservoir) — swapped by birdEcosystem.js as the nectar level crosses zero.
  // Hummingbirds hover at the ports to drink. Origin (0.5,1) at the foot of the post.
  const drawNectarFeeder = (g, stocked) => {
    const post = 0x8a5a2e, postHi = 0xa9743c, postLo = 0x6a4420;
    const glass = 0xcfe6ee, glassHi = 0xffffff;
    const nectar = 0xe85a7a, nectarHi = 0xf7a6bd, nectarLo = 0xc23a5c;
    const baseRed = 0xd83a3a, baseDark = 0xa82828, port = 0xf2d24a, portDark = 0xc89a1a;

    // Post + hang loop
    g.layer('post');
    g.fillStyle(post, 1);   g.fillRect(11, 2, 2, 12);
    g.fillStyle(postHi, 1); g.fillRect(11, 2, 1, 12);
    g.fillStyle(postLo, 1); g.fillEllipse(12, 51, 6, 2); // ground shadow
    g.fillStyle(postLo, 1); g.fillRect(10, 2, 4, 2);     // loop bar

    // Reservoir (inverted rounded bottle)
    g.layer('reservoir');
    g.fillStyle(glass, 0.9); g.fillEllipse(12, 24, 16, 26);
    g.fillStyle(glass, 0.9); g.fillRect(4, 14, 16, 12);
    if (stocked) { // rosy nectar settling in the bottom of the reservoir
      g.layer('nectar');
      g.fillStyle(nectarLo, 1); g.fillEllipse(12, 28, 13, 16);
      g.fillStyle(nectar, 1);   g.fillEllipse(12, 30, 12, 12);
      g.fillStyle(nectarHi, 0.8); g.fillEllipse(8, 27, 4, 6);
    }
    g.layer('glassHi');
    g.fillStyle(glassHi, 0.5); g.fillRect(7, 16, 2, 14); // vertical glass glint
    g.fillStyle(glassHi, 0.35); g.fillEllipse(12, 14, 14, 4); // top curve sheen

    // Red flower feeding base
    g.layer('base');
    g.fillStyle(baseDark, 1); g.fillEllipse(12, 40, 20, 8);
    g.fillStyle(baseRed, 1);  g.fillEllipse(12, 39, 18, 7);
    // petal lobes around the rim
    g.fillStyle(baseRed, 1);
    g.fillCircle(3, 39, 3); g.fillCircle(21, 39, 3); g.fillCircle(7, 42, 2); g.fillCircle(17, 42, 2);
    g.fillStyle(baseDark, 1); g.fillEllipse(12, 41, 14, 4); // underside shade

    // Yellow bee-guard feeding ports
    g.layer('ports');
    g.fillStyle(portDark, 1); g.fillCircle(6, 40, 2); g.fillCircle(18, 40, 2); g.fillCircle(12, 42, 2);
    g.fillStyle(port, 1);     g.fillCircle(6, 39, 1.4); g.fillCircle(18, 39, 1.4); g.fillCircle(12, 41, 1.4);

    // Little bottom drip tip
    g.layer('tip');
    g.fillStyle(baseDark, 1); g.fillTriangle(10, 43, 14, 43, 12, 47);
  };
  gen(scene, 'nectarFeeder',      24, 52, (g) => drawNectarFeeder(g, true));
  gen(scene, 'nectarFeederEmpty', 24, 52, (g) => drawNectarFeeder(g, false));

  // --- nectar station (22 × 26) — sugar-water jug the player fills a bucket at (#226) ---
  // A stout glass jug of rosy nectar with a cork and a little spout, on a wooden stand
  // by the house. A gathering SOURCE (like the kibble sack): fill a bucket here, then
  // pour it into the hummingbird feeder. Origin (0.5,1) at the base.
  gen(scene, 'nectarStation', 22, 26, (g) => {
    const wood = 0x9a6a34, woodHi = 0xb98a4c;
    const glass = 0xcfe6ee, glassHi = 0xffffff;
    const nectar = 0xe85a7a, nectarHi = 0xf7a6bd, nectarLo = 0xc23a5c;
    const cork = 0xb98a4c, corkDark = 0x8a5f2c;

    // Wooden stand
    g.layer('stand');
    g.fillStyle(wood, 1);   g.fillRect(2, 23, 18, 3);
    g.fillStyle(woodHi, 1); g.fillRect(2, 23, 18, 1);

    // Jug body (rounded)
    g.layer('jug');
    g.fillStyle(glass, 0.92); g.fillEllipse(11, 15, 18, 18);
    g.fillStyle(glass, 0.92); g.fillRect(4, 9, 14, 6);
    // nectar fill
    g.fillStyle(nectarLo, 1); g.fillEllipse(11, 17, 15, 13);
    g.fillStyle(nectar, 1);   g.fillEllipse(11, 18, 14, 11);
    g.fillStyle(nectarHi, 0.8); g.fillEllipse(7, 15, 4, 6);
    g.fillStyle(glassHi, 0.5); g.fillRect(6, 9, 2, 10); // glint

    // Neck + cork
    g.layer('cork');
    g.fillStyle(glass, 0.92); g.fillRect(8, 4, 6, 5);
    g.fillStyle(cork, 1);     g.fillRect(8, 2, 6, 3);
    g.fillStyle(corkDark, 1); g.fillRect(8, 4, 6, 1);

    // Little pour spout on the side
    g.layer('spout');
    g.fillStyle(glass, 0.92); g.fillTriangle(18, 12, 21, 13, 18, 15);
  });

  // --- beehive (30 × 44) — stacked-box hive, fixed world object (#239) ---
  // A classic langstroth-style beehive: two stacked wooden supers on a base board with
  // a peaked lid, a landing board + entrance slot, and (when ripe) golden honey glowing
  // in the seams. Two variants — `beehive` (working) and `beehiveReady` (honey ripe,
  // ready to harvest: warm honey glow in the box seams + a drip at the entrance).
  // Placed like the birdhouse (fixed spot). Origin (0.5,1) at the base. Dissect-tagged.
  const drawBeehive = (g, ripe) => {
    const box = 0xd8a24a, boxHi = 0xecc06a, boxLo = 0xb07e2e, seam = 0x9a6a24;
    const lid = 0xb07e2e, lidHi = 0xcf9a44, lidDark = 0x7f5a1e;
    const board = 0x9a6a34, dark = 0x2a1c08, glow = 0xf6c94e, honey = 0xe8a828;

    // Base board / stand
    g.layer('base');
    g.fillStyle(boxLo, 1); g.fillEllipse(15, 43, 30, 5); // ground shadow
    g.fillStyle(board, 1); g.fillRect(3, 38, 24, 4);
    g.fillStyle(0xb98a4c, 1); g.fillRect(3, 38, 24, 1);
    // landing board sticking out the front
    g.fillStyle(board, 1); g.fillRect(6, 36, 18, 2);

    // Lower super (box)
    g.layer('super_lower');
    g.fillStyle(box, 1);   g.fillRect(5, 26, 20, 12);
    g.fillStyle(boxHi, 1); g.fillRect(5, 26, 20, 2);
    g.fillStyle(boxLo, 1); g.fillRect(5, 36, 20, 2);
    g.fillStyle(seam, 1);  g.fillRect(5, 31, 20, 1); // frame seam
    // entrance slot + landing
    g.fillStyle(dark, 1);  g.fillRect(11, 35, 8, 2);

    // Upper super (box)
    g.layer('super_upper');
    g.fillStyle(box, 1);   g.fillRect(6, 14, 18, 12);
    g.fillStyle(boxHi, 1); g.fillRect(6, 14, 18, 2);
    g.fillStyle(boxLo, 1); g.fillRect(6, 24, 18, 2);
    g.fillStyle(seam, 1);  g.fillRect(6, 19, 18, 1);

    // Honey glow in the seams when ripe
    if (ripe) {
      g.layer('honey');
      g.fillStyle(glow, 0.9); g.fillRect(6, 19, 18, 1); g.fillRect(5, 31, 20, 1);
      g.fillStyle(glow, 0.55); g.fillRect(6, 18, 18, 3); g.fillRect(5, 30, 20, 3);
      // a honey drip at the entrance
      g.fillStyle(honey, 1); g.fillRect(14, 37, 2, 3); g.fillCircle(15, 40, 1.4);
      g.fillStyle(glow, 1);  g.fillRect(14, 37, 1, 2);
    }

    // Peaked telescoping lid
    g.layer('lid');
    g.fillStyle(lidDark, 1); g.fillRect(4, 12, 22, 3);
    g.fillStyle(lid, 1);     g.fillTriangle(3, 12, 15, 4, 27, 12);
    g.fillStyle(lidHi, 1);   g.fillTriangle(6, 12, 15, 6, 12, 12); // lit left slope
    g.fillStyle(lidDark, 1); g.fillRect(14, 4, 2, 3);              // ridge cap
  };
  gen(scene, 'beehive',      30, 44, (g) => drawBeehive(g, false));
  gen(scene, 'beehiveReady', 30, 44, (g) => drawBeehive(g, true));

  // --- birdhouse (26 × 58) — post-mounted decorative nesting box (#218) ---
  // A classic little birdhouse: a peaked-roof box with a round entrance hole and a
  // perch dowel, mounted atop a slim post. Purely decorative + ambient — no naming/
  // relationship mechanic (that's #223's job) — it just makes ambient songbirds
  // (paddock/birdEcosystemVisits.js) perch on the roof/entrance more often when it's
  // around, mirroring the bird bath (#219) and seed feeder (#240). Origin (0.5,1) at
  // the foot of the post so it depth-sorts on its base. Dissect-tagged.
  gen(scene, 'birdhouse', 26, 58, (g) => {
    const post = 0x8a5a2e, postHi = 0xa9743c, postLo = 0x6a4420;
    const wood = 0xc79456, woodHi = 0xe0b06e, woodLo = 0x9c7038;
    const roofD = 0x7a3f22, roofM = 0xa8582c, roofH = 0xcf7f48;
    const hole = 0x2a1c10, perch = 0x6a4420;

    // Post
    g.layer('post');
    g.fillStyle(postLo, 1); g.fillEllipse(13, 56, 8, 3); // ground shadow
    g.fillStyle(post, 1);   g.fillRect(11, 30, 4, 26);
    g.fillStyle(postHi, 1); g.fillRect(11, 30, 1, 26);
    g.fillStyle(postLo, 1); g.fillRect(14, 30, 1, 26);

    // House box
    g.layer('box');
    g.fillStyle(wood, 1);   g.fillRect(4, 16, 18, 16);
    g.fillStyle(woodHi, 1); g.fillRect(4, 16, 2, 16);   // lit left edge
    g.fillStyle(woodLo, 1); g.fillRect(20, 16, 2, 16);  // shaded right edge
    g.fillStyle(woodLo, 1); g.fillRect(4, 30, 18, 2);   // base trim shadow

    // Entrance hole
    g.layer('hole');
    g.fillStyle(hole, 1); g.fillCircle(13, 23, 3.4);

    // Perch dowel below the hole
    g.layer('perch');
    g.fillStyle(perch, 1); g.fillRect(11, 27, 6, 2);

    // Peaked roof
    g.layer('roof');
    g.fillStyle(roofD, 1); g.fillTriangle(1, 17, 13, 6, 25, 17);
    g.fillStyle(roofM, 1); g.fillTriangle(3, 17, 13, 8, 23, 17);
    g.fillStyle(roofH, 1); g.fillRect(6, 13, 3, 2); g.fillRect(10, 10, 3, 2); // highlight streaks
    g.fillStyle(woodLo, 1); g.fillRect(1, 16, 24, 2); // eave board
    g.fillStyle(roofD, 1);  g.fillRect(12, 6, 2, 3);  // ridge cap
  });

  // --- nest (18 × 12) — woven straw ring ---
  gen(scene, 'nest', 18, 12, (g) => {
    // Outer straw ring
    g.fillStyle(0xb87828, 1); g.fillEllipse(9, 8, 18, 10);
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

  // --- egg (collectible on ground / on the stand counter, 6 × 8) ---
  gen(scene, 'egg', 6, 8, (g) => {
    g.fillStyle(0xfff8e0, 1); g.fillEllipse(3, 4, 6, 8);
    g.fillStyle(0xfffdf5, 1); g.fillEllipse(2, 3, 2, 3);
  });

  // --- brown egg variant (#276) — laid by brown & gold hens ---
  gen(scene, 'eggBrown', 6, 8, (g) => {
    g.fillStyle(0xc48a4c, 1); g.fillEllipse(3, 4, 6, 8);          // warm brown shell
    g.fillStyle(0xdca868, 1); g.fillEllipse(2, 3, 2, 3);          // highlight
  });

  // --- nest with a brown egg (#276) ---
  gen(scene, 'nestEggBrown', 18, 12, (g) => {
    g.fillStyle(0xb87828, 1); g.fillEllipse(9, 8, 18, 10);
    g.fillStyle(0xd4a030, 1); g.fillEllipse(9, 7, 16, 8);
    g.fillStyle(0xc49028, 1); g.fillEllipse(9, 8, 12, 6);
    g.fillStyle(0x6a3c10, 1); g.fillEllipse(9, 8, 8, 5);
    g.fillStyle(0xe8b840, 1);
    g.fillRect(3, 6, 3, 1); g.fillRect(12, 6, 3, 1);
    g.fillRect(5, 4, 2, 1); g.fillRect(11, 4, 2, 1);
    // Brown egg sitting in nest
    g.fillStyle(0xc48a4c, 1); g.fillEllipse(9, 6, 6, 8);
    g.fillStyle(0xdca868, 1); g.fillEllipse(8, 5, 2, 3); // highlight
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

  // --- Shop / market stall (72 × 48) — where the player SPENDS gold on feed (#29).
  // Deliberately distinct from the red farm stand: a blue-striped canopy over a
  // crate-stacked counter so the two economy stations read apart at a glance.
  // Origin (0.5, 1), same footprint style as the farm stand. ---
  gen(scene, 'shopStall', 72, 48, (g) => {
    g.layer('poles');
    // Canopy poles
    g.fillStyle(0x6a4a28, 1);
    g.fillRect(4, 10, 4, 38); g.fillRect(64, 10, 4, 38);
    g.layer('canopy');
    // Blue-and-cream striped awning
    for (let x = 0; x < 72; x += 12) {
      g.fillStyle(x % 24 === 0 ? 0x3a72b0 : 0xeae4d2, 1);
      g.fillRect(x, 4, 12, 14);
    }
    // Scalloped edge
    for (let x = 0; x < 72; x += 12) {
      g.fillStyle(x % 24 === 0 ? 0x3a72b0 : 0xeae4d2, 1);
      g.fillEllipse(x + 6, 18, 10, 6);
    }
    g.layer('counter');
    // Counter top
    g.fillStyle(0x9a6430, 1); g.fillRect(4, 24, 64, 12);
    g.fillStyle(0xb87c3c, 1); g.fillRect(4, 24, 64, 4);
    g.fillStyle(0x805020, 1); g.fillRect(4, 32, 64, 4);
    g.layer('goods');
    // Stacked goods crates on the counter (a produce shop)
    g.fillStyle(0x7a5228, 1); g.fillRect(12, 16, 14, 10); g.fillRect(46, 16, 14, 10);
    g.fillStyle(0x9a6c38, 1); g.fillRect(12, 16, 14, 3); g.fillRect(46, 16, 14, 3);
    // A few round produce items poking out of the crates
    g.fillStyle(0xd85040, 1); g.fillCircle(16, 16, 2); g.fillCircle(22, 16, 2);
    g.fillStyle(0xe0902c, 1); g.fillCircle(50, 16, 2); g.fillCircle(56, 16, 2);
    g.layer('legs');
    // Legs
    g.fillStyle(0x6a4a28, 1);
    g.fillRect(8, 36, 4, 12); g.fillRect(60, 36, 4, 12);
  });

  // --- Spinning wheel (32 × 40) — the crafting station that spins wool into yarn
  // (#233). Origin (0.5, 1). A classic wheel-on-a-stand: a big spoked wheel on the
  // left, a slanted treadle base, and a small spindle/bobbin of yarn on the right. ---
  gen(scene, 'spinningWheel', 32, 40, (g) => {
    const WOOD   = 0x8a5a2c, WOOD_D = 0x6a4420, WOOD_L = 0xa8763c;
    const IRON   = 0x555055;
    const YARN   = 0xd88a6a, YARN_L = 0xe8a888;
    // Stand base (slanted foot rail)
    g.fillStyle(WOOD_D, 1); g.fillRect(4, 36, 24, 3);
    g.fillStyle(WOOD, 1);   g.fillRect(6, 33, 4, 4); g.fillRect(22, 33, 4, 4);
    // Wheel hub post
    g.fillStyle(WOOD, 1); g.fillRect(9, 14, 3, 20);
    g.fillStyle(WOOD_L, 1); g.fillRect(9, 14, 1, 20);
    // The big wheel — rim + hub + spokes
    const cx = 10, cy = 15, R = 9;
    g.fillStyle(WOOD, 1);   g.fillCircle(cx, cy, R);
    g.fillStyle(0x000000, 0);                                  // (no fill — carve rim)
    g.fillStyle(WOOD_D, 1); g.fillCircle(cx, cy, R - 2);       // inner cut
    g.fillStyle(WOOD, 1);   g.fillCircle(cx, cy, R - 3);       // re-fill center (spokes drawn over)
    g.fillStyle(WOOD_L, 1);                                    // spokes
    g.fillRect(cx - 0.5, cy - R + 2, 1, R * 2 - 4);            // vertical
    g.fillRect(cx - R + 2, cy - 0.5, R * 2 - 4, 1);            // horizontal
    g.fillRect(cx - R + 3, cy - R + 3, R * 2 - 6, 1);          // diagonal-ish
    g.fillStyle(IRON, 1);   g.fillCircle(cx, cy, 2);           // iron hub
    g.fillStyle(WOOD_D, 1); g.fillCircle(cx, cy, R); g.fillCircle(cx, cy, R - 1); // rim ring (outline)
    g.fillStyle(WOOD, 1);   g.fillCircle(cx, cy, R - 2);       // restore face inside rim
    // redraw spokes + hub crisply on top of the restored face
    g.fillStyle(WOOD_L, 1);
    g.fillRect(cx - 0.5, cy - R + 2, 1, R * 2 - 4);
    g.fillRect(cx - R + 2, cy - 0.5, R * 2 - 4, 1);
    g.fillStyle(IRON, 1); g.fillCircle(cx, cy, 2);
    // Spindle arm reaching right to the bobbin
    g.fillStyle(WOOD, 1); g.fillRect(19, 12, 9, 2);
    g.fillStyle(IRON, 1); g.fillRect(24, 8, 2, 8);             // upright post for the flyer
    // Bobbin of yarn on the spindle
    g.fillStyle(YARN, 1);   g.fillEllipse(25, 12, 6, 5);
    g.fillStyle(YARN_L, 1); g.fillEllipse(24, 11, 3, 2);
    g.fillStyle(YARN, 1);   g.fillRect(23, 11, 4, 1);
  });

  // --- Spinning-wheel spokes overlay (20 × 20) — just the spoked disc, centered so
  // it can be rotated in place during a craft (#233). Drawn as its own texture with
  // origin (0.5, 0.5) at the hub; the base `spinningWheel` prop stays static and this
  // spins on top of it while wool is spun into yarn, then hides. Matches the base
  // wheel's colors/radius (R=9, center of a 20×20 grid). ---
  gen(scene, 'spinningWheelSpokes', 20, 20, (g) => {
    const WOOD   = 0x8a5a2c, WOOD_D = 0x6a4420, WOOD_L = 0xa8763c;
    const IRON   = 0x555055;
    const cx = 10, cy = 10, R = 9;
    g.fillStyle(WOOD, 1);   g.fillCircle(cx, cy, R);
    g.fillStyle(WOOD_D, 1); g.fillCircle(cx, cy, R - 2);       // inner cut
    g.fillStyle(WOOD, 1);   g.fillCircle(cx, cy, R - 3);       // re-fill face
    g.fillStyle(WOOD_L, 1);                                    // spokes
    g.fillRect(cx - 0.5, cy - R + 2, 1, R * 2 - 4);            // vertical
    g.fillRect(cx - R + 2, cy - 0.5, R * 2 - 4, 1);            // horizontal
    g.fillRect(cx - R + 3, cy - R + 3, R * 2 - 6, 1);          // diagonal-ish
    g.fillStyle(IRON, 1);   g.fillCircle(cx, cy, 2);           // iron hub
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

  // --- Shopkeeper NPC (16 × 24) — the first concrete NPC (#244). Staffs the market
  // stall and runs the buy/sell shop. Deliberately reads as a *vendor*, distinct from
  // the walk-by farm-stand customer above: a green apron over a warm shirt, a rust
  // kerchief cap, and rosy cheeks — a friendly cozy shopkeeper. Two frames differ only
  // in the eyes (open / blinking) for a subtle idle blink; the body is identical so the
  // sprite can bob in place without moving. Origin (0.5, 1), same 16×24 layout as the
  // player/customer. Dissect-tagged for the dev dissect tool. ---
  const SK_SKIN  = 0xf2c894;
  const SK_CHEEK = 0xe6a884;
  const SK_HAIR  = 0x3a2414;
  const SK_CAP   = 0xb5533a;   // rust kerchief cap
  const SK_CAP_D = 0x8f3f2c;
  const SK_SHIRT = 0xd8b48a;   // warm cream shirt
  const SK_APRON = 0x4f7a4a;   // green vendor apron
  const SK_APRND = 0x3c5f39;
  const SK_PANTS = 0x5a4636;
  const SK_SHOE  = 0x2a1a0e;

  const drawShopkeeper = (g, blink) => {
    g.layer('cap');
    // Kerchief cap over the hair
    g.fillStyle(SK_CAP, 1);   g.fillRect(4, 0, 8, 3); g.fillRect(3, 1, 10, 2);
    g.fillStyle(SK_CAP_D, 1); g.fillRect(4, 2, 8, 1);
    g.layer('hair');
    // Hair peeking out at the sides
    g.fillStyle(SK_HAIR, 1);  g.fillRect(3, 3, 2, 4); g.fillRect(11, 3, 2, 4);
    g.layer('head');
    // Face
    g.fillStyle(SK_SKIN, 1);  g.fillRect(5, 3, 6, 6);
    // Rosy cheeks
    g.fillStyle(SK_CHEEK, 1); g.fillRect(5, 6, 1, 1); g.fillRect(10, 6, 1, 1);
    g.layer('eye');
    // Eyes — open normally, a thin closed line when blinking
    g.fillStyle(0x1a0a04, 1);
    if (blink) { g.fillRect(6, 6, 1, 1); g.fillRect(9, 6, 1, 1); }
    else       { g.fillRect(6, 5, 1, 2); g.fillRect(9, 5, 1, 2); }
    // Little smile
    g.fillStyle(0xb07050, 1); g.fillRect(7, 8, 2, 1);
    g.layer('body');
    // Shirt (shoulders/arms)
    g.fillStyle(SK_SHIRT, 1); g.fillRect(4, 9, 8, 6); g.fillRect(2, 9, 3, 5); g.fillRect(11, 9, 3, 5);
    // Apron over the chest/belly
    g.fillStyle(SK_APRON, 1); g.fillRect(5, 10, 6, 6);
    g.fillStyle(SK_APRND, 1); g.fillRect(5, 14, 6, 2);           // apron shadow hem
    g.fillStyle(SK_APRND, 1); g.fillRect(5, 9, 1, 5); g.fillRect(10, 9, 1, 5); // apron straps
    g.layer('hands');
    // Hands at the counter
    g.fillStyle(SK_SKIN, 1);  g.fillRect(2, 13, 2, 2); g.fillRect(12, 13, 2, 2);
    g.layer('legs');
    // Pants + legs (mostly hidden behind the counter, but drawn for standalone view)
    g.fillStyle(SK_PANTS, 1); g.fillRect(4, 16, 8, 5);
    g.fillRect(4, 16, 3, 5); g.fillRect(9, 16, 3, 5);
    g.layer('shoes');
    g.fillStyle(SK_SHOE, 1);  g.fillRect(4, 20, 4, 3); g.fillRect(8, 20, 4, 3);
  };
  gen(scene, 'shopkeeper_0', 16, 24, (g) => drawShopkeeper(g, false)); // eyes open
  gen(scene, 'shopkeeper_1', 16, 24, (g) => drawShopkeeper(g, true));  // blinking

  // Icons (hotbar/UI) and props/effects/gather-sources live in their own files.
  buildIconTextures(scene);
  buildPropTextures(scene);
}
