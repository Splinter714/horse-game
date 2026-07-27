// Town expansion (#222) — a CONTINUOUS eastward extension of the same world/scene
// (no loading screen, no scene swap, unlike the house interior), mirroring the
// riding trail (#36) exactly but on the opposite edge. Walking off the paddock's
// east edge (the old WORLD_W boundary) just keeps going: the camera bounds and
// PLAYER_BOUNDS were already widened in constants.js/player.js, so this mixin only
// needs to build the town's terrain/scenery and its one store building.
//
// The farm-stand customer and neighbor NPC already walk in from the east edge
// (WORLD_W - 20, see paddock/farmStand.js / paddock/neighbor.js) — no change to
// their spawn logic needed; they now narratively read as coming FROM town.
//
// v1 scope (per #222) originally left the general store (#215/#217) in the farm and
// added a separate NEW pet-store building here. #312 (unify all shops into one,
// moved out of the farm) superseded that: the pet store and the general store are
// now the SAME single building (paddock/generalStore.js's buildGeneralStore, called
// below), staffed by the shopkeeper NPC (#244). There's no separate pet-store prop
// or interactable anymore — pets is just another counter in that one building's
// STORE_COUNTERS tabs.
//
// Kept a separate concern file (not grown into world.js, which is already near
// the 500-line budget) so this doesn't collide with other agents editing the
// farm's world.js in parallel — mirrors exactly how trail.js avoided that collision.

import { S, TOWN_X0, TOWN_W, TOWN_Y0, TOWN_Y1 } from './constants.js';
import { bakeStaticGraphics } from './bakeGraphics.js';

// #371: this used to be a flat .setTint() on the whole tileSprite — a hard edge
// exactly at TOWN_X0. Mirrors trail.js's farm/trail gradient-overlay technique
// (BLEND_IN/BLEND_OUT + a Graphics gradient, not a plain setTint) so the
// farm/town boundary fades in instead of snapping on. Town sits EAST of the
// boundary (increasing x), the trail's mirror image, so the blend direction
// is flipped: alpha 0 back on the farm side, full alpha out into town.
const TOWN_TINT = 0xd8cf9e;
const TOWN_FULL_ALPHA = 0.55; // matches trail.js's overlay strength
const TOWN_BLEND_IN = TOWN_X0 - 120;  // still farm side: blend starts here, alpha 0
const TOWN_BLEND_OUT = TOWN_X0 + 420; // well into town: blend finishes here, alpha at full

