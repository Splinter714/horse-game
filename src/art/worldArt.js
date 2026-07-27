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
// Barn footprint + interior layout — the single source of truth, shared with the
// barn scene mixin so the drawn stalls/doorway line up with the collision + stand
// spots (#349).
import {
  BARN_W, BARN_H, NUM_STALLS, STALL_X0, STALL_STEP, STALL_TOP, STALL_SIGN_Y,
  STALL_HAY_Y, stallCenterX, DOOR_X0, DOOR_X1, BACK_WALL_H, BACK_ROOF_H, ROOF_MID_H,
  FRONT_EAVE, ROOF_PEAK,
} from '../data/barn.js';

// Water-trough texture size (#336). Rotated 90° from the original 100×26 so the
// trough's long axis runs north–south and horses can line up along BOTH long
// sides. The interior channel runs x=5..21, y=6..(TROUGH_H-4).
const TROUGH_W = 26;
const TROUGH_H = 100;

// The wooden shell every trough texture shares (empty + each filled level).
function drawTroughShell(g) {
  g.fillStyle(0x8a5a2e, 1); g.fillRect(0, 4, TROUGH_W, TROUGH_H - 4);  // wood body / side rails
  g.fillStyle(0xa06c38, 1); g.fillRect(0, 0, TROUGH_W, 6);             // far (north) end rim, lit
  g.fillStyle(0x6a3c18, 1); g.fillRect(0, TROUGH_H - 4, TROUGH_W, 4);  // near (south) end board, shaded
  g.fillStyle(0x3a2410, 1); g.fillRect(5, 6, 16, TROUGH_H - 12);       // dry dark interior channel
  g.fillStyle(0x2a1a08, 1); g.fillRect(5, 6, 3, TROUGH_H - 12);        // shadow down the west wall
}

