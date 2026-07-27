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

import { S, TOWN_X0, TOWN_W, TOWN_Y0, TOWN_Y1, PLAYER_BOUNDS } from './constants.js';

// #381: town used to carry its own warm ground tint (originally a flat
// .setTint(), then a gradient-overlay blend added by #371 to soften the
// farm/town seam). After several rounds chasing that seam, the owner's call
// was to drop per-region ground tinting entirely rather than keep fixing
// blend edges — town's ground is now plain grass, same as the farm.

export const WithTown = (Base) => class extends Base {
  buildTown() {
    // Town ground — plain grass, same texture/tiling as the farm (no tint
    // layer; see file header). Reuses the existing grass texture tiled
    // across the extension band. Spans the full PLAYER_BOUNDS Y-range (not
    // just TOWN_Y0/Y1, which only bound where town's CONTENT sits) so there's
    // no textureless gap north/south of town where the player can still walk.
    const top = PLAYER_BOUNDS.minY, bandH = PLAYER_BOUNDS.maxY - PLAYER_BOUNDS.minY;
    this.add.tileSprite(TOWN_X0, top, TOWN_W, bandH, 'grass')
      .setOrigin(0, 0).setTileScale(S, S).setDepth(-100);

    const midY = (TOWN_Y0 + TOWN_Y1) / 2;

    // Scenery: a scattering of trees along the street so it still feels
    // like the same world's palette (reusing the trail's tree texture).
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