export const WithTown = (Base) => class extends Base {
  buildTown() {
    // Town ground — a warmer, slightly dustier tint than the farm's grass reads as
    // "a little street/square" without needing a new tileset; reuses the existing
    // grass texture tiled across the extension band (mirrors buildTrail's tinting).
    // Plain (untinted) base layer — the tint is applied by the gradient overlay
    // below instead of a uniform .setTint(), so the transition fades in.
    const top = TOWN_Y0 - 40, bandH = (TOWN_Y1 - TOWN_Y0) + 80;
    this.add.tileSprite(TOWN_X0, top, TOWN_W, bandH, 'grass')
      .setOrigin(0, 0).setTileScale(S, S).setDepth(-100);

    // Smooth tint blend (mirrors buildTrail's gradient overlay): fades the
    // town tint in from 0 alpha at TOWN_BLEND_IN (still on the farm side) to
    // full alpha at TOWN_BLEND_OUT (well into town), then a flat full-alpha
    // fill covers the rest of town out to its far edge. Reads as a gradual
    // color shift instead of a hard line at TOWN_X0.
    const tintG = this.add.graphics().setDepth(-99);
    // Rect spans x ∈ [TOWN_BLEND_IN, TOWN_BLEND_OUT]: left edge (farm side) is
    // zero alpha, right edge (deeper into town) is full alpha — the mirror of
    // trail.js's left/right assignment, since town blends in the +x direction.
    tintG.fillGradientStyle(TOWN_TINT, TOWN_TINT, TOWN_TINT, TOWN_TINT, 0, TOWN_FULL_ALPHA, 0, TOWN_FULL_ALPHA);
    tintG.fillRect(TOWN_BLEND_IN, top, TOWN_BLEND_OUT - TOWN_BLEND_IN, bandH);
    tintG.fillStyle(TOWN_TINT, TOWN_FULL_ALPHA);
    tintG.fillRect(TOWN_BLEND_OUT, top, (TOWN_X0 + TOWN_W) - TOWN_BLEND_OUT, bandH);

    // A worn path leading off the farm's east edge into town, so the transition
    // reads as "the street continues from here" (mirrors the trail's dirt path).
    const g = this.add.graphics().setDepth(-95);
    const midY = (TOWN_Y0 + TOWN_Y1) / 2;
    const pts = [];
    for (let x = TOWN_X0 - 60; x <= TOWN_X0 + TOWN_W - 40; x += 40) {
      const wobble = 18 * Math.sin(x / 150);
      pts.push([x, midY + wobble]);
    }
    const stamp = (radius, color, alpha) => {
      g.fillStyle(color, alpha);
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        const dist = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.max(1, Math.ceil(dist / (radius * 0.5)));
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          g.fillCircle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius);
        }
      }
    };
    stamp(26, 0x9a8a5c, 0.85);
    stamp(18, 0xc9bb86, 0.9);

    // Static once stamped — bake the street into a texture (#325).
    bakeStaticGraphics(this, g, pts, 30, -95);

    // Scenery: a scattering of trees + flowers along the street so it still feels
    // like the same world's palette (reusing the trail's tree/flower textures).
    const trees = [
      [TOWN_X0 + 620, 260], [TOWN_X0 + 760, 460], [TOWN_X0 + 120, 320], [TOWN_X0 + 40, 900],
      [TOWN_X0 + 820, 780], [TOWN_X0 + 480, 900], [TOWN_X0 + 700, 900], [TOWN_X0 + 860, 300],
    ];
    // Tracked in props (#329 follow-up) so the dev object-label/drag tools
    // (#329/#330) can see and reposition each tree — mirrors the same fix in
    // trail.js's buildTrail. Shares the `trees` bucket with the trail's trees;
    // each carries its own distinguishing label so the two sets don't collide.
    (this.props.trees ??= []);
    for (const [i, [x, y]] of trees.entries()) {
      const sprite = this.add.image(x, y, 'trailTree').setScale(S).setDepth(y).setOrigin(0.5, 1);
      this.props.trees.push({ x, y, sprite, label: `Town Tree ${i + 1}` });
    }

    const flowers = ['flowerRed', 'flowerYellow', 'flowerWhite'];
    const flowerSpots = [
      [TOWN_X0 + 100, 560], [TOWN_X0 + 220, 780], [TOWN_X0 + 380, 340], [TOWN_X0 + 560, 620],
      [TOWN_X0 + 640, 800], [TOWN_X0 + 780, 600], [TOWN_X0 + 860, 460],
    ];
    flowerSpots.forEach(([x, y], i) => {
      this.add.image(x, y, flowers[i % flowers.length]).setScale(S).setDepth(y);
    });

    // A simple marker at the town's mouth (the farm side) so the entrance reads
    // clearly from the paddock, mirroring the trail's entrance marker.
    this.props.townEntrance = { x: TOWN_X0 - 20, y: midY };

    // The unified store (#312) — the one shop building for the whole game, moved
    // out of the farm into town. Builds its prop/obstacles/shopkeeper; see
    // paddock/generalStore.js for buildGeneralStore/openGeneralStore. Its
    // interactable descriptor lives in paddock/interactables.js's `generalStore`
    // (unchanged since #215) — no town-specific interactable needed anymore now
    // that the pet store isn't a separate building.
    this.buildGeneralStore();
  }
};