// Mid-length post divider, so it still reads as one long trough.
function drawTroughPost(g) {
  const mid = Math.round(TROUGH_H / 2) - 2;
  g.fillStyle(0x6a3c18, 1); g.fillRect(2, mid, 22, 4); g.fillRect(0, mid - 2, 4, 2);
}

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

  // --- chimney smoke wisp (#230) — a soft puff drifting up from the house chimney ---
  // A little translucent grey blob, layered light-to-dark so it reads as a puff of
  // smoke rather than a flat circle. The scene (worldObjects.js) spawns a fresh one
  // every few seconds above the chimney, tweening it up + fading it out — matching
  // the fireplace burning inside (#230). One texture, reused per puff.
  gen(scene, 'smokeWisp', 14, 14, (g) => {
    g.fillStyle(0xc8c8c8, 0.35); g.fillCircle(7, 8, 6);
    g.fillStyle(0xdcdcdc, 0.45); g.fillCircle(6, 6, 4);
    g.fillStyle(0xeeeeee, 0.5);  g.fillCircle(8, 5, 2.5);
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
    g.layer('pantry');
    // Pantry/fridge cupboard (#212): a slim standalone cabinet between the dresser
    // and the kitchen counter — a distinct storage pool, drawn distinctly (a tall
    // two-door cupboard) so it doesn't read as part of the counter.
    g.fillStyle(0x5a7a5a, 1); g.fillRect(40, 16, 16, 32);          // cupboard body (cool green)
    g.fillStyle(0x6a8a6a, 1); g.fillRect(41, 17, 14, 3);          // top highlight
    g.fillStyle(0x3a5a3a, 1); g.fillRect(40, 32, 16, 1);         // door split line (horizontal)
    g.fillStyle(0x3a5a3a, 1); g.fillRect(47, 17, 1, 30);        // door split line (vertical)
    g.fillStyle(0xd8c878, 1); g.fillCircle(45, 24, 1); g.fillCircle(45, 40, 1); // knobs (left door)
    g.fillStyle(0xd8c878, 1); g.fillCircle(51, 24, 1); g.fillCircle(51, 40, 1); // knobs (right door)
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
    g.layer('fishtank');
    // Fish tank (#221) — a wooden stand + glass tank on the open west wall, below the
    // dresser/mirror. PURELY DECORATIVE: no feed/catch mechanic. The ambient swimming
    // fish themselves are separate sprites the scene animates over this glass (see
    // HouseInteriorScene._buildFishTank) — reusing the stream fish art (#183) — so the
    // texture here only needs the tank furniture (stand, glass, gravel, waterline).
    // Proportions flattened per the 2026-07-06 playtest (was reading too tall/flat for
    // a wall-mounted tank) — same footprint width, shorter overall, plus a vertical
    // glass edge glint for a bit of depth instead of a flat wash.
    g.fillStyle(0x3a2a1a, 1); g.fillRect(9, 78, 2, 20); g.fillRect(45, 78, 2, 20); // tank frame sides
    g.fillStyle(0x3a2a1a, 1); g.fillRect(9, 76, 38, 3);           // tank frame top
    g.fillStyle(0x9adcec, 0.55); g.fillRect(11, 79, 34, 15);      // glass/water body
    g.fillStyle(0xbdeaf5, 0.5); g.fillRect(11, 79, 34, 2);        // waterline sheen
    g.fillStyle(0xeaf8fc, 0.35); g.fillRect(12, 81, 2, 11);       // vertical glass edge glint (depth)
    g.fillStyle(0xcaa877, 1); g.fillRect(11, 92, 34, 3);          // gravel bed
    g.fillStyle(0xd6b985, 1); g.fillRect(11, 92, 34, 1);         // gravel highlight
    g.fillStyle(0x4a8a54, 1); g.fillRect(15, 85, 2, 7); g.fillRect(38, 83, 2, 9); // little water plants
    g.fillStyle(0x5aa060, 1); g.fillRect(15, 84, 2, 2); g.fillRect(38, 82, 2, 2);
    g.fillStyle(0x6a4a2a, 1); g.fillRect(8, 98, 40, 8);           // wooden stand
    g.fillStyle(0x5a3f24, 1); g.fillRect(8, 105, 40, 2);         // stand shadow/base
    g.layer('fireplace');
    // Fireplace (#230) — a stone hearth on the open east wall, below the bed.
    // PURELY DECORATIVE/AMBIENT: no temperature/gameplay mechanic. The stone
    // surround + mantel + dark firebox are baked into this texture; the flickering
    // flame itself is a separate animated sprite the scene places over the firebox
    // (see HouseInteriorScene._buildFireplace), so re-skinning the flicker doesn't
    // require regenerating the whole room texture.
    g.fillStyle(0x8a8a8a, 1); g.fillRect(114, 62, 42, 44);          // stone surround block
    g.fillStyle(0x9c9c9c, 1);                                       // stone highlight patches
    g.fillRect(117, 65, 6, 6); g.fillRect(140, 68, 6, 6); g.fillRect(120, 92, 6, 5);
    g.fillStyle(0x767676, 1);                                       // stone shadow patches
    g.fillRect(130, 70, 5, 5); g.fillRect(118, 82, 5, 5); g.fillRect(142, 88, 5, 5);
    g.fillStyle(0x6a4a2a, 1); g.fillRect(112, 60, 46, 5);           // wood mantel shelf
    g.fillStyle(0x8a5a30, 1); g.fillRect(112, 60, 46, 2);          // mantel highlight
    g.fillStyle(0x1a1410, 1); g.fillRect(122, 76, 22, 24);          // firebox opening (dark)
    g.fillStyle(0x3a2a1a, 1); g.fillRect(122, 76, 22, 3);          // firebox lintel shadow
    g.fillStyle(0x4a3a2a, 1); g.fillRect(126, 96, 5, 3); g.fillRect(134, 97, 6, 2); // charred logs
  });

  // --- fireplace flame (#230) — 2-frame flicker, drawn over the firebox opening ---
  // A simple layered-triangle flame (like the beehive's honey glow but animated): an
  // outer orange flame + an inner yellow-white core, alternating a taller/shorter,
  // left/right-leaning silhouette between frames for a cheap, cozy flicker. Small
  // (22×20 design px, matching the firebox opening) so HouseInteriorScene can drop it
  // straight over the hearth and just flip frames on a timer — no per-frame logic.
  const FLAME_W = 22, FLAME_H = 20;
  function drawFlame(g, variant) {
    const lean = variant === 0 ? 1 : -1;
    g.layer('flame_outer');
    g.fillStyle(0xff8a2a, 0.95);
    g.fillTriangle(2, FLAME_H, 11 + lean, 1, 20, FLAME_H);
    g.fillStyle(0xffb040, 0.9);
    g.fillTriangle(5, FLAME_H, 11 + lean * 0.5, 5, 17, FLAME_H);
    g.layer('flame_core');
    g.fillStyle(0xfff2a0, 0.95);
    g.fillTriangle(8, FLAME_H, 11 - lean * 0.5, 8, 14, FLAME_H);
    g.layer('ember_glow');
    g.fillStyle(0xff6a1a, 0.5);
    g.fillRect(3, FLAME_H - 3, 16, 3);
  }
  gen(scene, 'fireplaceFlame_0', FLAME_W, FLAME_H, (g) => drawFlame(g, 0));
  gen(scene, 'fireplaceFlame_1', FLAME_W, FLAME_H, (g) => drawFlame(g, 1));

  // --- barn interior + cutaway (#35) ---
  // FIRST-PASS DRAFT ART, owner-art-directed. The barn is now a walk-in building
  // rendered as two stacked textures so it can do an in-world CUTAWAY: when the
  // player steps inside, the front-wall/roof façade (`barnFront`) fades out to
  // reveal the interior (`barnInterior`) drawn beneath it. See scenes/paddock/barn.js.
  //
  // Footprint is BARN_W×BARN_H design px (origin 0.5,1 at the SOUTH doorway),
  // imported from data/barn.js so the art and the scene geometry can't drift apart.
  // #349 enlarged it from 160×132 to 340×230 — at scale S=2 that's 680×460 world px,
  // a genuinely roomy walk-in barn. Dissect tags per part.

  // INTERIOR — floor, the full row of stalls along the back, and a tack room in the
  // left bay. Drawn UNDER animals/player (low depth) so anything standing inside
  // occludes it correctly. The south edge (y≈H) is the open doorway. (2026-07-27:
  // removed the back-roof cap, inner back-wall band, and middle-aisle dressing —
  // the roof-cap job is now barnBack's, and the owner wanted the floor plainer.)
  gen(scene, 'barnInterior', BARN_W, BARN_H, (g) => {
    const FX0 = 8, FX1 = BARN_W - 8, FY0 = 40, FY1 = BARN_H - 4;     // floor rect
    g.layer('floor');
    g.fillStyle(0x6a5236, 1); g.fillRect(FX0, FY0, FX1 - FX0, FY1 - FY0); // packed-dirt floor
    g.fillStyle(0x5e492f, 1);                                        // plank/board seams
    for (let y = FY0 + 16; y < FY1; y += 14) g.fillRect(FX0 + 2, y, FX1 - FX0 - 4, 1);
    g.fillStyle(0x775c3c, 1);                                        // straw scatter (light)
    for (const [sx, sy] of [[60, 160], [140, 200], [250, 150], [96, 210], [300, 190], [190, 176]]) {
      g.fillRect(sx, sy, 8, 1);
    }
    g.layer('stalls');
    // A full row of NUM_STALLS stalls across the back: low dividers + a hay mound +
    // a nameboard each. Geometry comes from data/barn.js so the scene's stand-spots
    // land exactly on the drawn stalls.
    for (let i = 0; i <= NUM_STALLS; i++) {
      const x = STALL_X0 + i * STALL_STEP;
      g.fillStyle(0x6a4420, 1); g.fillRect(x, STALL_TOP, 3, 46);     // stall divider post
      g.fillStyle(0x8a5a2e, 1); g.fillRect(x, STALL_TOP + 20, 3, 3); // divider rail cap
    }
    // Stall goodies drawn in a second pass so their colours don't fight the divider loop.
    for (let i = 0; i < NUM_STALLS; i++) {
      const cx = stallCenterX(i);
      g.fillStyle(0xd8b060, 1); g.fillRect(cx - 9, STALL_HAY_Y, 18, 7);       // hay mound
      g.fillStyle(0xe8c878, 1); g.fillRect(cx - 9, STALL_HAY_Y, 18, 2);
      g.fillStyle(0xead9b0, 1); g.fillRect(cx - 8, STALL_SIGN_Y, 16, 7);      // nameboard
      g.fillStyle(0x6a4420, 1); g.fillRect(cx - 8, STALL_SIGN_Y, 16, 1);
    }
    g.layer('tack');
    // Tack room — the whole left bay now that there's room for one: a partition wall
    // marking it off, two wall-mounted racks (saddles, bridles, brushes) and a
    // workbench with a lantern.
    g.fillStyle(0x6a4420, 1); g.fillRect(STALL_X0 - 12, STALL_TOP, 3, 78);    // partition post
    g.fillStyle(0x5a3f24, 1); g.fillRect(12, 96, 78, 4);                      // upper shelf
    g.fillStyle(0x5a3f24, 1); g.fillRect(12, 140, 78, 4);                     // lower shelf
    for (const sx of [16, 46]) {                                              // two saddles
      g.fillStyle(0x7a5a34, 1); g.fillRect(sx, 84, 22, 12);
      g.fillStyle(0x5a3f24, 1); g.fillRect(sx, 92, 22, 4);
      g.fillStyle(0x9a7a4c, 1); g.fillRect(sx + 2, 85, 18, 2);
    }
    for (const bx of [74, 82]) {                                              // hanging bridles
      g.fillStyle(0x2a1c10, 1); g.fillRect(bx, 84, 2, 14);
      g.fillStyle(0x2a1c10, 1); g.fillCircle(bx + 1, 100, 4);
    }
    g.fillStyle(0x8a5a2e, 1); g.fillRect(20, 130, 8, 10);                     // brush block
    g.fillStyle(0x3a2410, 1); g.fillRect(20, 138, 8, 3);                      // brush bristles
    g.fillStyle(0x6a4a28, 1); g.fillRect(40, 128, 44, 14);                    // workbench top
    g.fillStyle(0x4a3018, 1); g.fillRect(42, 142, 4, 10); g.fillRect(78, 142, 4, 10); // legs
    g.fillStyle(0xf0d890, 1); g.fillRect(66, 120, 8, 8);                      // lantern glow
    g.fillStyle(0x3a2410, 1); g.fillRect(68, 116, 4, 4);                      // lantern hook
  });

  // FRONT FAÇADE — the front wall, big doorway, gambrel roof, cupola & hayloft. This
  // is drawn OVER the interior + occupants (high depth) and is what fades out for the
  // cutaway. Kept visually consistent with the old #241 barn so it still reads as a
  // barn, just scaled up to the #349 footprint (wider roof, four windows, a doorway
  // matching data/barn.js's DOOR_X0..DOOR_X1 collision gap).
  //
  // The wall MUST reach the sprite's base (y = BARN_H) across the full width, because
  // this texture is the only thing hiding `barnInterior` from a player standing
  // outside. The first pass drew the wall band as a fixed-height strip well short of
  // BARN_H, so the bottom of the interior (floor, plank seams, straw, stall bottoms)
  // was permanently visible from anywhere on the map — the "front wall is see-through
  // even when standing outside" playtest bug (#35, 2026-07-06 / 2026-07-26, recurred
  // at the #349 enlarged size). Anything added here that leaves a gap above y = BARN_H
  // reintroduces it.
  gen(scene, 'barnFront', BARN_W, BARN_H, (g) => {
    const MID = BARN_W / 2;
    // Eave line: where the roof ends and the plain wall band begins. #349's first
    // pass put this right under the cupola (a ~54px roof over a ~176px wall), which
    // read as a boxy wall with a token roof cap instead of a barn's gambrel silhouette.
    // Lowering it deepens the roof (the part that actually reads as "barn") and
    // shrinks the wall to a normal door-height band.
    const EAVE = FRONT_EAVE;
    g.layer('silhouette');
    // Opaque base covering exactly the interior texture's extent, so no sliver of
    // floor/back wall can peek out past the roof's slanted corners. Everything below
    // paints over this. Still runs eave-to-base, same as the wall/doorway below, so
    // the "front wall is see-through" bug (#35) can't reappear.
    g.fillStyle(0x7a2a1c, 1); g.fillRect(8, EAVE, BARN_W - 16, BARN_H - EAVE);
    g.layer('roof');
    // Gambrel (barn) roof spanning the wide front — deep lower slopes down to EAVE.
    g.fillStyle(0x7a2a1c, 1); g.fillTriangle(4, EAVE, MID, 6, BARN_W - 4, EAVE);   // underside/shadow
    g.fillStyle(0x9a3826, 1);
    g.fillPoints([{ x: 8, y: EAVE }, { x: 64, y: 60 }, { x: BARN_W - 64, y: 60 }, { x: BARN_W - 8, y: EAVE }]); // lower slopes
    g.fillStyle(0xb6432e, 1);
    g.fillPoints([{ x: 64, y: 60 }, { x: MID, y: 6 }, { x: BARN_W - 64, y: 60 }]); // upper cap
    g.fillStyle(0xc8543c, 1); g.fillRect(8, EAVE - 2, BARN_W - 16, 3);                // eave highlight
    g.layer('cupola');
    g.fillStyle(0x9a3826, 1); g.fillRect(MID - 11, 0, 22, 12);
    g.fillStyle(0x5a2418, 1); g.fillTriangle(MID - 15, 3, MID, -7, MID + 15, 3);
    g.fillStyle(0xf0d890, 1); g.fillRect(MID - 5, 3, 10, 6);
    g.layer('wall');
    // Front wall, eave down to the ground line — full-height, full-width cover.
    g.fillStyle(0xb6432e, 1); g.fillRect(8, EAVE, BARN_W - 16, BARN_H - EAVE);     // front wall
    g.fillStyle(0xc8543c, 1); g.fillRect(8, EAVE, BARN_W - 16, 7);             // top-lit band
    g.fillStyle(0xa03826, 1);                                                 // board seams
    for (let y = EAVE + 14; y < BARN_H - 8; y += 12) g.fillRect(12, y, BARN_W - 24, 1);
    g.fillStyle(0x8e3421, 1); g.fillRect(8, BARN_H - 8, BARN_W - 16, 8);      // ground shadow at the base
    g.fillStyle(0x7a2a1c, 1);                                                 // corner posts
    g.fillRect(8, EAVE, 4, BARN_H - EAVE); g.fillRect(BARN_W - 12, EAVE, 4, BARN_H - EAVE);
    g.layer('loft');
    // Hayloft door + pulley sit up in the deepened roof, above the wall.
    g.fillStyle(0x5a2418, 1); g.fillRect(MID - 15, EAVE - 50, 30, 22);              // hayloft door
    g.fillStyle(0xd8b060, 1); g.fillRect(MID - 10, EAVE - 46, 20, 16);            // straw glow
    g.fillStyle(0x3a1810, 1); g.fillRect(MID - 1, EAVE - 62, 3, 12); g.fillCircle(MID, EAVE - 62, 3); // pulley
    g.layer('doorway');
    // A big open central doorway reading as a dark opening at ground level (reaching
    // the base), lining up with the collision gap in the south wall (data/barn.js
    // DOOR_X0..DOOR_X1). Framed jambs + a header, with the two doors swung open flat
    // against the wall.
    g.fillStyle(0x2a1c10, 1); g.fillRect(DOOR_X0, EAVE + 8, DOOR_X1 - DOOR_X0, BARN_H - (EAVE + 8)); // dark opening, reaches base
    g.fillStyle(0x1e140b, 1); g.fillRect(DOOR_X0, EAVE + 8, DOOR_X1 - DOOR_X0, 6);          // depth shadow under the header
    g.fillStyle(0x6a4420, 1);                                        // jambs
    g.fillRect(DOOR_X0 - 6, EAVE + 4, 6, BARN_H - (EAVE + 4)); g.fillRect(DOOR_X1, EAVE + 4, 6, BARN_H - (EAVE + 4));
    g.fillStyle(0x6a4420, 1); g.fillRect(DOOR_X0 - 6, EAVE + 4, DOOR_X1 - DOOR_X0 + 12, 6);    // header
    g.fillStyle(0x8a5a2e, 1);                                        // open doors flat on the wall
    g.fillRect(DOOR_X0 - 34, EAVE + 8, 28, 44); g.fillRect(DOOR_X1 + 6, EAVE + 8, 28, 44);
    g.fillStyle(0xe8dcc0, 1);                                        // white braces on the doors
    g.fillTriangle(DOOR_X0 - 33, EAVE + 9, DOOR_X0 - 7, EAVE + 51, DOOR_X0 - 6, EAVE + 51);
    g.fillTriangle(DOOR_X1 + 7, EAVE + 9, DOOR_X1 + 33, EAVE + 51, DOOR_X1 + 34, EAVE + 51);
    g.layer('window');
    for (const wx of [34, 76, BARN_W - 94, BARN_W - 52]) {
      g.fillStyle(0xf0d890, 1); g.fillRect(wx, EAVE + 14, 18, 18);
      g.fillStyle(0x7a2a1c, 1); g.fillRect(wx + 8, EAVE + 14, 2, 18); g.fillRect(wx, EAVE + 22, 18, 2);
    }
  });

  // BACK WALL + ROOF (#362) — a NEW always-opaque backdrop for the barn's north
  // side. Mirrors barnFront's gambrel/eave style (same BARN_W×BARN_H canvas, same
  // colour language) but has no doorway — animals don't enter from the back — and
  // its content is capped near the BOTTOM of the canvas (BACK_ROOF_H + BACK_WALL_H
  // tall), not spread across the whole BARN_H the way barnFront's is. The scene
  // mixin (scenes/paddock/barn.js) anchors this sprite at the barn's own back
  // (north) wall line (data/barn.js WALL_Y0), origin (0.5,1) — same convention as
  // barnFront/barnInterior — so this canvas-bottom band lands right at that wall
  // line and its roof rises a modest amount further north as overhang.
  //
  // This is the ONLY thing that keeps the barn's north side reading as a covered
  // building once barnFront fades out for the interior cutaway (#35) — it must
  // independently satisfy the same "opaque wall-to-base, no gap" invariant as
  // barnFront, just over its own (shorter) footprint instead of the whole BARN_H.
  // 2026-07-27: EXACT SAME shape as barnFront (same eave/peak/wall/cupola/window
  // geometry — BACK_WALL_H/BACK_ROOF_H are now derived from the same FRONT_EAVE/
  // ROOF_PEAK constants front uses, see data/barn.js), so barnRoofMid bridges two
  // matching gambrel silhouettes instead of two differently-proportioned ones. The
  // only real difference is no doorway/hayloft cutout — the back isn't an entry
  // point, so it's a solid wall band there instead.
  gen(scene, 'barnBack', BARN_W, BARN_H, (g) => {
    const MID = BARN_W / 2;
    const EAVE = FRONT_EAVE;
    const PEAK = FRONT_EAVE - BACK_ROOF_H; // == ROOF_PEAK
    g.layer('silhouette');
    g.fillStyle(0x7a2a1c, 1); g.fillRect(8, EAVE, BARN_W - 16, BARN_H - EAVE);
    g.layer('roof');
    g.fillStyle(0x7a2a1c, 1); g.fillTriangle(4, EAVE, MID, PEAK, BARN_W - 4, EAVE);
    g.fillStyle(0x9a3826, 1);
    g.fillPoints([{ x: 8, y: EAVE }, { x: 64, y: 60 }, { x: BARN_W - 64, y: 60 }, { x: BARN_W - 8, y: EAVE }]);
    g.fillStyle(0xb6432e, 1);
    g.fillPoints([{ x: 64, y: 60 }, { x: MID, y: PEAK }, { x: BARN_W - 64, y: 60 }]);
    g.fillStyle(0xc8543c, 1); g.fillRect(8, EAVE - 2, BARN_W - 16, 3);
    g.layer('cupola');
    g.fillStyle(0x9a3826, 1); g.fillRect(MID - 11, PEAK - 6, 22, 12);
    g.fillStyle(0x5a2418, 1); g.fillTriangle(MID - 15, PEAK - 3, MID, PEAK - 13, MID + 15, PEAK - 3);
    g.fillStyle(0xf0d890, 1); g.fillRect(MID - 5, PEAK - 3, 10, 6);
    g.layer('wall');
    g.fillStyle(0xb6432e, 1); g.fillRect(8, EAVE, BARN_W - 16, BARN_H - EAVE);
    g.fillStyle(0xc8543c, 1); g.fillRect(8, EAVE, BARN_W - 16, 7);
    g.fillStyle(0xa03826, 1);
    for (let y = EAVE + 14; y < BARN_H - 8; y += 12) g.fillRect(12, y, BARN_W - 24, 1);
    g.fillStyle(0x8e3421, 1); g.fillRect(8, BARN_H - 8, BARN_W - 16, 8);
    g.fillStyle(0x7a2a1c, 1);
    g.fillRect(8, EAVE, 4, BARN_H - EAVE); g.fillRect(BARN_W - 12, EAVE, 4, BARN_H - EAVE);
    g.layer('window');
    for (const wx of [34, 76, BARN_W - 94, BARN_W - 52]) {
      g.fillStyle(0xf0d890, 1); g.fillRect(wx, EAVE + 14, 18, 18);
      g.fillStyle(0x7a2a1c, 1); g.fillRect(wx + 8, EAVE + 14, 2, 18); g.fillRect(wx, EAVE + 22, 18, 2);
    }
  });

  // MIDDLE ROOF CONNECTOR (#362) — a plain roof plane bridging the depth between
  // barnBack's own eave and barnFront's eave, so the barn silhouette reads as one
  // continuous covered building front-to-back from outside, not a front gable with
  // nothing behind it. Fades in lockstep with barnFront (see updateBarnCutaway) —
  // unlike barnBack, which never fades. A small, plain texture (not the full
  // BARN_W×BARN_H footprint) since it's just a connecting ridge, no walls/windows.
  gen(scene, 'barnRoofMid', BARN_W, ROOF_MID_H, (g) => {
    const MID = BARN_W / 2;
    // 2026-07-27 owner-confirmed design (third pass): the connector is FULL WALL
    // WIDTH (matching barnFront's/barnBack's own eave inset), and its own DEPTH
    // (front-to-back thickness) is constant everywhere across that width — but the
    // strip's start/end points aren't flat horizontal lines: both undulate up/down
    // together, tracing the SAME roofline height profile front/back's own roof uses
    // (a shallow lower-slope down to the cap's shoulder width, then the cap's
    // steeper rise to the peak) — so the whole constant-thickness ribbon sits
    // higher (nearer y=0) toward the centre/ridge and lower (nearer y=ROOF_MID_H)
    // toward the side walls, instead of a flat cut with a separate tapered notch.
    const X0 = 8, X1 = BARN_W - 8;               // full wall width
    const SX0 = 64, SX1 = BARN_W - 64;           // shoulder, matching the cap's own base
    const THICKNESS = ROOF_MID_H * 0.55;         // the constant depth of the strip itself
    const RISE_MAX = ROOF_MID_H - THICKNESS;     // how far the strip can shift up/down
    // front/back's own shoulder sits at design y=60: lower-slope runs EAVE(130)->60
    // = 70 units, cap runs 60->PEAK(6) = 54 units, out of a 124-unit total span.
    const REAL_SPAN = FRONT_EAVE - ROOF_PEAK;
    const LOWER_RISE = RISE_MAX * ((FRONT_EAVE - 60) / REAL_SPAN);
    const CAP_RISE = RISE_MAX - LOWER_RISE;
    const shoulderHalf = MID - SX0, wallHalf = MID - X0;
    // rise(x): how far DOWN (toward y=ROOF_MID_H) the strip sits at this x — 0 dead
    // centre (highest, matching the peak), growing through the cap band to
    // CAP_RISE at the shoulder, then through the lower-slope band to RISE_MAX at
    // the wall edges (lowest, matching the eave).
    const rise = (x) => {
      const d = Math.abs(x - MID);
      if (d >= wallHalf) return RISE_MAX;
      if (d > shoulderHalf) return CAP_RISE + (RISE_MAX - CAP_RISE) * (d - shoulderHalf) / (wallHalf - shoulderHalf);
      return CAP_RISE * (d / shoulderHalf);
    };
    const topY    = (x) => rise(x);
    const bottomY = (x) => rise(x) + THICKNESS;
    g.layer('roof');
    g.fillStyle(0x9a3826, 1);
    // Build the ribbon as a polygon: top boundary left-to-right, then bottom
    // boundary right-to-left, sampling the shoulder/wall break points on each side.
    g.fillPoints([
      { x: X0, y: topY(X0) }, { x: SX0, y: topY(SX0) }, { x: MID, y: topY(MID) },
      { x: SX1, y: topY(SX1) }, { x: X1, y: topY(X1) },
      { x: X1, y: bottomY(X1) }, { x: SX1, y: bottomY(SX1) }, { x: MID, y: bottomY(MID) },
      { x: SX0, y: bottomY(SX0) }, { x: X0, y: bottomY(X0) },
    ]);
    // Vertical rafter slats running the depth of the roof, clipped to the ribbon's
    // own top/bottom at each x, so they follow the roofline's rise/fall too.
    g.fillStyle(0x7a2a1c, 1);
    for (let x = X0 + 4; x < X1; x += 18) g.fillRect(x, topY(x), 2, THICKNESS);
    g.fillStyle(0xa8462e, 1);
    for (let x = X0 + 6; x < X1; x += 18) g.fillRect(x, topY(x), 1, THICKNESS); // slat highlight
    g.fillStyle(0xb6432e, 1); g.fillRect(MID - 3, topY(MID), 6, THICKNESS); // ridge cap
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
  // Rotated 90° (#336): the trough now runs NORTH–SOUTH, drawn 26×100 (S=2 →
  // 52×200 in world) instead of the old 100×26. Its long sides face west and
  // east, which is what lets several horses line up along BOTH sides and drink
  // at once (the old east/west END anchors only fitted two).
  gen(scene, 'trough', TROUGH_W, TROUGH_H, (g) => {
    drawTroughShell(g);
    drawTroughPost(g);
  });

  // (The `shelter` texture — the open-sided lean-to from #319 — was deleted in #349.
  // The barn is the farm's rain shelter now; see the `barnInterior`/`barnFront`
  // textures above.)

  // Filled levels (#109): one texture per discrete water level (trough1..troughN)
  // so the rendered water maps 1:1 to the actual level — no more collapsing many
  // distinct levels into a few "looks full" buckets (#103 had only low/half/full,
  // which let, say, 7/9 and 9/9 look identical). Now the trough runs north–south
  // (#336) the water is a full-LENGTH strip whose WIDTH grows with the level —
  // the channel seen from above widens as it deepens — instead of a column
  // rising from the bottom edge (which, rotated, would have read as water
  // pooling at one end).
  for (let lvl = 1; lvl <= TROUGH_CAP; lvl++) {
    gen(scene, `trough${lvl}`, TROUGH_W, TROUGH_H, (g) => {
      drawTroughShell(g);
      const w  = Math.max(2, Math.round((lvl * 14) / TROUGH_CAP)); // 2..14 — distinct per level
      const x0 = 5 + Math.round((16 - w) / 2);                     // centred in the channel
      g.fillStyle(0x5fa6d6, 1); g.fillRect(x0, 8, w, TROUGH_H - 16);              // water body
      g.fillStyle(0x9ae0f8, 1); g.fillRect(x0, 8, Math.min(2, w), TROUGH_H - 16); // lit west edge
      if (w >= 5) {                                                // sparkle dashes once it has depth
        g.fillStyle(0x7cc8e8, 0.7);
        g.fillRect(x0 + 1, 20, w - 2, 1); g.fillRect(x0 + 1, 46, w - 2, 1); g.fillRect(x0 + 1, 74, w - 2, 1);
      }
      drawTroughPost(g); // divider sits proud of the water
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

    g.layer('legs');
    // Legs (drawn behind the body so they peek out below)
    g.fillStyle(legWood, 1);
    g.fillRect(12, 44, 4, 8); g.fillRect(38, 44, 4, 8); g.fillRect(54, 42, 3, 10);

    g.layer('body');
    // Main body box
    g.fillStyle(wall, 1);     g.fillRect(8, 20, 40, 26);
    g.fillStyle(wallDark, 1); g.fillRect(8, 20, 40, 3);  // eave shadow
    g.fillStyle(wallDark, 1); g.fillRect(8, 42, 40, 4);  // ground shadow
    g.fillStyle(wallDark, 1);                            // horizontal planks
    for (let y = 25; y < 42; y += 4) g.fillRect(8, y, 40, 1);
    g.fillStyle(post, 1); g.fillRect(8, 20, 3, 26); g.fillRect(45, 20, 3, 26);

    g.layer('nestbox_bumpout');
    // Nesting box bump-out on the right with a hinged, slanted lid
    g.fillStyle(wall, 1);     g.fillRect(46, 30, 14, 12);
    g.fillStyle(wallDark, 1); g.fillRect(46, 38, 14, 4);
    g.fillStyle(lid, 1);      g.fillTriangle(44, 31, 61, 25, 61, 31);
    g.fillStyle(0x6e4326, 1); g.fillRect(44, 30, 17, 1);  // lid edge
    g.fillStyle(0x3a2410, 1); g.fillCircle(58, 28, 1);    // lid knob
    g.fillStyle(straw, 1);    g.fillRect(47, 41, 3, 1); g.fillRect(55, 41, 3, 1);

    g.layer('roof');
    // Gable roof over the body
    g.fillStyle(roofDark, 1); g.fillTriangle(3, 23, 28, 7, 53, 23);
    g.fillStyle(roofMid, 1);  g.fillTriangle(6, 23, 28, 10, 50, 23);
    g.fillStyle(roofHi, 1);   // left-slope highlight streaks
    g.fillRect(11, 18, 2, 4); g.fillRect(16, 15, 2, 5); g.fillRect(21, 12, 2, 6);
    g.fillStyle(0x6e4326, 1); g.fillRect(3, 22, 50, 2); // eave board

    g.layer('weathervane');
    // Rooster weathervane on the ridge
    g.fillStyle(0x3a2410, 1);
    g.fillRect(30, 1, 1, 7);          // pole
    g.fillEllipse(29, 2, 7, 3);       // body
    g.fillRect(25, 0, 2, 3);          // tail
    g.fillStyle(comb, 1); g.fillRect(32, 0, 1, 2); // comb
    g.fillStyle(beak, 1); g.fillRect(33, 1, 1, 1); // beak

    g.layer('vent');
    // Wire vent (barred, not glass) high-center on the wall
    g.fillStyle(dark, 1);     g.fillRect(27, 24, 10, 8);
    g.fillStyle(wire, 1);
    g.fillRect(27, 27, 10, 1); g.fillRect(27, 29, 10, 1);   // horizontal wires
    g.fillRect(30, 24, 1, 8);  g.fillRect(33, 24, 1, 8);    // vertical wires
    g.fillStyle(0x6e4326, 1);
    g.fillRect(26, 23, 12, 1); g.fillRect(26, 32, 12, 1);
    g.fillRect(26, 23, 1, 10); g.fillRect(37, 23, 1, 10);

    g.layer('popdoor');
    // Pop-door (chicken sized)
    g.fillStyle(0x6e4326, 1); g.fillRect(12, 33, 11, 12); // frame
    g.fillStyle(dark, 1);     g.fillRect(13, 34, 9, 11);  // opening

    g.layer('ramp');
    // Ramp from the pop-door down to the ground, with rungs
    g.fillStyle(0xb5824a, 1);
    g.fillTriangle(13, 44, 22, 44, 6, 52);
    g.fillTriangle(22, 44, 6, 52, 15, 52);
    g.fillStyle(0x6e4326, 1);
    g.fillRect(13, 47, 4, 1); g.fillRect(10, 49, 4, 1); g.fillRect(8, 51, 4, 1);
  });

  // --- doghouse (48 × 42) — decorative yard prop (#237) ---
  // A classic peaked-roof kennel: a wooden gable house with a round arched
  // doorway, a little name-board over the door, and a gnawed bone on the grass
  // — all to read as "a dog lives here." No painted-on food bowl (2026-07-27 —
  // #361 moved to one shared pet bowl near the house, so a bowl painted into this
  // static art was a stale second one that wasn't actually functional). Decorative
  // only; the dog actually using it is deferred to #186. Dissect tags (g.layer)
  // per logical part for the dev dissect tool.
  gen(scene, 'doghouse', 48, 42, (g) => {
    const wall = 0xc08a4e, wallDark = 0x9a6a34, plank = 0x84592a;
    const roofDark = 0x6a3a1c, roofMid = 0x9a5024, roofHi = 0xc07a40;
    const dark = 0x241408, board = 0x6e4326;
    const bone = 0xeadfc4;

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

    // Water surface in the basin — flat waterline on TOP, kept rounded on the
    // bottom (2026-07-27 owner feedback: the bottom rounding was good, only the
    // top shouldn't curve). Each layer is the original ellipse (for the rounded
    // underside) with a rect filling in its upper half up to the ellipse's own
    // top extent, squaring off just the top edge.
    g.layer('water');
    g.fillStyle(waterLo, 1); g.fillRect(5, 9, 24, 4); g.fillEllipse(17, 13, 24, 8);
    g.fillStyle(water, 1);   g.fillRect(5, 8, 24, 4); g.fillEllipse(17, 12, 24, 7);
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

  // --- hummingbird house (26 × 54) — post-mounted box with a HINGED lid (#364) ---
  // A small house whose peaked-roof lid hinges at the back (left, x≈3) and props
  // open at the front (right, x≈23) when the rope tied off at the nearby post
  // pulls it up — mirrors the birdhouse above but the lid is a moving part, not
  // fixed scenery. NO front entrance hole (2026-07-27 owner feedback: it read as
  // just another birdhouse-with-a-hole) — the ONLY way in is the top, through the
  // gap the lifted lid reveals. Two variants: `hummingbirdHouse` (lid resting
  // flush/closed, fully sealed box) and `hummingbirdHouseOpen` (lid propped open
  // on its hinge, revealing the dark interior gap at the top + a little brass ring
  // at the tip where the rope attaches). Origin (0.5,1) at the foot of the post so
  // it depth-sorts on its base. Dissect-tagged (post/box/lid/hinge).
  const drawHummingbirdHouse = (g, open) => {
    const post = 0x8a5a2e, postHi = 0xa9743c, postLo = 0x6a4420;
    const wood = 0xcf9a5c, woodHi = 0xe6b878, woodLo = 0xa8763e;
    const roofD = 0x7a3f22, roofM = 0xa8582c, roofH = 0xcf7f48, roofU = 0x5a2c18; // roofU = lid underside (shaded)
    const hinge = 0x4a4a4a, ring = 0xe0b840;

    // Post
    g.layer('post');
    g.fillStyle(postLo, 1); g.fillEllipse(13, 52, 8, 3); // ground shadow
    g.fillStyle(post, 1);   g.fillRect(11, 36, 4, 18);
    g.fillStyle(postHi, 1); g.fillRect(11, 36, 1, 18);
    g.fillStyle(postLo, 1); g.fillRect(14, 36, 1, 18);

    // House box — a sealed shell, no hole. The lid (below) is the only opening.
    g.layer('box');
    g.fillStyle(wood, 1);   g.fillRect(3, 20, 20, 16);
    g.fillStyle(woodHi, 1); g.fillRect(3, 20, 20, 2);
    g.fillStyle(woodLo, 1); g.fillRect(3, 34, 20, 2);

    // Hinge (back-left edge, x≈3) — a small dark pin, visible in both states
    g.layer('hinge');
    g.fillStyle(hinge, 1); g.fillRect(2, 19, 3, 2);

    if (open) {
      // Dark gap under the lifted lid — the "propped open" mouth of the house.
      g.layer('interior');
      g.fillStyle(roofU, 1); g.fillTriangle(3, 20, 23, 20, 23, 8);

      // Lid tilted up on the hinge: a thin wedge from the hinge (3,20) to the
      // lifted tip near (23,7).
      g.layer('lid');
      g.fillStyle(roofM, 1); g.fillTriangle(3, 20, 23, 7, 23, 11);
      g.fillStyle(roofH, 1); g.fillTriangle(3, 20, 23, 11, 3, 17);
      g.fillStyle(roofD, 1); g.fillTriangle(3, 17, 23, 11, 23, 14);

      // Rope ring at the tip, where the taut rope pulls to prop it open.
      g.layer('ring');
      g.fillStyle(ring, 1); g.fillCircle(23, 8, 1.6);
    } else {
      // Flush peaked roof, resting closed on the box top (mirrors the birdhouse).
      g.layer('lid');
      g.fillStyle(roofD, 1); g.fillTriangle(1, 20, 13, 9, 25, 20);
      g.fillStyle(roofM, 1); g.fillTriangle(3, 20, 13, 11, 23, 20);
      g.fillStyle(roofH, 1); g.fillRect(6, 16, 3, 2); g.fillRect(10, 13, 3, 2);
      g.fillStyle(woodLo, 1); g.fillRect(1, 19, 24, 2); // eave board
      g.fillStyle(roofD, 1);  g.fillRect(12, 9, 2, 3);  // ridge cap

      // Rope ring at the tip, resting against the closed lid's front edge.
      g.layer('ring');
      g.fillStyle(ring, 1); g.fillCircle(22, 19, 1.6);
    }
  };
  gen(scene, 'hummingbirdHouse',     26, 54, (g) => drawHummingbirdHouse(g, false));
  gen(scene, 'hummingbirdHouseOpen', 26, 54, (g) => drawHummingbirdHouse(g, true));

  // --- hummingbird house tie post (10 × 30) — the nearby post (#364) ---
  // A simple stake the player ties/unties the house's rope at, mirroring the
  // fence-rail tie point (#317) but as its own small fixed prop rather than a
  // fence rail. Origin (0.5,1) at the foot. Dissect-tagged (post/hook).
  gen(scene, 'hummingbirdTiePost', 10, 30, (g) => {
    const post = 0x8a5a2e, postHi = 0xa9743c, postLo = 0x6a4420, hook = 0x4a4a4a;

    g.layer('post');
    g.fillStyle(postLo, 1); g.fillEllipse(5, 29, 6, 3); // ground shadow
    g.fillStyle(post, 1);   g.fillRect(3, 4, 4, 25);
    g.fillStyle(postHi, 1); g.fillRect(3, 4, 1, 25);
    g.fillStyle(postLo, 1); g.fillRect(6, 4, 1, 25);

    // Little tie-hook at the top
    g.layer('hook');
    g.fillStyle(hook, 1); g.fillRect(2, 2, 6, 2); g.fillCircle(5, 2, 1.6);
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

  // --- General store (72 × 50) — the seed shop building (#215). A small timbered
  // shopfront (walls + a shingled roof), distinct from the open-air market stalls
  // (farm stand / shop stall) since it's a proper BUILDING that can later hold a
  // second counter (clothing, #217) without adding a second structure. Green
  // shutters + a seed-sack sign read "garden supplies" at a glance. Origin (0.5, 1). ---
  gen(scene, 'generalStore', 72, 50, (g) => {
    g.layer('walls');
    // Timbered walls
    g.fillStyle(0xc9a86a, 1); g.fillRect(4, 18, 64, 28);
    g.fillStyle(0xdcc086, 1); g.fillRect(4, 18, 64, 4); // lit top band
    g.fillStyle(0x8a6a3e, 1); // corner posts
    g.fillRect(4, 18, 4, 28); g.fillRect(64, 18, 4, 28);
    g.layer('roof');
    // Peaked shingle roof
    g.fillStyle(0x5c4028, 1); g.fillTriangle(0, 18, 36, 2, 72, 18);
    g.fillStyle(0x7a5636, 1);
    for (let x = 4; x < 68; x += 8) g.fillTriangle(x, 17, x + 4, 17 - (18 - Math.abs(x + 4 - 36) * 0.44), x + 8, 17);
    g.layer('sign');
    // Hanging sign — a little seed sack + leaf, echoing the fertilizer icon
    g.fillStyle(0x6a4a28, 1); g.fillRect(34, 20, 4, 6); // post
    g.fillStyle(0x8a6a42, 1); g.fillRoundedRect(24, 24, 24, 10, 2); // sign board
    g.fillStyle(0x3b8a1c, 1); g.fillTriangle(36, 26, 31, 32, 41, 32); // leaf motif
    g.layer('door');
    // Door + window with green shutters
    g.fillStyle(0x4a3420, 1); g.fillRect(30, 34, 12, 12); // doorway
    g.fillStyle(0x6a4a2e, 1); g.fillRect(30, 34, 12, 2);
    g.fillStyle(0x3b8a1c, 1); // shutters either side of the door
    g.fillRect(10, 34, 8, 12); g.fillRect(54, 34, 8, 12);
    g.fillStyle(0xaee0d8, 1); g.fillRect(11, 35, 6, 6); g.fillRect(55, 35, 6, 6); // window glass
    g.fillStyle(0x2f7016, 1); g.fillRect(9, 34, 2, 12); g.fillRect(19, 34, 2, 12);
    g.fillRect(53, 34, 2, 12); g.fillRect(63, 34, 2, 12); // shutter frames
    g.layer('base');
    // Base/step
    g.fillStyle(0x8a6a3e, 1); g.fillRect(2, 46, 68, 4);
  });

  // --- Pet store (72 × 50) — the new town shop building (#222). Same timbered-
  // shopfront silhouette as the general store (so it reads as "another town
  // building"), but a rose/plum paint job + a paw-print sign distinguish it as
  // the pet store at a glance. Origin (0.5, 1). ---
  gen(scene, 'petStore', 72, 50, (g) => {
    g.layer('walls');
    // Timbered walls (a warm rose tone, distinct from the general store's tan)
    g.fillStyle(0xc98a96, 1); g.fillRect(4, 18, 64, 28);
    g.fillStyle(0xdca8b2, 1); g.fillRect(4, 18, 64, 4); // lit top band
    g.fillStyle(0x8a4a56, 1); // corner posts
    g.fillRect(4, 18, 4, 28); g.fillRect(64, 18, 4, 28);
    g.layer('roof');
    // Peaked shingle roof
    g.fillStyle(0x4a2c38, 1); g.fillTriangle(0, 18, 36, 2, 72, 18);
    g.fillStyle(0x6a4050, 1);
    for (let x = 4; x < 68; x += 8) g.fillTriangle(x, 17, x + 4, 17 - (18 - Math.abs(x + 4 - 36) * 0.44), x + 8, 17);
    g.layer('sign');
    // Hanging sign — a little paw print, echoing a pet-store icon
    g.fillStyle(0x6a4a28, 1); g.fillRect(34, 20, 4, 6); // post
    g.fillStyle(0x8a6a42, 1); g.fillRoundedRect(24, 24, 24, 10, 2); // sign board
    g.fillStyle(0xf0d8dc, 1); // paw print motif
    g.fillCircle(36, 29, 3);
    g.fillCircle(31, 26, 1.6); g.fillCircle(35, 24, 1.6); g.fillCircle(40, 26, 1.6);
    g.layer('door');
    // Door + window with plum shutters
    g.fillStyle(0x4a3420, 1); g.fillRect(30, 34, 12, 12); // doorway
    g.fillStyle(0x6a4a2e, 1); g.fillRect(30, 34, 12, 2);
    g.fillStyle(0x7a3a5a, 1); // shutters either side of the door
    g.fillRect(10, 34, 8, 12); g.fillRect(54, 34, 8, 12);
    g.fillStyle(0xf0d0da, 1); g.fillRect(11, 35, 6, 6); g.fillRect(55, 35, 6, 6); // window glass
    g.fillStyle(0x5c2c48, 1); g.fillRect(9, 34, 2, 12); g.fillRect(19, 34, 2, 12);
    g.fillRect(53, 34, 2, 12); g.fillRect(63, 34, 2, 12); // shutter frames
    g.layer('base');
    // Base/step
    g.fillStyle(0x8a6a3e, 1); g.fillRect(2, 46, 68, 4);
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

  // --- Kitchen counter (32 × 30) — the crop-processing station (#40): grinds/mashes a
  // basket of raw fruit/grain/veg into jam / flour / pig feed. Origin (0.5, 1). A sturdy
  // wooden counter with a mortar-and-pestle bowl set on top and a cutting board leaning
  // against the front, so it reads as "food prep" distinct from the spinning wheel's
  // fiber-craft silhouette. ---
  gen(scene, 'kitchenCounter', 32, 30, (g) => {
    const WOOD = 0x8a5a2c, WOOD_D = 0x6a4420, WOOD_L = 0xa8763c;
    const STONE = 0x9aa0a8, STONE_L = 0xbcc2ca, STONE_D = 0x767c84;
    // Counter legs
    g.fillStyle(WOOD_D, 1); g.fillRect(4, 22, 4, 8); g.fillRect(24, 22, 4, 8);
    // Counter top slab
    g.fillStyle(WOOD, 1);   g.fillRect(2, 14, 28, 9);
    g.fillStyle(WOOD_L, 1); g.fillRect(2, 14, 28, 2);
    g.fillStyle(WOOD_D, 1); g.fillRect(2, 21, 28, 2);
    // Cutting board leaning on the front face
    g.fillStyle(0xc99a5c, 1); g.fillRoundedRect(5, 23, 8, 6, 1);
    g.fillStyle(0xdcb476, 1); g.fillRect(6, 24, 6, 1);
    // Mortar bowl on the counter top
    const mx = 20, my = 12;
    g.fillStyle(STONE_D, 1); g.fillEllipse(mx, my + 2, 12, 6);
    g.fillStyle(STONE, 1);   g.fillEllipse(mx, my, 11, 5);
    g.fillStyle(STONE_D, 1); g.fillEllipse(mx, my - 1, 8, 3); // inner well
    g.fillStyle(STONE_L, 1); g.fillEllipse(mx - 3, my - 1, 3, 1.4); // rim highlight
    // Pestle resting diagonally in the bowl
    g.fillStyle(WOOD_L, 1); g.fillRect(mx - 2, my - 6, 3, 8);
    g.fillStyle(WOOD, 1);   g.fillCircle(mx - 1, my - 6, 2);
  });

  // --- Slop-maker (28 × 26) — the leftovers sink (#225): a squat metal barrel/bin
  // near the house that grinds junk-tagged leftover dishes into pig slop. Origin
  // (0.5, 1). Reads as a stout metal drum with a hinged lid and a hand-crank on the
  // side, distinct from the kitchen counter's food-prep silhouette and the compost
  // bin's open earthy look. ---
  gen(scene, 'slopMaker', 28, 26, (g) => {
    const METAL = 0x767a72, METAL_D = 0x565a52, METAL_L = 0x9aa096;
    const LID   = 0x4a5048, LID_L = 0x646a5e;
    const WOOD  = 0x8a5a2c, WOOD_D = 0x6a4420;
    // Feet
    g.fillStyle(METAL_D, 1); g.fillRect(4, 22, 4, 3); g.fillRect(20, 22, 4, 3);
    // Barrel body
    g.fillStyle(METAL_D, 1); g.fillRect(3, 8, 22, 15);
    g.fillStyle(METAL, 1);   g.fillRect(3, 8, 22, 13);
    g.fillStyle(METAL_L, 1); g.fillRect(3, 8, 22, 2);
    // Barrel bands
    g.fillStyle(METAL_D, 1); g.fillRect(3, 13, 22, 2); g.fillRect(3, 18, 22, 2);
    // Hinged lid on top
    g.fillStyle(LID, 1);   g.fillRoundedRect(2, 4, 24, 6, 2);
    g.fillStyle(LID_L, 1); g.fillRect(2, 4, 24, 2);
    g.fillStyle(METAL_D, 1); g.fillCircle(14, 5, 1.4); // lid latch
    // Hand-crank on the side, wood handle on a metal arm
    g.fillStyle(METAL_D, 1); g.fillRect(24, 12, 4, 2);
    g.fillStyle(WOOD_D, 1);  g.fillRect(26, 10, 3, 6);
    g.fillStyle(WOOD, 1);    g.fillRect(26, 10, 2, 6);
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
